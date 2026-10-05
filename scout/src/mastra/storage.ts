import { PostgresStore } from "@mastra/pg";
import { LibSQLStore } from "@mastra/libsql";

/**
 * One store for everything Mastra persists: agent working memory (scout_log),
 * workflow snapshots (so an approval survives a restart) and trace spans.
 * Neon Postgres when DATABASE_URL is set; a local SQLite file otherwise, so
 * `npm run dev` still works with zero setup.
 */
export function createScoutStorage(env: Record<string, string | undefined> = process.env) {
  const url = env.DATABASE_URL?.trim();
  if (url) return new PostgresStore({ id: "scout-neon", connectionString: url });
  return new LibSQLStore({ id: "scout-local", url: env.SCOUT_DB_URL ?? "file:./scout.db" });
}

export function storageKind(env: Record<string, string | undefined> = process.env): "neon" | "local" {
  return env.DATABASE_URL?.trim() ? "neon" : "local";
}
