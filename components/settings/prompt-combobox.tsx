import * as React from "react";
import { CheckIcon, ChevronsUpDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PromptOption {
  label: string;
  value: string;
}

interface PromptComboboxProps {
  options: PromptOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  onDeleteOption?: (value: string) => void;
}

export function PromptCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select a template",
  onDeleteOption
}: PromptComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-none">
        <Command className="custom-shadow">
          <CommandInput placeholder="Search prompts..." />
          <CommandList>
            <CommandEmpty>No prompt found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {option.label}
                  <div className="ml-auto flex items-center gap-2">
                    <CheckIcon
                      className={cn(
                        "h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {onDeleteOption && !["Default Assistant", "Code Assistant", "Math Tutor"].includes(option.label) && (
                      <Trash2 
                        className="h-4 w-4 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOption(option.value);
                        }}
                      />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}