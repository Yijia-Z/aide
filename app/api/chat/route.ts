import { NextRequest, NextResponse } from "next/server";

// Function to handle tool calls
async function handleToolCall(toolCall) {
  try {
    console.log("Entered handleToolCall function");
    const toolName = toolCall.function.name;
    const argumentsString = toolCall.function.arguments;

    console.log(`Handling tool call: ${toolName} with arguments: ${argumentsString}`);

    if (toolName === "get_current_weather") {
      const args = JSON.parse(argumentsString);
      console.log("Parsed arguments for get_current_weather:", args);
      const result = await getCurrentWeather(args);
      console.log("Tool call result:", result);
      return result; // 仅返回工具结果
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error("Error in handleToolCall:", error);
    throw error; // 重新抛出错误以在主 POST 处理程序中捕获
  }
}

// Function to get coordinates using Google Geocoding API
async function getCoordinates(location) {
  try {
    console.log("Entered getCoordinates function with location:", location);

    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GEOCODING_API_KEY 未设置");
    }

    const encodedLocation = encodeURIComponent(location);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLocation}&key=${apiKey}`;

    console.log("Fetching coordinates from URL:", url);
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching coordinates:", response.status, response.statusText, errorText);
      throw new Error("无法从 Google Geocoding API 获取坐标");
    }

    const data = await response.json();
    console.log("Received geocoding response:", data);

    if (data.status !== "OK") {
      throw new Error(`Geocoding API error: ${data.status}${data.error_message ? ' - ' + data.error_message : ''}`);
    }

    if (data.results.length === 0) {
      throw new Error("未找到该地址");
    }

    // 选择第一个结果（通常是最相关的）
    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    console.log("Extracted coordinates:", { lat, lon: lng });
    return { lat, lon: lng };

  } catch (error) {
    console.error("Error in getCoordinates:", error.message);
    throw error; // 重新抛出错误以在 getCurrentWeather 中捕获
  }
}

// Function to get current weather using OpenWeatherMap's Current Weather API
async function getCurrentWeather({ location, unit = "celsius" }) {
  try {
    console.log("Entered getCurrentWeather function with arguments:", { location, unit });
    const { lat, lon } = await getCoordinates(location);

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENWEATHER_API_KEY 未设置");
    }

    const unitsParam =
      unit === "celsius"
        ? "metric"
        : unit === "fahrenheit"
        ? "imperial"
        : "standard";

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${unitsParam}`;

    console.log("Fetching weather data from URL:", url);
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching weather data:", response.status, response.statusText, errorText);
      throw new Error("无法获取天气数据");
    }

    const data = await response.json();
    console.log("Received weather data:", data);

    return {
      location: data.name,
      temperature: data.main.temp,
      unit: unit,
      description: data.weather[0].description,
    };
  } catch (error) {
    console.error("Error in getCurrentWeather:", error);
    throw error; // 重新抛出错误以在 handleToolCall 中捕获
  }
}

// Function to fetch chat completion from OpenRouter API
async function fetchChatCompletion(params) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://aide.zy-j.com",
        "X-Title": "Aide",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error("Error in fetchChatCompletion:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("API route started");

    const body = await req.json();
    console.log("Request body:", body);
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
      tool_choice: configuration.tool_choice || 'auto',
      stream: false, // 初始请求设置为 false，以检查工具调用
    };

    console.log("Sending initial chat completion request with params:", params);
    const initialResponse = await fetchChatCompletion(params);
    const initialData = await initialResponse.json();
    console.log("Initial response data:", initialData);

    // 提取助手消息（包含 tool_calls）
    const assistantMessage = initialData.choices[0]?.message;
    if (assistantMessage) {
      messages.push(assistantMessage);
    }

    // 检查并处理工具调用
    const toolCalls = assistantMessage?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      console.log("Tool calls detected:", toolCalls);

      for (const toolCall of toolCalls) {
        console.log("Processing tool call:", toolCall);
        const toolResult = await handleToolCall(toolCall);

        // 添加工具结果消息，确保 content 仅包含工具结果
        messages.push({
          role: "tool",
          name: toolCall.function.name,
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult), // 仅工具结果
        });
      }

      // 更新请求参数
      params.messages = messages;
      console.log("Updated messages with tool results:", messages);
    } else {
      console.log("No tool call detected in initial response");
    }

    // 设置为流式响应以获取最终结果
    params.stream = true;
    console.log("Sending final chat completion request with streaming enabled");
    const finalResponse = await fetchChatCompletion(params);
    console.log("Received final response, starting stream");

    // 确保 finalResponse.body 是一个 ReadableStream
    if (!finalResponse.body || typeof finalResponse.body.getReader !== 'function') {
      throw new Error("finalResponse.body is not a ReadableStream");
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = finalResponse.body.getReader();

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        while (true) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              console.log("Stream reading done");
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                  console.log("Stream complete: [DONE]");
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  // 检查是否有错误
                  if (parsed.error) {
                    console.error("API Error:", parsed.error.message);
                    controller.error(parsed.error.message);
                    return;
                  }
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    console.log("Streaming content:", content);
                    controller.enqueue(encoder.encode(`data: ${content}\n\n`));
                  }
                } catch (error) {
                  console.error("Error parsing JSON:", error, "Data:", data);
                }
              }
            }
          } catch (error) {
            console.error("Error reading stream:", error);
            controller.error(error);
            break;
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
