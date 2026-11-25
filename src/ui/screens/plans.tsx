import type { ReactNode } from "react";
import { CheckIcon, SealCheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { advanceFor, firstYearExample, formatSoles, implementationWithInvoicing, PRICING } from "@/demo/pricing";
import { Badge, Card, PageHeader, SectionTitle } from "../components/primitives";

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
  const { plans, addons, implementation, website, advance, conditions } = PRICING;
  const example = firstYearExample();
  const advanceExamples = [
    { label: "Implementación base", split: advanceFor(implementation.base.from) },
    { label: "Solo web comercial", split: advanceFor(website.creation.from) },
  ];

  return (
    <>
      <PageHeader title="Planes de QorStock" description={<strong className="font-semibold text-ink-900">{PRICING.taxNote}</strong>} />

      <section aria-labelledby="plans">
        <SectionTitle id="plans">Planes</SectionTitle>
        <ul className="grid gap-3 md:grid-cols-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className={
                plan.recommended
                  ? "relative flex flex-col gap-3 rounded-2xl border-2 border-gold-500 bg-white p-4 shadow-sm"
                  : "flex flex-col gap-3 rounded-2xl border border-ivory-300 bg-white p-4"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="title-2 text-ink-900">{plan.name}</p>
                {plan.recommended && (
                  <Badge tone="gold" icon={<SealCheckIcon size={14} weight="fill" aria-hidden />}>
                    Recomendado
                  </Badge>
                )}
              </div>
              <Price amount={plan.monthly} suffix="al mes" />
              <p className="body-6 text-ink-700">{plan.includes}</p>
              <p className="inline-flex items-center gap-2 body-4 text-ink-900">
                <CheckIcon size={16} weight="bold" className="text-sage-800" aria-hidden />
                {plan.users} usuarios
              </p>
            </li>
          ))}
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

      <section aria-labelledby="implementation">
        <SectionTitle id="implementation">Implementación (pago único)</SectionTitle>
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

      <section aria-labelledby="example">
        <SectionTitle id="example">Ejemplo: {plans.find((p) => p.recommended)?.name}, primer año</SectionTitle>
        {/* Phones: stacked rows. */}
        <ul className="flex flex-col gap-2 md:hidden">
          {example.map((row) => (
            <Card as="li" key={row.label} className="flex flex-col gap-2">
              <p className="title-3 text-ink-900">{row.label}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 body-6">
                <dt className="text-ink-600">Implementación</dt>
                <dd className="text-right tabular-nums text-ink-900">{formatSoles(row.implementation)}</dd>
                <dt className="text-ink-600">Mensualidades</dt>
                <dd className="text-right tabular-nums text-ink-900">
                  {row.compact ? formatSoles(row.subscriptions) : `${row.months} × ${formatSoles(row.monthly)} = ${formatSoles(row.subscriptions)}`}
                </dd>
                <dt className="body-4 text-ink-900">Primer año</dt>
                <dd className="text-right number-md text-ink-900">{formatSoles(row.total)}</dd>
              </dl>
            </Card>
          ))}
        </ul>
        {/* Tablet and up: table. */}
        <div className="hidden overflow-hidden rounded-2xl border border-ivory-300 bg-white md:block">
          <table className="w-full text-left body-6">
            <thead className="bg-ivory-100 text-ink-700">
              <tr>
                <th scope="col" className="p-3 font-semibold">Forma de pago</th>
                <th scope="col" className="p-3 font-semibold">Implementación</th>
                <th scope="col" className="p-3 font-semibold">Mensualidades</th>
                <th scope="col" className="p-3 text-right font-semibold">Primer año</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-300 tabular-nums">
              {example.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="p-3 font-semibold text-ink-900">{row.label}</th>
                  <td className="p-3">{formatSoles(row.implementation)}</td>
                  <td className="p-3">{row.compact ? formatSoles(row.subscriptions) : `${row.months} × ${formatSoles(row.monthly)} = ${formatSoles(row.subscriptions)}`}</td>
                  <td className="p-3 text-right body-4 text-ink-900">{formatSoles(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 caption-4 text-ink-600">{PRICING.exampleFootnote}</p>
      </section>
    </>
  );
}
