import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { canDoThreadOperation, ThreadOperation } from "@/lib/permission";
import { ThreadRole } from "@/types/models";

/**
 * Update a user's role in a thread
 * PATCH /api/threads/[id]/invited-users/[userId]
 * Request body: { role: ThreadRole }
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string; userId: string } }
) {
    try {
        const { userId: currentUserId } = await auth();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: threadId, userId: targetUserId } = params;
        const { role } = await req.json() as { role: ThreadRole };

        // Check if current user has permission to update roles
        const canUpdate = await canDoThreadOperation(
            currentUserId,
            threadId,
            ThreadOperation.INVITE_MEMBER
        );

        if (!canUpdate) {
            return NextResponse.json(
                { error: "You don't have permission to update user roles" },
                { status: 403 }
            );
        }

        // Get thread to check if current user is creator
        const thread = await prisma.thread.findUnique({
            where: { id: threadId },
            select: { creatorId: true }
        });

        if (!thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        const isCreator = thread.creatorId === currentUserId;

        // Get the target user's current role
        const targetUserMembership = await prisma.threadMembership.findUnique({
            where: {
                userId_threadId: {
                    userId: targetUserId,
                    threadId,
                }
            }
        });

        if (!targetUserMembership) {
            return NextResponse.json({ error: "User is not a member of this thread" }, { status: 404 });
        }

        // If assigning or modifying an OWNER role, only creator can do this
        if ((targetUserMembership.role === "OWNER") && !isCreator) {
            return NextResponse.json(
                { error: "Only the creator can add, remove, or change owners" },
                { status: 403 }
            );
        }

        // Update the user's role
        const updatedMembership = await prisma.threadMembership.update({
            where: {
                userId_threadId: {
                    userId: targetUserId,
                    threadId,
                },
            },
            data: {
                role: role as any, // Cast to any to avoid type issue with Prisma enum
            },
        });

        return NextResponse.json(
            { success: true, membership: updatedMembership },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("[PATCH /api/threads/[id]/invited-users/[userId]] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Remove a user from a thread
 * DELETE /api/threads/[id]/invited-users/[userId]
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string; userId: string } }
) {
    try {
        const { userId: currentUserId } = await auth();
        if (!currentUserId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: threadId, userId: targetUserId } = params;

        // Check if current user has permission to remove users
        const canRemove = await canDoThreadOperation(
            currentUserId,
            threadId,
            ThreadOperation.KICK_MEMBER
        );

        if (!canRemove) {
            return NextResponse.json(
                { error: "You don't have permission to remove users" },
                { status: 403 }
            );
        }

        // Get the thread to check if current user is creator
        const thread = await prisma.thread.findUnique({
            where: { id: threadId },
            select: { creatorId: true },
        });

        if (!thread) {
            return NextResponse.json({ error: "Thread not found" }, { status: 404 });
        }

        const isCreator = thread.creatorId === currentUserId;

        // Cannot remove the creator of the thread
        if (thread.creatorId === targetUserId) {
            return NextResponse.json(
                { error: "Cannot remove the creator of the thread" },
                { status: 403 }
            );
        }

        // Get target user's role
        const targetUserMembership = await prisma.threadMembership.findUnique({
            where: {
                userId_threadId: {
                    userId: targetUserId,
                    threadId,
                }
            }
        });

        if (!targetUserMembership) {
            return NextResponse.json({ error: "User is not a member of this thread" }, { status: 404 });
        }

        // If removing an OWNER, only creator can do this
        if (targetUserMembership.role === "OWNER" && !isCreator) {
            return NextResponse.json(
                { error: "Only the creator can remove owners" },
                { status: 403 }
            );
        }

        // Remove the user's membership
        await prisma.threadMembership.delete({
            where: {
                userId_threadId: {
                    userId: targetUserId,
                    threadId,
                },
            },
        });

        return NextResponse.json(
            { success: true, message: "User removed from thread" },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("[DELETE /api/threads/[id]/invited-users/[userId]] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
} 