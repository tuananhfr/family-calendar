import type { AiToolDef } from '../tools';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCompletion {
  text: string;
  toolCalls: Array<{ name: string; input: unknown }>;
}

export interface AiProvider {
  complete(input: { system: string; messages: AiMessage[]; tools: AiToolDef[] }): Promise<AiCompletion>;
}

/** Resolves to null when no provider is configured; the API then answers AI_NOT_CONFIGURED. */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiFailureReason = 'BUSY' | 'UNAVAILABLE' | 'MISCONFIGURED';

/** Provider failures without the upstream message, which can echo the prompt. */
export class AiProviderError extends Error {
  name = 'AiProviderError';
  constructor(readonly reason: AiFailureReason) {
    super(reason);
  }
}
