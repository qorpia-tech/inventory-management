/** Public files live under the base path on GitHub Pages; next/link adds it for routes, not for <img>. */
export function asset(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
