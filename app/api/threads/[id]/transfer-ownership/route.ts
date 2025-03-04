import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Transfer ownership of a thread to another user
 * POST /api/threads/[id]/transfer-ownership
 * Request body: { userId: string }
 * Only the creator can transfer ownership
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { userId: currentUserId } = await auth();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: threadId } = params;
        const { userId: newOwnerId } = await req.json() as { userId: string };

        // Get the thread to check if the current user is the creator
        const thread = await prisma.thread.findUnique({
            where: { id: threadId },
            select: { creatorId: true },
        });

        if (!thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        // Only the creator can transfer ownership
        if (thread.creatorId !== currentUserId) {
            return NextResponse.json(
                { error: "Only the creator can transfer ownership" },
                { status: 403 }
            );
        }

        // Check if the new owner exists and is a member of the thread
        const newOwnerMembership = await prisma.threadMembership.findUnique({
            where: {
                userId_threadId: {
                    userId: newOwnerId,
                    threadId,
                },
            },
        });

        if (!newOwnerMembership) {
            return NextResponse.json(
                { error: "The new owner must be a member of the thread" },
                { status: 400 }
            );
        }

        // Update the thread creator and update the new owner's role to OWNER
        const [updatedThread, updatedMembership] = await prisma.$transaction([
            // Update the thread creator
            prisma.thread.update({
                where: { id: threadId },
                data: { creatorId: newOwnerId },
            }),

            // Update the new owner's role to OWNER
            prisma.threadMembership.update({
                where: {
                    userId_threadId: {
                        userId: newOwnerId,
                        threadId,
                    },
                },
                data: { role: "OWNER" },
            }),

            // Update the previous creator's role to OWNER (not creator anymore)
            prisma.threadMembership.upsert({
                where: {
                    userId_threadId: {
                        userId: currentUserId,
                        threadId,
                    },
                },
                update: { role: "OWNER" },
                create: {
                    userId: currentUserId,
                    threadId,
                    role: "OWNER",
                    status: "ACCEPTED",
                },
            }),
        ]);

        return NextResponse.json(
            {
                success: true,
                message: "Ownership transferred successfully",
                thread: updatedThread
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("[POST /api/threads/[id]/transfer-ownership] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
} 