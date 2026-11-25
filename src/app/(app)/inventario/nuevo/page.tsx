import type { Metadata } from "next";
import { NewArticleScreen } from "@/ui/screens/inventory";

export const metadata: Metadata = { title: "Nuevo artículo" };

export default function Page() {
  return <NewArticleScreen />;
}
