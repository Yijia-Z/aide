// app/api/membership/insertpin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function PATCH(req: NextRequest) {
  // 1) Clerk 鉴权
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) 从请求体拿到 threadId, pinned
  const { threadId, pinned }: { threadId: string; pinned?: boolean } = await req.json();
  if (!threadId) {
    return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
  }

  // pinned 不传时，可以默认取反，也可以默认 true，看你的需求
  // const pinnedValue = pinned ?? true;
  // 这里就直接用 pinnedValue = pinned，若不传 pinned 就设成 true
  const pinnedValue = pinned;

  // 3) 查 membership
  let membership = await prisma.threadMembership.findUnique({
    where: { userId_threadId: { userId, threadId } },
  });

  // 如果没有 membership，就先创建
  if (!membership) {
    membership = await prisma.threadMembership.create({
      data: {
        userId,
        threadId,
        pinned: pinnedValue,
      },
    });
  } else {
    // 如果有 membership，就更新 pinned 字段
    membership = await prisma.threadMembership.update({
      where: { userId_threadId: { userId, threadId } },
      data: { pinned: pinnedValue },
    });
  }

  return NextResponse.json({ ok: true, pinned: membership.pinned }, { status: 200 });
}
