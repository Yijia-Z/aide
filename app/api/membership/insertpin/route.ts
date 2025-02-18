// app/api/membership/insertpin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // First ensure UserProfile exists
    let userProfile = await prisma.userProfile.findUnique({
      where: { id: userId }
    });

    // If no profile exists, create one
    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: { id: userId }
      });
    }

    const { threadId, pinned }: { threadId: string; pinned?: boolean } = await req.json();
    if (!threadId) {
      return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
    }

    // Update membership in transaction
    const result = await prisma.$transaction(async (tx) => {
      const membership = await tx.threadMembership.upsert({
        where: {
          userId_threadId: { userId: userProfile.id, threadId }
        },
        create: {
          userId: userProfile.id,
          threadId,
          pinned: pinned ?? true
        },
        update: {
          pinned: pinned
        }
      });

      return membership;
    });

    return NextResponse.json({ ok: true, pinned: result.pinned }, { status: 200 });

  } catch (error: any) {
    console.error("PATCH /api/membership/insertpin error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
