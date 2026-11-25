import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingCards } from "@/ui/components/primitives";
import { EventDetailScreen } from "@/ui/screens/event-detail";

export const metadata: Metadata = { title: "Evento" };

// The event id travels in the query string, so events created in the browser work on a static host.
export default function Page() {
  return (
    <Suspense fallback={<LoadingCards count={2} label="Cargando el evento" />}>
      <EventDetailScreen />
    </Suspense>
  );
}
