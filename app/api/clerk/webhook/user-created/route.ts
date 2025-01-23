// app/api/clerk/webhook/user-created/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body.data 包含 user 的信息
    const user = body.data;
    const userId = user.id;
    const email = user.email_addresses?.[0]?.email_address?.toLowerCase();
    const threadId = user.public_metadata?.threadId;
    // 如果你还放了 inviteId => user.public_metadata?.inviteId

    if (!email || !threadId) {
      return NextResponse.json({ message: "No threadId or email in metadata" }, { status: 200 });
    }

    // 1) 找到对应 invite 记录
    //    ( 假设你只发过一条 inviteEmail=xxx, threadId=yyy 的记录 )
    const invite = await prisma.threadInvite.findFirst({
      where: {
        inviteEmail: email,
        threadId: threadId,
        acceptedAt: null, // 只找还没被 accepted 的
      },
    });

    if (!invite) {
      // 说明可能没找到；要么之前 invite 被 accept 了，要么没有 invite 
      return NextResponse.json({ message: "No matching invite" }, { status: 200 });
    }

    // 2) 标记已接受
    await prisma.threadInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    // 3) upsert userProfile
    const userProfile = await prisma.userProfile.upsert({
      where: { id: userId },
      update: { email },
      create: {
        id: userId,
        email,
      },
    });

    // 4) 把这个 user 加入 ThreadMembership
    //    (这里可以用 invite.role 作为 membership.role)
    await prisma.threadMembership.upsert({
      where: {
        userId_threadId: { userId, threadId },
      },
      update: {
        role: invite.role, 
      },
      create: {
        userId,
        threadId,
        role: invite.role, 
      },
    });

    return NextResponse.json({ message: "Invite accepted and membership updated" }, { status: 200 });
  } catch (err: any) {
    console.error("webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
