// app/api/available-tools/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/available-tools
 * => 返回当前用户所关联的所有 tool 信息
 */
export async function GET(req: NextRequest) {
    const { userId } =await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  try {
    // 1) 从表 availableTool 找到所有 { userId, toolId }，
    //    并联表查询 tool 字段
    const userAvailableTools = await prisma.availableTool.findMany({
      where: { userId },
      include: {
        tool: true, // 这样能拿到 tool 的全部字段
      },
    });

    // 2) 如果只想返回「工具数组」，可直接 map 出 tool
    //    如果想返回 userId, toolId 等可直接用 userAvailableTools
    const tools = userAvailableTools.map(record => record.tool);

    return NextResponse.json({ tools }, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/available-tools] error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
