import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
    try {
        // Log the start of the request
        console.log("API route started");

        const body = await req.json();
        const { messages, configuration } = body;

        // Log the received configuration
        console.log("Received configuration:", configuration);

        // Check if the API key is set
        if (!process.env.OPENROUTER_API_KEY) {
            console.error("OPENROUTER_API_KEY is not set");
            throw new Error("OPENROUTER_API_KEY is not set");
        }

        const params = {
            messages,
            model: configuration.model,
            temperature: configuration.temperature,
            max_tokens: configuration.max_tokens,
            stream: true,
        };

        // Log the request parameters
        console.log("Request parameters:", params);

        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                "X-Title": "Aide",
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText);
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body?.getReader();
                if (!reader) {
                    throw new Error("Failed to get response reader");
                }

                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            if (data === "[DONE]") {
                                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                                controller.close();
                                return;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content;
                                if (content) {
                                    controller.enqueue(new TextEncoder().encode(`data: ${content}\n\n`));
                                }
                            } catch (error) {
                                console.error("Error parsing JSON:", error);
                            }
                        }
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
        console.error("Error in API route:", error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
