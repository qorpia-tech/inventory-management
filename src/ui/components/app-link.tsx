import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Internal link without automatic prefetch. The static export of this Next.js version writes
 * segment prefetch files under a different name than the client requests, so prefetching only
 * produces 404s on a static host. Navigation stays client-side and loads the route on tap.
 */
export default function AppLink({ prefetch = false, ...props }: ComponentProps<typeof Link>) {
  return <Link prefetch={prefetch} {...props} />;
}
