// lib/process_tool_use.ts
import { runCalculate } from './functions/calculate'
import { runGetCurrentWeather } from './functions/get_current_weather'
import { ToolUseRequest, ToolUseResponse } from '@/types/models'

export async function processToolUseFunction(req: ToolUseRequest): Promise<ToolUseResponse> {
  const { tool_name, tool_args, tool_call_id } = req;

  // “动态”加载也行，这里简单 if else
  if (tool_name === 'calculate') {
    try {
      const { operation, operand1, operand2 } = tool_args;
      const result = runCalculate(operation, operand1, operand2);
      return {
        role: 'tool',
        name: tool_name,
        tool_call_id,
        content: JSON.stringify(result)
      }
    } catch (err: any) {
      return {
        role: 'tool',
        name: tool_name,
        tool_call_id,
        content: JSON.stringify({ error: err.message })
      }
    }
  } else if (tool_name === 'get_current_weather') {
    try {
      const { location, unit } = tool_args;
      const result = await runGetCurrentWeather(location, unit);
      return {
        role: 'tool',
        name: tool_name,
        tool_call_id,
        content: JSON.stringify(result),
      }
    } catch (err: any) {
      return {
        role: 'tool',
        name: tool_name,
        tool_call_id,
        content: JSON.stringify({ error: err.message })
      }
    }
  } else {
    // 未找到
    return {
      role: 'tool',
      name: tool_name,
      tool_call_id,
      content: JSON.stringify({ error: `Tool not found: ${tool_name}`})
    }
  }
}