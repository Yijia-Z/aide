// /app/api/models/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";



export async function PATCH(req: NextRequest,
    { params }: { params: Promise<{id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    console.log("[PATCH] raw params =>", params);
    const { id: modelId } = await params;
    console.log("[PATCH] modelId =>", modelId);
    const body = await req.json();
    // 你可以只允许 name, systemPrompt, parameters 等字段
    console.log("[PATCH] received body =>", body);
    const { name, baseModel, systemPrompt, parameters } = body;

    // 先确认是否存在
    const exist = await prisma.model.findFirst({
      where: { id: modelId, createdBy: userId, isDeleted: false },
    });
    if (!exist) {
      return NextResponse.json({ error: "Not found or no permission" }, { status: 404 });
    }

    const updated = await prisma.model.update({
      where: { id: modelId },
      data: {
        ...(name !== undefined && { name }),
        ...(baseModel !== undefined && { baseModel }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(parameters !== undefined && { parameters }),
      },
    });
    return NextResponse.json({ model: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest,
  { params }: { params: Promise<{id: string }> }) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
    try {
      console.log("[PATCH] raw params =>", params);
      const { id: modelId } = await params;
      console.log("[PATCH] modelId =>", modelId);
      
    const exist = await prisma.model.findFirst({
      where: { id: modelId, createdBy: userId, isDeleted: false },
    });
    if (!exist) {
      return NextResponse.json({ error: "Not found or no permission" }, { status: 404 });
    }

    // 软删除
    const updated = await prisma.model.update({
      where: { id: modelId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ model: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
