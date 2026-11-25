import type { Metadata } from "next";
import { HomeScreen } from "@/ui/screens/home";

export const metadata: Metadata = { title: "Inicio" };

export default function Page() {
  return <HomeScreen />;
}
