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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: threadId } = await params;
        // 查找 Thread 时，一并 include:
        // - creator => 拿到 username / email
        // - memberships => 拿到 membership 里的 role，并 include 对应 userProfile
        const thread = await prisma.thread.findUnique({
          where: { id: threadId },
          include: {
            creator: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
            memberships: {
              select: {
                role: true,
                userProfile: {
                  select: {
                    id: true,
                    email: true,
                    username: true,
                  },
                },
              },
            },
          },
        });
    
        if (!thread) {
          return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }
    
        // 1) 整理 thread.creator => 构造一个“创作者用户对象”
        //    因为在数据库里没存 creator 到 memberships，所以手动添加一条。
        const creatorData = {
          userId: thread.creator.id,
          email: thread.creator.email,
          username: thread.creator.username,
          role: "CREATOR" as const, // 你想自定义个角色名
        };
    
        // 2) 整理 thread.memberships => 里面可能有 "OWNER", "EDITOR", "VIEWER" 等角色
        //    把 membership 和它关联的 userProfile 合并成一个对象
        const membershipData = thread.memberships.map((m) => ({
          userId: m.userProfile.id,
          email: m.userProfile.email,
          username: m.userProfile.username,
          role: m.role, // enum ThreadRole：OWNER/EDITOR/VIEWER
        }));
    
        // 3) 最终把“creator + membership”拼起来，
        //    当然要小心别和 memberships 里某个 user 重复（如果某用户既是创建者也加了 membership）
        //    如果你确定创建者从不写进 membership，那就直接合并就好。
        const allUsers = [creatorData, ...membershipData];
        console.log("[invited-user GET] allUsers =>", JSON.stringify(allUsers, null, 2));
        return NextResponse.json({ users: allUsers }, { status: 200 });
      } catch (error: any) {
        console.error("[GET /api/threads/[threadId]/invited-users] error =>", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
      }
    }