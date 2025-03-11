import { useCallback } from 'react';
import { Model } from '@/components/types';
import { storage } from '@/components/store';
import { v4 as uuidv4 } from 'uuid';
import React from 'react';

interface UseModelUtilsProps {
    models: Model[];
    setModels: (value: Model[] | ((prev: Model[]) => Model[])) => void;
    setEditingModel: React.Dispatch<React.SetStateAction<Model | null>>;
    selectedModels: string[];
    setSelectedModels: (value: string[] | ((prev: string[]) => string[])) => void;
    setAvailableModels: (value: any[]) => void;
}

export function useModelUtils({
    models,
    setModels,
    setEditingModel,
    selectedModels,
    setSelectedModels,
    setAvailableModels
}: UseModelUtilsProps) {
    // Fetch available models from the API or cache
    const fetchAvailableModels = useCallback(async () => {
        try {
            const cachedModels = storage.get("availableModels");
            const lastFetchTime = storage.get("lastFetchTime");
            const currentTime = Date.now();

            // If cached models exist and were fetched less than an hour ago, use them
            if (
                cachedModels &&
                lastFetchTime &&
                currentTime - parseInt(lastFetchTime) < 3600000
            ) {
                const modelData = cachedModels;
                setAvailableModels(modelData);
                return modelData;
            }

            // Fetch from API if no valid cache is found
            const response = await fetch("https://openrouter.ai/api/v1/models", {
                method: "GET",
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(
                    "Failed to fetch available models from OpenRouter:",
                    errorText
                );
                throw new Error("Failed to fetch available models from OpenRouter");
            }

            const data = await response.json();

            if (!data.data) {
                console.error('Response data does not contain "data" key.');
                throw new Error("Invalid response format from OpenRouter");
            }

            const modelData = data.data.map((model: any) => {
                const maxOutput =
                    model.top_provider?.max_completion_tokens ??
                    model.context_length ??
                    9999;
                return {
                    id: model.id,
                    name: model.name,
                    baseModel: model.id,
                    systemPrompt: "",
                    parameters: {
                        top_p: 1,
                        temperature: 0.7,
                        frequency_penalty: 0,
                        presence_penalty: 0,
                        top_k: 0,
                        max_tokens: maxOutput, // Set initial max_tokens to maxOutput
                        max_output: maxOutput, // Include max_output in the parameters
                    },
                };
            });

            // Cache the fetched models and update the fetch time
            storage.set("availableModels", modelData);
            storage.set("lastFetchTime", currentTime.toString());

            setAvailableModels(modelData);
            return modelData;
        } catch (error) {
            console.error("Error fetching available models:", error);
            return [];
        }
    }, [setAvailableModels]);

    // Fetch model parameters
    const fetchModelParameters = useCallback(async (modelId: string) => {
        try {
            const response = await fetch(
                `/api/model-parameters?modelId=${encodeURIComponent(modelId)}`
            );
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch model parameters: ${response.status} ${response.statusText}`
                );
            }
            const data = await response.json();

            // Find the corresponding model in availableModels to get the max_output
            const availableModels = storage.get("availableModels") || [];
            const selectedModel = availableModels.find(
                (model: any) => model.id === modelId
            );
            if (selectedModel && selectedModel.parameters?.max_output) {
                data.max_output = selectedModel.parameters.max_output;
            }
            console.log("fetch model parameter: ", data);
            return data;
        } catch (error) {
            console.error("Error fetching model parameters:", error);
            throw error;
        }
    }, []);

    // Change the model
    const handleModelChange = useCallback(
        (field: keyof Model, value: string | number | Partial<Model['parameters']> | any[]) => {
            setEditingModel((prevModel) => {
                if (!prevModel) return prevModel;
                if (field === "parameters") {
                    return {
                        ...prevModel,
                        parameters: {
                            ...prevModel.parameters,
                            ...(value as Partial<Model['parameters']>),
                        },
                    };
                }
                return { ...prevModel, [field]: value };
            });
        },
        [setEditingModel]
    );

    // Save model changes
    const saveModelChanges = useCallback(async () => {
        setEditingModel((editingModel) => {
            if (editingModel) {
                const updatedModel = {
                    ...editingModel,
                    parameters: {
                        ...editingModel.parameters,
                        tools: editingModel.parameters?.tools || [],
                        tool_choice: editingModel.parameters?.tool_choice || "none"
                    }
                };

                setModels((prev) =>
                    prev.map((model) => model.id === editingModel.id ? updatedModel : model)
                );

                // Update model in backend
                (async () => {
                    try {
                        const res = await fetch(`/api/models/${editingModel.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: updatedModel.name,
                                baseModel: updatedModel.baseModel,
                                systemPrompt: updatedModel.systemPrompt,
                                parameters: updatedModel.parameters,
                            }),
                        });
                        if (!res.ok) {
                            throw new Error(`Failed to update model ${editingModel.id}`);
                        }
                    } catch (err) {
                        console.error("[saveModelChanges] error =>", err);
                    }
                })();
            }
            return null;
        });
    }, [setEditingModel, setModels]);

    // Delete model
    const deleteModel = useCallback(
        async (id: string) => {
            // Save current state for rollback if needed
            const oldModels = structuredClone(models);
            const oldSelected = [...selectedModels];

            // Update frontend state
            setModels((prev) => prev.filter((model) => model.id !== id));
            if (selectedModels.includes(id)) {
                const newSelected = selectedModels.filter((mid) => mid !== id);
                setSelectedModels(newSelected);
            }

            // Delete from backend
            try {
                const res = await fetch(`/api/models/${id}`, { method: "DELETE" });
                if (!res.ok) {
                    throw new Error(`Server fail, status = ${res.status}`);
                }
                console.log(`[deleteModel] success => removed from backend`);
            } catch (err) {
                console.error(`[deleteModel] error =>`, err);
                // Rollback frontend state if backend fails
                setModels(oldModels);
                setSelectedModels(oldSelected);
            }
        },
        [models, selectedModels, setModels, setSelectedModels]
    );

    // Add new model
    const addNewModel = useCallback(async (modelToClone?: Model) => {
        const newId = uuidv4();
        const newModel: Model = modelToClone ? {
            ...modelToClone,
            id: newId,
            name: `${modelToClone.name}`
        } : {
            id: newId,
            name: "New Model",
            baseModel: "none",
            systemPrompt: "You are a helpful assistant.",
            parameters: {
                temperature: 1,
                top_p: 1,
                max_tokens: 2000,
            },
        };

        // Optimistically add to frontend
        setModels((prev) => [...prev, newModel]);

        try {
            // Add to backend
            const response = await fetch("/api/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: newModel }),
            });

            if (!response.ok) {
                throw new Error("Failed to create new model");
            }

            const data = await response.json();
            setEditingModel(newModel);
            console.log("[addNewModel] server created =>", data.model);
        } catch (err) {
            console.error("[addNewModel] error =>", err);

            // Rollback if backend fails
            setModels((prev) => prev.filter((m) => m.id !== newId));
            setEditingModel(null);
        }
    }, [setModels, setEditingModel]);

    // Create default model
    const createDefaultModel = useCallback((): Model => {
        return {
            id: uuidv4(),
            name: "Default",
            baseModel: "openai/gpt-4o-mini",
            systemPrompt: "Answer concisely.",
            parameters: {
                temperature: 0,
                top_p: 1,
                max_tokens: 1000,
            },
        };
    }, []);

    return {
        fetchAvailableModels,
        fetchModelParameters,
        handleModelChange,
        saveModelChanges,
        deleteModel,
        addNewModel,
        createDefaultModel
    };
} 