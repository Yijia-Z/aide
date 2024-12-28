// app/api/threads/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb"; 
import { auth } from "@clerk/nextjs/server"; 
import { Thread  } from "@/types/models";


export async function PATCH(
  req: NextRequest,
  context: any 
) {
  // 1) Clerk 鉴权：拿到 userId
  const { userId } = await auth();
  console.log("[Backend] userId from Clerk auth:", userId);
  if (!userId) {
    console.log("[Backend] Unauthorized - no userId");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) 拿到路由参数 [id]，即 threadId
  const threadId = context.params.id as string;
  console.log("[Backend] Enter PATCH /api/threads/[id], threadId =", threadId);

  try {
    // 3) 从请求体读取要更新或创建的字段
    //    注意这里把它断言成 Partial<Thread>，以表示「部分更新」
    const updatedData = (await req.json()) as Partial<Thread>;
    console.log("[Backend] updatedData from client:", updatedData);

    // 4) 执行 upsert：若 threadId 不存在就 create，若已存在则 update
    const upsertedThread = await prisma.thread.upsert({
      where: { id: threadId },
      update: {
        // 下面只接收前端传入的字段 (title, isPinned等)，其余不变
        // 如果你想自动更新 updatedAt，可以手动设定
        ...updatedData,
       
      },
      create: {
        // create 里通常需要至少包含 id 
        id: threadId,
        title: updatedData.title ?? "Untitled Thread",
        // 以及其他你想在创建时设定的字段 (title, isPinned 等)
        ...updatedData,
       
      },
    });
    console.log("[Backend] upsertedThread =>", upsertedThread);

    // 5) 确保 membership 存在（若 schema.prisma 里是多对多关系）
    //    如果已经存在 (userId, threadId) 就不动，否则自动创建
    console.log("[Backend] Checking membership for userId =", userId);
    const membership = await prisma.threadMembership.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });

    if (!membership) {
      console.log("[Backend] Membership not found. Creating one...");
      await prisma.threadMembership.create({
        data: {
          userId,
          threadId,
          // role: "VIEWER" or whatever logic you want
        },
      });
      console.log("[Backend] Created membership for", { userId, threadId });
    } else {
      console.log("[Backend] membership already exists =>", membership);
    }

    // 6) 返回成功 JSON
    return NextResponse.json({ thread: upsertedThread }, { status: 200 });
  } catch (error: any) {
    console.error("[Backend] Failed to upsert thread:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}