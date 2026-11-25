import { fail, type CommandResult } from "./errors";
import type { CommandContext, InventoryState } from "./types";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, entry]) => key !== "idempotencyKey" && entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

/**
 * One user intent produces one movement (design §4, decision 6).
 * The key is bound to the operation, the acting user and the request body:
 * a replay returns the stored response; the same key with another body is rejected.
 * A failed command stores nothing, like a rolled back transaction.
 */
export function withIdempotency<T>(
  state: InventoryState,
  key: string | undefined,
  operation: string,
  input: unknown,
  ctx: CommandContext,
  run: () => CommandResult<T>,
): CommandResult<T> {
  if (!key) return run();
  const fingerprint = JSON.stringify({ operation, actor: ctx.actor.id, input: canonical(input) });
  const existing = state.idempotency[key];
  if (existing) {
    if (existing.fingerprint !== fingerprint) return fail("idempotency_mismatch");
    return { ok: true, state, value: existing.response as T, replayed: true };
  }
  const result = run();
  if (result.ok) {
    result.state.idempotency[key] = { operation, fingerprint, response: result.value };
  }
  return result;
}
