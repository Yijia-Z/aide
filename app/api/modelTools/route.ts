// app/api/modelTools/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/modelTools
 * => 读取当前用户所有的 model -> toolId 关系，以一个大字典返回
 *    { modelTools: { [modelId]: [toolId1, toolId2...] } }
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 找到所有 userId 拥有的 model
    const allModels = await prisma.model.findMany({
      where: { createdBy: userId, isDeleted: false },
      select: { id: true },
    });
    const modelIds = allModels.map(m => m.id);

    // 找到所有 userId 所属 model 的 ModelTool 记录
    const allLinks = await prisma.modelTool.findMany({
      where: {
        modelId: { in: modelIds },
      },
      select: {
        modelId: true,
        toolId: true,
      },
    });

    // 汇总成字典
    const resultDict: Record<string, string[]> = {};
    for (const { modelId, toolId } of allLinks) {
      if (!resultDict[modelId]) {
        resultDict[modelId] = [];
      }
      resultDict[modelId].push(toolId);
    }

    return NextResponse.json({ modelTools: resultDict }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/modelTools error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


/**
 * POST /api/modelTools
 * Body: { modelTools: { [modelId: string]: string[] } }
 * => 替换 user 所有/部分 model 的 Tool 关系。
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { modelTools } = await req.json() || {};
    if (!modelTools || typeof modelTools !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // 取出 keys => modelId
    const modelIds = Object.keys(modelTools);
    if (modelIds.length === 0) {
      return NextResponse.json({ success: true, note: "No modelTools to process" });
    }

    // 检查这些 model 是否都属于 user
    const foundModels = await prisma.model.findMany({
      where: { 
        id: { in: modelIds },
        createdBy: userId,
        isDeleted: false 
      },
      select: { id: true },
    });
    if (foundModels.length !== modelIds.length) {
      return NextResponse.json({ error: "Some models not found or not owned by user" }, { status: 403 });
    }

    // 开始事务
    await prisma.$transaction(async (tx) => {
      for (const mId of modelIds) {
        // 1) 先删旧记录
        await tx.modelTool.deleteMany({ where: { modelId: mId } });
        // 2) 新建
        const toolIdList = modelTools[mId] as string[];
        for (const tId of toolIdList) {
          // 可选：检查 Tool 是否存在/未删除
          // ...
          await tx.modelTool.create({
            data: { modelId: mId, toolId: tId },
          });
        }
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/modelTools error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
