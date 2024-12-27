// app/api/threads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/mongo'
import { ThreadData } from '@/types/models'

/**
 * POST /api/threads => Save Thread
 * 由于原Python是 /save_thread，但 NextJS Route Handler 
 * 不支持像 /api/threads/save_thread, 你可以改成 HTTP POST /api/threads
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ThreadData;
    const threadId = body.threadId;
    const thread = body.thread;
    
    if (!threadId || !thread) {
      return NextResponse.json({ error: "Invalid thread data" }, { status: 400 });
    }

    const db = await getDB();
    const collectionName = `thread_${threadId}`;
    const collection = db.collection(collectionName);

    await collection.updateOne(
      { threadId },
      { $set: thread },
      { upsert: true }
    );

    console.log(`Successfully saved thread ${threadId}.`);
    return NextResponse.json({ status: "success" });
  } catch (e: any) {
    console.error("Failed to save thread:", e);
    return NextResponse.json({ error: "Failed to save thread." }, { status: 500 });
  }
}

/**
 * GET /api/threads => load all threads
 */
export async function GET() {
  try {
    const db = await getDB();
    const collections = await db.listCollections().toArray();

    let threads: any[] = [];
    for (const collInfo of collections) {
      if (collInfo.name.startsWith("thread_")) {
        const collection = db.collection(collInfo.name);
        const oneThread = await collection.findOne({}, { projection: { _id: 0 } });
        if (oneThread) {
          threads.push(oneThread);
        }
      }
    }

    console.log(`Successfully loaded ${threads.length} threads from MongoDB.`);
    return NextResponse.json({ threads });
  } catch (e: any) {
    console.error("Failed to load threads:", e);
    return NextResponse.json({ error: "Failed to load threads." }, { status: 500 });
  }
}

/**
 * DELETE /api/threads?thread_id=xxx => Delete specific thread
 * 
 * 注: Next.js Route Handler 不支持 /threads/{id} 形式的 route param 
 *    只能用 /api/threads/[id] or query param. 
 *    这里演示 query approach: /api/threads?thread_id=xxx
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("thread_id");
  
  if (!threadId) {
    return NextResponse.json({ error: "Missing thread_id" }, { status: 400 });
  }

  try {
    const db = await getDB();
    const collectionName = `thread_${threadId}`;

    const collectionNames = await db.listCollections().toArray();
    const found = collectionNames.find((c) => c.name === collectionName);

    if (!found) {
      console.warn(`Thread ${threadId} not found`);
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    await db.dropCollection(collectionName);
    console.log(`Successfully deleted thread ${threadId}.`);
    return NextResponse.json({ status: "success" });
  } catch (e: any) {
    console.error("Failed to delete thread:", e);
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}
