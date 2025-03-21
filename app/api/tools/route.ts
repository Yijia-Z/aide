// app/api/tools/route.ts

import { Tool, ToolUseRequest, ToolUseResponse } from '@/types/models'
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  try {
    // 检查是否空表
    const toolsCount = await prisma.tool.count();
    if (toolsCount === 0) {
      console.log("[GET /api/tools] => no tools found, inserting defaults...");

      await prisma.tool.createMany({
        data: [
          {
            id: randomUUID(),
            name: "Get Current Weather",
            description: "Provides the current weather for a specified location.",

            type: "function",
            function: {
              name: "get_current_weather",
              description: "Get the current weather in a given location",
              parameters: {
                type: "object",
                properties: {
                  location: {
                    type: "string",
                    description: "The city and state, e.g., San Francisco, CA",
                  },
                  unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                  },
                },
                required: ["location"],
              },
            },
          },
          {
            id: randomUUID(),
            name: "Calculate",
            description: "Performs basic arithmetic calculations.",

            type: "function",
            function: {
              name: "calculate",
              description:
                "Performs basic arithmetic operations like addition, subtraction, multiplication, and division.",
              parameters: {
                type: "object",
                properties: {
                  operation: {
                    type: "string",
                    enum: ["add", "subtract", "multiply", "divide"],
                    description: "The arithmetic operation to perform.",
                  },
                  operand1: {
                    type: "number",
                    description: "The first operand.",
                  },
                  operand2: {
                    type: "number",
                    description: "The second operand.",
                  },
                },
                required: ["operation", "operand1", "operand2"],
              },
            },
          },
        ],
      });
    }

    // 再从数据库读取并返回
    const tools = await prisma.tool.findMany();
    console.log("api/tools/route.js:get", tools);
    return NextResponse.json({ tools }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();

    const newId = randomUUID();


    const createdRow = await prisma.tool.create({
      data: {
        id: newId,
        name: body.name,
        description: body.description,
        type: body.type,
        function: body.function,
        createdBy: userId,

      },
    });


    return NextResponse.json(createdRow, { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/tools] error =>", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
