// app/api/tools_support/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/mongo'

// GET /api/tools_support?model_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get("model_id");
    if (!modelId) {
      return NextResponse.json({ error: "Missing model_id" }, { status: 400 });
    }

    console.log(`Received request to check model tool support: ${modelId}`);

    const db = await getDB();
    const modelColl = db.collection("models");
    const toolColl = db.collection("tools");

    const model = await modelColl.findOne({ id: modelId });
    if (!model) {
      return NextResponse.json({ error: "Model not found." }, { status: 404 });
    }
    const basemodel = model.baseModel;
    if (!basemodel) {
      return NextResponse.json({ error: `Model ${modelId} has no 'baseModel'.`}, { status: 400 });
    }

    // 这里是调用 openrouter.ai 的 GET /api/v1/parameters/{basemodel} 
    // 我们用 fetch():
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterApiKey) {
      throw new Error("Missing OPENROUTER_API_KEY env.");
    }

    const openrouterUrl = `https://openrouter.ai/api/v1/parameters/${basemodel}`;
    console.log("Fetching from openrouter:", openrouterUrl);

    const resp = await fetch(openrouterUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!resp.ok) {
      console.error("OpenRouter API error: ", resp.status, await resp.text());
      // fallback
      return NextResponse.json({ supportsTools: false });
    }
    const data = await resp.json();
    const supportedParams = data?.data?.supported_parameters || [];
    const supportsTools = supportedParams.includes('tools');

    if (supportsTools) {
      // load tools
      const toolsFromDB = await toolColl.find({}).toArray();
      return NextResponse.json({
        supportsTools: true,
        tools: toolsFromDB, // or do some "serialize"
      });
    } else {
      return NextResponse.json({ supportsTools: false });
    }
  } catch (e: any) {
    console.error("Error checking model tool support:", e);
    return NextResponse.json({ supportsTools: false });
  }
}
