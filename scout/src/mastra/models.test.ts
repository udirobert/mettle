import { describe, expect, it } from "vitest";
import { buildScoutModels, DEFAULT_FEATHERLESS_MODEL, FEATHERLESS_URL } from "./models";

const neon = { NEON_AI_GATEWAY_TOKEN: "t", NEON_AI_GATEWAY_BASE_URL: "https://x" };

describe("buildScoutModels", () => {
  it("falls back to OpenAI direct when nothing is configured", () => {
    expect(buildScoutModels({}).map((m) => m.model)).toEqual(["openai/gpt-5-mini"]);
  });

  it("uses Neon alone when only the gateway is configured", () => {
    const models = buildScoutModels(neon);
    expect(models.map((m) => m.id)).toEqual(["neon"]);
    expect(models[0].model).toBe("neon/claude-sonnet-4-6");
  });

  it("uses Featherless alone when it is the only key", () => {
    const [only, ...rest] = buildScoutModels({ FEATHERLESS_API_KEY: "fl" });
    expect(rest).toHaveLength(0);
    expect(only.model).toEqual({
      id: `featherless-ai/${DEFAULT_FEATHERLESS_MODEL}`,
      url: FEATHERLESS_URL,
      apiKey: "fl",
    });
  });

  it("puts Neon first and Featherless second as a fallback", () => {
    const models = buildScoutModels({ ...neon, FEATHERLESS_API_KEY: "fl" });
    expect(models.map((m) => m.id)).toEqual(["neon", "featherless"]);
  });

  it("honours SCOUT_MODEL as primary and FEATHERLESS_MODEL for the fallback", () => {
    const models = buildScoutModels({
      ...neon,
      SCOUT_MODEL: "neon/claude-haiku-4-5",
      FEATHERLESS_API_KEY: "fl",
      FEATHERLESS_MODEL: "zai-org/GLM-4.7",
    });
    expect(models[0].model).toBe("neon/claude-haiku-4-5");
    expect(models[1].model).toMatchObject({ id: "featherless-ai/zai-org/GLM-4.7" });
  });

  it("ignores a blank Featherless key", () => {
    expect(buildScoutModels({ FEATHERLESS_API_KEY: "  " }).map((m) => m.id)).toEqual(["openai"]);
  });
});
