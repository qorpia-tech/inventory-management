"use client";

import Link from "@/ui/components/app-link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowLeftIcon, BriefcaseIcon, ChampagneIcon, CoffeeIcon, MartiniIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { buildInquiryMessage, buildWhatsAppUrl, type PublicStorefront, type ServiceIllustration } from "@/demo/storefront";
import { fromLima, limaDateKey } from "@/lib/lima-time";
import { formatLongDateYear } from "../format";
import { useDemoControls } from "../runtime";
import { buttonClass, cx } from "../components/primitives";
import { Field, SelectInput, TextArea, TextInput } from "../components/fields";

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase, DrawSVGPlugin);
// Base curve of the visual system: weighted, decelerating into place.
CustomEase.create("qor.out", "0.22,1,0.36,1");

const ILLUSTRATION: Record<ServiceIllustration, { icon: typeof ChampagneIcon; tile: string }> = {
  wedding: { icon: ChampagneIcon, tile: "bg-blush-100 text-blush-800" },
  corporate: { icon: BriefcaseIcon, tile: "bg-mist-100 text-mist-800" },
  cocktail: { icon: MartiniIcon, tile: "bg-apricot-100 text-apricot-800" },
  coffee: { icon: CoffeeIcon, tile: "bg-sage-100 text-sage-800" },
};

const noopSubscribe = () => () => {};
const todayInLima = () => limaDateKey(Date.now());

const TAGLINE = "Cada copa, cada mantel y cada mesero en su lugar. Tú solo recibes a tus invitados.";

const NAV_LINKS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#preguntas", label: "Preguntas" },
];

function TableSetting() {
  // Simple line drawing of a place setting, drawn with the brand gold.
  return (
    <svg viewBox="0 0 320 240" className="h-auto w-full max-w-[420px]" role="img" aria-label="Ilustración de un puesto de mesa con plato, cubiertos y copas">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle data-draw cx="160" cy="130" r="86" />
        <circle data-draw cx="160" cy="130" r="62" opacity="0.7" />
        <path data-draw d="M48 70 V190 M40 70 V102 C40 110 56 110 56 102 V70" />
        <path data-draw d="M272 70 C286 92 286 126 272 136 V190" />
        <circle data-draw cx="262" cy="40" r="18" />
        <circle data-draw cx="226" cy="30" r="13" opacity="0.7" />
        <path data-draw d="M108 222 H212" opacity="0.5" />
      </g>
    </svg>
  );
}

interface FormValues {
  serviceId: string;
  date: string;
  district: string;
  guests: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues, today: string): FormErrors {
  const errors: FormErrors = {};
  if (!values.serviceId) errors.serviceId = "Elige un servicio.";
  if (!values.date) errors.date = "Elige la fecha del evento.";
  else if (values.date < today) errors.date = "La fecha ya pasó. Elige una fecha futura.";
  if (!values.district) errors.district = "Elige el distrito.";
  const guests = Number.parseInt(values.guests, 10);
  if (!values.guests) errors.guests = "Escribe cuántos invitados esperas.";
  else if (!/^\d+$/.test(values.guests) || guests < 10 || guests > 2000) errors.guests = "Escribe un número entre 10 y 2000.";
  return errors;
}

