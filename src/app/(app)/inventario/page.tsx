import type { Metadata } from "next";
import { InventoryScreen } from "@/ui/screens/inventory";

export const metadata: Metadata = { title: "Inventario" };

export default function Page() {
  return <InventoryScreen />;
}
