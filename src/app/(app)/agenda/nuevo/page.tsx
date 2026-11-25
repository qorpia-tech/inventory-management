import type { Metadata } from "next";
import { NewEventScreen } from "@/ui/screens/new-event";

export const metadata: Metadata = { title: "Nuevo borrador" };

export default function Page() {
  return <NewEventScreen />;
}
