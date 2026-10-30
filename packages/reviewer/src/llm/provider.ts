// One interface for every model the group uses (Claude, Codex/OpenAI): the reviewer does not care
// which one answers, and a team can switch without touching the review logic.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface ModelRequest {
  system: string;
  prompt: string;
  /** JSON schema the answer must follow */
  schema: Record<string, unknown>;
  maxTokens: number;
}

export interface ModelProvider {
  readonly name: string;
  complete(req: ModelRequest): Promise<string>;
}

export const requestKey = (req: ModelRequest): string =>
  createHash('sha256').update(JSON.stringify([req.system, req.prompt, req.schema])).digest('hex').slice(0, 24);

/** Claude through the Messages API, forced to answer through one tool whose input is the JSON. */
export class AnthropicProvider implements ModelProvider {
  readonly name: string;
  private client: Anthropic;

  constructor(private model = 'claude-sonnet-5-5', apiKey = process.env.ANTHROPIC_API_KEY) {
    this.name = `anthropic:${model}`;
    this.client = new Anthropic({ apiKey });
  }

  async complete(req: ModelRequest): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
      tools: [{ name: 'submit_review', description: 'Submit the review comments.', input_schema: req.schema as Anthropic.Tool.InputSchema }],
      tool_choice: { type: 'tool', name: 'submit_review' },
    });
    const call = res.content.find((c) => c.type === 'tool_use');
    if (!call || call.type !== 'tool_use') throw new Error('model did not submit a review');
    return JSON.stringify(call.input);
  }
}

/** OpenAI (Codex-family models) through the Responses API with a strict JSON schema. */
export class OpenAIProvider implements ModelProvider {
  readonly name: string;
  private client: OpenAI;

  constructor(private model = 'gpt-5-codex', apiKey = process.env.OPENAI_API_KEY) {
    this.name = `openai:${model}`;
    this.client = new OpenAI({ apiKey });
  }

  async complete(req: ModelRequest): Promise<string> {
    const res = await this.client.responses.create({
      model: this.model,
      instructions: req.system,
      input: req.prompt,
      max_output_tokens: req.maxTokens,
      text: { format: { type: 'json_schema', name: 'review', schema: req.schema, strict: true } },
    });
    return res.output_text;
  }
}

/**
 * Answers recorded earlier, keyed by a hash of the request. Tests and the benchmark replay them,
 * so results are reproducible and cost nothing; a request nobody recorded is an error, never a
 * silent empty review.
 */
export class ReplayProvider implements ModelProvider {
  readonly name: string;
  calls = 0;

  constructor(private cassette: Record<string, string>, recordedWith = 'recorded') {
    this.name = `replay:${recordedWith}`;
  }

  static fromFile(path: string): ReplayProvider {
    const data = JSON.parse(readFileSync(path, 'utf8')) as { model: string; answers: Record<string, string> };
    return new ReplayProvider(data.answers, data.model);
  }

  async complete(req: ModelRequest): Promise<string> {
    this.calls++;
    const answer = this.cassette[requestKey(req)];
    if (answer === undefined) throw new Error(`no recorded answer for request ${requestKey(req)}`);
    return answer;
  }
}

/** Wraps a live provider and writes every answer to a cassette. */
export class RecordingProvider implements ModelProvider {
  readonly name: string;

  constructor(private inner: ModelProvider, private path: string) {
    this.name = `recording:${inner.name}`;
  }

  async complete(req: ModelRequest): Promise<string> {
    const answer = await this.inner.complete(req);
    const data = existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : { model: this.inner.name, answers: {} };
    data.answers[requestKey(req)] = answer;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(data, null, 2)}\n`);
    return answer;
  }
}

export function providerFromEnv(): ModelProvider | null {
  if (process.env.REVIEWER_MODEL_PROVIDER === 'openai' && process.env.OPENAI_API_KEY) return new OpenAIProvider(process.env.REVIEWER_MODEL);
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider(process.env.REVIEWER_MODEL);
  return null;
}
