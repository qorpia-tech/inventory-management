import type { ReactNode } from "react";
import { CheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { advanceFor, formatSoles, hiringSteps, implementationWithInvoicing, PRICING } from "@/demo/pricing";
import { Card, PageHeader, SectionTitle } from "../components/primitives";
import { PlanCalculator } from "./plan-calculator";
import { PlanCards } from "./plan-cards";

function Price({ amount, suffix, prefix }: { amount: number; suffix?: string; prefix?: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1">
      {prefix && <span className="body-5 text-ink-700">{prefix}</span>}
      <span className="number-lg text-ink-900">{formatSoles(amount)}</span>
      {suffix && <span className="body-5 text-ink-700">{suffix}</span>}
    </p>
  );
}

function Row({ title, price, children }: { title: string; price: ReactNode; children: ReactNode }) {
  return (
    <Card as="li" className="flex flex-col gap-2">
      <p className="title-3 text-ink-900">{title}</p>
      {price}
      <p className="body-6 text-ink-700">{children}</p>
    </Card>
  );
}

/** Public price sheet (part A). Every amount and total comes from the pricing data file. */
export function PlansScreen() {
  const { addons, implementation, website, advance, conditions } = PRICING;
  const advanceExamples = [
    { label: "Implementación base", split: advanceFor(implementation.base.from) },
    { label: "Solo web comercial", split: advanceFor(website.creation.from) },
  ];

  return (
    <>
      <PageHeader title="Planes de QorStock" description={<strong className="font-semibold text-ink-900">{PRICING.taxNote}</strong>} />

      <section aria-labelledby="how-to-hire">
        <SectionTitle id="how-to-hire">Cómo se contrata</SectionTitle>
        <Card>
          <p className="body-6 text-ink-700">
            Todo plan empieza con una implementación de pago único. Después pagas solo la mensualidad.
          </p>
          <ol className="mt-3 grid gap-3 md:grid-cols-3">
            {hiringSteps().map((step, index) => (
              <li key={step.title} className="flex items-start gap-3 rounded-xl bg-ivory-100 p-3">
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petroleum-950 body-5 text-gold-300"
                >
                  {index + 1}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="title-4 text-ink-900">{step.title}</span>
                  <span className="body-6 text-ink-700">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section aria-labelledby="calculator">
        <SectionTitle id="calculator">Arma tu plan</SectionTitle>
        <PlanCalculator />
      </section>

      <section aria-labelledby="plans">
        <SectionTitle id="plans">Planes</SectionTitle>
        <PlanCards />
      </section>

      <section aria-labelledby="implementation">
        <SectionTitle id="implementation">Implementación: pago único para empezar</SectionTitle>
        <ul className="grid gap-3 md:grid-cols-2">
          <Row title={implementation.base.name} price={<Price prefix="desde" amount={implementation.base.from} />}>
            {implementation.base.includes}
          </Row>
          <Card as="li" className="flex flex-col gap-2">
            <p className="title-3 text-ink-900">{implementation.invoicing.name}</p>
            <Price prefix="+" amount={implementation.invoicing.surcharge} suffix="sobre la base" />
            <p className="body-5 text-ink-900">desde {formatSoles(implementationWithInvoicing())} en total</p>
            <p className="body-6 text-ink-700">
              {implementation.invoicing.includes} ({formatSoles(implementation.invoicing.providerMonthly)} al mes, pagados a {implementation.invoicing.providerName}).
            </p>
          </Card>
        </ul>
      </section>

      <section aria-labelledby="addons">
        <SectionTitle id="addons">Adicionales</SectionTitle>
        <ul className="grid gap-3 md:grid-cols-2">
          <Row title={addons.staff.name} price={<Price prefix="+" amount={addons.staff.monthly} suffix="al mes" />}>
            {addons.staff.condition}
          </Row>
          <Row title={addons.extraUser.name} price={<Price prefix="+" amount={addons.extraUser.monthlyPerUser} suffix="al mes por usuario" />}>
            {addons.extraUser.condition}
          </Row>
        </ul>
      </section>

      <section aria-labelledby="website">
        <SectionTitle id="website">Web comercial</SectionTitle>
        <ul className="grid gap-3 md:grid-cols-2">
          <Row title={website.creation.name} price={<Price prefix="desde" amount={website.creation.from} suffix="pago único" />}>
            {website.creation.includes}
          </Row>
          <Row title={website.hosting.name} price={<Price amount={website.hosting.monthly} suffix="al mes" />}>
            {website.hosting.includes}
          </Row>
        </ul>
      </section>

      <section aria-labelledby="advance">
        <SectionTitle id="advance">Anticipo</SectionTitle>
        <Card className="flex flex-col gap-4">
          <p className="body-6 text-ink-700">{advance.lead}</p>
          <ul className="flex flex-col gap-2">
            {advanceExamples.map(({ label, split }) => (
              <li key={label} className="flex flex-col gap-1 rounded-xl bg-ivory-100 p-3 md:flex-row md:items-center md:justify-between">
                <span className="body-4 text-ink-900">
                  {label} {formatSoles(split.total)}
                </span>
                <span className="body-6 tabular-nums text-ink-700">
                  → anticipo {formatSoles(split.advance)}
                  {split.isMinimum && " (mínimo)"}, saldo {formatSoles(split.balance)}
                </span>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="title-4 text-ink-900">El anticipo cubre</p>
              <ul className="flex flex-col gap-2">
                {advance.covers.map((item) => (
                  <li key={item} className="flex items-start gap-2 body-6 text-ink-700">
                    <CheckIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-sage-800" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <p className="title-4 text-ink-900">No cubre</p>
              <ul className="flex flex-col gap-2">
                {advance.excludes.map((item) => (
                  <li key={item} className="flex items-start gap-2 body-6 text-ink-700">
                    <XIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-blush-800" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </section>

      <section aria-labelledby="conditions">
        <SectionTitle id="conditions">Condiciones</SectionTitle>
        <Card>
          <ul className="flex flex-col gap-3">
            {conditions.map((c) => (
              <li key={c.title} className="body-6 text-ink-700">
                <strong className="font-semibold text-ink-900">{c.title}:</strong> {c.text}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </>
  );
}
