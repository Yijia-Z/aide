/**
 * ModelConfig component props interface.
 * 
 * @interface ModelConfigProps
 * @property {Model[]} models - List of available models.
 * @property {string[]} selectedModels - List of selected model IDs.
 * @property {Model | null} editingModel - The model currently being edited.
 * @property {(modelIds: string[]) => void} setSelectedModels - Function to set selected models.
 * @property {(model: Model | null) => void} setEditingModel - Function to set the model being edited.
 * @property {() => void} addNewModel - Function to add a new model.
 * @property {(field: keyof Model, value: string | number | Partial<ModelParameters> | Tool[]) => void} handleModelChange - Function to handle changes to the model fields.
 * @property {() => void} saveModelChanges - Function to save changes to the model.
 * @property {(modelId: string) => void} deleteModel - Function to delete a model.
 * @property {() => Promise<any>} fetchAvailableModels - Function to fetch available models.
 * @property {(modelId: string) => Promise<any>} fetchModelParameters - Function to fetch parameters for a specific model.
 * @property {Tool[]} availableTools - List of available tools.
 */

/**
 * ModelConfig component.
 * 
 * This component renders a configuration interface for managing models. It allows users to select, edit, add, and delete models.
 * 
 * @component
 * @param {ModelConfigProps} props - The props for the ModelConfig component.
 * @returns {JSX.Element} The rendered ModelConfig component.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Trash, Sparkles, Edit, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { SelectBaseModel } from "@/components/model/model-selector";
import { Model, ModelParameters, Tool } from "@/components/types";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "./multi-select";
import { v4 as uuidv4 } from 'uuid';

interface ModelConfigProps {
  models: Model[];
  selectedModels: string[];
  editingModel: Model | null;
  setSelectedModels: (modelIds: string[]) => void;
  setEditingModel: (model: Model | null) => void;
  addNewModel: (model?: Model) => void;
  handleModelChange: (
    field: keyof Model,
    value: string | number | Partial<ModelParameters> | Tool[]
  ) => void;
  saveModelChanges: () => void;
  deleteModel: (modelId: string) => void;
  fetchAvailableModels: () => Promise<any>;
  fetchModelParameters: (modelId: string) => Promise<any>;
  availableTools: Tool[];
  isSignedIn?: boolean;
}

const ModelConfig: React.FC<ModelConfigProps> = ({
  models,
  selectedModels,
  editingModel,
  setSelectedModels,
  setEditingModel,
  addNewModel,
  handleModelChange,
  saveModelChanges,
  deleteModel,
  fetchAvailableModels,
  fetchModelParameters,
  availableTools,
  isSignedIn
}) => {
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
      <div
        className="top-bar h-14 bg-gradient-to-b from-background/100 to-background/00 flex items-center justify-between"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <h2 className="text-4xl font-serif font-bold pl-2">Models</h2>
        <div className="flex items-center gap-2 absolute top-0 right-0">
          <MultiSelect
            options={models.map(model => ({
              value: model.id,
              label: model.name
            }))}
            onValueChange={(values) => setSelectedModels(values)}
            defaultValue={selectedModels}
            placeholder="⚠ None"
            variant="secondary"
            className="custom-shadow"
            maxCount={0}
          />
          <Button
            className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
            size="default"
            onClick={(e) => addNewModel()}
          >
            <Sparkles className="h-4 w-4" />
            <span className="ml-2 hidden lg:inline">New Model</span>
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-grow">
        <AnimatePresence>
          <motion.div className="flex-grow overflow-y-visible mt-2">
            {models.map((model) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={editingModel?.id !== model.id ? { y: -2 } : undefined}
                onDoubleClick={() => {
                  if (editingModel?.id != model.id) {
                    setEditingModel(model);
                  }
                }}
                className={`group p-2 rounded-lg mb-2
                  ${editingModel?.id !== model.id ? 'md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)] bg-background cursor-pointer' : 'custom-shadow'}
                `}
              >
                <div className={`${editingModel?.id !== model.id ? 'flex-grow justify-between items-start' : ''}`}>
                  <div>
                    <div
                      className="flex cursor-pointer items-start"
                      onDoubleClick={() => {
                        if (editingModel?.id === model.id) {
                          setEditingModel(null);
                        }
                      }}
                    >
                      <h3 className="font-bold text-xl flex-grow">{model.name}</h3>
                      {editingModel?.id !== model.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const clonedModel = {
                                ...model,
                                id: uuidv4(),
                                name: `${model.name} 📋️`,
                              };
                              addNewModel(clonedModel);
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            size="sm"
                            onClick={() => setEditingModel(model)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-x-2 flex justify-end">
                          <Button
                            className="transition-scale-zoom"
                            size="sm"
                            variant="outline"
                            onClick={saveModelChanges}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            className="transition-scale-zoom"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingModel(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {editingModel?.id === model.id ? (
                      <div className="text-muted-foreground">
                        <div className="pb-1">
                          <Label>Name</Label>
                        </div>
                        <Input
                          id={`model-title-${model.id}`}
                          className="min-font-size text-foreground"
                          value={editingModel?.name}
                          onChange={(e) =>
                            handleModelChange("name", e.target.value)
                          }
                        />
                        <div className="py-1">
                          <Label>Base Model</Label>
                        </div>
                        <SelectBaseModel
                          value={editingModel.baseModel}
                          onValueChange={(value, parameters) => {
                            handleModelChange("baseModel", value);
                            handleModelChange(
                              "parameters",
                              parameters as Partial<ModelParameters>
                            );
                          }}
                          availableTools={availableTools}
                          fetchAvailableModels={fetchAvailableModels}
                          fetchModelParameters={fetchModelParameters}
                          existingParameters={editingModel.parameters}
                          isSignedIn={isSignedIn}
                        />
                        <div className="py-1">
                          <Label>System Prompt</Label>
                        </div>
                        <Textarea
                          id={`model-textarea-${model.id}`}
                          className="min-font-size text-foreground"
                          value={editingModel?.systemPrompt}
                          onChange={(e) =>
                            handleModelChange("systemPrompt", e.target.value)
                          }
                        />
                        <div className="flex justify-end items-center mt-2 space-x-2">
                          {confirmDelete === model.id ? (
                            <>
                              <Button
                                className="transition-scale-zoom"
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  deleteModel(model.id);
                                  setConfirmDelete(null);
                                }}
                                disabled={models.length === 1}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                className="transition-scale-zoom text-primary"
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDelete(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              className="transition-scale-zoom"
                              variant="destructive"
                              size="sm"
                              onClick={() => setConfirmDelete(model.id)}
                              disabled={models.length === 1}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm" >
                        <p>
                          <span className="text-muted-foreground">
                            Base Model:
                          </span>{" "}
                          {model.baseModel.split("/").pop()}
                        </p>
                        {model.parameters?.supported_parameters?.includes("temperature") && (
                          <p>
                            <span className="text-muted-foreground">
                              Temperature:
                            </span>{" "}
                            {model.parameters.temperature}
                          </p>
                        )}
                        {model.parameters?.supported_parameters?.includes("max_tokens") && (
                          <p>
                            <span className="text-muted-foreground">
                              Max Tokens:
                            </span>{" "}
                            {model.parameters.max_tokens}
                          </p>
                        )}
                        {model.parameters?.tools && model.parameters.tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {model.parameters.tools
                              .filter(tool => availableTools.some(availableTool => availableTool.function.name === tool.function.name))
                              .map((tool) => (
                                <Badge
                                  key={tool.function.name}
                                  variant={model.parameters.tool_choice === 'auto' ? 'outline' : model.parameters.tool_choice === 'none' ? 'outline' : 'secondary'}
                                  className={`flex items-center gap-2 ${model.parameters.tool_choice === 'none' ? 'text-muted-foreground line-through' : ''}`}
                                >
                                  {tool.function.name}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
};

export default ModelConfig;
