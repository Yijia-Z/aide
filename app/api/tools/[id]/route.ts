import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get toolId from params
    const { id: toolId } = await params;

    // Parse request body
    const body = await req.json();

    // First check if tool exists and belongs to user
    const existingTool = await prisma.tool.findFirst({
      where: {
        id: toolId,
        createdBy: userId,
        isDeleted: false
      }
    });

    if (!existingTool) {
      console.error(`Tool not found: ${toolId} for user: ${userId}`);
      return NextResponse.json(
        { error: "Tool not found or unauthorized" },
        { status: 404 }
      );
    }

    // Prepare update data, only including fields that are present
    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.description) updateData.description = body.description;
    if (body.type) updateData.type = body.type;
    if (body.function) updateData.function = body.function;
    if ('script' in body) updateData.script = body.script;
    if (typeof body.approvalRate === 'number') updateData.approvalRate = body.approvalRate;

    // Update the tool
    const updated = await prisma.tool.update({
      where: { id: toolId },
      data: updateData,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/tools/[id]] error =>", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}