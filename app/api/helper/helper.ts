// src/helpers/helpers.ts

// Function to fetch and normalize tools
export async function fetchAndNormalizeTools(apiBaseUrl: string) {
    const toolsResponse = await fetch(`${apiBaseUrl}/api/load_tools`);
  
    if (!toolsResponse.ok) {
      const errorText = await toolsResponse.text();
      console.error(`Failed to load tools: ${toolsResponse.status} ${toolsResponse.statusText}`, errorText);
      throw new Error(`Failed to load tools: ${toolsResponse.status} ${toolsResponse.statusText}`);
    }
  
    const toolsData = await toolsResponse.json();
    console.log("Loaded tools data:", JSON.stringify(toolsData, null, 2));
  
    return toolsData.tools.map((tool: any) => ({
      ...tool,
      enabled: tool.enabled === true || tool.enabled === "true",
    }));
  }
  
  // Function to filter out undefined values from the request parameters
  export function filterUndefinedParams(params: Record<string, any>) {
    return Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined)
    );
  }
  
  // Function to parse and process tool calls
  export async function processToolCalls(toolCall: any, apiBaseUrl: string) {
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch (error) {
      console.error("Error parsing tool arguments:", error);
      throw new Error("Invalid tool arguments format.");
    }
  
    const toolUseResponse = await fetch(`${apiBaseUrl}/api/process_tool_use`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool_name: toolCall.function.name,
        tool_args: parsedArgs,
        tool_call_id: toolCall.id,
      }),
    });
  
    if (!toolUseResponse.ok) {
      const errorText = await toolUseResponse.text();
      console.error(`Failed to process tool use: ${toolUseResponse.status} ${toolUseResponse.statusText}`, errorText);
      throw new Error(`Failed to process tool use: ${toolUseResponse.status} ${toolUseResponse.statusText}`);
    }
  
    return await toolUseResponse.json();
  }
  