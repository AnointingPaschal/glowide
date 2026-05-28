// ================================
// OpenRouter AI Integration
// ================================

export interface ChatCompletionMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are GlowIDE's AI coding assistant — a senior full-stack Web3 engineer with deep expertise in:
- JavaScript, TypeScript, React, Next.js, Node.js
- Solidity smart contracts and Web3 development
- Arc Testnet (Chain ID: 5042002), USDC/Circle integrations
- dApp architecture, DeFi protocols, NFT systems
- Security best practices for smart contracts
- Code optimization, refactoring, and debugging

When writing code:
- Always use TypeScript with strict types
- Prefer modern patterns (async/await, hooks, composables)
- Write production-ready, secure, well-commented code
- For Solidity: follow security best practices, use latest compiler features
- Include error handling and edge cases
- Format code cleanly with proper indentation

When explaining:
- Be concise but thorough
- Use code examples
- Highlight important security considerations

You have access to the current workspace context. Use it to provide relevant, project-aware assistance.`;

export async function streamChatCompletion(
  messages: ChatCompletionMessage[],
  config: OpenRouterConfig,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://glowide.app",
        "X-Title": "GlowIDE",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
          },
          ...messages,
        ],
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenRouter error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error("Unknown error"));
  }
}

export async function getAvailableModels(apiKey: string): Promise<
  Array<{
    id: string;
    name: string;
    context_length: number;
    pricing?: { prompt: string; completion: string };
  }>
> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) throw new Error("Failed to fetch models");
    const data = await response.json();
    return data.data || [];
  } catch (err) {
    console.error("Error fetching models:", err);
    return [];
  }
}

export const POPULAR_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5", provider: "Google" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "Meta" },
  { id: "mistralai/mistral-large", name: "Mistral Large", provider: "Mistral" },
  { id: "deepseek/deepseek-coder", name: "DeepSeek Coder", provider: "DeepSeek" },
];
