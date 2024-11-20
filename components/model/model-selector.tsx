"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolSelector } from "./tool-selector";
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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModelParameters {
  model: string;
  supported_parameters: string[];
  max_output: number;
  [key: string]: any;
}

interface Model {
  id: string;
  name: string;
  parameters?: Partial<ModelParameters>;
}

interface SelectBaseModelProps {
  value: string;
  onValueChange: (value: string, parameters: Partial<ModelParameters>) => void;
  fetchAvailableModels: () => Promise<Model[]>;
  existingParameters?: Partial<ModelParameters>;
  fetchModelParameters: (modelId: string) => Promise<ModelParameters | null>;
}

export function SelectBaseModel({
  value,
  onValueChange,
  fetchAvailableModels,
  existingParameters,
  fetchModelParameters,
}: SelectBaseModelProps) {
  const [open, setOpen] = React.useState(false);
  const [parameters, setParameters] = React.useState<ModelParameters | null>(
    null
  );
  const [availableModels, setAvailableModels] = React.useState<Model[]>([]);
  const [cachedParameters, setCachedParameters] = React.useState<
    Record<string, ModelParameters>
  >({});

  React.useEffect(() => {
    const loadModels = async () => {
      const models = await fetchAvailableModels();
      setAvailableModels(models);
    };
    loadModels();
  }, [fetchAvailableModels]);

  const fetchModelParametersWithCache = React.useCallback(
    async (modelId: string) => {
      if (cachedParameters[modelId]) {
        setParameters(cachedParameters[modelId]);
        return cachedParameters[modelId];
      }
      if (cachedParameters[modelId]) {
        console.log(
          "Using cached parameters for model:",
          modelId,
          cachedParameters[modelId]
        );
        setParameters(cachedParameters[modelId]);
        return cachedParameters[modelId];
      }

      try {
        // console.log("Fetching parameters for model:", modelId);
        const data = await fetchModelParameters(modelId);
        // console.log("Received parameters:", data);
        if (data) {
          setParameters(data.data);
          setCachedParameters((prev) => ({ ...prev, [modelId]: data.data }));
        }
        return data?.data;
      } catch (error) {
        console.error("Error fetching model parameters:", error);
        setParameters(null);
        return null;
      }
    },
    [cachedParameters, fetchModelParameters]
  );

  React.useEffect(() => {
    if (value) {
      if (existingParameters && Object.keys(existingParameters).length > 0) {
        setParameters(existingParameters as ModelParameters);
      } else {
        fetchModelParametersWithCache(value);
      }
    }
  }, [value, fetchModelParametersWithCache, existingParameters]);

  const handleParameterChange = (param: string, newValue: any) => {
    if (parameters) {
      const updatedParameters = { ...parameters, [param]: newValue };
      setParameters(updatedParameters);
      onValueChange(value, updatedParameters);
    }
  };

  const renderParameter = (param: string) => {
    const value = parameters?.[param];
    let min = 0;
    let max = 1;
    let step = 0.01;
    let defaultValue = 0;
    let tooltip = "";

    switch (param) {
      case "temperature":
        min = 0.0;
        max = 2.0;
        step = 0.01;
        defaultValue = 1.0;
        tooltip =
          "Influences the variety in the model's responses. Lower values lead to more predictable responses, higher values encourage more diverse responses. (0.0 to 2.0, Default: 1.0)";
        break;
      case "top_p":
        min = 0.0;
        max = 1.0;
        step = 0.01;
        defaultValue = 1.0;
        tooltip =
          "Limits the model's choices to a percentage of likely tokens. Lower values make responses more predictable. (0.0 to 1.0, Default: 1.0)";
        break;
      case "top_k":
        min = 0;
        max = 128;
        step = 1;
        defaultValue = 0;
        tooltip =
          "Limits the model's choice of tokens at each step. Lower values make responses more predictable. (0 or above, Default: 0)";
        break;
      case "frequency_penalty":
        min = -2.0;
        max = 2.0;
        step = 0.01;
        defaultValue = 0.0;
        tooltip =
          "Controls repetition of tokens based on their frequency in the input. Higher values reduce repetition. (-2.0 to 2.0, Default: 0.0)";
        break;
      case "presence_penalty":
        min = -2.0;
        max = 2.0;
        step = 0.01;
        defaultValue = 0.0;
        tooltip =
          "Adjusts how often the model repeats specific tokens from the input. Higher values reduce repetition. (-2.0 to 2.0, Default: 0.0)";
        break;
      case "repetition_penalty":
        min = 0.0;
        max = 2.0;
        step = 0.01;
        defaultValue = 1.0;
        tooltip =
          "Reduces repetition of tokens from the input. Higher values make repetition less likely. (0.0 to 2.0, Default: 1.0)";
        break;
      case "min_p":
        min = 0.0;
        max = 1.0;
        step = 0.01;
        defaultValue = 0.0;
        tooltip =
          "Minimum probability for a token to be considered, relative to the most likely token. (0.0 to 1.0, Default: 0.0)";
        break;
      case "top_a":
        min = 0.0;
        max = 1.0;
        step = 0.01;
        defaultValue = 0.0;
        tooltip =
          "Considers only top tokens with 'sufficiently high' probabilities. Lower values narrow the scope of choices. (0.0 to 1.0, Default: 0.0)";
        break;
      case "seed":
        min = 0;
        max = Number.MAX_SAFE_INTEGER;
        step = 1;
        tooltip =
          "If specified, makes the inferencing deterministic. Repeated requests with the same seed and parameters should return the same result.";
        break;
      case "max_tokens":
        min = 1;
        max = parameters?.max_output || 9999;
        step = 1;
        tooltip =
          "Sets the upper limit for the number of tokens the model can generate in response. (1 or above)";
        break;
      case "top_logprobs":
        min = 0;
        max = 20;
        step = 1;
        tooltip =
          "Number of most likely tokens to return at each token position, with associated log probability. (0 to 20)";
        break;
      case "logit_bias":
        tooltip =
          "JSON object mapping tokens to bias values. Affects token selection likelihood.";
        break;
      case "response_format":
        tooltip =
          'Forces specific output format. Set to { "type": "json_object" } for JSON mode.';
        break;
      case "stop":
        tooltip =
          "Array of tokens. Generation stops if any of these tokens are encountered.";
        break;
      case "tools":
        tooltip =
          "Tool calling parameter, following OpenAI's tool calling request shape.";
        break;
      case "tool_choice":
        tooltip = "Controls which (if any) tool is called by the model.";
        break;
      case "logprobs":
        tooltip = "Whether to return log probabilities of the output tokens.";
        break;
      default:
        console.warn(`Unknown parameter: ${param}`);
        return null;
    }

    const renderTooltip = (title: string, content: string) => (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-help">
              <span>{title}</span>
              <Info className="hidden md:inline h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="font-serif w-60 mx-4 custom-shadow" side="top">
            <p>{content}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    switch (param) {
      case "temperature":
      case "top_p":
      case "top_k":
      case "frequency_penalty":
      case "presence_penalty":
      case "repetition_penalty":
      case "min_p":
      case "top_a":
      case "seed":
        return (
          <div key={param} className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <Label>{renderTooltip(param, tooltip)}</Label>
              <Input
                type="number"
                value={Math.min(value ?? defaultValue, max)}
                onChange={(e) =>
                  handleParameterChange(
                    param,
                    Math.min(parseFloat(e.target.value), max)
                  )
                }
                className="min-font-size text-foreground p-1 ml-2 w-fit h-6 text-right text-xs"
                step={step.toString()}
                min={min}
                max={max}
              />
            </div>
            <Slider
              defaultValue={[Math.min(value ?? defaultValue, max)]}
              max={max}
              min={min}
              step={step}
              value={[Math.min(value ?? defaultValue, max)]}
              onValueChange={([val]) =>
                handleParameterChange(param, Math.min(val, max))
              }
              className="h-2"
            />
          </div>
        );
      case "max_tokens":
        return (
          <div key={param} className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <Label>{renderTooltip(param, tooltip)}</Label>
              <Input
                type="number"
                value={Math.min(value || 0, max)}
                onChange={(e) =>
                  handleParameterChange(
                    param,
                    Math.min(parseInt(e.target.value), max)
                  )
                }
                className="min-font-size text-foreground p-1 ml-2 w-fit h-6 text-right text-xs"
                step={step.toString()}
                min={min}
                max={max}
              />
            </div>
            <Slider
              defaultValue={[Math.min(value || 0, max)]}
              max={max}
              min={min}
              step={step}
              value={[Math.min(value || 0, max)]}
              onValueChange={([val]) =>
                handleParameterChange(param, Math.min(val, max))
              }
              className="h-4"
            />
          </div>
        );
      case "logit_bias":
      case "response_format":
      case "stop":
        return (
          <div key={param} className="flex flex-col space-y-2">
            <Label>{renderTooltip(param, tooltip)}</Label>
            <Input
              type="text"
              value={typeof value === "object" ? JSON.stringify(value) : value}
              onChange={(e) => {
                try {
                  const parsedValue = JSON.parse(e.target.value);
                  handleParameterChange(param, parsedValue);
                } catch (error) {
                  handleParameterChange(param, e.target.value);
                }
              }}
              placeholder={`Enter ${param}...`}
              className="text-foreground"
            />
          </div>
        );
      case "logprobs":
        return (
          <div key={param} className="flex items-center space-x-2">
            <Switch
              id={`${param}-switch`}
              checked={value === true}
              onCheckedChange={(checked) =>
                handleParameterChange(param, checked)
              }
            />
            <Label htmlFor={`${param}-switch`}>
              {renderTooltip(param, tooltip)}
            </Label>
          </div>
        );
      case "top_logprobs":
        return (
          <div key={param} className="flex flex-col space-y-2">
            <Label>{renderTooltip(param, tooltip)}</Label>
            <Input
              type="number"
              value={Math.min(value || 0, max)}
              onChange={(e) =>
                handleParameterChange(
                  param,
                  Math.min(parseInt(e.target.value), max)
                )
              }
              min={min}
              max={max}
            />
          </div>
        );
      case "tools":
      case "tool_choice":
        if (param === "tools" && parameters?.supported_parameters?.includes("tools")) {
          return (
            <div key={param} className="flex flex-col space-y-2">
              <Label>{renderTooltip(param, tooltip)}</Label>
              <ToolSelector
                tools={parameters.available_tools || []}
                selectedTools={Array.isArray(value) ? value.map((t: any) => t.function.name) : []}
                toolChoice={parameters.tool_choice || "auto"}
                onToolsChange={(selectedTools) => {
                  const toolObjects = selectedTools.map(toolName => {
                    const tool = parameters.available_tools.find(
                      (t: any) => t.function.name === toolName
                    );
                    return tool;
                  });
                  handleParameterChange("tools", toolObjects);
                }}
                onToolChoiceChange={(choice) => {
                  handleParameterChange("tool_choice", choice);
                }}
              />
            </div>
          );
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-fit justify-between"
          >
            <span className="whitespace-break-spaces flex-1 text-left text-foreground">
            {value ? (
                availableModels.find((model) => model.id === value)?.name ||
                value
            ) : (
              "Select model..."
            )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-screen sm:w-auto">
          <Command className="w-full custom-shadow">
            <CommandInput placeholder="Search model..." className="w-full" />
            <CommandList className="w-full bg-transparent">
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup className="w-full">
                {availableModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={async (currentValue) => {
                      setOpen(false);
                      const newParameters = await fetchModelParametersWithCache(
                        currentValue
                      );
                      if (newParameters) {
                        const modelWithMaxOutput = availableModels.find(
                          (m) => m.id === currentValue
                        );
                        if (
                          modelWithMaxOutput &&
                          modelWithMaxOutput.parameters?.max_output
                        ) {
                          newParameters.max_output =
                            modelWithMaxOutput.parameters.max_output;
                        }
                        onValueChange(currentValue, newParameters);
                      }
                    }}
                  >
                    {/*<Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model.id ? "opacity-100" : "opacity-0"
                      )}
                    />*/}
                    {model.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {parameters && (
        <div className="space-y-4">
          {renderParameter("max_tokens")}
          {renderParameter("top_p")}
          {renderParameter("temperature")}
          <Accordion type="single" collapsible className="w-auto">
            <AccordionItem value="additional-parameters">
              <AccordionTrigger className="text-sm text-foreground rounded-lg h-8">
                Additional Parameters
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {parameters.supported_parameters
                    ?.filter(
                      (param) =>
                        !["max_tokens", "top_p", "temperature"].includes(param)
                    )
                    .map(renderParameter)}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
}
