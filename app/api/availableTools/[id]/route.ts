import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

/**
 * POST   /api/availableTools/:toolId
 * 把 toolId 加到当前用户的 availableTool ( upsert )
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } =await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id:toolId } =await  params;
  if (!toolId) {
    return NextResponse.json({ error: "Missing toolId" }, { status: 400 });
  }

  try {
    // upsert => 已存在 (userId, toolId) 就不重复插入
    await prisma.availableTool.upsert({
      where: { userId_toolId: { userId, toolId } },
      update: {},
      create: { userId, toolId },
    });

    return NextResponse.json({ message: `Tool ${toolId} added to user ${userId}`}, { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/available-tools/:toolId] error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/available-tools/:toolId
 * 从当前用户 availableTool 移除
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } =await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id:toolId } =await  params;
  if (!toolId) {
    return NextResponse.json({ error: "Missing toolId" }, { status: 400 });
  }

  try {
    // 1) 先删 availableTool
    await prisma.availableTool.deleteMany({
      where: { userId, toolId },
    });

    // 2) 找出 user 拥有的 modelTool 记录
    const impactedModelTools = await prisma.modelTool.findMany({
      where: {
        toolId,
        model: {
          createdBy: userId,
          isDeleted: false,
        },
      },
      select: { modelId: true },
    });
    if (impactedModelTools.length === 0) {
      return NextResponse.json({
        message: "Tool removed, no model was using it",
        updatedModelIds: [],
      });
    }

    // 3) 拿到所有 modelId
    const impactedModelIds = impactedModelTools.map((m) => m.modelId);

    // 4) 从 modelTool 表移除
    await prisma.modelTool.deleteMany({
      where: {
        toolId,
        modelId: { in: impactedModelIds },
      },
    });

    // 5) 同步更新 model.parameters.tools
    //    先查出每个 model 的 parameters JSON, 过滤掉该 toolId, 再回存
    for (const mid of impactedModelIds) {
      const model = await prisma.model.findUnique({ where: { id: mid } });
      if (!model) continue;

      const oldParams = model.parameters as any; // 你可能要定义一下
      if (!oldParams?.tools || !Array.isArray(oldParams.tools)) {
        continue; 
      }
      // 过滤掉 toolId
      const newTools = oldParams.tools.filter((t: any) => t.id !== toolId);
      const newParams = {
        ...oldParams,
        tools: newTools,
      };

      // 回存
      await prisma.model.update({
        where: { id: mid },
        data: {
          parameters: newParams,
        },
      });
    }

    return NextResponse.json({
      message: "Tool removed + model.parameters.tools updated",
      updatedModelIds: impactedModelIds,
    });
  } catch (err: any) {
    console.error("[DELETE /api/availableTools/:toolId] error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}