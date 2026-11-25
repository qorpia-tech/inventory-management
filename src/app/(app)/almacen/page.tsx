import type { Metadata } from "next";
import { WarehouseScreen } from "@/ui/screens/warehouse";

export const metadata: Metadata = { title: "Almacén" };

export default function Page() {
  return <WarehouseScreen />;
}
