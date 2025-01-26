import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { ThreadRole } from '../../../../types/models';

export async function POST(req: NextRequest) {
  console.log("===[POST /api/threads/full] START===");
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { thread } = await req.json() as {
      thread: {
        id: string;
        title: string;
        isPinned?: boolean;
        updatedAt?: string;
        messages: any[];
      };
    };
    if (!thread?.id || !Array.isArray(thread.messages)) {
      return NextResponse.json({ error: "Invalid thread data" }, { status: 400 });
    }

    // 1) 开始事务
    console.log("1) Starting transaction to create Thread + Membership + Messages");
    const result = await prisma.$transaction(async (tx) => {
      // a) 创建 Thread
      console.log(`[1a) Creating Thread] ID=${thread.id} userId=${userId}`);
      const newThread = await tx.thread.create({
        data: {
          id: thread.id,
          title: thread.title ?? "Welcome to AIDE",
          // updatedAt 也可以赋值
          updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : new Date(),
          isDeleted: false,
          creatorId:userId
        },
      });
      console.log("    => Created Thread:", newThread);

      console.log("[1b) Creating ThreadMembership] userId=", userId, " threadId=", newThread.id);
      
      // b) 创建 membership
      await tx.threadMembership.create({
        data: {
          userId,
          threadId: newThread.id,
          role: "OWNER",
          pinned: thread.isPinned ?? false, // 看你要不要同步 pinned
          joinedAt: new Date(),
        },
      });
      console.log("    => Created ThreadMembership");
      // c) 插入 messages
      //    你的 messages 数组里可能嵌套了 replies，需要做个递归插入
      //    或者，如果结构很简单，就先 BFS/DFS 展开，然后再插
      await insertMessagesRecursively(tx, thread.messages, newThread.id, null);

      return newThread;
    });

    // 成功后返回
    return NextResponse.json({ success: true, thread: result }, { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/threads/full] error =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * 递归插入 messages（含 replies）
 */
async function insertMessagesRecursively(
  tx: Prisma.TransactionClient,
  messages: any[], 
  threadId: string, 
  parentId: string | null
) {
  for (const msg of messages) {
    // 先插这条
    const created = await tx.message.create({
      data: {
        id: msg.id,
        threadId,
        parentId,
        publisher: msg.publisher ?? "ai",
        content: msg.content ?? [],
      },
    });

    // 如果有 replies，就递归插
    if (Array.isArray(msg.replies) && msg.replies.length > 0) {
      await insertMessagesRecursively(tx, msg.replies, threadId, msg.id);
    }
  }
}