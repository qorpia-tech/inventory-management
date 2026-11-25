import type { Metadata } from "next";
import { StaffScreen } from "@/ui/screens/staff";

export const metadata: Metadata = { title: "Personal y asistencia" };

export default function Page() {
  return <StaffScreen />;
}
