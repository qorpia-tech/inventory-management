import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingCards } from "@/ui/components/primitives";
import { ArticleScreen } from "@/ui/screens/inventory";

export const metadata: Metadata = { title: "Artículo" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingCards count={2} label="Cargando el artículo" />}>
      <ArticleScreen />
    </Suspense>
  );
}
