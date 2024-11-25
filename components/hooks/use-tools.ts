import { useState } from "react";
import { Tool } from "@/components/types";

export function useTools() {
    const [tools, setTools] = useState<Tool[]>([]);
    const [availableTools, setAvailableTools] = useState<Tool[]>([]);
    const [toolsLoading, setToolsLoading] = useState(false);
    const [toolsError, setToolsError] = useState("");
    const [modelTools, setModelTools] = useState<{ [modelId: string]: string[] }>({});
    return {
        tools,
        setTools,
        availableTools,
        setAvailableTools,
        toolsLoading,
        setToolsLoading,
        toolsError,
        setToolsError,
        modelTools,
        setModelTools
    };
}
