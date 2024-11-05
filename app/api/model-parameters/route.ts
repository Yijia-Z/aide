import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json(
      { error: "Model ID is required" },
      { status: 400 }
    );
  }

  console.log(`Fetching parameters for model ID: ${modelId}`);
  try {
    const decodedModelId = decodeURIComponent(modelId);
    const url = `https://openrouter.ai/api/v1/parameters/${decodedModelId}`;
    console.log(`Fetching from: ${url}`);

    // Check if the API key is set
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not set in the environment variables"
      );
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch model parameters: ${response.status} ${response.statusText}. Response: ${errorText}`
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching model parameters:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to fetch model parameters", details: error.message },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        {
          error: "Failed to fetch model parameters",
          details: "An unknown error occurred",
        },
        { status: 500 }
      );
    }
  }
}
