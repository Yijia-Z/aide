// app/api/tools/route.ts

import { Tool, ToolUseRequest, ToolUseResponse } from '@/types/models'
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prismadb";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const tools = await prisma.tool.findMany();
    return NextResponse.json({ tools }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}