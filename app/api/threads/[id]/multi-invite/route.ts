// app/api/threads/[threadId]/multi-invite/route.ts
import { prisma } from "@/lib/db/prismadb"; // 你的 prisma 客户端
import { auth,clerkClient  } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { canDoThreadOperation, ThreadOperation } from "@/lib/permission";

/**
 * 批量邀请接口:
 * POST /api/threads/[threadId]/multi-invite
 * 请求体: { invites: { email: string, role: ThreadRole }[] }
 */
import { ThreadRole } from "@/types/models"; // your local interface that includes: { id, title, messages, isPinned, ... }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  // 1) Clerk auth: get userId
  const { userId } =await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: threadId } = await params;

    // 2) 解析请求体
    const body = await req.json();
    const invitesRaw = body.invites;
    const invites: ThreadRole[] = Array.isArray(invitesRaw)
      ? invitesRaw
      : [body]; // 兼容单条
    const allowed = await canDoThreadOperation(userId, threadId, ThreadOperation.INVITE_MEMBER);
    if (!allowed) {
      return NextResponse.json({ error: "No Permission" }, { status: 403 });
    }
    const results: any[] = [];
    const clerkInviteList: {
      email_address: string,
      public_metadata: { },
      redirect_url?: string,
      notify?: boolean,
      ignore_existing?: boolean,
      expires_in_days?: number;
    }[] = [];


    // 4) 逐条处理 invites
    for (const item of invites) {
      const email = (item.email || "").trim().toLowerCase();
      // 如果 item.role 为空，就默认 "VIEWER"
      const role = item.role || "VIEWER";

      // a) 一定先记录到 ThreadInvite 表(做留痕)
      const inviteRecord = await prisma.threadInvite.create({
        data: {
          threadId,
          inviteEmail: email,
          role,
          invitedBy: userId,
          acceptedAt: null, // 如果你想“直接绑定”也可以写 new Date()
        },
      });

      // b) 检查用户是否已注册
      const existingUser = await prisma.userProfile.findUnique({
        where: { email },
      });

      if (existingUser) {
        // c) 如果已注册 => upsert membership => 立刻加入该 Thread
        await prisma.threadMembership.upsert({
          where: {
            userId_threadId: {
              userId: existingUser.id,
              threadId,
            },
          },
          update: {
            role,
          },
          create: {
            userId: existingUser.id,
            threadId,
            role,
          },
        });
        results.push({
          email,
          inviteId: inviteRecord.id,
          status: "joined",
        });
      } else {
        clerkInviteList.push({
          email_address: email,
          public_metadata: {
            threadId,
            inviteId: inviteRecord.id,
          },
          

          notify: true, // 让 Clerk 真的发邮件
          ignore_existing: false, 
          expires_in_days:3
          // 你也可以设置: ignore_existing: true (如果想无视“已存在的用户”报错)
        });
        // d) 如果没注册 => 只在 invites 表留痕 (已经创建 inviteRecord)
        //    等对方注册后是否再自动加，这里就看你业务需求了
        results.push({
          email,
          inviteId: inviteRecord.id,
          status: "user-not-registered",
        });
      }
    }
    if (clerkInviteList.length > 0) {
      // fetch https://api.clerk.dev/v1/invitations/bulk
      // 需要 Bearer <CLERK_SECRET_KEY> 
      const clerkRes = await fetch("https://api.clerk.dev/v1/invitations/bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clerkInviteList),
      });

      if (!clerkRes.ok) {
        // 如果 Clerk 说有错误（如 email 已经被邀请过，或用户已存在）
        const errorDetail = await clerkRes.json();
        console.error("Clerk bulk invite error:", errorDetail);
        // 这里你可以选择是否要抛错，让前端知道
        // return NextResponse.json({ error: errorDetail }, { status: clerkRes.status });
        // 或者只是记录到 results 里
        results.push({
          clerkBulkError: errorDetail,
        });
      } else {
        const clerkData = await clerkRes.json();
        // Clerk 会返回一些创建详情
        // 你可以把 clerkData 写进 results 或日志
        results.push({
          clerkBulkResult: clerkData,
        });
      }
    }
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (err: any) {
    console.error("Error inviting =>", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}