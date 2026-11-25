"use client";

import Link from "@/ui/components/app-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRightIcon, PackageIcon, PlusIcon } from "@phosphor-icons/react";
import type { ArticleKind, ArticleView, DomainError, StockRow } from "@/application/gateway";
import { errorMessage } from "../copy";
import { formatDateTime, formatQty } from "../format";
import { newIntentKey, useGateway, useLive } from "../runtime";
import { ActionBar } from "../components/action-bar";
import { KindBadge, LedgerList, RoleNotice } from "../components/domain-bits";
import { Field, Segmented, Stepper, TextInput } from "../components/fields";
import { Badge, Button, ButtonLink, Card, cx, EmptyState, LoadingCards, Notice, PageHeader, SectionTitle, Stat } from "../components/primitives";

type Feedback = { tone: "success" | "error"; title: string; body?: string } | null;

function Buckets({ row, large }: { row: StockRow; large?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
      <Stat label="Disponible" value={formatQty(row.available)} tone="sage" emphasis={large} />
      <Stat label="En lavado" value={formatQty(row.washing)} tone="apricot" emphasis={large} />
      <Stat label="Fuera" value={formatQty(row.out)} tone="mist" emphasis={large} />
      <Stat label="Física" value={formatQty(row.physical)} emphasis={large} />
    </div>
  );
}

