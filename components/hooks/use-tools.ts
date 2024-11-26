import { useState, useEffect } from "react";
import { Tool } from "@/components/types";
import { storage } from "@/components/store";

// Custom hook to manage tools
export function useTools() {
    const [tools, setTools] = useState<Tool[]>(() => {
        // Load tools from localStorage on initialization
        const savedTools = storage.get("tools");
        return savedTools ? savedTools : [];
    });
    const [availableTools, setAvailableTools] = useState<Tool[]>(() => {
        // Load available tools from localStorage on initialization
        const savedAvailableTools = storage.get("availableTools");
        return savedAvailableTools ? savedAvailableTools : [];
    });
    const [toolsLoading, setToolsLoading] = useState(false);
    const [toolsError, setToolsError] = useState("");
    const [modelTools, setModelTools] = useState<{ [modelId: string]: string[] }>(() => {
        // Load model tools from localStorage on initialization
        const savedModelTools = storage.get("modelTools");
        return savedModelTools ? savedModelTools : {};
    });

    // Save tools to localStorage whenever they change
    useEffect(() => {
        storage.set("tools", tools);
    }, [tools]);

    useEffect(() => {
        storage.set("availableTools", availableTools);
    }, [availableTools]);

    useEffect(() => {
        storage.set("modelTools", modelTools);
    }, [modelTools]);

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