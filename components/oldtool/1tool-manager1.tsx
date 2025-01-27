import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Model, ModelParameters } from "@/components/types";
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
import { Rnd } from "react-rnd";
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
  tools: Tool[];
  setTools: (tools: Tool[]) => void;         // 目前可能没用
  availableTools: Tool[];
  setAvailableTools: (tools: Tool[]) => void;
  setModels: React.Dispatch<React.SetStateAction<Model[]>>; 
  isLoading: boolean;
  error: string;
}

/**
 * Component for managing tools (enabling/disabling).
 *
 * - tools: 所有可用工具（大列表）
 * - availableTools: 当前用户已经启用 / 添加的工具
 */
export function ToolManager({
  tools,
  setTools,
  availableTools,
  setAvailableTools,
  isLoading,
  error,
  setModels,

}: ToolManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  /**
   * Add a tool to "availableTools".
   * Then call POST /api/availableTools/[toolId].
   */
  const handleAddTool = useCallback(
    async (tool: Tool) => {
      // 1) 前端乐观更新（直接传新数组）
      setAvailableTools([...availableTools, tool]);

      try {
        // 2) 发起后端请求
        const res = await fetch(`/api/availableTools/${tool.id}`, {
          method: "POST",
        });
        if (!res.ok) {
          throw new Error(`Add tool failed => status = ${res.status}`);
        }

        // （可选）后端如果返回了最新数据，可再次 setAvailableTools(...)

      } catch (err) {
        console.error("[handleAddTool] error =>", err);
        // 3) 失败 => 回滚
        //    重新设置回未添加之前的状态
        setAvailableTools(
          availableTools.filter((t) => t.id !== tool.id)
        );
        alert("Add tool failed!");
      }
    },
    [availableTools, setAvailableTools]
  );

  /**
   * 从 availableTools 中移除某个工具，
   * 并对后端发起 DELETE /api/availableTools/[tool.id] 请求。
   */
  const handleRemoveTool = useCallback(
    async (tool: Tool) => {
      // 1) 前端先移除
      setAvailableTools(
        availableTools.filter((t) => t.id !== tool.id)
      );
      try {
        // 2) 发请求
        const res = await fetch(`/api/availableTools/${tool.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error(`Remove tool failed => status = ${res.status}`);
        }
        const data = await res.json();
        console.log("[handleRemoveTool] server returned =>", data);
        // data.updatedModelIds => [ "xxx-xxx", ... ]
  
        // 3) 让前端 `models` state 同步去掉 model.parameters.tools 里这个 tool
        //    你需要在 props 里也拿到 setModels, models (或者用 context/hook 全局管理)
        if (data.updatedModelIds && Array.isArray(data.updatedModelIds)) {
          setModels((prevModels: Model[]) => {
            return prevModels.map(m => {
              // 如果这条不受影响就直接返回
              if (!data.updatedModelIds.includes(m.id)) {
                return m;
              }
              // 如果要更新 tools
              const filteredTools = (m.parameters?.tools ?? []).filter(
                (toolItem: { id: string }) => toolItem.id !== tool.id
              );
              return {
                ...m,
                parameters: {
                  ...m.parameters,
                  tools: filteredTools,
                },
              };
            });
          });
        }
  
        // 4) 如果你还有 selectedTools，需要过滤一下
        //    例如:
        //    setSelectedTools(prev => prev.filter(t => t.id !== tool.id));
        
      } catch (err) {
        console.error("[handleRemoveTool] error =>", err);
        // 5) 回滚
        setAvailableTools([...availableTools, tool]);
        alert("Remove tool failed!");
      }
    },
    [availableTools, setAvailableTools, setModels /*, setSelectedTools*/]
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
        <Button
          className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border absolute right-0"
          onClick={() => setIsDialogOpen(true)}
        >
          <PackagePlus className="h-4 w-4" />
          <span className="ml-2 hidden lg:inline">Add Tool</span>
        </Button>
      </div>

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
                      className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      size="sm"
                      onClick={() => handleRemoveTool(tool)}
                    >
                      <PackageMinus />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>

      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="custom-shadow bg-background/80 select-none">
          <DialogHeader className='font-serif'>
            <DialogTitle>Add Tool</DialogTitle>
            <DialogDescription>
              Search and add tools to your workspace. Added tools will appear in your tools list.
            </DialogDescription>
          </DialogHeader>
          <Command className="custom-shadow rounded-lg">
            <CommandInput placeholder="Search tools to add..." />
            {/* 只显示还没添加过的工具 */}
            {tools.filter(tool => !availableTools.some(av => av.id === tool.id)).length === 0 ? (
              <CommandEmpty>No tools found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {tools
                  .filter(tool => !availableTools.some(av => av.id === tool.id))
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
