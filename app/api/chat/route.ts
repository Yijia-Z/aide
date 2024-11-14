// src/api/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { fetchAndNormalizeTools, processToolCalls, filterUndefinedParams } from '../helper/helper';

export async function POST(req: NextRequest) {
  try {
    console.log("API route started");

    const body = await req.json();
    const { messages, configuration } = body;

    if (!process.env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY is not set");
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    // 获取工具列表
    const allTools = await fetchAndNormalizeTools(process.env.NEXT_PUBLIC_BACKEND_URL as string);


    // 过滤启用的工具
    const activeTools = allTools.filter((tool: any) => tool.enabled);


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
            ...(activeTools && activeTools.length > 0 && {
              tool_choice: configuration.tool_choice,
            }),
            stream: true,
          };
          const filteredParams = filterUndefinedParams(params);
    

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
            
                if (!dataStr) continue;
                
                let parsed;

                try {
                 
                  if(dataStr!=="[DONE]"){
                  parsed = JSON.parse(dataStr);
                }
                else{continue;}
                  

                  const delta = parsed.choices[0]?.delta;
                  const finish_reason = parsed.choices[0]?.finish_reason;
                  const content = parsed.choices[0]?.delta?.content;
                  // 累积助手的内容
                  if (delta?.content) {
                    
                    assistantMessages += delta.content;
               

                    // 将内容发送给客户端
                  /*   controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify(parsed)}\n\n`
                      ) 
                    );*/
                  }
                  
                  if (finish_reason) {
                 
                    if (finish_reason === "tool_calls") {
               

                      let parsedArgs;
                      try {
                        parsedArgs = JSON.parse(currentToolCall.function.arguments);
                      } catch (error) {
                        console.error("Error parsing tool arguments:", error);
                        return controller.error(new Error("Invalid tool arguments format."));
                      }
                      const toolResult = await processToolCalls(currentToolCall, process.env.NEXT_PUBLIC_BACKEND_URL as string);
               
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

                      assistantMessages = '';
                    } else if (finish_reason === "end_turn") {
                      
                      parsed.choices[0].delta.content = assistantMessages;
                    
                      controller.enqueue(
                        new TextEncoder().encode(
                          `data: ${JSON.stringify(parsed)}\n\n`
                        )
                      );
                      shouldContinue = false;
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
