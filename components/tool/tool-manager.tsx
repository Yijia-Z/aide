"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PackageMinus, PackagePlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  /** 当前已添加(启用)的工具 */
  availableTools: Tool[];
  setAvailableTools: (tools: Tool[]) => void;

  /** 如果需要更新 models 里的 tools */
  setModels: React.Dispatch<React.SetStateAction<Model[]>>;
  isLoading: boolean;
  error: string;

  /**
   * 让父组件控制“Create Tool”对话框是否打开
   * 这里只需提供一个回调 openCreateDialog()
   */
  openCreateDialog: () => void;
}

export function ToolManager({
  tools,
  setTools,
  availableTools,
  setAvailableTools,
  isLoading,
  error,
  setModels,
  openCreateDialog,
}: ToolManagerProps) {
  // “添加已有工具”的普通对话框
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /**
   * 添加已有工具 => POST /api/availableTools/[id]
   */
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
        alert("Add tool failed!");
        // 回滚
        setAvailableTools(
          availableTools.filter((t) => t.id !== tool.id)
        );
      }
    },
    [availableTools, setAvailableTools]
  );

  /**
   * 移除已添加的工具 => DELETE /api/availableTools/[id]
   */
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
        // 如果后端返回 updatedModelIds，就去掉相关 model 里对这个 tool 的引用
        if (data.updatedModelIds && Array.isArray(data.updatedModelIds)) {
          setModels((prev) =>
            prev.map((m) => {
              if (!data.updatedModelIds.includes(m.id)) {
                return m;
              }
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
        alert("Remove tool failed!");
        // 回滚
        setAvailableTools([...availableTools, tool]);
      }
    },
    [availableTools, setAvailableTools, setModels]
  );



  return (
    <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
      <div
        className="top-bar bg-linear-to-b from-background/100 to-background/00"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <h2 className="text-4xl font-serif font-bold pl-2">Tools</h2>

        {/* 1) 普通 <Dialog> => “Add Tool” */}
        <Button
          className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border absolute right-20"
          onClick={() => setIsDialogOpen(true)}
        >
          <PackagePlus className="h-4 w-4" />
          <span className="ml-2 hidden lg:inline">Add Tool</span>
        </Button>

        {/* 2) “Create Tool” Button => 让父组件 openCreateDialog() */}
        <Button
          className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border absolute right-0"
          onClick={openCreateDialog}
        >
          <span className="ml-1">Create Tool</span>
        </Button>
      </div>

      {/* 中间列出当前已启用的 tools */}
      <ScrollArea className="grow">
        <AnimatePresence>
          <motion.div className="space-y-2 mt-2">
            {availableTools.map((tool) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ y: -2 }}
                className="group p-2 rounded-lg md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]"
              >
                <div className="grow justify-between items-start">
                  <div className="flex cursor-pointer justify-between items-center">
                    <h3 className="font-bold text-xl">{tool.name}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveTool(tool)}
                      className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <PackageMinus />
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