export function Landing({ storefront }: { storefront: PublicStorefront }) {
  const root = useRef<HTMLDivElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const controls = useDemoControls();
  const [menuOpen, setMenuOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({ serviceId: "", date: "", district: "", guests: "" });
  const [touched, setTouched] = useState(false);
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const today = useSyncExternalStore(noopSubscribe, todayInLima, () => "");

  useEffect(() => {
    controls?.markVisited("landingOpened");
  }, [controls]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { motion: "(prefers-reduced-motion: no-preference)", reduced: "(prefers-reduced-motion: reduce)", desktop: "(min-width: 768px)" },
        (context) => {
          const { motion, desktop } = context.conditions as { motion: boolean; desktop: boolean };
          // Reduced motion: no movement, only a short fade of the hero so the page still feels alive.
          if (!motion) {
            gsap.from(["[data-hero-line]", "[data-hero-sub]", "[data-hero-cta]", "[data-hero-art]"], { autoAlpha: 0, duration: 0.3, ease: "power1.out" });
            return;
          }
          const distance = desktop ? 32 : 16;

          const hero = gsap.timeline({ defaults: { ease: "qor.out", duration: desktop ? 0.8 : 0.6 } });
          hero
            .from("[data-hero-line]", { y: 24, autoAlpha: 0, stagger: 0.08 })
            .from("[data-hero-sub]", { y: 16, autoAlpha: 0 }, "<0.2")
            .from("[data-hero-cta]", { y: 12, autoAlpha: 0, stagger: 0.06 }, "<0.1");
          if (desktop) {
            // Stroke drawing only on larger screens; phones get a plain fade.
            hero.from("[data-draw]", { drawSVG: 0, duration: 1.4, ease: "power2.inOut", stagger: 0.1 }, 0.15);
          } else {
            hero.from("[data-hero-art]", { autoAlpha: 0, duration: 0.6 }, 0.2);
          }

          // Sections rise once when they enter, never replay.
          const reveal = gsap.utils.toArray<HTMLElement>("[data-reveal]");
          gsap.set(reveal, { y: distance, autoAlpha: 0 });
          ScrollTrigger.batch(reveal, {
            start: "top 90%",
            once: true,
            onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: desktop ? 0.7 : 0.5, ease: "qor.out", stagger: 0.06, overwrite: true }),
          });

          // Tagline: each word goes from muted to full color as the section scrolls by.
          gsap.fromTo(
            "[data-word]",
            { opacity: 0.3 },
            {
              opacity: 1,
              ease: "qor.out",
              stagger: 0.12,
              scrollTrigger: { trigger: "[data-tagline]", start: "top 78%", end: "bottom 50%", scrub: desktop ? 0.6 : true },
            },
          );
        },
      );
    },
    { scope: root },
  );

  // Menu links arrive one after another: 60 ms apart, the whole sequence under 400 ms.
  useGSAP(
    () => {
      if (!menuOpen) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo("[data-menu-link]", { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.22, ease: "qor.out", stagger: 0.06 });
      });
      return () => mm.revert();
    },
    { scope: menuPanel, dependencies: [menuOpen], revertOnUpdate: true },
  );

  const service = storefront.services.find((s) => s.id === values.serviceId);
  const errors = validate(values, today);
  const generated = useMemo(() => {
    if (!service || !values.date || !values.district || errors.guests) return "";
    return buildInquiryMessage(storefront, {
      serviceName: service.name,
      dateLabel: formatLongDateYear(fromLima(values.date, "12:00")),
      district: values.district,
      guests: Number.parseInt(values.guests, 10),
    });
  }, [service, values.date, values.district, values.guests, errors.guests, storefront]);
  const message = customMessage ?? generated;
  const valid = Object.keys(errors).length === 0 && message.trim().length > 0;
  const whatsappUrl = buildWhatsAppUrl(message);
  const showError = (key: keyof FormValues) => (touched ? errors[key] : undefined);

  const chooseService = (serviceId: string) => {
    setValues((v) => ({ ...v, serviceId }));
    setCustomMessage(null);
    document.getElementById("consulta")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const ctaLabel = "Consultar por WhatsApp";

  return (
    <div ref={root} className="min-h-dvh bg-petroleum-950">
      <a href="#contenido" className="sr-only z-[60] rounded-lg bg-gold-300 text-petroleum-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <div className="on-dark flex flex-wrap items-center justify-between gap-2 bg-petroleum-950 px-4 py-2 text-petroleum-300">
        <p className="caption-4">
          <span className="text-gold-300">Vista previa de la web comercial</span> · Demo con datos ficticios
        </p>
        <Link href="/" className="inline-flex min-h-11 items-center gap-1 caption-4 text-ivory-50 underline-offset-2 [@media(hover:hover)]:hover:underline">
          <ArrowLeftIcon size={14} aria-hidden />
          Volver a la demo
        </Link>
      </div>

      <nav aria-label="Principal" className="on-dark sticky top-0 z-40 -mb-16 px-4 pt-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-2xl border border-ivory-50/10 bg-petroleum-950/55 px-3 py-2 backdrop-blur-md md:w-fit md:gap-6">
          <a href="#contenido" className="title-3 inline-flex min-h-11 items-center px-1 text-ivory-50">
            {storefront.businessName}
          </a>
          <ul className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="pressable inline-flex min-h-11 items-center rounded-lg px-3 body-5 text-ivory-200 [@media(hover:hover)]:hover:bg-ivory-50/10">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <span className="hidden md:block">
              <a href="#consulta" className={buttonClass("primary", "sm")}>
                Consultar
              </a>
            </span>
          <button
            type="button"
            className="pressable relative inline-flex size-11 flex-col items-center justify-center gap-1.5 rounded-xl md:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-movil"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-line menu-line-top block h-0.5 w-5 rounded-full bg-ivory-50" />
            <span className="menu-line menu-line-bottom block h-0.5 w-5 rounded-full bg-ivory-50" />
          </button>
        </div>
      </nav>

      <div
        id="menu-movil"
        ref={menuPanel}
        hidden={!menuOpen}
        className="fixed inset-x-0 bottom-0 top-0 z-30 flex flex-col justify-end bg-petroleum-950/95 px-6 pb-[calc(48px+var(--safe-bottom))] backdrop-blur-xl md:hidden"
      >
        <ul className="flex flex-col gap-2">
          {[...NAV_LINKS, { href: "#consulta", label: "Consultar" }].map((link) => (
            <li key={link.href} data-menu-link>
              <a href={link.href} onClick={() => setMenuOpen(false)} className="inline-flex min-h-12 w-full items-center heading-6 text-ivory-50">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>


      <header className="bg-petroleum-gradient on-dark relative overflow-hidden text-ivory-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 pt-28 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] md:items-center md:pb-24 md:pt-32">
          <div className="flex flex-col gap-6">
            <p className="caption-3 text-gold-300" data-hero-line>
              Catering en {storefront.city}
            </p>
            <h1 className="heading-4 md:heading-2 lg:heading-1 max-w-[680px] bg-linear-to-r from-ivory-50 to-petroleum-300 bg-clip-text text-transparent">
              <span data-hero-line className="block">
                Tu evento, servido
              </span>
              <span data-hero-line className="block">
                con calma de principio a fin.
              </span>
            </h1>
            <p data-hero-sub className="body-3 max-w-[680px] text-ivory-200 md:title-2">
              Bodas, almuerzos corporativos, cócteles y coffee break. Cuéntanos la fecha, el distrito y cuántos invitados esperas, y te respondemos por WhatsApp.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href="#consulta" data-hero-cta className={buttonClass("primary", "md", "shrink-0 whitespace-nowrap")}>
                <WhatsappLogoIcon size={20} weight="fill" aria-hidden />
                {ctaLabel}
              </a>
              <p data-hero-cta className="caption-4 text-petroleum-300">
                Atendemos {storefront.districts.length} distritos de {storefront.city}. Tú revisas el mensaje antes de enviarlo.
              </p>
            </div>
          </div>
          <div data-hero-art className="flex justify-center text-gold-300">
            <TableSetting />
          </div>
        </div>
      </header>

      <main id="contenido" className="bg-ivory-50">
        <section id="servicios" aria-labelledby="servicios-titulo" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:py-24">
          <div data-reveal className="flex max-w-[680px] flex-col gap-3">
            <h2 id="servicios-titulo" className="heading-5 md:heading-3 text-ink-900">
              Elige el servicio para tu fecha
            </h2>
            <p className="body-3 text-ink-700">Cada servicio incluye el montaje y el recojo del material. En la web real, cada uno lleva las fotos del catering.</p>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {storefront.services.map((item) => {
              const art = ILLUSTRATION[item.illustration];
              const Icon = art.icon;
              const selected = values.serviceId === item.id;
              return (
                <li key={item.id} data-reveal className={cx("lift-on-hover flex flex-col gap-4 rounded-3xl border bg-white p-4", selected ? "border-gold-500" : "border-ivory-300")}>
                  <div className={cx("flex aspect-[16/9] items-center justify-center rounded-2xl", art.tile)} aria-hidden>
                    <Icon size={56} weight="light" />
                  </div>
                  <div className="flex flex-col gap-2 px-1">
                    <h3 className="heading-6 text-ink-900">{item.name}</h3>
                    <p className="body-6 text-ink-700">{item.summary}</p>
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {item.includes.map((inc) => (
                        <li key={inc} className="rounded-full bg-ivory-200 px-2 py-0.5 caption-4 text-ink-700">
                          {inc}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button type="button" onClick={() => chooseService(item.id)} className={buttonClass(selected ? "dark" : "secondary", "md", "mt-auto")} aria-pressed={selected}>
                    {selected ? "Servicio elegido" : "Elegir este servicio"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Nuestra promesa" className="on-dark bg-petroleum-950 px-4 py-24 md:py-32">
          <p data-tagline className="heading-4 md:heading-2 mx-auto max-w-[680px] text-ivory-50">
            {TAGLINE.split(" ").map((word, index) => (
              <span key={index} data-word className="inline">
                {word}{" "}
              </span>
            ))}
          </p>
        </section>

        <section id="como-funciona" aria-labelledby="pasos-titulo" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 md:py-24">
          <h2 id="pasos-titulo" data-reveal className="heading-5 md:heading-3 max-w-[680px] text-ink-900">
            Tu consulta en tres pasos
          </h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: "Elige el servicio", text: "Bodas, almuerzos corporativos, cócteles o coffee break." },
              { title: "Cuéntanos los datos", text: "Fecha, distrito y número de invitados. Nada más." },
              { title: "Revisa y envía", text: "Se abre WhatsApp con el mensaje listo. Lo cambias si quieres y lo envías." },
            ].map((step, index) => (
              <li key={step.title} data-reveal className="flex flex-col gap-3 rounded-3xl border border-ivory-300 bg-white p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-gold-100 title-3 text-gold-800">{index + 1}</span>
                <h3 className="heading-6 text-ink-900">{step.title}</h3>
                <p className="body-6 text-ink-700">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="consulta" aria-labelledby="consulta-titulo" className="scroll-mt-24 bg-ivory-100 px-4 py-16 md:py-24">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
            <div data-reveal className="flex flex-col gap-3">
              <h2 id="consulta-titulo" className="heading-5 md:heading-3 text-ink-900">
                Consulta tu fecha
              </h2>
              <p className="body-3 text-ink-700">Completa los datos y abre WhatsApp con el mensaje listo. Esta página no guarda tu consulta.</p>
            </div>
            <form
              data-reveal
              noValidate
              className="flex flex-col gap-4 rounded-3xl border border-ivory-300 bg-white p-4 md:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                setTouched(true);
                if (valid) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="body-5 pb-1 text-ink-900">Servicio</legend>
                <div className="grid grid-cols-2 gap-2">
                  {storefront.services.map((item) => {
                    const checked = values.serviceId === item.id;
                    return (
                      <label
                        key={item.id}
                        className={cx(
                          "pressable flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center button-sm",
                          checked ? "border-petroleum-700 bg-petroleum-700 text-ivory-50" : "border-line-strong bg-white text-ink-900",
                        )}
                      >
                        <input
                          type="radio"
                          name="service"
                          value={item.id}
                          checked={checked}
                          onChange={() => {
                            setValues((v) => ({ ...v, serviceId: item.id }));
                            setCustomMessage(null);
                          }}
                          className="sr-only"
                        />
                        {item.name}
                      </label>
                    );
                  })}
                </div>
                {showError("serviceId") && (
                  <p className="caption-4 text-blush-800" role="alert">
                    {errors.serviceId}
                  </p>
                )}
              </fieldset>
              <div className="grid gap-4 min-[420px]:grid-cols-2">
                <Field label="Fecha del evento" htmlFor="inq-date" error={showError("date")}>
                  <TextInput
                    id="inq-date"
                    type="date"
                    min={today}
                    value={values.date}
                    invalid={!!showError("date")}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, date: e.target.value }));
                      setCustomMessage(null);
                    }}
                  />
                </Field>
                <Field label="Invitados" htmlFor="inq-guests" error={showError("guests")}>
                  <TextInput
                    id="inq-guests"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="Por ejemplo, 120"
                    value={values.guests}
                    invalid={!!showError("guests")}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, guests: e.target.value.replace(/\D/g, "") }));
                      setCustomMessage(null);
                    }}
                  />
                </Field>
              </div>
              <Field label="Distrito" htmlFor="inq-district" error={showError("district")}>
                <SelectInput
                  id="inq-district"
                  value={values.district}
                  invalid={!!showError("district")}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, district: e.target.value }));
                    setCustomMessage(null);
                  }}
                >
                  <option value="">Elige el distrito</option>
                  {storefront.districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Mensaje para WhatsApp" htmlFor="inq-message" hint="Puedes editarlo aquí o en WhatsApp antes de enviarlo.">
                <TextArea
                  id="inq-message"
                  value={message}
                  placeholder="Completa los datos y aparecerá el mensaje."
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
              </Field>
              {customMessage !== null && (
                <button type="button" onClick={() => setCustomMessage(null)} className="pressable -mt-2 inline-flex min-h-11 w-fit items-center rounded-lg px-1 body-5 text-petroleum-700 underline underline-offset-2">
                  Volver al mensaje sugerido
                </button>
              )}
              {touched && !valid && Object.keys(errors).length === 0 && (
                <p className="caption-4 text-blush-800" role="alert">
                  Escribe un mensaje antes de abrir WhatsApp.
                </p>
              )}
              <button type="submit" className={buttonClass("primary", "md")}>
                <WhatsappLogoIcon size={20} weight="fill" aria-hidden />
                Abrir WhatsApp
              </button>
              <p className="caption-4 text-ink-600">Se abre WhatsApp con el texto listo. Nada se envía hasta que tú lo confirmes.</p>
            </form>
          </div>
        </section>

        <section id="preguntas" aria-labelledby="faq-titulo" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 md:py-24">
          <h2 id="faq-titulo" data-reveal className="heading-5 md:heading-3 text-ink-900">
            Preguntas frecuentes
          </h2>
          <div className="mt-6 flex flex-col gap-2">
            {storefront.faqs.map((faq) => (
              <details key={faq.question} data-reveal className="group rounded-2xl border border-ivory-300 bg-white">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 title-3 text-ink-900 [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span aria-hidden className="text-gold-800 transition-transform duration-200 ease-out-strong group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-4 pb-4 body-6 text-ink-700">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-petroleum-gradient on-dark px-4 py-16 text-center md:py-24" aria-labelledby="cta-final">
          <div data-reveal className="mx-auto flex max-w-[680px] flex-col items-center gap-4">
            <h2 id="cta-final" className="heading-5 md:heading-3 text-ivory-50">
              ¿Ya tienes la fecha?
            </h2>
            <p className="body-3 text-ivory-200">Cuéntanos el servicio, el distrito y los invitados. Te respondemos por WhatsApp.</p>
            <a href="#consulta" className={buttonClass("primary", "md")}>
              <WhatsappLogoIcon size={20} weight="fill" aria-hidden />
              {ctaLabel}
            </a>
          </div>
        </section>
      </main>

      <footer className="on-dark bg-petroleum-950 px-4 pb-[calc(24px+var(--safe-bottom))] pt-8 text-petroleum-300">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 caption-4">
          <p className="title-4 text-ivory-50">{storefront.businessName}</p>
          <p>
            {storefront.city}, Perú · Demo con datos ficticios. La política de privacidad y los términos se publican con la web real.
          </p>
          <p>Página creada con QorStock Web comercial.</p>
        </div>
      </footer>
    </div>
  );
}
