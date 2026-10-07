import Anthropic from '@anthropic-ai/sdk';
import type { AiToolDef } from '../tools';
import { AiProviderError, type AiCompletion, type AiMessage, type AiProvider } from './ai-provider';

/** Shown instead of an answer when the model declines; the user can rephrase. */
export const REFUSAL_REPLY = 'Xin lỗi, trợ lý không thể giúp yêu cầu này. Bạn thử diễn đạt lại nhé.';

export class AnthropicProvider implements AiProvider {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    // Interactive request: fail within a minute rather than leave the chat spinning; the SDK retries 429/5xx twice.
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 });
  }

  async complete(input: { system: string; messages: AiMessage[]; tools: AiToolDef[] }): Promise<AiCompletion> {
    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16_000,
        // Server-side fallback re-runs a declined request on the recommended model instead of failing it.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: input.system,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        // Forced tool_choice is rejected by current models; strict schemas keep tool inputs valid under `auto`.
        tool_choice: { type: 'auto' },
        tools: input.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Beta.Messages.BetaTool.InputSchema,
          strict: true,
        })),
      });
    } catch (err) {
      throw new AiProviderError(classify(err));
    }

    if (response.stop_reason === 'refusal') return { text: REFUSAL_REPLY, toolCalls: [] };
    const text: string[] = [];
    const toolCalls: AiCompletion['toolCalls'] = [];
    for (const block of response.content) {
      if (block.type === 'text') text.push(block.text);
      else if (block.type === 'tool_use') toolCalls.push({ name: block.name, input: block.input });
    }
    return { text: text.join('\n').trim(), toolCalls };
  }
}

function classify(err: unknown): AiProviderError['reason'] {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return 'MISCONFIGURED';
  }
  if (err instanceof Anthropic.RateLimitError) return 'BUSY';
  return 'UNAVAILABLE';
}
