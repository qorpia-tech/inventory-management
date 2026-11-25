"use client";

import { useId, useState, type ReactNode } from "react";
import { CheckIcon } from "@phosphor-icons/react";
import { formatSoles, PRICING, quote, type Billing, type PlanChoice, type QuoteLine, type QuoteSelection } from "@/demo/pricing";
import { Segmented, Stepper } from "../components/fields";
import { cx } from "../components/primitives";

const INITIAL: QuoteSelection = {
  plan: "inventario-eventos",
  staff: false,
  users: 5,
  invoicing: false,
  website: false,
  billing: "monthly",
  pilot: false,
  newClient: true,
};

/** The whole row is the touch target; the native control stays for keyboards and screen readers. */
const row =
  "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-white p-3 has-[:checked]:border-gold-500 has-[:checked]:ring-1 has-[:checked]:ring-gold-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-petroleum-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

function Indicator({ shape }: { shape: "radio" | "check" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center border-2 border-line-strong bg-white text-white peer-checked:border-petroleum-700 peer-checked:bg-petroleum-700",
        shape === "radio" ? "rounded-full" : "rounded-md",
      )}
    >
      <CheckIcon size={14} weight="bold" />
    </span>
  );
}

function Option({
  title,
  price,
  hint,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  price: ReactNode;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={row}>
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
      <Indicator shape="check" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="body-4 text-ink-900">{title}</span>
          <span className="body-5 tabular-nums text-ink-900">{price}</span>
        </span>
        {hint && (
          <span id={`${id}-hint`} className="caption-4 text-ink-600">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function Lines({ title, lines, total, suffix }: { title: string; lines: QuoteLine[]; total: number; suffix?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="body-5 text-ivory-100">{title}</p>
      <ul className="flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line.label} className="flex items-baseline justify-between gap-3 body-6 text-ivory-200">
            <span className="min-w-0">{line.label}</span>
            <span className="shrink-0 tabular-nums">{formatSoles(line.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t border-white/15 pt-1 body-5 text-white">
        <span>Total</span>
        <span className="tabular-nums">
          {formatSoles(total)}
          {suffix && ` ${suffix}`}
        </span>
      </p>
    </div>
  );
}

/** «Arma tu plan»: the client picks what they need and sees what it costs, with the rules of the price sheet. */
export function PlanCalculator() {
  const [selection, setSelection] = useState<QuoteSelection>(INITIAL);
  const set = <K extends keyof QuoteSelection>(key: K, value: QuoteSelection[K]) => setSelection((current) => ({ ...current, [key]: value }));
  const result = quote(selection);
  const radioName = useId();
  const { plans, addons, implementation, website } = PRICING;
  const webOnly = selection.plan === "web";
  const included = plans.find((p) => p.id === selection.plan)?.users ?? 0;

  const choices: { value: PlanChoice; title: string; price: string }[] = [
    ...plans.map((p) => ({ value: p.id as PlanChoice, title: p.name, price: `${formatSoles(p.monthly)} al mes` })),
    { value: "web", title: "Solo web comercial", price: `${formatSoles(website.creation.from)} + ${formatSoles(website.hosting.monthly)} al mes` },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
      <div className="flex flex-col gap-4 rounded-2xl border border-ivory-300 bg-white p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="body-5 pb-1 text-ink-900">¿Qué necesitas?</legend>
          {choices.map((choice) => (
            <label key={choice.value} className={row}>
              <input
                type="radio"
                name={radioName}
                value={choice.value}
                className="peer sr-only"
                checked={selection.plan === choice.value}
                onChange={() => set("plan", choice.value)}
              />
              <Indicator shape="radio" />
              <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2">
                <span className="body-4 text-ink-900">{choice.title}</span>
                <span className="body-5 tabular-nums text-ink-900">{choice.price}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {!webOnly && (
          <fieldset className="flex flex-col gap-2">
            <legend className="body-5 pb-1 text-ink-900">Adicionales</legend>
            <Option
              title={addons.staff.name}
              price={`+ ${formatSoles(addons.staff.monthly)} al mes`}
              hint={selection.plan === "inventario-eventos" ? "Convocatoria y registro de llegada por evento." : "Requiere el plan Inventario + Eventos."}
              checked={result.applied.staff}
              disabled={selection.plan !== "inventario-eventos"}
              onChange={(checked) => set("staff", checked)}
            />
            <Option
              title="Facturación electrónica (Nubefact)"
              price={`+ ${formatSoles(implementation.invoicing.surcharge)} pago único`}
              hint={`La cuenta de Nubefact se contrata aparte (${formatSoles(implementation.invoicing.providerMonthly)} al mes).`}
              checked={selection.invoicing}
              onChange={(checked) => set("invoicing", checked)}
            />
            <Option
              title="Web comercial"
              price={`${formatSoles(website.creation.from)} + ${formatSoles(website.hosting.monthly)} al mes`}
              hint="Landing con tus servicios, fotos y consulta por WhatsApp."
              checked={selection.website}
              onChange={(checked) => set("website", checked)}
            />
            <Stepper label="Usuarios" value={selection.users} min={1} max={50} onChange={(value) => set("users", value)} />
            <p className="caption-4 text-ink-600">
              {included} incluidos; desde el sexto, {formatSoles(addons.extraUser.monthlyPerUser)} al mes cada uno. El personal convocado no necesita cuenta.
            </p>
          </fieldset>
        )}

        <Segmented<Billing>
          label="Forma de pago"
          options={[
            { value: "monthly", label: "Mensual" },
            { value: "annual", label: "Anual: 2 meses gratis" },
          ]}
          value={selection.billing}
          onChange={(value) => set("billing", value)}
        />

        {!webOnly && (
          <Option
            title="Primera vez con QorStock"
            price={`mes ${PRICING.welcomeFreeMonth} gratis`}
            hint={
              selection.billing === "annual"
                ? "La bienvenida es para el pago mensual; el anual ya trae 2 meses gratis."
                : `Pagas mes a mes: el mes ${PRICING.welcomeFreeMonth} no se cobra si estás al día con los tres primeros. Una sola vez por RUC.`
            }
            checked={result.applied.welcome}
            disabled={selection.billing === "annual"}
            onChange={(checked) => set("newClient", checked)}
          />
        )}

        {!webOnly && (
          <Option
            title="Cliente piloto"
            price="−30% en la implementación base"
            hint="No aplica al recargo de facturación."
            checked={selection.pilot}
            onChange={(checked) => set("pilot", checked)}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl p-4 text-white md:sticky md:top-4" style={{ background: "var(--gradient-petroleum)" }}>
        <p className="caption-4 uppercase tracking-wide text-gold-300">Cuánto te sale</p>
        <div className="flex flex-col gap-4" aria-live="polite">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={selection.billing === "monthly"}
              onClick={() => set("billing", "monthly")}
              className={cx(
                "pressable flex min-h-11 flex-col items-start gap-0.5 rounded-xl p-3 text-left",
                selection.billing === "monthly" ? "bg-white/15 ring-2 ring-gold-300" : "bg-white/5",
              )}
            >
              <span className="caption-4 text-ivory-200">Mes a mes</span>
              <span className="body-4 tabular-nums text-white">{formatSoles(result.monthlyTotal)} al mes</span>
              {!webOnly && <span className="caption-4 text-gold-300">Nuevo: mes {PRICING.welcomeFreeMonth} gratis</span>}
            </button>
            <button
              type="button"
              aria-pressed={selection.billing === "annual"}
              onClick={() => set("billing", "annual")}
              className={cx(
                "pressable flex min-h-11 flex-col items-start gap-0.5 rounded-xl p-3 text-left",
                selection.billing === "annual" ? "bg-white/15 ring-2 ring-gold-300" : "bg-white/5",
              )}
            >
              <span className="caption-4 text-ivory-200">Pagando el año</span>
              <span className="body-4 tabular-nums text-white">{formatSoles(result.annual.perMonth)} al mes</span>
              <span className="caption-4 text-gold-300">
                {formatSoles(result.annual.total)} al año · {PRICING.annualFreeMonths} meses gratis
              </span>
            </button>
          </div>

          <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-2">
            <dt className="body-6 text-ivory-200">Al firmar (anticipo)</dt>
            <dd className="body-4 tabular-nums">
              {formatSoles(result.advance.advance)}
              {result.advance.isMinimum && <span className="caption-4 text-ivory-200"> mínimo</span>}
            </dd>
            <dt className="body-6 text-ivory-200">A la entrega (saldo)</dt>
            <dd className="body-4 tabular-nums">{formatSoles(result.advance.balance)}</dd>
            {result.applied.welcome && (
              <>
                <dt className="body-6 text-ivory-200">Bienvenida: mes {PRICING.welcomeFreeMonth} gratis</dt>
                <dd className="body-4 tabular-nums text-gold-300">−{formatSoles(result.welcome)}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-col gap-1 border-t border-white/15 pt-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="body-4 text-white">Primer año, todo incluido</span>
              <span className="shrink-0 text-right">
                <span className="number-md tabular-nums text-gold-300">{formatSoles(result.firstYearPerMonth)}</span>
                <span className="body-6 text-ivory-200"> al mes</span>
              </span>
            </p>
            <p className="caption-4 text-ivory-200">
              Promedio con la implementación repartida en 12 meses: {formatSoles(result.firstYear)} en el año. La implementación se paga al inicio.
            </p>
          </div>
        </div>
        {result.providerMonthly > 0 && (
          <p className="caption-4 text-ivory-200">Aparte: {formatSoles(result.providerMonthly)} al mes que pagas directamente a Nubefact.</p>
        )}
        <details className="group rounded-xl bg-white/5">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 body-5 text-white">Ver detalle</summary>
          <div className="flex flex-col gap-3 px-3 pb-3">
            <Lines title="Pagos únicos" lines={result.oneTime} total={result.oneTimeTotal} />
            <Lines title="Mensualidad" lines={result.monthly} total={result.monthlyTotal} suffix="al mes" />
          </div>
        </details>
        <p className="caption-4 text-ivory-200">Montos con IGV. La implementación es «desde»: el monto final depende del catálogo.</p>
      </div>
    </div>
  );
}
