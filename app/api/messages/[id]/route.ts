// /app/api/messages/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { canDoThreadOperation, ThreadOperation } from "@/lib/permission";

export async function PATCH(req: NextRequest,
    { params }: { params: Promise<{ id: string }> }) {
      console.log("[PATCH /api/messages/[id]] => Entered PATCH");
  
  const { userId } = await auth();

 if (!userId) {
    console.log("[PATCH] => Unauthorized, no userId");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id: messageId } = await params;
    console.log("[PATCH /api/messages/:id] incoming id =", messageId);
    const { content } = await req.json() as { content: string | any[] };
    console.log("[PATCH /api/messages/:id] body = ", content);
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        threadId: true,
        publisher: true,
      },
    });
    console.log("[PATCH /api/messages/:id] existingMessage =>", existingMessage);

    if (!existingMessage) {
      return NextResponse.json({ error: "Message Not Found" }, { status: 404 });
    }

    const threadId = existingMessage.threadId;
    const publisher = existingMessage.publisher;
   if(publisher!="ai"){
       const allowed = await canDoThreadOperation(userId, threadId, ThreadOperation.EDIT_MESSAGE);
       if (!allowed) {
        console.log(`[PATCH] userId=${userId} no permission to edit message in thread=${threadId}`);
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
     }
   
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: Array.isArray(content) ? content : [content],
        editingBy: null, 
        editingAt: null, 
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
      select: {
        threadId: true,
        publisher: true,
        isDeleted: true,
      },
    });
   
    if (!messageToDelete) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    const allowed = await canDoThreadOperation(userId, messageToDelete.threadId, ThreadOperation.EDIT_MESSAGE);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });}

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
    where: { parentId: msgId, isDeleted: false },
  });
  // 递归先删子
  for (const child of children) {
    await deleteMessageAndDescendants(child.id);
  }
  // 最后删自己
  await prisma.message.update({
    where: { id: msgId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

// (B) 保留自己，只把所有子节点（及其后代）删光
async function clearMessageChildren(msgId: string) {
  // 找到直接子(未软删)
  const children = await prisma.message.findMany({
    where: { parentId: msgId, isDeleted: false },
  });
  // 递归软删
  for (const child of children) {
    await deleteMessageAndDescendants(child.id);
  }
  // 自己不删
}

// (C) 删除自己，但保留子消息 => 要把子“挂”到我的父节点下
async function deleteButKeepChildren(msgId: string) {
  // 1) 查出这条消息 => 拿到 parentId
  const thisMsg = await prisma.message.findUnique({
    where: { id: msgId },
  });
  if (!thisMsg) return;

  // 2) 把子节点们改到 my parent
  await prisma.message.updateMany({
    where: { parentId: msgId, isDeleted: false },
    data: { parentId: thisMsg.parentId },
  });

  // 3) 软删自己
  await prisma.message.update({
    where: { id: msgId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}
export async function GET(req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


  const { id: messageId } = await params;
  console.log("[GET /api/messages/:id] => fetch message", { messageId, userId });
  const fmsg = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      content: true,
      editingBy: true,
      // ...
    },
  });
  if (!fmsg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const locked = fmsg.editingBy !== null && fmsg.editingBy !== userId;
  const msg = {
    id: fmsg.id,
    content: fmsg.content,
    locked,           // 新增 locked
    // 你如果还想把编辑者是不是自己锁，改写成
    // locked = (msg.editingBy !== null && msg.editingBy !== userId)
    // 或者 lockedByMe = (msg.editingBy === userId)
    // ...
  };
  console.log("[GET /api/messages/:id] => returning message", msg);
  // 如果你想包含 editingBy 的用户名，可以再 join userProfile
  
  return NextResponse.json({ message: msg }, { status: 200 });
}