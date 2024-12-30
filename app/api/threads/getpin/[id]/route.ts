// app/api/threads/getpin/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;

  // 查到 Thread
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      memberships: {
        where: { userId }, // 只包含当前用户的 membership
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // membership 有可能是空数组
  const membership = thread.memberships[0];
  const pinned = membership ? membership.pinned : false;

  return NextResponse.json({
    thread: {
      id: thread.id,
      title: thread.title,
      pinned,
      updatedAt: thread.updatedAt,
      createdAt: thread.createdAt,
    },
  });
}
