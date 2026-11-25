"use client";

import { useState } from "react";
import { CheckIcon, GiftIcon, SealCheckIcon } from "@phosphor-icons/react";
import { annualEquivalent, annualPrice, formatSoles, PRICING, startCost, type Billing } from "@/demo/pricing";
import { Segmented } from "../components/fields";
import { Badge } from "../components/primitives";

/** Plan cards with a monthly/annual switch, so both prices read side by side with their offer. */
export function PlanCards() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const annual = billing === "annual";

  return (
    <div className="flex flex-col gap-3">
      <Segmented<Billing>
        label="Forma de pago"
        hideLabel
        options={[
          { value: "monthly", label: "Mensual" },
          { value: "annual", label: `Anual: ${PRICING.annualFreeMonths} meses gratis` },
        ]}
        value={billing}
        onChange={setBilling}
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {PRICING.plans.map((plan) => {
          const start = startCost(plan, billing);
          return (
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
              <p className="flex flex-wrap items-baseline gap-x-1">
                <span className="number-lg text-ink-900">{formatSoles(annual ? annualPrice(plan.monthly) : plan.monthly)}</span>
                <span className="body-5 text-ink-700">{annual ? "al año" : "al mes"}</span>
              </p>
              {annual ? (
                <p className="rounded-xl bg-sage-100 px-3 py-2 body-6 text-sage-800">
                  Equivale a {formatSoles(annualEquivalent(plan.monthly))} al mes, con IGV, en un solo pago. {PRICING.annualFreeMonths} meses gratis cada año.
                </p>
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-apricot-100 px-3 py-2 body-6 text-apricot-800">
                  <GiftIcon size={18} weight="duotone" className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    Bienvenida: si es tu primera vez, el mes {PRICING.welcomeFreeMonth} va gratis al estar al día con los tres primeros.
                  </span>
                </p>
              )}
              <p className="body-6 text-ink-700">{plan.includes}</p>
              <p className="inline-flex items-center gap-2 body-4 text-ink-900">
                <CheckIcon size={16} weight="bold" className="text-sage-800" aria-hidden />
                {plan.users} usuarios
              </p>
              <div className="mt-auto flex flex-col gap-1 border-t border-ivory-300 pt-3">
                <p className="body-6 text-ink-700">Para empezar: implementación desde {formatSoles(start.implementation)}, pago único.</p>
                <p className="body-5 text-ink-900">
                  Inicio: {formatSoles(start.total)}{" "}
                  <span className="body-6 text-ink-700">(implementación + {annual ? "primer año" : "primer mes"})</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
