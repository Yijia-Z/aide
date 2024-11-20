import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    console.log("API route started");

    const body = await req.json();
    const { messages, configuration } = body;

    const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    if (!process.env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY is not set");
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    let activeTools: any[] = [];

    if (apiBaseUrl) {
      // 获取工具列表
      const toolsResponse = await fetch(
        `${apiBaseUrl}/api/load_tools`
      );

      if (!toolsResponse.ok) {
        const errorText = await toolsResponse.text();
        console.error(
          `Failed to load tools: ${toolsResponse.status} ${toolsResponse.statusText}`,
          errorText
        );
        throw new Error(
          `Failed to load tools: ${toolsResponse.status} ${toolsResponse.statusText}`
        );
      }

      const toolsData = await toolsResponse.json();
      console.log("Loaded tools data:", JSON.stringify(toolsData, null, 2));

      // 提取工具列表并规范化 enabled 字段
      const allTools = toolsData.tools.map((tool: any) => {
        return {
          ...tool,
          enabled: tool.enabled === true || tool.enabled === "true",
        };
      });

      // 过滤启用的工具
      activeTools = allTools.filter((tool: any) => tool.enabled == true || tool.enabled == "true");
    }

    // 初始化消息列表
    let currentMessages = [...messages];
    let assistantMessages = ''; // 用于累积助手的回复内容

    let shouldContinue = true;

    // 定义 ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        while (shouldContinue) {

          const params = {
            messages: currentMessages,
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
            tools: activeTools,
            tool_choice: configuration.tool_choice,
/*             ...(activeTools && activeTools.length > 0 && {
              tool_choice: "auto",
            }), */
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
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
          assistantMessages = ''; // 重置助手的回复内容
          let toolCalls: any[] = []; // 存储工具调用
          let currentToolCall: any = null; // 当前处理的工具调用

          const reader = response.body?.getReader();
          if (!reader) {
            controller.error(new Error("Failed to get response reader"));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = ''; // 缓存不完整的行
          let doneReading = false;

          while (!doneReading) {
            const { done, value } = await reader.read();
            if (done) {
              doneReading = true;
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留不完整的行

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();


                if (!dataStr || dataStr === "[Done]") continue;

                try {
                  const parsed = JSON.parse(dataStr);
                  console.log("Parsed JSON data:", JSON.stringify(parsed, null, 2));

                  const delta = parsed.choices[0]?.delta;
                  const finish_reason = parsed.choices[0]?.finish_reason;

                  // 累积助手的内容
                  if (delta?.content) {
                    console.log("Delta content detected:", delta.content);
                    assistantMessages += delta.content;
                    console.log("Accumulated assistantMessages:", assistantMessages);
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify(parsed)}\n\n`
                      )
                    );
                    // 将内容发送给客户端

                  }
                  if (finish_reason) {

                    if (finish_reason === "tool_calls") {
                      console.log("Finish reason is 'tool_calls', preparing to process tool calls.");

                      if (assistantMessages) {
                        currentMessages.push({
                          role: 'assistant',
                          content: assistantMessages,
                        });
                        assistantMessages = ''; // 重置助手消息
                      }
                      let parsedArgs;
                      try {
                        parsedArgs = JSON.parse(currentToolCall.function.arguments);
                      } catch (error) {
                        console.error("Error parsing tool arguments:", error);
                        return controller.error(new Error("Invalid tool arguments format."));
                      }
                      const toolUseResponse = await fetch(
                        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/process_tool_use`,
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
                        content: null, // content 必须为 null
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

                      // 添加工具的响应消息
                      currentMessages.push({
                        role: 'tool',
                        name: currentToolCall.function.name,
                        tool_call_id: currentToolCall.id,
                        content: toolResult.content,
                      });

                    } else if (finish_reason === "end_turn" || "stop") {
                      console.log("Finish reason is 'endturn', closing stream.");
                      parsed.choices[0].delta.content = assistantMessages;


                      shouldContinue = false;

                      /*     // 发送 [DONE] 并关闭流
                          controller.enqueue(
                            new TextEncoder().encode("data: [DONE]\n\n")
                          ); */
                      controller.close();
                      return;
                    }
                  }

                  // 处理工具调用
                  if (delta?.tool_calls) {

                    // 处理多个工具调用
                    for (const toolCall of delta.tool_calls) {
                      const toolCallIndex = toolCall.index;
                      const toolCallId = toolCall.id || `tool_call_${toolCallIndex}_${Date.now()}`;
                      if (
                        !currentToolCall ||
                        currentToolCall.index !== toolCallIndex
                      ) {
                        // 开始新的工具调用
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

                      // 累积函数参数
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

          /*    // 在流结束后，处理工具调用（如果有）
             if (toolCalls.length > 0) {
               console.log(
                 "Processing tool calls:",
                 JSON.stringify(toolCalls, null, 2)
               );
   
               // 将助手的回复添加到消息列表
               if (assistantMessages) {
                 currentMessages.push({
                   role: 'assistant',
                   content: assistantMessages,
                 });
                 assistantMessages = ''; // 重置助手消息
               }
   
               // 处理每个工具调用
               for (const toolCall of toolCalls) {
                 console.log(
                   `Processing tool call: ${JSON.stringify(toolCall, null, 2)}`
                 );
   
                 // 解析累积的参数
                 let toolArgs: any;
                 try {
                   toolArgs = JSON.parse(toolCall.function.arguments);
                 } catch (error) {
                   console.error(
                     "Error parsing tool call arguments:",
                     error
                   );
                   continue; // 如果参数无效，跳过此工具调用
                 }
                 console.log(`Sending to /api/process_tool_use:`, {
                   tool_name: toolCall.function.name,
                   tool_args: toolArgs,
                   tool_call_id: toolCall.id,
                 });
                 // 调用后端处理工具调用
                 const toolUseResponse = await fetch(
                   `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/process_tool_use`,
                   {
                     method: 'POST',
                     headers: {
                       'Content-Type': 'application/json',
                     },
                     body: JSON.stringify({
                       tool_name: toolCall.function.name,
                       tool_args: toolArgs,
                       tool_call_id: toolCall.id,
                     }),
                   }
                 );
   
                 if (!toolUseResponse.ok) {
                   const errorText = await toolUseResponse.text();
                   console.error(
                     `Failed to process tool use: ${toolUseResponse.status} ${toolUseResponse.statusText}`,
                     errorText
                   );
                   continue; // 跳过下一个工具调用
                 }
   
                 const toolResult = await toolUseResponse.json();
                 console.log(
                   "Tool result:",
                   JSON.stringify(toolResult, null, 2)
                 );
   
                 // 更新消息，添加工具调用和工具结果
                 // 添加助手的工具调用消息
                 currentMessages.push({
                   role: 'assistant',
                   content: null, // content 必须为 null
                   tool_calls: [
                     {
                       id: toolCall.id,
                       type: 'function',
                       function: {
                         name: toolCall.function.name,
                         arguments: toolCall.function.arguments,
                       },
                     },
                   ],
                 });
   
                 // 添加工具的响应消息
                 currentMessages.push({
                   role: 'tool',
                   name: toolCall.function.name,
                   tool_call_id: toolCall.id,
                   content: toolResult.content,
                 });
               }
   
               // 重置工具调用列表
               toolCalls = [];
             } else {
               // 没有工具调用，结束循环
               shouldContinue = false;
             } */
        }
      },
    });

    // **立即返回流给客户端**
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