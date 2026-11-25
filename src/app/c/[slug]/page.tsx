import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedStorefront, STOREFRONT_SLUGS } from "@/demo/storefront";
import { Landing } from "@/ui/landing/landing";

// Static export: only the published slugs exist.
export const dynamicParams = false;

export function generateStaticParams() {
  return STOREFRONT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const storefront = getPublishedStorefront(slug);
  if (!storefront) return {};
  return {
    title: { absolute: `${storefront.businessName} · Catering en ${storefront.city}` },
    description: `Bodas, almuerzos corporativos, cócteles y coffee break en ${storefront.city}. Consulta tu fecha por WhatsApp.`,
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const storefront = getPublishedStorefront(slug);
  if (!storefront) notFound();
  return <Landing storefront={storefront} />;
}
