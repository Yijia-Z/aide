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
import { X } from "lucide-react";
import { Tool } from "../types";

interface ToolSelectorProps {
  tools: Tool[];
  selectedTools: string[];
  toolChoice: string | { type: string; function: { name: string } };
  onToolsChange: (tools: string[]) => void;
  onToolChoiceChange: (choice: string | { type: string; function: { name: string } }) => void;
}

export function ToolSelector({
  tools,
  selectedTools,
  toolChoice,
  onToolsChange,
  onToolChoiceChange,
}: ToolSelectorProps) {
  return (
    <div className="space-y-2">
      <div>
        <div className="flex flex-wrap">
          {selectedTools.map((toolName) => (
            <Badge key={toolName} variant="secondary">
              {toolName}
              <button
                className="ml-1"
                onClick={() => onToolsChange(selectedTools.filter(t => t !== toolName))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Command className="mt-2 custom-shadow">
          <CommandInput placeholder="Search tools..." />
          <CommandEmpty>No tools found.</CommandEmpty>
          <CommandGroup>
            {tools.map((tool) => (
              <CommandItem
                key={tool.function.name}
                onSelect={() => {
                  if (!selectedTools.includes(tool.id)) {
                    onToolsChange([...selectedTools, tool.id]);
                  }
                }}
              >
                {tool.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">tool_choice</label>
        <Select
          value={typeof toolChoice === 'string' ? toolChoice : 'required'}
          onValueChange={(value) => {
            if (value === 'required') {
              onToolChoiceChange({
                type: "function",
                function: { name: selectedTools[0] || '' }
              });
            } else {
              onToolChoiceChange(value);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select tool choice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="required">Required</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}