export function InventoryScreen() {
  const stock = useLive("stock", (g) => g.getStock());
  const session = useLive("session", (g) => g.getSession());
  const canCreate = session.data?.permissions.includes("article.manage") ?? false;
  const categories = stock.data ? [...new Set(stock.data.map((r) => r.category))] : [];

  return (
    <>
      <PageHeader title="Inventario" description="Existencias por estado en el almacén principal. La cantidad física suma disponible, en lavado y fuera." />
      <div className="flex flex-wrap gap-2 pb-2" aria-label="Leyenda">
        <Badge tone="sage">Disponible: lista para usar</Badge>
        <Badge tone="apricot">En lavado: bloqueada hasta liberarse</Badge>
        <Badge tone="mist">Fuera: en un evento</Badge>
      </div>
      {!stock.data ? (
        <LoadingCards label="Cargando el inventario" />
      ) : stock.data.length === 0 ? (
        <EmptyState icon={<PackageIcon size={32} aria-hidden />} title="Todavía no hay artículos">
          Crea el primero y registra su saldo inicial.
        </EmptyState>
      ) : (
        categories.map((category) => (
          <section key={category} aria-labelledby={`cat-${category}`}>
            <SectionTitle id={`cat-${category}`}>{category}</SectionTitle>
            <ul className="flex flex-col gap-3">
              {stock.data!
                .filter((row) => row.category === category)
                .map((row) => (
                  <li key={row.articleId}>
                    <Link href={`/inventario/articulo/?id=${row.articleId}`} className="pressable flex flex-col gap-3 rounded-2xl border border-ivory-300 bg-white p-4">
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="title-3 text-ink-900">{row.name}</span>
                          <span className="flex flex-wrap items-center gap-2 caption-4 text-ink-600">
                            {row.sku}
                            <KindBadge kind={row.kind} />
                          </span>
                        </span>
                        <ArrowRightIcon size={20} className="mt-1 shrink-0 text-ink-600" aria-hidden />
                      </span>
                      <Buckets row={row} />
                      {row.reservedUpcoming > 0 && (
                        <span className="caption-4 text-ink-600">Reservado en próximos eventos: {formatQty(row.reservedUpcoming)}</span>
                      )}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
      {canCreate && (
        <ActionBar>
          <ButtonLink href="/inventario/nuevo/">
            <PlusIcon size={18} weight="bold" aria-hidden />
            Nuevo artículo
          </ButtonLink>
        </ActionBar>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function OpeningForm({ article, onDone }: { article: ArticleView; onDone: (f: Feedback) => void }) {
  const gateway = useGateway();
  const [available, setAvailable] = useState(0);
  const [washing, setWashing] = useState(0);
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="title-3">Saldo inicial</p>
        <p className="caption-4 text-ink-600">Se registra una sola vez, antes de cualquier otro movimiento.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stepper label="Disponible" value={available} onChange={setAvailable} id="open-available" />
        <Stepper label="En lavado" value={washing} onChange={setWashing} id="open-washing" />
      </div>
      <Button
        variant="dark"
        disabled={available + washing === 0}
        onClick={async () => {
          if (!gateway) return;
          const result = await gateway.registerOpening({ articleId: article.articleId, available, washing });
          onDone(result.ok ? { tone: "success", title: "Saldo inicial registrado." } : { tone: "error", title: errorMessage(result.error) });
        }}
      >
        Registrar saldo inicial
      </Button>
    </Card>
  );
}

function ReceiptForm({ article, onDone }: { article: ArticleView; onDone: (f: Feedback) => void }) {
  const gateway = useGateway();
  const key = useRef("");
  const [quantity, setQuantity] = useState(0);
  const [note, setNote] = useState("");
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="title-3">Ingreso de mercadería</p>
        <p className="caption-4 text-ink-600">Suma unidades a disponible. La nota es opcional.</p>
      </div>
      <Stepper label="Cantidad recibida" value={quantity} onChange={setQuantity} id="receipt-qty" />
      <Field label="Nota (opcional)" htmlFor="receipt-note">
        <TextInput id="receipt-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por ejemplo, compra al proveedor" />
      </Field>
      <Button
        variant="dark"
        disabled={quantity === 0}
        onClick={async () => {
          if (!gateway) return;
          key.current ||= newIntentKey();
          const result = await gateway.registerReceipt({ articleId: article.articleId, quantity, note, idempotencyKey: key.current });
          key.current = "";
          if (result.ok) {
            setQuantity(0);
            setNote("");
          }
          onDone(result.ok ? { tone: "success", title: "Ingreso registrado.", body: `${formatQty(quantity)} unidades a disponible.` } : { tone: "error", title: errorMessage(result.error) });
        }}
      >
        Registrar ingreso
      </Button>
    </Card>
  );
}

function AdjustmentForm({ article, onDone }: { article: ArticleView; onDone: (f: Feedback) => void }) {
  const gateway = useGateway();
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [pendingShortage, setPendingShortage] = useState<DomainError | null>(null);
  const missingReason = !reason.trim();

  async function submit(acceptShortage: boolean) {
    setTouched(true);
    if (!gateway || quantity === 0 || missingReason) return;
    const result = await gateway.adjustStock({
      articleId: article.articleId,
      delta: direction === "add" ? quantity : -quantity,
      reason,
      acceptShortage,
    });
    if (!result.ok && result.error.code === "creates_shortage") {
      setPendingShortage(result.error);
      return;
    }
    setPendingShortage(null);
    if (result.ok) {
      setQuantity(0);
      setReason("");
      setTouched(false);
    }
    onDone(result.ok ? { tone: "success", title: "Ajuste registrado con su motivo." } : { tone: "error", title: errorMessage(result.error) });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="title-3">Ajuste con motivo</p>
        <p className="caption-4 text-ink-600">Todo ajuste exige motivo y queda en el historial.</p>
      </div>
      <Segmented
        label="Tipo de ajuste"
        value={direction}
        onChange={setDirection}
        options={[
          { value: "remove", label: "Restar" },
          { value: "add", label: "Sumar" },
        ]}
      />
      <Stepper label="Cantidad" value={quantity} max={direction === "remove" ? article.available : 99999} onChange={setQuantity} id="adjust-qty" />
      <Field label="Motivo" htmlFor="adjust-reason" error={touched && missingReason ? "El motivo es obligatorio." : undefined}>
        <TextInput id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} invalid={touched && missingReason} placeholder="Por ejemplo, desgaste o conteo" />
      </Field>
      {pendingShortage && (
        <Notice tone="warning" title="Este ajuste deja eventos sin stock">
          Faltarían {formatQty(pendingShortage.affectedEvents?.[0]?.missing ?? 0)} unidades en {pendingShortage.affectedEvents?.length ?? 0} evento(s). Si es la realidad del almacén, regístralo igual: el conflicto aparecerá en las alertas.
          <Button size="sm" variant="danger" className="mt-2" onClick={() => submit(true)}>
            Registrar y aceptar el faltante
          </Button>
        </Notice>
      )}
      <Button variant="dark" disabled={quantity === 0} onClick={() => submit(false)}>
        Registrar ajuste
      </Button>
    </Card>
  );
}

export function ArticleScreen() {
  const id = useSearchParams().get("id") ?? "";
  const article = useLive(`article:${id}`, (g) => g.getArticle(id));
  const session = useLive("session", (g) => g.getSession());
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (article.loading || !session.data) return <LoadingCards count={2} label="Cargando el artículo" />;
  const view = article.data;
  if (!view) {
    return (
      <EmptyState title="No encontramos este artículo" action={<ButtonLink href="/inventario/" variant="secondary">Volver al inventario</ButtonLink>}>
        Puede que la demo se haya reiniciado.
      </EmptyState>
    );
  }
  const permissions = session.data.permissions;
  const role = session.data.actor.roles[0]!;
  const canOpening = permissions.includes("stock.opening") && !view.hasMovements;
  const canReceipt = permissions.includes("stock.receipt") && view.hasMovements;
  const canAdjust = permissions.includes("stock.adjust") && view.hasMovements;

  return (
    <>
      <PageHeader
        title={view.name}
        back={{ href: "/inventario/", label: "Inventario" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {view.sku} · {view.category}
            <KindBadge kind={view.kind} />
          </span>
        }
      />
      <Buckets row={view} large />
      <div className="mt-4 flex flex-col gap-3" aria-live="polite">
        {feedback && (
          <Notice tone={feedback.tone} title={feedback.title} onDismiss={() => setFeedback(null)}>
            {feedback.body}
          </Notice>
        )}
      </div>

      {view.commitments.length > 0 && (
        <>
          <SectionTitle>Reservado en próximos eventos</SectionTitle>
          <ul className="flex flex-col gap-2">
            {view.commitments.map((c) => (
              <li key={c.eventId}>
                <Link href={`/agenda/evento/?id=${c.eventId}`} className="pressable flex items-center justify-between gap-3 rounded-xl border border-ivory-300 bg-white p-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="body-4 text-ink-900">{c.eventName}</span>
                    <span className="caption-4 tabular-nums text-ink-600">
                      {formatDateTime(c.from)}
                      {Number.isFinite(c.to) ? ` → ${formatDateTime(c.to)}` : " · hasta despachar"}
                    </span>
                  </span>
                  <span className="number-md shrink-0">{formatQty(c.quantity)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {view.batches.length > 0 && (
        <>
          <SectionTitle>Lotes en lavado</SectionTitle>
          <ul className="flex flex-col gap-2">
            {view.batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-apricot-100 p-3 text-apricot-800">
                <span className="body-6">{b.eventName ? `Devolución de ${b.eventName}` : "Saldo inicial, sin evento"}</span>
                <span className="body-4 tabular-nums">{formatQty(b.remaining)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(canOpening || canReceipt || canAdjust) && <SectionTitle>Registrar</SectionTitle>}
      <div className="flex flex-col gap-3">
        {canOpening && <OpeningForm article={view} onDone={setFeedback} />}
        {canReceipt && <ReceiptForm article={view} onDone={setFeedback} />}
        {canAdjust && <AdjustmentForm article={view} onDone={setFeedback} />}
        {!canOpening && !canReceipt && !canAdjust && (
          <RoleNotice current={role} needed={view.hasMovements ? ["admin", "warehouse"] : ["admin"]} action={view.hasMovements ? "registrar ingresos o ajustes" : "registrar el saldo inicial"} />
        )}
      </div>

      <SectionTitle>Historial</SectionTitle>
      <LedgerList entries={view.movements} showArticle={false} />
    </>
  );
}

// ---------------------------------------------------------------------------

export function NewArticleScreen() {
  const router = useRouter();
  const gateway = useGateway();
  const session = useLive("session", (g) => g.getSession());
  const [values, setValues] = useState({ sku: "", name: "", category: "" });
  const [kind, setKind] = useState<ArticleKind>("returnable");
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!session.data) return <LoadingCards count={1} label="Cargando el formulario" />;
  const canCreate = session.data.permissions.includes("article.manage");
  const errors = {
    sku: values.sku.trim() ? undefined : "Escribe un código.",
    name: values.name.trim() ? undefined : "Escribe el nombre.",
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!gateway || errors.sku || errors.name) return;
    const result = await gateway.createArticle({ ...values, kind });
    if (!result.ok) {
      setFailure(errorMessage(result.error));
      return;
    }
    router.push(`/inventario/articulo/?id=${result.value.articleId}`);
  }

  return (
    <>
      <PageHeader title="Nuevo artículo" back={{ href: "/inventario/", label: "Inventario" }} description="Después registrarás su saldo inicial." />
      {!canCreate ? (
        <RoleNotice current={session.data.actor.roles[0]!} needed={["admin"]} action="crear artículos" />
      ) : (
        <form id="new-article" onSubmit={submit} noValidate className="flex flex-col gap-4">
          {failure && <Notice tone="error">{failure}</Notice>}
          <Card className="flex flex-col gap-4">
            <Field label="Código (SKU)" htmlFor="art-sku" error={touched ? errors.sku : undefined}>
              <TextInput id="art-sku" value={values.sku} onChange={(e) => setValues({ ...values, sku: e.target.value })} invalid={touched && !!errors.sku} autoCapitalize="characters" autoComplete="off" placeholder="Por ejemplo, COP-AGU-02" />
            </Field>
            <Field label="Nombre" htmlFor="art-name" error={touched ? errors.name : undefined}>
              <TextInput id="art-name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} invalid={touched && !!errors.name} autoComplete="off" placeholder="Por ejemplo, Copa de agua" />
            </Field>
            <Field label="Categoría" htmlFor="art-category" hint="Por ejemplo, Cristalería, Vajilla o Mantelería.">
              <TextInput id="art-category" value={values.category} onChange={(e) => setValues({ ...values, category: e.target.value })} autoComplete="off" />
            </Field>
          </Card>
          <Card className="flex flex-col gap-3">
            <Segmented
              label="Tipo de artículo"
              value={kind}
              onChange={setKind}
              options={[
                { value: "returnable", label: "Retornable" },
                { value: "consumable", label: "Consumible" },
              ]}
            />
            <p className={cx("caption-4 text-ink-600")}>
              {kind === "returnable"
                ? "Sale al evento y vuelve: se recibe sano, para lavado, roto o perdido."
                : "Se consume al despachar, como los vasos descartables. No genera saldo por devolver."}
            </p>
          </Card>
          <ActionBar>
            <Button type="submit" form="new-article">
              Crear artículo
            </Button>
          </ActionBar>
        </form>
      )}
    </>
  );
}
