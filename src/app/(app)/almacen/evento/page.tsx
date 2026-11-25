import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingCards } from "@/ui/components/primitives";
import { WarehouseEventScreen } from "@/ui/screens/warehouse";

export const metadata: Metadata = { title: "Despacho y devolución" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingCards count={2} label="Cargando el evento" />}>
      <WarehouseEventScreen />
    </Suspense>
  );
}
