import type { Metadata } from "next";
import { MoreScreen } from "@/ui/screens/more";

export const metadata: Metadata = { title: "Más" };

export default function Page() {
  return <MoreScreen />;
}
