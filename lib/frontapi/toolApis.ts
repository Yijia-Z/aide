// app/lib/frontapi/toolApis.ts
import { Tool } from "@/components/types";

export async function upsertNewTool(
  toolData: Omit<Tool, "id">
): Promise<Tool> {
  // 直接在这里统一发请求

  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toolData),
  });

  if (!res.ok) {
    throw new Error(`Failed to upsert tool => status ${res.status}`);
  }

  const created: Tool = await res.json();
  return created;
}
/**
 * 保存某个 Tool 的脚本代码
 * 
 * @param toolId 工具ID
 * @param scriptContent 用户编辑的脚本字符串
 */
export async function saveToolScript(toolId: string, scriptContent: string): Promise<void> {
  console.log("saveToolScript has been called");
    const response = await fetch(`/api/tools/${toolId}/script`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: scriptContent }),
    });
    if (!response.ok) {
      throw new Error(`Failed to save script => status ${response.status}`);
    }
    // 如果后端返回更新后的 Tool，也可以在这里:
    // const updated: Tool = await response.json();
    // return updated;
  }
  export async function handleUploadScript(toolId: string, scriptContent: string) {
    // 1) 先把 script 保存
    // 2) 把 approvalRate=100
    await fetch(`/api/tools/${toolId}`, {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        script: scriptContent,
        approvalRate: 50  // or isApproved: true
      })
    });
  }