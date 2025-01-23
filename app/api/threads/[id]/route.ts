import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { Thread } from "@/types/models"; // your local interface that includes: { id, title, messages, isPinned, ... }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Clerk auth: get userId
  const { userId } =await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Get threadId from route params
  const { id: threadId } = await params;
  console.log("[Backend] PATCH /api/threads/[id], threadId =", threadId);
  const membership = await prisma.threadMembership.findUnique({
    where: { userId_threadId: { userId, threadId } },
  });
  if (!membership) {
    console.log("[PATCH] membership not found => 403");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // 如果 role 不是 owner/editor，就 403
  if (membership.role !== "OWNER" && membership.role !== "EDITOR") {
    console.log("[PATCH] no permission => 403");
    return NextResponse.json({ error: "No Permission" }, { status: 403 });
  }
  const existingThread = await prisma.thread.findUnique({
    where: { id: threadId },
  });
  if (!existingThread) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  // 若已软删除，就不让改
  if (existingThread.isDeleted) {
    console.log("[PATCH] thread isDeleted => 403");
    return NextResponse.json({ error: "Thread Deleted" }, { status: 403 });
  }
  try {
    // 3) Read the partial data from request body
    const updatedData = (await req.json()) as Partial<Thread>;
    console.log("[Backend] updatedData from client:", updatedData);

    // 4) First check if the Thread already exists, so we can keep old messages if not provided
    const existingThread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        
      },
    });

    // 5) Perform upsert. If the thread does not exist, create it with messages from updatedData; 
    //    if it does exist, update relevant fields, including messages (merging or overwriting).
    const upsertedThread = await prisma.thread.upsert({
      where: { id: threadId },
      update: {
        title: updatedData.title,
        // If the client sent updatedData.messages, we use that; otherwise fallback to existing
       
       
      },
      create: {
        id: threadId,
        title: updatedData.title ?? "Untitled Thread",
        
      },
    });
    console.log("[Backend] upsertedThread =>", upsertedThread);

    // 6) Ensure membership exists for this userId => threadId
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });
    if (!membership) {
      await prisma.threadMembership.create({
        data: { userId, threadId },
      });
      console.log("[Backend] Created membership:", { userId, threadId });
    } else {
      console.log("[Backend] Membership already exists =>", membership);
    }

    return NextResponse.json({ thread: upsertedThread }, { status: 200 });
  } catch (error: any) {
    console.error("[Backend] Failed to upsert thread:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  console.log("[Backend] GET /api/threads/[id]", threadId);

  try {
    // 1) 确保 userId 对此 thread 有 membership
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2) 找到这个 thread 本身，包括 messages
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        title: true,
        
        updatedAt: true,
        isDeleted: true,
      },
    });

    if (!thread) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    if (thread.isDeleted) {
      console.log("[GET] thread isDeleted => 404");
      return NextResponse.json({ error: "Thread Deleted" }, { status: 404 });
    }

    // 3) 返回前端
     const { isDeleted, ...rest } = thread;

    return NextResponse.json({ thread: rest }, { status: 200 });
  } catch (error: any) {
    console.error("[Backend] GET thread by id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }  
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  console.log("[Backend] GET /api/threads/[id]", threadId);
  try {
    // 查 membership
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });
    if (!membership) {
      console.log("[DELETE] membership not found => 403");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 查 Thread
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 如果是 owner，则把 Thread 软删除
    if (membership.role === "OWNER") {
      console.log("[DELETE] user is owner => delete this thread");
      await prisma.thread.update({
        where: { id: threadId },
        data: { isDeleted: true },
      });
      return NextResponse.json({ message: "Thread deleted" }, { status: 200 });
    } else {
      // 不是 owner，就仅仅删除自己的 membership
      console.log("[DELETE] user is not owner => remove membership only");
      await prisma.threadMembership.delete({
        where: { userId_threadId: { userId, threadId } },
      });
      return NextResponse.json({ message: "Left the thread" }, { status: 200 });
    }
  } catch (error: any) {
    console.error("[DELETE /api/threads/[id]] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}