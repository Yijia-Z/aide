import { useState, useEffect } from "react";
import { Tool } from "@/components/types";

export function useTools() {
    const [tools, setTools] = useState<Tool[]>(() => {
        // Load tools from localStorage on initialization
        const savedTools = localStorage.getItem("tools");
        return savedTools ? JSON.parse(savedTools) : [];
    });
    const [availableTools, setAvailableTools] = useState<Tool[]>(() => {
        // Load available tools from localStorage on initialization
        const savedAvailableTools = localStorage.getItem("availableTools");
        return savedAvailableTools ? JSON.parse(savedAvailableTools) : [];
    });
    const [toolsLoading, setToolsLoading] = useState(false);
    const [toolsError, setToolsError] = useState("");
    const [modelTools, setModelTools] = useState<{ [modelId: string]: string[] }>(() => {
        // Load model tools from localStorage on initialization
        const savedModelTools = localStorage.getItem("modelTools");
        return savedModelTools ? JSON.parse(savedModelTools) : {};
    });

    // Save tools to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem("tools", JSON.stringify(tools));
    }, [tools]);

    useEffect(() => {
        localStorage.setItem("availableTools", JSON.stringify(availableTools));
    }, [availableTools]);

    useEffect(() => {
        localStorage.setItem("modelTools", JSON.stringify(modelTools));
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