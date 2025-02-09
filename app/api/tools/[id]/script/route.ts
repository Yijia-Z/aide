import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";

export async function PATCH(req: NextRequest,
    { params }: { params: Promise<{id: string }> }) {
  try {
    
    const { id:toolId} = await params;// 访问 /api/tools/{toolId}/script
    const { script } = await req.json();
console.log("cunle");
    // 假设你在 Tool 模型里有个 `script` 字段
    // (String或Text或Json)
    const updated = await prisma.tool.update({
      where: { id: toolId },
      data: { script },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/tools/[toolId]/script] error =>", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
