import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "QorStock Eventos · Demo", template: "%s · QorStock Eventos" },
  description: "Demo de QorStock Eventos: inventario y reservas para catering, con datos ficticios que corren en tu navegador.",
  applicationName: "QorStock",
  robots: { index: false, follow: false },
  openGraph: {
    title: "QorStock Eventos · Demo",
    description: "Inventario, reservas por horario, despacho y devolución desde el celular. Demo con datos ficticios.",
    locale: "es_PE",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d1e22",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
