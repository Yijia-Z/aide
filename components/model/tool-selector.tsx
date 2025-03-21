/**
 * Props for the ToolSelector component.
 * 
 * @interface ToolSelectorProps
 * @property {Tool[]} availableTools - List of tools that can be selected.
 * @property {Tool[]} selectedTools - List of currently selected tools.
 * @property {string | { type: string; function: { name: string } }} toolChoice - The current tool choice mode or specific tool function.
 * @property {(tools: Tool[]) => void} onToolsChange - Callback function to handle changes in the selected tools.
 * @property {(choice: string | { type: string; function: { name: string } }) => void} onToolChoiceChange - Callback function to handle changes in the tool choice.
 */

/**
 * ToolSelector component allows users to select tools from a list of available tools.
 * 
 * @param {ToolSelectorProps} props - The props for the ToolSelector component.
 * @returns {JSX.Element} The rendered ToolSelector component.
 * 
 * @component
 * @example
 * const availableTools = [{ name: 'Tool1', function: { name: 'func1' }, description: 'Description1' }];
 * const selectedTools = [{ name: 'Tool1', function: { name: 'func1' }, description: 'Description1' }];
 * const toolChoice = 'required';
 * const handleToolsChange = (tools) => console.log(tools);
 * const handleToolChoiceChange = (choice) => console.log(choice);
 * 
 * <ToolSelector
 *   availableTools={availableTools}
 *   selectedTools={selectedTools}
 *   toolChoice={toolChoice}
 *   onToolsChange={handleToolsChange}
 *   onToolChoiceChange={handleToolChoiceChange}
 * />
 */

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Tool } from "../types";

interface ToolSelectorProps {
  availableTools: Tool[];
  selectedTools: Tool[];
  toolChoice: string | { type: string; function: { name: string } };
  onToolsChange: (tools: Tool[]) => void;
  onToolChoiceChange: (choice: string | { type: string; function: { name: string } }) => void;
}

export function ToolSelector({
  selectedTools,
  toolChoice,
  onToolsChange,
  onToolChoiceChange,
  availableTools
}: ToolSelectorProps) {
  const isToolChoiceVisible = toolChoice !== 'none';

  const handleToolsChange = (newTools: Tool[]) => {
    onToolsChange(newTools);
    // If we're in required mode and this is the first tool, automatically select it
    if (toolChoice === 'required' && newTools.length === 1) {
      onToolChoiceChange({
        type: "function",
        function: { name: newTools[0].function.name }
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Select
          value={typeof toolChoice === 'string' ? toolChoice : 'required'}
          onValueChange={(value) => {
            if (value === 'required' && selectedTools.length > 0) {
              onToolChoiceChange({
                type: "function",
                function: { name: selectedTools[0].function.name }
              });
            } else {
              onToolChoiceChange(value);
            }
          }}
        >
          <SelectTrigger className="text-primary" >
            <SelectValue placeholder="Select tool choice" />
          </SelectTrigger>
          <SelectContent className="custom-shadow">
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="required">Required</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isToolChoiceVisible && (
        <div>
          <div className="flex flex-wrap gap-1 mb-2">
            {availableTools.filter(tool => selectedTools.some(selected => selected.function.name === tool.function.name)).map((tool) => (
              <Badge
                key={tool.function.name}
                variant={toolChoice === 'auto' ? 'outline' : toolChoice === 'none' ? 'outline' : 'secondary'}
                className="flex items-center gap-2 cursor-pointer hover:text-destructive active:bg-background"
                onClick={() => handleToolsChange(selectedTools.filter(t => t.function.name !== tool.function.name))}
              >
                {tool.function.name}
              </Badge>
            ))}
          </div>
          {availableTools.filter(tool => !selectedTools.some(selected => selected.function.name === tool.function.name)).length > 0 && (
            <Command className="custom-shadow rounded-lg">
              <CommandInput placeholder="Search available tools..." />
              <CommandEmpty>No tools found.</CommandEmpty>
              <CommandGroup>
                {availableTools
                  .filter((tool) => !selectedTools.some((selected) => selected.function.name === tool.function.name))
                  .map((tool: Tool) => (
                    <CommandItem
                      key={tool.function.name}
                      onSelect={() => {
                        if (toolChoice === 'required' || 'auto') {
                          onToolChoiceChange({
                            type: "function",
                            function: { name: tool.function.name }
                          });
                          handleToolsChange([...selectedTools, tool]);
                        }
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{tool.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {tool.description}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </Command>
          )}
        </div>
      )}
    </div>
  );
}