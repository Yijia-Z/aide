import { useState, useEffect } from "react";
import { Tool } from "@/components/types";
import { storage } from "@/components/store";
import { useUser } from "@clerk/nextjs";
// Custom hook to manage tools
export function useTools() {
  const { isSignedIn } = useUser(); 
  const [tools, setTools] = useState<Tool[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState("");
  const [modelTools, setModelTools] = useState<Record<string, string[]>>({});
  useEffect(() => {
    (async () => {
      try {
        setToolsLoading(true);
        setToolsError("");

        // 1.1) 获取全部 tools
        const resTools = await fetch("/api/tools");
        if (!resTools.ok) {
          throw new Error(`Failed to fetch tools => ${resTools.status}`);
        }
        const dataTools = await resTools.json();
        setTools(dataTools.tools || []);

        // 1.2) 获取 availableTools
        const resAvail = await fetch("/api/availableTools");
        if (!resAvail.ok) {
          throw new Error(`Failed to fetch availableTools => ${resAvail.status}`);
        }
        const dataAvail = await resAvail.json();
        setAvailableTools(dataAvail.tools || []);

        // 1.3) 获取 modelTools
        const resModelTools = await fetch("/api/modelTools");
        if (!resModelTools.ok) {
          throw new Error(`Failed to fetch modelTools => ${resModelTools.status}`);
        }
        const dataModelTools = await resModelTools.json();
        setModelTools(dataModelTools.modelTools || {});

      } catch (err: any) {
        console.error("[useTools] initial load error =>", err);
        setToolsError(err.message || "Failed to load data from cloud");
      } finally {
        setToolsLoading(false);
      }
    })();
  }, [isSignedIn]);

  // Save tools to localStorage whenever they change

  /*     useEffect(() => {
          storage.set("availableTools", availableTools);
      }, [availableTools]);
   */

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