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
    const { id,threadId, parentId, publisher, content,modelConfig,  } = await req.json() as {
      id:string,
      threadId: string;
      parentId?: string | null;
      publisher: "user" | "ai";
      content: string | any[]; 
      modelConfig?: any;
      // content 可能是 string 或 ContentPart[]，视你需求
    };
    console.log("[POST /api/messages] incoming content =>", content);
    // 3) 查看用户是否在此 thread 有 membership
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const finalContent = Array.isArray(content) ? content : [content];
    console.log("[POST /api/messages] finalContent =>", finalContent);
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
        content: finalContent,
        modelConfig: modelConfig ?? null,
      },
      // 也可以 `select` 一些字段
    });
    console.log("[POST /api/messages] created message:", newMsg);

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
    const rawMessages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },  // 比如按时间排序
      select: {
        id: true,
        parentId: true,
        publisher: true,
        userId: true,
        content: true,
        modelConfig: true,
        createdAt: true,
        updatedAt: true,
        userProfile: {
          select: {
            username: true,
          },
        },
      },
    });
    function buildTree(messages: typeof rawMessages) {
      const map: Record<string, typeof rawMessages[number] & { replies: any[] }> = {};
      const roots: (typeof rawMessages[number] & { replies: any[] })[] = [];

      // 所有 message 放到 map 里，并加个 replies: []
      for (const m of messages) {
        map[m.id] = { ...m, replies: [] };
      }

      // parentId === null => 顶层；否则往 parent 的 replies 里插
      for (const m of messages) {
        if (!m.parentId) {
          roots.push(map[m.id]);
        } else {
          if (map[m.parentId]) {
            map[m.parentId].replies.push(map[m.id]);
          } else {
            console.warn(`[buildTree] cannot find parent for message ${m.id}`);
          }
        }
      }

      return roots;
    }

    // 构建树状结构
    const nestedMessages = buildTree(rawMessages.map(msg => ({
      ...msg,
      userName: msg.userProfile?.username ?? null, //  <-- 拍平
    })))
    console.log("[GET /api/messages] nestedMessages =>", nestedMessages);
    // 4) 返回给前端
    //    前端会把这里的 messages 合并进 thread 对象
    return NextResponse.json({messages: nestedMessages}, { status: 200 });
  } catch (error: any) {
    console.error("[GET /api/messages] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}