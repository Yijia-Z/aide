// /app/api/messages/[id]/lock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { canDoThreadOperation, ThreadOperation } from "@/lib/permission";

export async function PATCH(req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) {
    console.log("[PATCH /api/messages/[id]/lock] => Entered");
const { userId } = await auth();
if (!userId) {
  console.log("[lock] => Unauthorized");
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
try{
  const { id: messageId } = await params;
  console.log("[lock] messageId=", messageId, " userId=", userId);
  const result = await prisma.message.updateMany({
    where: {
      id: messageId,
      OR: [
        { editingBy: null },     // 无人锁定
        { editingBy: userId },   // 已经是自己
      ],
    },
    data: {
      editingBy: userId,
      editingAt: new Date(),
    },
  });
  console.log("[lock] updateMany result =>", result);

  if (result.count === 0) {
    console.log("[lock] => conflict, message is locked by another user");
    // 说明被他人锁定
    return NextResponse.json(
      { error: "Message is locked by another user" },
      { status: 409 }
    );
  }

  // 如果成功就返回一个简单的消息
  return NextResponse.json({ ok: true });
} catch (err: any) {
  console.error("Lock message failed:", err);
  return NextResponse.json({ error: err.message }, { status: 500 });
}
}