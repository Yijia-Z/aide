import { Thread, Model } from '../types';
import { findAllParentMessages } from './helpers';
import { useModels } from '../hooks/use-models';
 

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;


  export async function generateAIResponse(
    prompt: string,
    role: string,
    model: Model,
    threads: Thread[],
    currentThread: string | null,
    replyingTo: string | null
  ) {
    const requestPayload = {
      messages: [
        { role: "system", content: model.systemPrompt },
        ...findAllParentMessages(threads, currentThread, replyingTo).map(
          (msg) => ({
            role: msg.publisher === "user" ? "user" : "assistant",
            content: msg.content,
          })
        ),
        { role: role === "user" ? "user" : "assistant", content: prompt },
      ],
      configuration: {
        model: model.baseModel,
        ...model.parameters,
      },
    };
  
    console.log("Request payload:", JSON.stringify(requestPayload, null, 2));
  
    const response = await fetch(
      apiBaseUrl ? `${apiBaseUrl}/api/chat` : "/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      }
    );
    console.log(response);
    if (!response.ok) {
      throw new Error("Failed to generate AI response");
    }
  
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }
  
    return reader;
  }

  export async function fetchAvailableModels() {
    try {
      // Check if models are already cached in localStorage
      const cachedModels = localStorage.getItem('availableModels');
      const lastFetchTime = localStorage.getItem('lastFetchTime');
      const currentTime = Date.now();

      // If cached models exist and were fetched less than an hour ago, use them
      if (cachedModels && lastFetchTime && currentTime - parseInt(lastFetchTime) < 3600000) {
        const modelData = JSON.parse(cachedModels);
        setAvailableModels(modelData);
        return modelData;
      }

      // Fetch from API if no valid cache is found
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch available models from OpenRouter:", errorText);
        throw new Error("Failed to fetch available models from OpenRouter");
      }

      const data = await response.json();
      console.log("Received data from OpenRouter:", data);

      if (!data.data) {
        console.error('Response data does not contain "data" key.');
        throw new Error("Invalid response format from OpenRouter");
      }

      const modelData = data.data.map((model: any) => {
        const maxOutput = model.top_provider?.max_completion_tokens ?? model.context_length ?? 9999;
        return {
          id: model.id,
          name: model.name,
          baseModel: model.id,
          systemPrompt: "",
          parameters: {
            top_p: 1,
            temperature: 0.7,
            frequency_penalty: 0,
            presence_penalty: 0,
            top_k: 0,
            max_tokens: maxOutput, // Set initial max_tokens to maxOutput
            max_output: maxOutput, // Include max_output in the parameters
          },
        };
      });

      // Cache the fetched models and update the fetch time
      localStorage.setItem('availableModels', JSON.stringify(modelData));
      localStorage.setItem('lastFetchTime', currentTime.toString());

      setAvailableModels(modelData);
      return modelData;
    } catch (error) {
      console.error("Error fetching available models:", error);
      return [];
    }
  }