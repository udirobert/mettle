/**
 * Scout model selection. Providers are included only when configured, in
 * priority order; Mastra falls through the list when a model errors out.
 *
 *   1. SCOUT_MODEL        – explicit override (any Mastra model string)
 *   2. Neon AI Gateway    – NEON_AI_GATEWAY_TOKEN (+ _BASE_URL) → neon/<model>
 *   3. Featherless        – FEATHERLESS_API_KEY → OpenAI-compatible open models
 *   4. OpenAI direct      – Mastra's default env (OPENAI_API_KEY)
 *
 * Featherless is also the fallback when Neon is primary.
 */

export const FEATHERLESS_URL = "https://api.featherless.ai/v1";
export const DEFAULT_NEON_MODEL = "neon/claude-sonnet-4-6";
// Strong agentic tool-calling among Featherless' open models.
export const DEFAULT_FEATHERLESS_MODEL = "moonshotai/Kimi-K2-Instruct-0905";

type Env = Record<string, string | undefined>;

export type ScoutModel = {
  id: string;
  model: string | { id: `${string}/${string}`; url: string; apiKey: string };
  maxRetries: number;
};

export function buildScoutModels(env: Env = process.env): ScoutModel[] {
  const models: ScoutModel[] = [];
  const override = env.SCOUT_MODEL?.trim();
  const hasNeon = Boolean(env.NEON_AI_GATEWAY_TOKEN && env.NEON_AI_GATEWAY_BASE_URL);
  const featherlessKey = env.FEATHERLESS_API_KEY?.trim();

  if (override) {
    models.push({ id: "primary", model: override, maxRetries: 1 });
  } else if (hasNeon) {
    models.push({ id: "neon", model: DEFAULT_NEON_MODEL, maxRetries: 1 });
  }

  if (featherlessKey) {
    const name = env.FEATHERLESS_MODEL?.trim() || DEFAULT_FEATHERLESS_MODEL;
    models.push({
      id: "featherless",
      model: {
        id: `featherless-ai/${name}`,
        url: FEATHERLESS_URL,
        apiKey: featherlessKey,
      },
      maxRetries: 1,
    });
  }

  if (models.length === 0) {
    models.push({ id: "openai", model: "openai/gpt-5-mini", maxRetries: 1 });
  }
  return models;
}
