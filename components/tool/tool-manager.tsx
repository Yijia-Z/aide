"use client";

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, PackagePlus, Check, X, Trash, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Model } from "@/components/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";

// Tool类型可根据后端结构而定
interface Tool {
  id: string;
  type: string;
  name: string;
  description: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required: string[];
    };
  };
}

interface ToolManagerProps {
  /** 后端返回的所有工具（大列表） */
  tools: Tool[];
  setTools: React.Dispatch<React.SetStateAction<Tool[]>>;
  availableTools: Tool[];
  setAvailableTools: (tools: Tool[]) => void;
  setModels: React.Dispatch<React.SetStateAction<Model[]>>;
  isLoading: boolean;
  error: string;
}

export function ToolManager({
  tools,
  setTools,
  availableTools,
  setAvailableTools,
  isLoading,
  error,
  setModels,
}: ToolManagerProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Partial<Tool> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleAddTool = useCallback(
    async (tool: Tool) => {
      setAvailableTools([...availableTools, tool]);
      try {
        const res = await fetch(`/api/availableTools/${tool.id}`, {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error(`Add tool failed => status = ${res.status}`);
        }
      } catch (err) {
        console.error("[handleAddTool]", err);
        toast({
          title: "Error",
          description: "Failed to add tool",
          variant: "destructive"
        });
        setAvailableTools(
          availableTools.filter((t) => t.id !== tool.id)
        );
      }
    },
    [toast, availableTools, setAvailableTools]
  );

  const handleRemoveTool = useCallback(
    async (tool: Tool) => {
      setAvailableTools(
        availableTools.filter((t) => t.id !== tool.id)
      );
      try {
        const res = await fetch(`/api/availableTools/${tool.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(`Remove tool failed => status = ${res.status}`);
        }
        const data = await res.json();
        if (data.updatedModelIds && Array.isArray(data.updatedModelIds)) {
          setModels((prev) =>
            prev.map((m) => {
          setModels((prev) =>
            prev.map((m) => {
              if (!data.updatedModelIds.includes(m.id)) {
                return m;
              }
              const filtered = (m.parameters?.tools ?? []).filter(
              const filtered = (m.parameters?.tools ?? []).filter(
                (toolItem: { id: string }) => toolItem.id !== tool.id
              );
              return {
                ...m,
                parameters: { ...m.parameters, tools: filtered },
              };
            })
          );
        }
      } catch (err) {
        console.error("[handleRemoveTool]", err);
        toast({
          title: "Error",
          description: "Failed to remove tool",
          variant: "destructive"
        });
        setAvailableTools([...availableTools, tool]);
      }
    },
    [toast, availableTools, setAvailableTools, setModels]
  );

  const handleCreateTool = async (toolData: Omit<Tool, "id">) => {
    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData),
      });

      if (!res.ok) throw new Error(`Create tool failed => status = ${res.status}`);

      const newTool = await res.json();
      setTools((prev: Tool[]) => [...prev, newTool]);
      setAvailableTools([...availableTools, newTool]);
      setEditingTool(null);
    } catch (err) {
      console.error("[handleCreateTool]", err);
      toast({
        title: "Error",
        description: "Failed to create tool",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
      <div
        className="top-bar bg-gradient-to-b from-background/100 to-background/00"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}>
        <h2 className="text-4xl font-serif font-bold pl-2">Tools</h2>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border absolute right-0"
            >
              <Package className="h-4 w-4 mr-2" />
              Add Tool
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="custom-shadow">
            <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
              <Package className="h-4 w-4 mr-2" />
              Existing Tool
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditingTool({
              name: "",
              description: "",
              type: "function",
              function: {
                name: "",
                description: "",
                parameters: {
                  type: "object",
                  properties: {},
                  required: [],
                },
              },
            })}>
              <PackagePlus className="h-4 w-4 mr-2" />
              New Tool
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-grow">
        <AnimatePresence>
          <motion.div className="space-y-2 mt-2">
            {editingTool && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-2 rounded-lg custom-shadow bg-background"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xl">New Tool</h3>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateTool(editingTool as Omit<Tool, "id">)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTool(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label>Tool Name</Label>
                    <Input
                      value={editingTool.name}
                      onChange={(e) => setEditingTool(prev => ({ ...prev!, name: e.target.value }))}
                      placeholder="e.g. WeatherTool"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label>Tool Description</Label>
                    <Input
                      value={editingTool.description}
                      onChange={(e) => setEditingTool(prev => ({ ...prev!, description: e.target.value }))}
                      placeholder="e.g. Used to query weather for a location"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label>Tool Type</Label>
                    <Input
                      value={editingTool.type}
                      onChange={(e) => setEditingTool(prev => ({ ...prev!, type: e.target.value }))}
                      placeholder="function"
                    />
                  </div>

                  <hr className="my-2 opacity-50" />

                  <div className="flex flex-col space-y-2">
                    <Label>Function Name</Label>
                    <Input
                      value={editingTool.function?.name}
                      onChange={(e) => setEditingTool(prev => ({
                        ...prev!,
                        function: { ...prev!.function!, name: e.target.value }
                      }))}
                      placeholder="e.g. get_current_weather"
                    />
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label>Function Description</Label>
                    <Input
                      value={editingTool.function?.description}
                      onChange={(e) => setEditingTool(prev => ({
                        ...prev!,
                        function: { ...prev!.function!, description: e.target.value }
                      }))}
                      placeholder="e.g. Get the current weather in a given location"
                    />
                  </div>

                  <hr className="my-2 opacity-50" />
                  <h3 className="font-semibold">Parameter List</h3>

                  {editingTool.function?.parameters?.properties && Object.entries(editingTool.function.parameters.properties).map(([key, param], idx) => (
                    <div key={idx} className="border border-border rounded-md p-3 relative mb-4">
                      <div className="flex flex-col space-y-4">
                        <div className="flex flex-col space-y-2">
                          <Label>Parameter Name (properties key)</Label>
                          <Input
                            value={key}
                            onChange={(e) => {
                              const newProps = { ...editingTool.function!.parameters.properties };
                              const value = newProps[key];
                              delete newProps[key];
                              newProps[e.target.value] = value;
                              setEditingTool(prev => ({
                                ...prev!,
                                function: {
                                  ...prev!.function!,
                                  parameters: {
                                    ...prev!.function!.parameters,
                                    properties: newProps
                                  }
                                }
                              }));
                            }}
                            placeholder="e.g. location / unit"
                          />
                        </div>

                        <div className="flex flex-col space-y-2">
                          <Label>Type (string/number/...)</Label>
                          <Input
                            value={param.type}
                            onChange={(e) => {
                              const newProps = { ...editingTool.function!.parameters.properties };
                              newProps[key] = { ...param, type: e.target.value };
                              setEditingTool(prev => ({
                                ...prev!,
                                function: {
                                  ...prev!.function!,
                                  parameters: {
                                    ...prev!.function!.parameters,
                                    properties: newProps
                                  }
                                }
                              }));
                            }}
                            placeholder="string"
                          />
                        </div>

                        <div className="flex flex-col space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={param.description || ''}
                            onChange={(e) => {
                              const newProps = { ...editingTool.function!.parameters.properties };
                              newProps[key] = { ...param, description: e.target.value };
                              setEditingTool(prev => ({
                                ...prev!,
                                function: {
                                  ...prev!.function!,
                                  parameters: {
                                    ...prev!.function!.parameters,
                                    properties: newProps
                                  }
                                }
                              }));
                            }}
                            placeholder="e.g. The city and state, e.g. Boston, MA"
                          />
                        </div>

                        <div className="flex flex-col space-y-2">
                          <Label>Enum (comma-separated, optional)</Label>
                          <Input
                            value={param.enum?.join(',') || ''}
                            onChange={(e) => {
                              const newProps = { ...editingTool.function!.parameters.properties };
                              newProps[key] = {
                                ...param,
                                enum: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined
                              };
                              setEditingTool(prev => ({
                                ...prev!,
                                function: {
                                  ...prev!.function!,
                                  parameters: {
                                    ...prev!.function!.parameters,
                                    properties: newProps
                                  }
                                }
                              }));
                            }}
                            placeholder="e.g. celsius,fahrenheit"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`required-${idx}`}>Required?</Label>
                            <input
                              id={`required-${idx}`}
                              type="checkbox"
                              className="h-5 w-5 rounded border-border text-primary"
                              checked={editingTool.function!.parameters.required.includes(key)}
                              onChange={(e) => {
                                const newRequired = e.target.checked
                                  ? [...editingTool.function!.parameters.required, key]
                                  : editingTool.function!.parameters.required.filter(r => r !== key);
                                setEditingTool(prev => ({
                                  ...prev!,
                                  function: {
                                    ...prev!.function!,
                                    parameters: {
                                      ...prev!.function!.parameters,
                                      required: newRequired
                                    }
                                  }
                                }));
                              }}
                            />
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                const newProps = { ...editingTool.function!.parameters.properties };
                                newProps['new_param'] = { type: 'string' };
                                setEditingTool(prev => ({
                                  ...prev!,
                                  function: {
                                    ...prev!.function!,
                                    parameters: {
                                      ...prev!.function!.parameters,
                                      properties: newProps
                                    }
                                  }
                                }));
                              }}
                            >
                              +
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                const newProps = { ...editingTool.function!.parameters.properties };
                                delete newProps[key];
                                setEditingTool(prev => ({
                                  ...prev!,
                                  function: {
                                    ...prev!.function!,
                                    parameters: {
                                      ...prev!.function!.parameters,
                                      properties: newProps,
                                      required: prev!.function!.parameters.required.filter(r => r !== key)
                                    }
                                  }
                                }));
                              }}
                              disabled={Object.keys(editingTool.function!.parameters.properties).length <= 1}
                            >
                              -
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!editingTool.function?.parameters?.properties ||
                    Object.keys(editingTool.function.parameters.properties).length === 0) && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingTool(prev => ({
                            ...prev!,
                            function: {
                              ...prev!.function!,
                              parameters: {
                                type: 'object',
                                properties: { 'new_param': { type: 'string' } },
                                required: []
                              }
                            }
                          }));
                        }}
                      >
                        Add Parameter
                      </Button>
                    )}
                </div>
              </motion.div>
            )}

            {availableTools.map((tool) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ y: -2 }}
                className="group p-2 rounded-lg md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]"
              >
                <div className="flex-grow justify-between items-start">
                  <div className="flex cursor-pointer justify-between items-center">
                    <h3 className="font-bold text-xl">{tool.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTool(tool)}
                      className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>

      {/* “Add Tool” => 普通对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-shadow bg-background/80 select-none">
          <DialogHeader className="font-serif">
            <DialogTitle>Add Tool</DialogTitle>
            <DialogDescription>
              搜索并添加已有工具，添加过的工具会在列表里。
            </DialogDescription>
          </DialogHeader>
          <Command className="custom-shadow rounded-lg">
            <CommandInput placeholder="Search tools to add..." />
            {tools.filter(
              (tool) => !availableTools.some((av) => av.id === tool.id)
            ).length === 0 ? (
              <CommandEmpty>暂无可添加的工具。</CommandEmpty>
            ) : (
              <CommandGroup>
                {tools
                  .filter(
                    (tool) =>
                      !availableTools.some((av) => av.id === tool.id)
                  )
                  .map((tool) => (
                    <CommandItem
                      key={tool.id}
                      value={tool.name}
                      onSelect={() => handleAddTool(tool)}
                    >
                      {tool.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
