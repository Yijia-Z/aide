// lib/permission.ts
import { prisma } from "@/lib/db/prismadb";
import { ROLE_RANK } from "./role";

export async function getUserRankForThread(userId: string, threadId: string): Promise<number> {
  // 查 thread，带上 membership
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      memberships: {
        where: { userId },
      }
    }
  });
  if (!thread) {
    // 不存在 => rank=0
    return 0;
  }

  // 如果 thread.creatorId === userId => rank=4
  if (thread.creatorId === userId) {
    return 4;
  }

  // 再看 membership
  const membership = thread.memberships[0];
  if (!membership) {
    // user 没有 membership => rank=0
    return 0;
  }

  // 用 membership.role 查 ROLE_RANK
  const baseRank = ROLE_RANK[membership.role] || 0;
  return baseRank;
}
