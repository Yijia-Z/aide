import { useState, useCallback, useRef } from 'react';
import { Thread, Message, Model, KeyInfo } from '@/components/types';
import { useToast } from './use-toast';
import { useMessagesMutation } from './use-messages-mutation';
import { storage } from '@/components/store';

interface UseAIGenerationProps {
    threads: Thread[];
    models: Model[];
    selectedModels: string[];
    findMessageById: (messages: Message[], id: string) => Message | null;
    updateMessageContent: (threadId: string, messageId: string, newContent: string | any[]) => void;
    setActiveTab: (tab: "threads" | "messages" | "models" | "tools" | "settings") => void;
    isSignedIn: boolean;
    reloadUserProfile: () => Promise<void>;
}

export function useAIGeneration({
    threads,
    models,
    selectedModels,
    findMessageById,
    updateMessageContent,
    setActiveTab,
    isSignedIn,
    reloadUserProfile
}: UseAIGenerationProps) {
    const { toast } = useToast();
    const { addMessage } = useMessagesMutation();
    const [isGenerating, setIsGenerating] = useState<{ [key: string]: boolean }>({});
    const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
    const abortControllersRef = useRef<Record<string, AbortController | null>>({});

    // Refresh usage information
    const refreshUsage = useCallback(async (userKey: string) => {
        if (!userKey) return;
        try {
            const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${userKey}`,
                },
            });
            if (!res.ok) {
                throw new Error(`Key usage fetch failed. HTTP ${res.status}`);
            }
            const data = await res.json();
            setKeyInfo(data); // Update state for SettingsPanel
        } catch (err) {
            console.error("refreshUsage error:", err);
            setKeyInfo(null);
        }
    }, []);

    // Generate AI reply
    const generateAIReply = useCallback(
        async (threadId: string, messageId: string, count: number = 1) => {
            const userKey = storage.get("openrouter_api_key") || "";
            if (isGenerating[messageId]) {
                console.log("Second click => Stop for messageId=", messageId);
                const controller = abortControllersRef.current[messageId];
                if (controller) {
                    controller.abort();
                }
                abortControllersRef.current[messageId] = null;
                setIsGenerating((prev) => ({ ...prev, [messageId]: false }));
                return;
            }

            const thread = threads.find((t: { id: string }) => t.id === threadId);
            if (!thread) return;

            const message = findMessageById(thread.messages, messageId);
            if (!message) return;

            const selectedModelIds = selectedModels;
            if (selectedModelIds.length === 0) {
                if (models.length > 0) {
                    toast({
                        title: "No Model Selected",
                        description: "First available model has been automatically selected.",
                    });
                    setActiveTab("models");
                    const firstModelId = models[0].id;
                    selectedModels.push(firstModelId);
                } else {
                    toast({
                        title: "No Model Selected",
                        description: "Please select a model in Models tab to proceed.",
                        variant: "destructive"
                    });
                    setActiveTab("models");
                    return;
                }
            }

            try {
                for (let i = 0; i < count; i++) {
                    const promises = selectedModelIds.map(async (modelId) => {
                        const model = models.find((m) => m.id === modelId);
                        if (!model) return;

                        if (!isSignedIn && !model.baseModel.endsWith(":free")) {
                            toast({
                                title: "Authentication Required",
                                description: `Sign in to use ${model.baseModel}`,
                                variant: "destructive"
                            });
                            return;
                        }

                        const messageAbortController = new AbortController();
                        abortControllersRef.current[messageId] = messageAbortController;

                        setIsGenerating((prev) => ({ ...prev, [messageId]: true }));

                        try {
                            await addMessage.mutateAsync({
                                threadId,
                                parentId: messageId,
                                publisher: "ai",
                                content: "",
                                modelConfig: {
                                    id: model.id,
                                    name: model.name,
                                    baseModel: model.baseModel,
                                    systemPrompt: model.systemPrompt,
                                    parameters: model.parameters,
                                },
                                generateAIResponse: {
                                    model,
                                    userKey,
                                    abortController: messageAbortController,
                                    onChunk: (chunk) => {
                                        updateMessageContent(threadId, messageId, chunk);
                                    }
                                }
                            });

                            if (userKey) {
                                await refreshUsage(userKey);
                            } else {
                                await reloadUserProfile();
                            }
                        } catch (error) {
                            console.error("Failed to generate AI response:", error);
                            toast({
                                title: "Generation Failed",
                                description: error instanceof Error ? error.message : "Unknown error occurred",
                                variant: "destructive"
                            });
                        } finally {
                            setIsGenerating((prev) => ({ ...prev, [messageId]: false }));
                            abortControllersRef.current[messageId] = null;
                        }
                    });
                    await Promise.all(promises);
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') {
                    // Generation aborted
                } else {
                    console.error("Failed to generate AI response:", error);
                }
            }
        },
        [
            toast,
            threads,
            models,
            selectedModels,
            findMessageById,
            updateMessageContent,
            isGenerating,
            isSignedIn,
            reloadUserProfile,
            refreshUsage,
            addMessage,
            setActiveTab
        ]
    );

    // Get model details
    const getModelDetails = useCallback((modelId: string | undefined) => {
        if (!modelId) return null;
        const model = models.find((m) => m.id === modelId);
        if (!model) return null;
        return {
            name: model.name,
            baseModel: model.baseModel.split("/").pop(),
            temperature: model.parameters.temperature,
            maxTokens: model.parameters.max_tokens,
            systemPrompt: model.systemPrompt,
            tools: model.parameters.tools
        };
    }, [models]);

    return {
        isGenerating,
        keyInfo,
        refreshUsage,
        generateAIReply,
        getModelDetails,
        abortControllersRef
    };
} 