// app/api/models/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/mongo'
import { ModelData } from '@/types/models'

/**
 * POST /api/models => save_models
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const models = body.models as ModelData[] | undefined;

    if (!models) {
      return NextResponse.json({ error: "No model data provided." }, { status: 400 });
    }

    const db = await getDB();
    const collection = db.collection("models");

    // 先清空再插入
    await collection.deleteMany({});
    await collection.insertMany(models);

    console.log("Models successfully saved to MongoDB.");
    return NextResponse.json({ status: "success" });
  } catch (e: any) {
    console.error("Failed to save models to MongoDB:", e);
    return NextResponse.json({ error: "Failed to save models." }, { status: 500 });
  }
}

/**
 * GET /api/models => load_models
 */
export async function GET() {
  try {
    const db = await getDB();
    const collection = db.collection("models");
    const modelsFromDB = await collection.find({}).project({ _id: 0 }).toArray();

    let modelsList: ModelData[] = [];

    if (!modelsFromDB || modelsFromDB.length === 0) {
      console.warn("No models found in DB. (You can do something like load from file fallback here)");
      // 也可以执行你原先 load_models_from_file() 之类, 这里简写:
      // modelsList = get_default_models();
      modelsList = []; // 如果没有就留空
    } else {
      modelsList = modelsFromDB as ModelData[];
      console.log(`Successfully loaded ${modelsList.length} models from MongoDB.`);
    }

    return NextResponse.json({ models: modelsList });
  } catch (e: any) {
    console.error("Failed to load models:", e);
    return NextResponse.json({ error: "Failed to load models from DB." }, { status: 500 });
  }
}
