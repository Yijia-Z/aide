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
  console.log('ENV CHECK =>', process.env.aide_POSTGRES_URL);
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
            role: true
          },
        },
      },
    });

    // 将 membership[].pinned 提炼成 isPinned（表示该 user 是否 pin 了此 thread）
    const mapped = threads.map(t => {
      const pinnedValue = t.memberships?.[0]?.pinned ?? false;
      const roleValue = t.memberships?.[0]?.role ?? "VIEWER"; 
      return {
        id: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
        isPinned: pinnedValue,
        role: roleValue,
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
    // First ensure UserProfile exists
    let userProfile = await prisma.userProfile.findUnique({
      where: { id: userId }
    });

    // If no profile exists, create one
    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: { id: userId }
      });
    }

    const { id, title } = await req.json() as {
      id: string;
      title?: string;
    };

    // Create thread and membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1) Create thread
      const newThread = await tx.thread.create({
        data: {
          id,
          title: title ?? "Untitled Thread",
          creatorId: userId,
        },
      });

      // 2) Create membership
      await tx.threadMembership.create({
        data: {
          userId: userProfile.id,
          threadId: newThread.id,
          role: "OWNER",
        },
      });

      return newThread;
    });

    // 3) Return response
    const responseData = {
      ...result,
      isPinned: false,
      role: "OWNER",
    };

    return NextResponse.json({ thread: responseData }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/threads error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}