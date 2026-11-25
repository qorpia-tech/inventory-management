"use client";

import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import type { QorStockGateway } from "@/application/gateway";
import { browserStore, LocalDemoGateway, type DemoControls, type DemoSnapshot } from "@/demo/local-gateway";

/**
 * Composition root of the browser demo. Screens receive the gateway port; only the presenter
 * panel receives the demo controls. Swapping in an HTTP adapter only changes this file.
 */
let instance: LocalDemoGateway | null = null;
let snapshot: DemoSnapshot | null = null;

function runtime(): LocalDemoGateway {
  if (!instance) {
    instance = new LocalDemoGateway({ store: browserStore() });
    instance.subscribe(() => {
      snapshot = null;
    });
  }
  return instance;
}

const noopSubscribe = () => () => {};

/** Null during prerender and hydration, so server and first client render match. */
export function useGateway(): QorStockGateway | null {
  return useSyncExternalStore(noopSubscribe, runtime, () => null);
}

export function useDemoControls(): DemoControls | null {
  return useSyncExternalStore(noopSubscribe, runtime, () => null);
}

function subscribeDemo(listener: () => void) {
  return runtime().subscribe(listener);
}

function readDemo(): DemoSnapshot {
  snapshot ??= runtime().getDemo();
  return snapshot;
}

export function useDemo(): DemoSnapshot | null {
  return useSyncExternalStore(subscribeDemo, readDemo, () => null);
}

export interface LiveQuery<T> {
  data: T | undefined;
  loading: boolean;
}

/**
 * Loads data through the gateway and reloads it whenever the gateway reports a change.
 * `key` identifies the query; change it when its inputs change.
 */
export function useLive<T>(key: string, loader: (gateway: QorStockGateway) => Promise<T>): LiveQuery<T> {
  const gateway = useGateway();
  const [result, setResult] = useState<{ key: string; data: T } | null>(null);
  const load = useEffectEvent((active: { current: boolean }) => {
    if (!gateway) return;
    void loader(gateway).then((data) => {
      if (active.current) setResult({ key, data });
    });
  });
  useEffect(() => {
    if (!gateway) return;
    const active = { current: true };
    load(active);
    const unsubscribe = gateway.subscribe(() => load(active));
    return () => {
      active.current = false;
      unsubscribe();
    };
  }, [gateway, key]);
  const data = result && result.key === key ? result.data : undefined;
  return { data, loading: data === undefined };
}

/** A fresh key per user intent: a double tap reuses it, a new intent gets another one. */
export function newIntentKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
