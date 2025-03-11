import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    // console.log("API route started");

    const body = await req.json();
    let { messages, configuration, openRouterKey } = body;
    let generationId: string | null = null;
    let isEnvKeyUsed = false;
    // 3. 如果前端没传 / 是空，就回退到 ENV
    if (!openRouterKey) {
      const { userId } = await auth();
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      openRouterKey = process.env.OPENROUTER_API_KEY;
      isEnvKeyUsed = true;
    }

    // 4. 如果两边都没有，就报错
    if (!openRouterKey) {
      console.error("No user key or environment key found");
      throw new Error("No valid OpenRouter key provided");
    }
    // Initialize the message list
    let currentMessages = [...messages];
    let assistantMessages = ''; // Used to accumulate the assistant's reply content

    let shouldContinue = true;

    // Define ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        while (shouldContinue) {

          let modelName = configuration.model;

          // Handle web search functionality
          const plugins = [];
          if (configuration.enable_web_search) {
            // Add :online suffix or web plugin based on configuration
            if (!modelName.includes(':online')) {
              // Create web plugin configuration
              const webPlugin: { id: string;[key: string]: any } = {
                id: "web"
              };

              // Add custom parameters if specified
              if (configuration.web_search_max_results) {
                webPlugin["max_results"] = configuration.web_search_max_results;
              }

              if (configuration.web_search_prompt) {
                webPlugin["search_prompt"] = configuration.web_search_prompt;
              }

              plugins.push(webPlugin);
            }
          }

          const params = {
            messages: currentMessages,
            model: modelName,
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
            tool_choice: configuration.tools?.length ? configuration.tool_choice : "none",
            plugins: plugins.length > 0 ? plugins : undefined,
            stream: true,
          };

          const filteredParams = Object.fromEntries(
            Object.entries(params).filter(([_, value]) => value !== undefined)
          );
          console.log("Request parameters:", JSON.stringify(filteredParams, null, 2));

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_OPENROUTER_API_URL}/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openRouterKey}`,
                "HTTP-Referer":
                  process.env.NEXT_PUBLIC_APP_URL || "http://aide.zy-j.com",
                "X-Title": "Aide",
              },
              body: JSON.stringify(filteredParams),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `OpenRouter API error: ${response.status} ${response.statusText}`,
              errorText
            );
            controller.error(
              new Error(
                `OpenRouter API error: ${response.status} ${response.statusText}`
              )
            );
            return;
          }

          // Initialize variables to handle tool calls
          assistantMessages = ''; // Reset the assistant's reply content
          let toolCalls: any[] = []; // Store tool calls
          let currentToolCall: any = null; // Currently processed tool call

          const reader = response.body?.getReader();
          if (!reader) {
            controller.error(new Error("Failed to get response reader"));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = ''; // Cache incomplete lines
          let doneReading = false;

          while (!doneReading) {
            const { done, value } = await reader.read();
            if (done) {
              doneReading = true;
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete lines

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();


                if (!dataStr || dataStr === "[Done]" || dataStr === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(dataStr);
                  // console.log("Parsed JSON data:", JSON.stringify(parsed, null, 2));

                  const delta = parsed.choices[0]?.delta;
                  const finish_reason = parsed.choices[0]?.finish_reason;

                  // Accumulate the content of the assistant
                  if (delta?.content) {
                    // console.log("Delta content detected:", delta.content);
                    assistantMessages += delta.content;
                    // console.log("Accumulated assistantMessages:", assistantMessages);
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify(parsed)}\n\n`
                      )
                    );
                    // Send the content to the client

                  }
                  if (finish_reason) {

                    if (finish_reason === "tool_calls") {
                      console.log("Finish reason is 'tool_calls', preparing to process tool calls.");
                      if (configuration.tool_choice !== "auto" && configuration.tool_choice !== "none") {
                        configuration.tool_choice = "auto";
                      }
                      if (assistantMessages) {
                        currentMessages.push({
                          role: 'assistant',
                          content: assistantMessages,
                        });
                        assistantMessages = ''; // Reset assistant message
                      }

                      let parsedArgs;
                      try {
                        parsedArgs = JSON.parse(currentToolCall.function.arguments);
                      } catch (error) {
                        console.error("Error parsing tool arguments:", error);
                        return controller.error(new Error("Invalid tool arguments format."));
                      }
                      const baseURL = process.env.ALLOWED_ORIGINS || "http://localhost:3000";
                      const toolUseResponse = await fetch(
                        `${baseURL}/api/tools/process_tool_use`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            tool_name: currentToolCall.function.name,
                            tool_args: parsedArgs,
                            tool_call_id: currentToolCall.id,
                          }),
                        }
                      );
                      const toolResult = await toolUseResponse.json();
                      console.log(
                        "Tool result:",
                        JSON.stringify(toolResult, null, 2)
                      );
                      currentMessages.push({
                        role: 'assistant',
                        content: null, // content must be null
                        tool_calls: [
                          {
                            id: currentToolCall.id,
                            type: 'function',
                            function: {
                              name: currentToolCall.function.name,
                              arguments: currentToolCall.function.arguments,
                            },
                          },
                        ],
                      });

                      // Add the tool's response message
                      currentMessages.push({
                        role: 'tool',
                        name: currentToolCall.function.name,
                        tool_call_id: currentToolCall.id,
                        content: toolResult.content,
                      });

                    } else if (finish_reason === "end_turn" || finish_reason === "stop" || finish_reason === "STOP") {
                      // console.log("Finish reason is 'end_turn' or 'stop', closing stream.");
                      parsed.choices[0].delta.content = assistantMessages;
                      console.log("finish_reason reached. Let's see if there's an id:", parsed.id);
                      generationId = parsed.id;
                      shouldContinue = false;

                      controller.close();
                      if (isEnvKeyUsed && generationId) {
                        const { userId } = await auth();
                        if (!userId) {
                          // 用户已退出登录？
                          console.warn("User not found when finishing usage record.");
                          return;
                        }

                        // 调用 openrouter /api/v1/generation 拿到费用和原生 token
                        try {
                          const costRes = await fetch(
                            `https://openrouter.ai/api/v1/generation?id=${generationId}`,
                            {
                              headers: {
                                Authorization: `Bearer ${openRouterKey}`,
                              },
                            }
                          );

                          if (costRes.ok) {
                            const costData = await costRes.json();
                            const detail = costData.data; // 里面有 total_cost, tokens_prompt, tokens_completion 等

                            // 1) 往 UsageRecord 插入
                            await prisma.usageRecord.create({
                              data: {
                                generationId: generationId,
                                userId: userId,
                                totalCost: detail.total_cost ?? 0,
                                promptTokens: detail.tokens_prompt ?? 0,
                                completionTokens: detail.tokens_completion ?? 0,
                                totalTokens: detail.tokens_prompt
                                  ? detail.tokens_prompt + (detail.tokens_completion ?? 0)
                                  : null,
                              },
                            });

                            // 2) 更新用户 balance
                            //    balance 是 Decimal，如果 total_cost 是 float，需要做转换
                            const costAmount = detail.total_cost ? String(detail.total_cost) : "0";
                            await prisma.userProfile.update({
                              where: { id: userId },
                              data: {
                                balance: {
                                  decrement: costAmount, // Prisma Decimal decrement
                                },
                              },
                            });

                            console.log(
                              `User ${userId} usage recorded: cost = ${costAmount}, generationId = ${generationId}`
                            );
                          } else {
                            console.error("Failed to fetch cost from /api/v1/generation", costRes.statusText);
                          }
                        } catch (err) {
                          console.error("Error fetching generation cost data:", err);
                        }
                      }

                      return;
                    }
                  }

                  // Handle tool calls
                  if (delta?.tool_calls) {

                    // Handle multiple tool calls
                    for (const toolCall of delta.tool_calls) {
                      const toolCallIndex = toolCall.index;
                      const toolCallId = toolCall.id || `tool_call_${toolCallIndex}_${Date.now()}`;
                      if (
                        !currentToolCall ||
                        currentToolCall.index !== toolCallIndex
                      ) {
                        // Start a new tool call
                        currentToolCall = {
                          index: toolCallIndex,
                          id: toolCallId,
                          function: {
                            name: toolCall.function.name,
                            arguments: '',
                          },
                        };
                        toolCalls[toolCallIndex] = currentToolCall;
                      }

                      // Accumulate function arguments
                      if (toolCall.function.arguments) {
                        currentToolCall.function.arguments +=
                          toolCall.function.arguments;
                      }
                      console.log("aaa:", toolCalls);
                    }
                  }
                } catch (error) {
                  console.error("Error parsing JSON:", error);
                }
              }
            }
          }
        }
      },
    });

    // Immediately return the stream to the client
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error("Error in API route:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}