"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DraggableDialog from "@/components/ui/draggable-dialog";

// Define backend data structures
export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: string;
  function: ToolFunction;
}

// Interface for storing parameter rows in the frontend
interface ParamField {
  paramName: string;
  paramType: string;
  paramDescription: string;
  paramEnum: string;
  isRequired: boolean;
}

interface CreateToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (toolData: Omit<Tool, "id">) => void;
}

/**
 * A dialog that initially renders one parameter row.
 * Each field is displayed in a `<div className="flex flex-col space-y-2">` style.
 */
export function CreateToolDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateToolDialogProps) {
  // Top-level Tool Info
  const [toolName, setToolName] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [toolType, setToolType] = useState("function");

  // function.xxx
  const [functionName, setFunctionName] = useState("");
  const [functionDesc, setFunctionDesc] = useState("");

  // Initially one parameter row
  const [parameters, setParameters] = useState<ParamField[]>([
    {
      paramName: "",
      paramType: "string",
      paramDescription: "",
      paramEnum: "",
      isRequired: false,
    },
  ]);

  function addParameter() {
    setParameters((prev) => [
      ...prev,
      {
        paramName: "",
        paramType: "string",
        paramDescription: "",
        paramEnum: "",
        isRequired: false,
      },
    ]);
  }

  function removeParameter(index: number) {
    // If you don't want to allow deleting the last row, keep this condition
    if (parameters.length === 1) return;
    setParameters((prev) => prev.filter((_, i) => i !== index));
  }

  function updateParameter(
    index: number,
    key: keyof ParamField,
    value: string | boolean
  ) {
    setParameters((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [key]: value } : p))
    );
  }

  function handleCreate() {
    // Basic validations
    if (!toolName.trim()) {
      alert("Tool name is required!");
      return;
    }
    if (!functionName.trim()) {
      alert("Function name is required!");
      return;
    }

    // Convert parameters => properties + required
    const properties: Record<string, ToolParameter> = {};
    const requiredArr: string[] = [];

    for (const param of parameters) {
      if (!param.paramName.trim()) continue;
      const paramObj: ToolParameter = { type: param.paramType };
      if (param.paramDescription.trim()) {
        paramObj.description = param.paramDescription.trim();
      }
      if (param.paramEnum.trim()) {
        paramObj.enum = param.paramEnum.split(",").map((s) => s.trim());
      }
      properties[param.paramName] = paramObj;
      if (param.isRequired) {
        requiredArr.push(param.paramName);
      }
    }

    const newToolData = {
      name: toolName.trim(),
      description: toolDescription.trim(),
      type: toolType.trim(),
      function: {
        name: functionName.trim(),
        description: functionDesc.trim(),
        parameters: {
          type: "object",
          properties,
          required: requiredArr,
        },
      },
    };

    onCreate(newToolData);
  }

  return (
    <DraggableDialog open={open} onOpenChange={onOpenChange}>
      <div className="p-4 sm:p-6 flex flex-col gap-4 h-full w-full">
        <h2 className="text-xs font-bold mb-2">Create New Tool</h2>

        {/* Top-level tool info */}
        <div className="flex flex-col space-y-2">
          <Label>Tool Name (tool.name)</Label>
          <Input
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder="e.g. WeatherTool"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label>Tool Description (tool.description)</Label>
          <Input
            value={toolDescription}
            onChange={(e) => setToolDescription(e.target.value)}
            placeholder="e.g. Used to query weather for a location"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label>Tool Type (tool.type)</Label>
          <Input
            value={toolType}
            onChange={(e) => setToolType(e.target.value)}
            placeholder="function"
          />
        </div>

        {/* Function: name + description */}
        <hr className="my-2 opacity-50" />
        <div className="flex flex-col space-y-2">
          <Label>Function Name (function.name)</Label>
          <Input
            value={functionName}
            onChange={(e) => setFunctionName(e.target.value)}
            placeholder="e.g. get_current_weather"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <Label>Function Description (function.description)</Label>
          <Input
            value={functionDesc}
            onChange={(e) => setFunctionDesc(e.target.value)}
            placeholder="e.g. Get the current weather in a given location"
          />
        </div>

        {/* Parameter list */}
        <hr className="my-2 opacity-50" />
        <h3 className="font-semibold">Parameter List (function.parameters.properties)</h3>

        {parameters.map((param, idx) => (
          <div key={idx} className="border border-border rounded-md p-3 relative mb-4">
            {/* Each field uses space-y-4 */}
            <div className="flex flex-col space-y-4">
              {/* paramName */}
              <div className="flex flex-col space-y-2">
                <Label>Parameter Name (properties key)</Label>
                <Input
                  value={param.paramName}
                  onChange={(e) => updateParameter(idx, "paramName", e.target.value)}
                  placeholder="e.g. location / unit"
                />
              </div>

              {/* paramType */}
              <div className="flex flex-col space-y-2">
                <Label>Type (string/number/...)</Label>
                <Input
                  value={param.paramType}
                  onChange={(e) => updateParameter(idx, "paramType", e.target.value)}
                  placeholder="string"
                />
              </div>

              {/* paramDescription */}
              <div className="flex flex-col space-y-2">
                <Label>Description</Label>
                <Input
                  value={param.paramDescription}
                  onChange={(e) => updateParameter(idx, "paramDescription", e.target.value)}
                  placeholder="e.g. The city and state, e.g. Boston, MA"
                />
              </div>

              {/* paramEnum */}
              <div className="flex flex-col space-y-2">
                <Label>Enum (comma-separated, optional)</Label>
                <Input
                  value={param.paramEnum}
                  onChange={(e) => updateParameter(idx, "paramEnum", e.target.value)}
                  placeholder="e.g. celsius,fahrenheit"
                />
              </div>

              {/* Required + +-/buttons on the same row */}
              <div className="flex items-center justify-between">
                {/* Left: Required? */}
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`required-${idx}`}>Required?</Label>
                  <input
                    id={`required-${idx}`}
                    type="checkbox"
                    className="h-5 w-5 rounded border-border text-primary"
                    checked={param.isRequired}
                    onChange={(e) => updateParameter(idx, "isRequired", e.target.checked)}
                  />
                </div>

                {/* Right: + - buttons */}
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={addParameter}>
                    +
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => removeParameter(idx)}
                    disabled={parameters.length <= 1}
                  >
                    -
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Bottom buttons */}
        <div className="mt-auto pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create Tool</Button>
        </div>
      </div>
    </DraggableDialog>
  );
}

export default CreateToolDialog;
