import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    console.log("API route started");

    const body = await req.json();
    const { messages, configuration } = body;

    console.log("Received configuration:", configuration);

    if (!process.env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY is not set");
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    const params = {
      messages,
      model: configuration.model,
      temperature: configuration.temperature,
      max_tokens: configuration.max_tokens,
      top_p: configuration.top_p,
      frequency_penalty: configuration.frequency_penalty,
      presence_penalty: configuration.presence_penalty,
      repetition_penalty: configuration.repetition_penalty,
      min_p: configuration.min_p,
      top_a: configuration.top_a,
      seed: configuration.seed,
      context_length: configuration.context_length,
      top_k: configuration.top_k,
      logit_bias: configuration.logit_bias,
      logprobs: configuration.logprobs,
      top_logprobs: configuration.top_logprobs,
      response_format: configuration.response_format,
      stop: configuration.stop,
      tools: configuration.tools,
      tool_choice: configuration.tool_choice,
      stream: true,
    };
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined)
    );
    console.log("Request parameters:", filteredParams);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_OPENROUTER_API_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "http://aide.zy-j.com",
          "X-Title": "Aide",
        },
        body: JSON.stringify(filteredParams), // Ensure filteredParams is used
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `OpenRouter API error: ${response.status} ${response.statusText}`,
        errorText
      );
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}`
      );
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
                controller.enqueue(
                  new TextEncoder().encode("data: [DONE]\n\n")
                );
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${content}\n\n`)
                  );
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
