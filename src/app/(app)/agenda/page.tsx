import type { Metadata } from "next";
import { AgendaScreen } from "@/ui/screens/agenda";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return <AgendaScreen />;
}
