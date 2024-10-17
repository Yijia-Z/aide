import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, configuration } = body;

        const params: OpenAI.Chat.ChatCompletionCreateParams = {
            messages,
            model: configuration.model,
            temperature: configuration.temperature,
            max_tokens: configuration.max_tokens,
            stream: true,
        };

        const chatCompletion = await openai.chat.completions.create(params);

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of chatCompletion) {
                    const content = chunk.choices[0]?.delta?.content;
                    const finishReason = chunk.choices[0]?.finish_reason;
                    if (finishReason === "stop") {
                        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                        controller.close();
                        return;
                    }
                    if (content) {
                        controller.enqueue(new TextEncoder().encode(`data: ${content}\n\n`));
                    }
                }
            },
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
