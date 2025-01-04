// /app/api/models/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

// 1) GET: 列出当前用户未软删除的模型
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const models = await prisma.model.findMany({
      where: {
        createdBy: userId,
        isDeleted: false,           // 只查询没被软删的
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ models }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/models error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2) POST: 创建一条新模型
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    // 前端发来 { "models": [ {...}, {...}, ... ] }
    const { model } = body;

    const created = await prisma.model.create({
      data: {
        id: model.id,
        name: model.name ?? "New Model",
        baseModel: model.baseModel ?? "none",
        systemPrompt: model.systemPrompt ?? "",
        parameters: model.parameters ?? {},
        createdBy: userId,
      },
    });

    return NextResponse.json({ model: created }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/models error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}