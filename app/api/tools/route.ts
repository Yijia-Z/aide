// app/api/tools/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/mongo'
import { Tool, ToolUseRequest, ToolUseResponse } from '@/types/models'
// 你还需要自己写 processToolUseFunction (JS版) 替代 process_tool_use_function

/**
 * POST /api/tools => save tools
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tools = body.tools as Tool[] | undefined;

    if (!tools) {
      return NextResponse.json({ error: "No tool data provided." }, { status: 400 });
    }

    // 这里可以对 tools 做数据校验
    // ...

    const db = await getDB();
    const collection = db.collection("tools");

    await collection.deleteMany({});
    await collection.insertMany(tools);

    return NextResponse.json({ status: "success" });
  } catch (e: any) {
    console.error("Failed to save tools:", e);
    return NextResponse.json({ error: "Failed to save tools." }, { status: 500 });
  }
}

/**
 * GET /api/tools => load tools
 */
export async function GET() {
  try {
    const db = await getDB();
    const collection = db.collection("tools");
    const tools = await collection.find({}).project({ _id: 0 }).toArray();

    if (!tools || tools.length === 0) {
      // init default maybe
      // ...
      console.warn("No tools found in the DB.");
      return NextResponse.json({ tools: [] });
    }
    return NextResponse.json({ tools });
  } catch (e: any) {
    console.error("Failed to load tools:", e);
    return NextResponse.json({ error: "Failed to load tools." }, { status: 500 });
  }
}
