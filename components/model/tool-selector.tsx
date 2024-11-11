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

interface ToolSelectorProps {
  tools: any[];
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
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Selected Tools</label>
        <div className="flex flex-wrap gap-2 mt-2">
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
                  if (!selectedTools.includes(tool.function.name)) {
                    onToolsChange([...selectedTools, tool.function.name]);
                  }
                }}
              >
                {tool.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </div>

      <div>
        <label className="text-sm font-medium">Tool Choice</label>
        <Select
          value={typeof toolChoice === 'string' ? toolChoice : 'specific'}
          onValueChange={(value) => {
            if (value === 'specific') {
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
            <SelectItem value="specific">Specific Tool</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}