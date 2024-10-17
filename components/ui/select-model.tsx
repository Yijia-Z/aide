"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"


// @Yijia should we keep the models here or in the parent component?
const models = [
  {
    id: "1",
    name: "Default Model",
    baseModel: "gpt-4o-mini",
    systemPrompt: "You are a helpful assistant.",
    temperature: 0.7,
    maxTokens: 512,
  },
  {
    id: "2",
    name: "Custom Model",
    baseModel: "claudeai/gpt-4o-mini",
    systemPrompt: "You are a helpful assistant.",
    temperature: 0.7,
    maxTokens: 512,
  }
]

interface SelectModelProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function SelectModel({ value, onValueChange }: SelectModelProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? models.find((model) => model.baseModel === value)?.baseModel
            : "Select model..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search model..." />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.baseModel}
                  value={model.baseModel}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === model.baseModel ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {model.baseModel}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}