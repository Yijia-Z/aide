import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PackagePlus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
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
    setTools: (tools: Tool[]) => void;
    availableTools: Tool[];
    setAvailableTools: (tools: Tool[]) => void;
    isLoading: boolean;
    error: string;
}

/**
 * Component for managing tools.
 *
 * @component
 * @param {ToolManagerProps} props - The properties for the ToolManager component.
 * @param {Tool[]} props.tools - The list of all tools.
 * @param {React.Dispatch<React.SetStateAction<Tool[]>>} props.setTools - Function to set the list of all tools.
 * @param {Tool[]} props.availableTools - The list of available tools.
 * @param {React.Dispatch<React.SetStateAction<Tool[]>>} props.setAvailableTools - Function to set the list of available tools.
 * @param {boolean} props.isLoading - Indicates if the tools are being loaded.
 * @param {Error | null} props.error - The error object if there is an error.
 *
 * @returns {JSX.Element} The rendered ToolManager component.
 *
 * @example
 * <ToolManager
 *   tools={tools}
 *   setTools={setTools}
 *   availableTools={availableTools}
 *   setAvailableTools={setAvailableTools}
 *   isLoading={isLoading}
 *   error={error}
 * />
 */
export function ToolManager({ tools, setTools, availableTools, setAvailableTools, isLoading, error }: ToolManagerProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);


    const handleAddTool = useCallback((tool: Tool) => {
        setAvailableTools([...availableTools, tool]);
        setIsDialogOpen(false);
    }, [availableTools, setAvailableTools, setIsDialogOpen]);

    const handleRemoveTool = useCallback((tool: Tool) => {
        setAvailableTools(availableTools.filter(t => t.function.name !== tool.function.name));
    }, [availableTools, setAvailableTools]);

    return (
        <div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
            <div className="top-bar bg-gradient-to-b from-background/100 to-background/00">
                <h2 className="text-2xl font-serif font-bold pl-2">Tools</h2>
                <Button
                    className="bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
                    onClick={() => setIsDialogOpen(true)}
                >
                    <PackagePlus className="h-4 w-4" />
                    <span className="ml-2 hidden md:inline">Add Tool</span>
                </Button>
            </div>

            <ScrollArea className="flex-grow">
                <AnimatePresence>
                    <motion.div className="space-y-2 mt-2">
                        {availableTools.map((tool) => (
                            <motion.div
                                key={tool.function.name}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                whileHover={{ y: -2 }}
                                className="group p-2 rounded-md md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold">{tool.name}</h3>
                                        <p className="text-sm text-muted-foreground">{tool.description}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                        size="default"
                                        onClick={() => handleRemoveTool(tool)}
                                    >
                                        <Trash />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </ScrollArea>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Tool</DialogTitle>
                    </DialogHeader>
                    <Command className="custom-shadow rounded-lg">
                        <CommandInput placeholder="Search tools to add..." />
                        {tools.filter(tool => !availableTools.some(availableTool => availableTool.function?.name === tool.function?.name)).length === 0 ? (
                            <CommandEmpty>No tools found.</CommandEmpty>
                        ) : (
                            <CommandGroup>
                                {tools.filter(tool =>
                                    !availableTools.some(availableTool =>
                                        availableTool.function?.name === tool.function?.name
                                    )
                                ).map((tool) => (
                                    <CommandItem
                                        key={tool.function.name}
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