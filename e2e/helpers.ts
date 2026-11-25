import { expect, type Locator, type Page } from "@playwright/test";

export interface DemoRefs {
  saturday: string;
  weddingId: string;
  lunchId: string;
  cupsId: string;
}

/** Starts from a fresh scenario so every run sees the numbers of the script. */
export async function freshDemo(page: Page): Promise<DemoRefs> {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return page.evaluate(() => JSON.parse(localStorage.getItem("qorstock-demo:v1") ?? "{}").refs);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

/** The value shown next to a key-number label inside a container. */
export function stat(container: Locator, label: string): Locator {
  return container.getByText(label, { exact: true }).locator("..");
}

export async function openPanel(page: Page) {
  await page.getByRole("button", { name: /Panel de la demo/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Panel de la demo" })).toBeVisible();
}

export async function goToStep(page: Page, step: number) {
  await openPanel(page);
  await page
    .getByRole("dialog")
    .getByRole("listitem")
    .filter({ hasText: `Paso ${step}.` })
    .getByRole("button", { name: /Ir al paso|Volver a ver/ })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
