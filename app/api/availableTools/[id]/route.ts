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
    await prisma.availableTool.deleteMany({
      where: { userId, toolId },
    });
    return NextResponse.json({ message: `Tool ${toolId} removed from user ${userId}`}, { status: 200 });
  } catch (err: any) {
    console.error("[DELETE /api/available-tools/:toolId] error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
