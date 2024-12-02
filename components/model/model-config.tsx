import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Trash, Sparkles, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SelectBaseModel } from "@/components/model/model-selector";
import { Model, ModelParameters, Tool } from "@/components/types";
import { Badge } from "@/components/ui/badge";

interface ModelConfigProps {
  models: Model[];
  selectedModel: string | null;
  editingModel: Model | null;
  setSelectedModel: (modelId: string) => void;
  setEditingModel: (model: Model | null) => void;
  addNewModel: () => void;
  handleModelChange: (
    field: keyof Model,
    value: string | number | Partial<ModelParameters> | Tool[]
  ) => void;
  saveModelChanges: () => void;
  deleteModel: (modelId: string) => void;
  fetchAvailableModels: () => Promise<any>;
  fetchModelParameters: (modelId: string) => Promise<any>;
  availableTools: Tool[];
}

const ModelConfig: React.FC<ModelConfigProps> = ({
  models,
  selectedModel,
  editingModel,
  setSelectedModel,
  setEditingModel,
  addNewModel,
  handleModelChange,
  saveModelChanges,
  deleteModel,
  fetchAvailableModels,
  fetchModelParameters,
  availableTools,
}) => {

  return (
    <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
      <div
        className="top-bar bg-gradient-to-b from-background/100 to-background/00"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <Select
          value={selectedModel ?? models[0]?.id}
          onValueChange={setSelectedModel}
        >
          <SelectTrigger className="custom-shadow transition-scale-zoom">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent className="custom-shadow">
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
          size="default"
          onClick={addNewModel}
        >
          <Sparkles className="h-4 w-4" />
          <span className="ml-2 hidden md:inline">New Model</span>
        </Button>
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
                className={`group p-2 rounded-md mb-2
                  ${editingModel?.id !== model.id ? 'md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)] bg-background cursor-pointer' : 'custom-shadow'}
                `}
              >
                <div className={`${editingModel?.id !== model.id ? 'flex justify-between items-start' : ''}`}>
                  <div>
                    <div
                      className="flex cursor-pointer justify-between items-center"
                      onDoubleClick={() => {
                        if (editingModel?.id === model.id) {
                          setEditingModel(null);
                        }
                      }}
                    >
                      <h3 className="font-bold">{model.name}</h3>
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
                        <div className="flex justify-between items-center mt-2">
                          <div className="space-x-2 text-foreground">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={saveModelChanges}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingModel(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteModel(model.id)}
                            disabled={models.length === 1}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
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
                          <p>
                            {(
                              <span className="flex flex-wrap gap-1">
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
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {editingModel?.id !== model.id && (
                    <Button
                      variant="ghost"
                      className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      size="default"
                      onClick={() => setEditingModel(model)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
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
