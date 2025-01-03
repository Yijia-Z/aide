// /app/api/messages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function PATCH(req: NextRequest,
    { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: messageId } = await params;
    console.log("[PATCH /api/messages/:id] incoming id =", messageId);
    const { content } = await req.json() as { content: string | any[] };
    console.log("[PATCH /api/messages/:id] body = ", content);
   
   
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: Array.isArray(content) ? content : [content],
      },
    });
    console.log("[PATCH /api/messages/:id] updated:", updated);


    return NextResponse.json({ message: updated }, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/messages/:id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export async function DELETE(req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

try {
  const { id: messageId } = await params;
  const { deleteOption } = await req.json(); 
    console.log("[DELETE /api/messages/:id] =>", { messageId, deleteOption });

    // 先查这条消息是否存在
    const messageToDelete = await prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!messageToDelete) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // 根据 deleteOption 分三种逻辑
    if (deleteOption === true) {
      // 1) 连自己和所有后代都删除
      await deleteMessageAndDescendants(messageId);
    } else if (deleteOption === "clear") {
      // 2) 只清空子消息，保留这条
      await clearMessageChildren(messageId);
    } else {
      // 3) 删除自己，但保留子消息并把子“上移”到自己父节点
      await deleteButKeepChildren(messageId);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("[DELETE /api/messages/:id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ====== 辅助函数们写在同一个文件里 ======

// (A) 彻底删除自己 + 递归删除所有下级
async function deleteMessageAndDescendants(msgId: string) {
  // 找到所有直接子节点
  const children = await prisma.message.findMany({
    where: { parentId: msgId },
  });
  // 递归先删子
  for (const child of children) {
    await deleteMessageAndDescendants(child.id);
  }
  // 最后删自己
  await prisma.message.delete({
    where: { id: msgId },
  });
}

// (B) 保留自己，只把所有子节点（及其后代）删光
async function clearMessageChildren(msgId: string) {
  // 找到所有直接子
  const children = await prisma.message.findMany({
    where: { parentId: msgId },
  });
  // 然后用 (A) 的逻辑删除所有子孙
  for (const child of children) {
    await deleteMessageAndDescendants(child.id);
  }
  // 自己不删除
}

// (C) 删除自己，但保留子消息 => 要把子“挂”到我的父节点下
async function deleteButKeepChildren(msgId: string) {
  // 1) 查出这条消息，拿到它的 parentId
  const thisMsg = await prisma.message.findUnique({
    where: { id: msgId },
  });
  if (!thisMsg) return; // 万一被删掉或找不到

  // 2) 把所有子节点的 parentId 改成我的 parentId
  await prisma.message.updateMany({
    where: { parentId: msgId },
    data: { parentId: thisMsg.parentId }, 
  });

  // 3) 然后删掉自己
  await prisma.message.delete({
    where: { id: msgId },
  });
}