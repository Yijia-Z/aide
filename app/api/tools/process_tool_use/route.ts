import { NextRequest, NextResponse } from 'next/server'
// 这只是示例，你可以把 ToolUseRequest 放在你自己的 /types/models.ts 里
// 例如：
// interface ToolUseRequest {
//   tool_name: string;
//   tool_args: Record<string, any>;
//   tool_call_id: string;
// }

import { ToolUseRequest } from '@/types/models'

// 这里是你要调用的函数，它会根据 tool_name/tool_args 做相应处理
// 你可以放在 /lib/functions/calculate.ts 或 /lib/functions/get_current_weather.ts 等
// 只要能正常 import 到就行
import { processToolUseFunction } from '@/lib/tool_logic'

/**
 * POST /api/tools/process_tool_use
 * 用于处理各种工具调用
 */
export async function POST(req: NextRequest) {
  try {
    // 解析请求体
    const body = (await req.json()) as ToolUseRequest

    // 调用实际逻辑函数
    const resp = await processToolUseFunction(body)
    
    // 返回 JSON
    return NextResponse.json(resp)

  } catch (error: any) {
    console.error("[process_tool_use] Error:", error)
    return NextResponse.json(
      { error: "Failed to process tool use." },
      { status: 500 },
    )
  }
}