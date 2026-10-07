# ChatGPT plugin playbook (Oct 2026)

Grounded in [OpenAI Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines) and DevDay 2026 Plugin Extensions (skills + MCP + optional UI + MCP Events; universal ChatGPT/Codex directory at chatgpt.com/plugins).

## Why this window matters

ChatGPT can surface plugins mid-conversation when user intent matches a tool. That is the distribution bet: empty high-intent slots, description in the user's words, free action first, then double down on what gets recommended.

## Shared shipping rule (all our plugins)

1. **Trigger phrase** = exact words people type ("is my data healthy?", "audit this paper").
2. **Ship the free action first** — discovery + recommendation surface.
3. **Watch** which queries get recommended mid-conversation.
4. **Double down** on that slot (narrower tools, better examples, reliability).

## Best-in-class shape

| Layer        | Do this                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability   | Headless MCP tools first; optional UI only where it changes the outcome (preview, confirm, compare).                                                  |
| Tools        | Narrow, verb-named (`health_check`, `extract_claims`). Separate tools per operation — no generic executor.                                            |
| Descriptions | When to use **and** when not. Match schema and real behavior. No "prefer this over X".                                                                |
| Annotations  | Set `readOnlyHint`, `destructiveHint`, `openWorldHint` explicitly.                                                                                    |
| Listing      | Clear name (not generic single word; don't append "Plugin"/"MCP"). Example **Prompts**, not screenshots. No pricing/trials/promos in the description. |
| Privacy      | Published privacy policy; minimize inputs; no secrets/PCI/PHI in tool schemas.                                                                        |
| Auth         | Transparent OAuth; demo account with sample data for review.                                                                                          |
| Intent QA    | Test direct, indirect, negative, ambiguous prompts. Track selection precision/recall, arg accuracy, completion, latency.                              |
| Business     | Keep signup, billing, analytics on our site. ChatGPT = discovery + execution surface.                                                                 |

## Monetization constraint (critical)

OpenAI currently allows plugin **commerce only for physical goods**. Selling digital products/services (subscriptions, credits, paid digital audits/briefings) **inside** ChatGPT is not allowed.

Allowed patterns for our free → paid ladders:

- Free tool runs fully in ChatGPT (the discovery wedge).
- User may **sign in to an existing paid account** and use entitlements already purchased elsewhere.
- Plugin may **explain** that a richer action needs a higher plan and link to an **informational** plans page — **not** to checkout.
- Do **not** initiate subscribe/upgrade/checkout in-plugin; do **not** apply ChatGPT-specific surcharges.
- Keep x402 / paid APIs on our own product URLs; treat ChatGPT as the free funnel + account-linked entitlements.

## Launch checklist

- [x] One primary trigger phrase in user language
- [x] Free read-only (or low-side-effect) tool shipped and stable
- [x] Paid/deep action available via existing account or external product — not in-plugin checkout
- [x] Intent test set (10+ prompts) with pass/fail
- [ ] Privacy policy + support contact + identity verification ready
- [x] Example Prompts on the directory listing
- [ ] Measure recommendation rate → double down

## Sources

- https://developers.openai.com/plugins/plugin-guidelines
- https://learn.chatgpt.com/docs/plugins
- DevDay 2026 Plugin Extensions / mid-conversation discovery writeups (e.g. intent routing / "plugin SEO")

## Mettle v1 slot

| Item                     | Value                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger phrases          | "help me prepare for this meeting", "what are they going to ask me"                                                                                                                    |
| Free MCP tool            | `meeting_brief` at `https://mettle-xi.vercel.app/mcp`                                                                                                                                  |
| Paid/deep                | Rehearsal + debrief via existing account / [informational plans](https://mettle-xi.vercel.app/plans) — no in-plugin checkout                                                           |
| Connect / eval / prompts | [CHATGPT_PLUGIN_CONNECT.md](./CHATGPT_PLUGIN_CONNECT.md), [CHATGPT_PLUGIN_EVAL.md](./CHATGPT_PLUGIN_EVAL.md), [CHATGPT_PLUGIN_STARTER_PROMPTS.md](./CHATGPT_PLUGIN_STARTER_PROMPTS.md) |

## Usage → monetisation scoreboard (Plugin Lane)

Watch weekly. Free MCP wedge: `meeting_brief` in ChatGPT; **digital paid stays off-platform** (rehearsal / debrief / plans — informational `/plans` only, no in-plugin checkout). Instrument when you have analytics (MCP/`/mcp` request logs, Vercel logs, site referral/`utm` on deep-links, plan-start events); do not invent dashboards until those exist.

| #   | Metric                       | What “good” looks like                                                                        |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Plugin connects              | Successful connect + `tools/list` for `https://mettle-xi.vercel.app/mcp`                      |
| 2   | `meeting_brief` calls / week | Free-hook volume on the live ChatGPT tool                                                     |
| 3   | Repeat briefers              | ≥2 briefs in 7 days (same user / stable client id if logged)                                  |
| 4   | Click-through off free set   | Deep-link to rehearsal / debrief / [plans](https://mettle-xi.vercel.app/plans) (not checkout) |
| 5   | Paid plan starts             | Plan / trial **started** attributed to ChatGPT referral — when attribution exists             |

Related: [CONNECT](./CHATGPT_PLUGIN_CONNECT.md) · free tool vs out-of-set product surfaces.
