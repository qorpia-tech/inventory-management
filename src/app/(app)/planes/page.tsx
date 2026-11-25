import type { Metadata } from "next";
import { PlansScreen } from "@/ui/screens/plans";

export const metadata: Metadata = {
  title: "Planes y precios",
  description: "Precios de QorStock en soles, IGV incluido, por empresa: planes, adicionales, implementación, web comercial y anticipo.",
};

export default function Page() {
  return <PlansScreen />;
}
