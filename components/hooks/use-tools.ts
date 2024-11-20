import { useState } from "react";
import { Tool } from "@/components/types";

export function useTools() {
    const [tools, setTools] = useState<Tool[]>([]);
    const [toolsLoading, setToolsLoading] = useState(false);
    const [toolsError, setToolsError] = useState("");
    const [modelSupportsTools, setModelSupportsTools] = useState<boolean | null>(null);

    return {
        tools,
        setTools,
        toolsLoading,
        setToolsLoading,
        toolsError,
        setToolsError,
        modelSupportsTools,
        setModelSupportsTools,    
    };
}
