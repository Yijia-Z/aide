import { useModels } from '../hooks/use-models';

const { setAvailableModels } = useModels();


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