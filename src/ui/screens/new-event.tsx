"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { fromLima } from "@/lib/lima-time";
import { errorMessage } from "../copy";
import { useDemo, useGateway, useLive } from "../runtime";
import { ActionBar } from "../components/action-bar";
import { RoleNotice } from "../components/domain-bits";
import { Field, TextInput } from "../components/fields";
import { Button, Card, LoadingCards, Notice, PageHeader } from "../components/primitives";

interface Values {
  name: string;
  customer: string;
  venue: string;
  departureDate: string;
  departureTime: string;
  readyDate: string;
  readyTime: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Escribe el nombre del evento.";
  if (!values.customer.trim()) errors.customer = "Escribe el cliente.";
  if (!values.venue.trim()) errors.venue = "Escribe el lugar.";
  if (!values.departureDate) errors.departureDate = "Elige la fecha de salida.";
  if (!values.departureTime) errors.departureTime = "Elige la hora de salida.";
  if (!values.readyDate) errors.readyDate = "Elige la fecha.";
  if (!values.readyTime) errors.readyTime = "Elige la hora.";
  if (!errors.departureDate && !errors.departureTime && !errors.readyDate && !errors.readyTime) {
    const departure = fromLima(values.departureDate, values.departureTime);
    const ready = fromLima(values.readyDate, values.readyTime);
    if (ready <= departure) errors.readyTime = "Debe ser posterior a la salida.";
  }
  return errors;
}

export function NewEventScreen() {
  const router = useRouter();
  const gateway = useGateway();
  const demo = useDemo();
  const session = useLive("session", (g) => g.getSession());
  const [values, setValues] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!demo || !session.data) return <LoadingCards count={1} label="Cargando el formulario" />;
  const form: Values = values ?? {
    name: "",
    customer: "",
    venue: "",
    departureDate: demo.refs.saturday,
    departureTime: "10:00",
    readyDate: demo.refs.saturday,
    readyTime: "20:00",
  };
  const canEdit = session.data.permissions.includes("event.edit");
  const set = (key: keyof Values) => (event: { target: { value: string } }) => setValues({ ...form, [key]: event.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !gateway) return;
    setSubmitting(true);
    const result = await gateway.createDraft({
      name: form.name,
      customer: form.customer,
      venue: form.venue,
      departureAt: fromLima(form.departureDate, form.departureTime),
      readyAt: fromLima(form.readyDate, form.readyTime),
      lines: [],
    });
    setSubmitting(false);
    if (!result.ok) {
      setFailure(errorMessage(result.error));
      return;
    }
    router.push(`/agenda/evento/?id=${result.value.eventId}`);
  }

  return (
    <>
      <PageHeader title="Nuevo borrador" description="Un borrador no compromete stock: sirve para simular cantidades." back={{ href: "/agenda/", label: "Agenda" }} />
      {!canEdit ? (
        <RoleNotice current={session.data.actor.roles[0]!} needed={["coordinator"]} action="crear eventos" />
      ) : (
        <form id="new-event" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {failure && <Notice tone="error">{failure}</Notice>}
          <Card className="flex flex-col gap-4">
            <Field label="Nombre del evento" htmlFor="ev-name" error={errors.name}>
              <TextInput id="ev-name" value={form.name} onChange={set("name")} invalid={!!errors.name} autoComplete="off" placeholder="Por ejemplo, Cena de gala" />
            </Field>
            <Field label="Cliente" htmlFor="ev-customer" error={errors.customer}>
              <TextInput id="ev-customer" value={form.customer} onChange={set("customer")} invalid={!!errors.customer} autoComplete="off" />
            </Field>
            <Field label="Lugar" htmlFor="ev-venue" error={errors.venue}>
              <TextInput id="ev-venue" value={form.venue} onChange={set("venue")} invalid={!!errors.venue} autoComplete="off" placeholder="Local y distrito" />
            </Field>
          </Card>
          <Card className="flex flex-col gap-4">
            <p className="title-3">Salida prevista del almacén</p>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <Field label="Fecha" htmlFor="ev-dep-date" error={errors.departureDate}>
                <TextInput id="ev-dep-date" type="date" value={form.departureDate} onChange={set("departureDate")} invalid={!!errors.departureDate} />
              </Field>
              <Field label="Hora" htmlFor="ev-dep-time" error={errors.departureTime}>
                <TextInput id="ev-dep-time" type="time" value={form.departureTime} onChange={set("departureTime")} invalid={!!errors.departureTime} />
              </Field>
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="title-3">Material listo otra vez</p>
              <p className="caption-4 text-ink-600">Incluye el lavado. Desde esa hora el material queda libre para otra reserva.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <Field label="Fecha" htmlFor="ev-ready-date" error={errors.readyDate}>
                <TextInput id="ev-ready-date" type="date" value={form.readyDate} onChange={set("readyDate")} invalid={!!errors.readyDate} />
              </Field>
              <Field label="Hora" htmlFor="ev-ready-time" error={errors.readyTime}>
                <TextInput id="ev-ready-time" type="time" value={form.readyTime} onChange={set("readyTime")} invalid={!!errors.readyTime} />
              </Field>
            </div>
          </Card>
          <ActionBar>
            <Button type="submit" form="new-event" disabled={submitting}>
              {submitting ? "Creando…" : "Crear borrador"}
            </Button>
          </ActionBar>
        </form>
      )}
    </>
  );
}
