// app/api/threads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb"; 
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";

// [GET]  获取用户所有 Thread 的简要列表（只包含 id, title, updatedAt, isPinned）
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // 查询 Thread 并联表拿到 pinned
    // 其中 pinned 存在 membership 里，而 membership 用 userId_threadId 做外键
    const threads = await prisma.thread.findMany({
      where: {
        isDeleted: false,

        memberships: {
          
          some: { userId },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        // 如果只想要 id、title，不想要 messages，可以不 select messages
        memberships: {
          // 只查当前 userId 对应的 membership
          where: { userId },
          select: {
            pinned: true,
          },
        },
      },
    });

    // 将 membership[].pinned 提炼成 isPinned（表示该 user 是否 pin 了此 thread）
    const mapped = threads.map(t => {
      const pinnedValue = t.memberships?.[0]?.pinned ?? false;
      return {
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
        isPinned: pinnedValue,
      };
    });

    return NextResponse.json({ threads: mapped }, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/threads] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title } = await req.json();
    // 也可以接收更多字段，比如 messages 等

    // 1) 在 Thread 表里创建记录，数据库自动生成 id 或由 Prisma 生成
    const newThread = await prisma.thread.create({
      data: {
        title: title ?? "Untitled Thread",
        messages: [],
      },
    });

    // 2) 同时在 ThreadMembership 插入一条，表示当前 user 拥有此 Thread
    await prisma.threadMembership.create({
      data: {
        userId,
        threadId: newThread.id,
        role: "owner",
      },
    });

    // 3) 返回前端
    const responseData = {
      ...newThread,
     
      isPinned: false, 
    };

    return NextResponse.json({ thread: responseData }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/threads error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}