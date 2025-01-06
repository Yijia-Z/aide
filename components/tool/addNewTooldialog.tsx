import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
// 你可能还会用到 Icon，比如 Trash, Plus, etc.:
import { Trash2, Plus } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
// “ToolParameter”仅用于前端表单
interface ToolParameter {
  id: string;                  // 前端用的唯一id, 方便做列表 key
  fieldName: string;           // e.g. "location"
  type: string;                // e.g. "string", "number"
  description: string;         // e.g. "The city and state..."
  required: boolean;           // 是否必填
  enumValues: string[];        // 若 type=string, 可能有 enum
}

interface AddNewToolDialogProps {
  onSaveTool: (tool: any) => void;
}

/**
 * AddNewToolDialog - “添加新Tool”的对话框组件
 */
export function addNewToolDialog({ onSaveTool }: AddNewToolDialogProps) {
  const [open, setOpen] = useState(false);

  // 基本字段
  const [toolName, setToolName] = useState("");
  const [toolDesc, setToolDesc] = useState("");
  const [toolType, setToolType] = useState("function");

  // parameters
  const [parameters, setParameters] = useState<ToolParameter[]>([]);

  // 添加一个空的 parameter
  const handleAddParameter = () => {
    const newId=uuidv4();
    setParameters((prev) => [
      ...prev,
      {
        id: newId,
        fieldName: "",
        type: "string",
        description: "",
        required: false,
        enumValues: [],
      },
    ]);
  };

  // 删除某一个 parameter
  const handleRemoveParameter = (id: string) => {
    setParameters((prev) => prev.filter((p) => p.id !== id));
  };

  // 更新 parameter
  const handleChangeParameter = (id: string, field: Partial<ToolParameter>) => {
    setParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...field } : p))
    );
  };

  // 组装最终结构
  const handleSave = () => {
    // 先组装 properties 与 required
    const properties: Record<string, any> = {};
    const requiredFields: string[] = [];

    parameters.forEach((param) => {
      properties[param.fieldName] = {
        type: param.type,            // e.g. "string"
        description: param.description,
      };
      if (param.enumValues.length > 0) {
        // 仅当有 enumValues 时，才写 enum
        properties[param.fieldName].enum = param.enumValues;
      }
      if (param.required) {
        requiredFields.push(param.fieldName);
      }
    });

    // 组装完成后的 “tool” 对象
    const newTool = {
      name: toolName,
      description: toolDesc,
      type: toolType, // e.g. "function"
      function: {
        name: toolName,
        description: toolDesc,
        parameters: {
          type: "object",
          properties,
          required: requiredFields,
        },
      },
    };

    onSaveTool(newTool);
    setOpen(false);
    // 重置表单
    setToolName("");
    setToolDesc("");
    setToolType("function");
    setParameters([]);
  };

  return (
    <div>
      {/* 触发按钮，可以放到ToolManager里 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" className="flex gap-1 items-center">
            <Plus className="w-4 h-4" />
            Add New Tool
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-xl bg-background">
          <DialogHeader>
            <DialogTitle>Add New Tool</DialogTitle>
            <DialogDescription>
              Fill in the fields below to define a new Tool.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            {/* Tool Basic Info */}
            <div className="space-y-2 mb-4">
              <Label>Tool Name</Label>
              <Input
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="e.g. get_current_weather"
              />
              <Label>Description</Label>
              <Textarea
                value={toolDesc}
                onChange={(e) => setToolDesc(e.target.value)}
                placeholder="What does this tool do?"
              />
              <Label>Tool Type</Label>
              <Input
                value={toolType}
                onChange={(e) => setToolType(e.target.value)}
                placeholder="default is 'function'"
              />
            </div>

            {/* Parameters List */}
            <div className="my-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">Parameters</h3>
                <Button variant="outline" size="sm" onClick={handleAddParameter}>
                  <Plus className="w-4 h-4" />
                  Add Parameter
                </Button>
              </div>

              <div className="space-y-3">
                {parameters.map((param) => (
                  <motion.div
                    key={param.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="border rounded-md p-3 relative"
                  >
                    {/* Delete btn */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1"
                      onClick={() => handleRemoveParameter(param.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>

                    <Label className="mt-2">Field Name</Label>
                    <Input
                      value={param.fieldName}
                      onChange={(e) =>
                        handleChangeParameter(param.id, {
                          fieldName: e.target.value,
                        })
                      }
                      placeholder="e.g. location"
                      className="mb-2"
                    />

                    <Label>Type</Label>
                    <Input
                      value={param.type}
                      onChange={(e) =>
                        handleChangeParameter(param.id, { type: e.target.value })
                      }
                      placeholder='e.g. "string", "number", "boolean"'
                      className="mb-2"
                    />

                    <div className="flex items-center gap-2 mb-2">
                      <Label className="whitespace-nowrap mb-0">Required?</Label>
                      <input
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) =>
                          handleChangeParameter(param.id, {
                            required: e.target.checked,
                          })
                        }
                      />
                    </div>

                    <Label>Description</Label>
                    <Textarea
                      value={param.description}
                      onChange={(e) =>
                        handleChangeParameter(param.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder="Parameter usage description."
                      className="mb-2"
                    />

                    {/* If type=string, can show enum */}
                    {param.type === "string" && (
                      <div className="border-t pt-2 mt-2">
                        <Label>Enum Values (optional)</Label>
                        <small className="block mb-1 text-muted-foreground">
                          Comma-separated values if you want to restrict the possible strings.
                        </small>
                        <Input
                          value={param.enumValues.join(",")}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const arr = raw
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean);
                            handleChangeParameter(param.id, { enumValues: arr });
                          }}
                          placeholder='e.g. "celsius,fahrenheit"'
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
