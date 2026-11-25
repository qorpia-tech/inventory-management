/**
 * Published catalog of the fictional catering company (design §6.7).
 * The visitor only sees these fields; the inquiry is never stored.
 */
export type ServiceIllustration = "wedding" | "corporate" | "cocktail" | "coffee";

export interface PublicService {
  id: string;
  name: string;
  summary: string;
  includes: string[];
  illustration: ServiceIllustration;
}

export interface PublicStorefront {
  slug: string;
  businessName: string;
  city: string;
  districts: string[];
  services: PublicService[];
  faqs: { question: string; answer: string }[];
}

const STOREFRONTS: PublicStorefront[] = [
  {
    slug: "valtiera",
    businessName: "Valtiera Banquetes",
    city: "Lima",
    districts: [
      "Barranco",
      "Chorrillos",
      "Cieneguilla",
      "La Molina",
      "Lurín",
      "Miraflores",
      "Pachacámac",
      "San Borja",
      "San Isidro",
      "Santiago de Surco",
    ],
    services: [
      {
        id: "bodas",
        name: "Bodas",
        summary: "Banquete, mesa de bebidas y servicio de meseros para tu celebración.",
        includes: ["Menú de tres tiempos", "Cristalería y vajilla", "Montaje de mesas"],
        illustration: "wedding",
      },
      {
        id: "corporativos",
        name: "Almuerzos corporativos",
        summary: "Almuerzos para reuniones de trabajo, aniversarios y lanzamientos.",
        includes: ["Menú ejecutivo", "Montaje en tu local", "Servicio puntual"],
        illustration: "corporate",
      },
      {
        id: "cocteles",
        name: "Cócteles",
        summary: "Bocaditos fríos y calientes con barra de bebidas para eventos de pie.",
        includes: ["Bocaditos variados", "Barra de bebidas", "Meseros de servicio"],
        illustration: "cocktail",
      },
      {
        id: "coffee-break",
        name: "Coffee break",
        summary: "Pausas de café para capacitaciones, congresos y talleres.",
        includes: ["Café y bebidas calientes", "Opciones dulces y saladas", "Reposición durante la jornada"],
        illustration: "coffee",
      },
    ],
    faqs: [
      { question: "¿Con cuánta anticipación debo consultar?", answer: "Te recomendamos escribirnos con dos semanas de anticipación. Para fechas cercanas, consúltanos igual y revisamos la disponibilidad." },
      { question: "¿Atienden fuera de Lima Metropolitana?", answer: "Atendemos los distritos de la lista. Para otros lugares, cuéntanos en el mensaje y te confirmamos." },
      { question: "¿Puedo cambiar el número de invitados?", answer: "Sí. Te pediremos el número final unos días antes para preparar la vajilla y el personal." },
      { question: "¿El mensaje de WhatsApp se envía solo?", answer: "No. Se abre con el texto listo y tú lo revisas, lo cambias si quieres y lo envías." },
      { question: "¿Guardan mis datos?", answer: "No. Esta página no guarda tu consulta: solo prepara el mensaje para WhatsApp." },
      { question: "¿Ofrecen degustación?", answer: "Coordinamos una degustación para bodas y eventos corporativos grandes. Pregúntanos por fechas." },
    ],
  },
];

export const STOREFRONT_SLUGS = STOREFRONTS.map((s) => s.slug);

export function getPublishedStorefront(slug: string): PublicStorefront | null {
  return STOREFRONTS.find((s) => s.slug === slug) ?? null;
}

export interface InquiryInput {
  serviceName: string;
  /** Long date already formatted for Peru, for example «sábado, 28 de noviembre de 2026». */
  dateLabel: string;
  district: string;
  guests: number;
}

export function buildInquiryMessage(storefront: PublicStorefront, input: InquiryInput): string {
  return [
    `Hola, ${storefront.businessName}.`,
    `Quisiera cotizar el servicio de ${input.serviceName.toLowerCase()} para el ${input.dateLabel}, en ${input.district}, para ${input.guests} invitados.`,
    "¿Me pueden enviar opciones y precios?",
  ].join(" ");
}

/** Opens WhatsApp with an editable message. The demo has no phone number on purpose. */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
