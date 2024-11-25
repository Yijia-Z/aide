import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Trash, Sparkles } from "lucide-react";
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
    <div className="flex flex-col relative  h-[calc(97vh)] overflow-clip select-none">
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
                whileHover={{
                  boxShadow: "inset 0px 0px 10px rgba(128, 128, 128, 0.2)",
                  transition: { duration: 0.2 },
                }}
                className="p-2 border rounded-md mb-2 custom-shadow"
              >
                <div>
                  <div
                    className="flex cursor-pointer justify-between items-center pb-2"
                    onDoubleClick={() => {
                      if (editingModel?.id === model.id) {
                        setEditingModel(null);
                      }
                      else setEditingModel(model)
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
                    <div
                      onDoubleClick={() => {
                        if (editingModel?.id === model.id) {
                          setEditingModel(null);
                        }
                        else setEditingModel(model)
                      }}
                      className="text-sm cursor-pointer"
                    >
                      <p>
                        <span className="text-muted-foreground">
                          Base Model:
                        </span>{" "}
                        {model.baseModel.split("/").pop()}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Temperature:
                        </span>{" "}
                        {model.parameters.temperature}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Max Tokens:
                        </span>{" "}
                        {model.parameters.max_tokens}
                      </p>
                    </div>
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
