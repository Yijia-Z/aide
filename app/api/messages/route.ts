// app/api/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
    const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2) 解析请求体
    const { id,threadId, parentId, publisher, content } = await req.json() as {
      id:string,
      threadId: string;
      parentId?: string | null;
      publisher: "user" | "ai";
      content: string | any[]; 
      // content 可能是 string 或 ContentPart[]，视你需求
    };

    // 3) 查看用户是否在此 thread 有 membership
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4) 创建消息
    // 如果 publisher="user"，就设置 userId；若是 "ai"，可以不设
    const newMsg = await prisma.message.create({
      data: {
        id,
        threadId,
        parentId: parentId ?? null,
        publisher,
        userId: publisher === "user" ? userId : null,
        
        // content 存储到 Json 字段
        content: Array.isArray(content) ? content : [content], 
      },
      // 也可以 `select` 一些字段
    });


    // 6) 返回前端
    //    带上 newMsg 以及 username
    return NextResponse.json({
      message: {
        ...newMsg,
        
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/messages] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function GET(req: NextRequest) {
  try {
    // 1) 解析查询参数
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // e.g. /api/messages?threadId=xxxx
    const url = new URL(req.url);
    const threadId = url.searchParams.get("threadId");
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    // 2) 检查是否有 membership（即当前 userId 对此 thread 是否可访问）
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) 查询该 thread 下的所有 messages
    const messages = await prisma.message.findMany({
      where: {
        threadId,
      },
      // 如果想按照创建时间、或其它字段排序，可以加一个 orderBy
      // orderBy: { createdAt: "asc" },
    });

    // 4) 返回给前端
    //    前端会把这里的 messages 合并进 thread 对象
    return NextResponse.json({ messages }, { status: 200 });
  } catch (error: any) {
    console.error("[GET /api/messages] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}