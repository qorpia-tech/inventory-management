import type { Actor, Role } from "./types";

/**
 * Role to action map (design §2). Roles add up per person and none inherits another.
 * Permissions live in code; storage only keeps the roles of each membership.
 */
export const PERMISSIONS = {
  "stock.view": ["admin", "coordinator", "warehouse"],
  "article.manage": ["admin"],
  "stock.opening": ["admin"],
  "stock.adjust": ["admin"],
  "stock.receipt": ["admin", "warehouse"],
  "agenda.view": ["admin", "coordinator", "warehouse"],
  "event.edit": ["coordinator"],
  "event.lifecycle": ["coordinator"],
  "warehouse.operate": ["warehouse"],
  "staff.view": ["admin", "coordinator"],
  "storefront.configure": ["admin"],
  "demo.reset": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof PERMISSIONS;

export function can(actor: Pick<Actor, "roles">, action: Action): boolean {
  const allowed: readonly Role[] = PERMISSIONS[action];
  return actor.roles.some((role) => allowed.includes(role));
}
