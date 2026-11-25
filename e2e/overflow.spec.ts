import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshDemo } from "./helpers";

test("no horizontal scroll and touch targets of at least 44 px on every route", async ({ page }) => {
  const refs = await freshDemo(page);
  const routes = [
    "/",
    "/agenda/",
    "/agenda/nuevo/",
    `/agenda/evento/?id=${refs.weddingId}`,
    "/almacen/",
    `/almacen/evento/?id=${refs.lunchId}&modo=despacho`,
    "/inventario/",
    `/inventario/articulo/?id=${refs.cupsId}`,
    "/inventario/nuevo/",
    "/personal/",
    "/planes/",
    "/mas/",
    "/c/valtiera/",
  ];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, summary")]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const clipped = style.clipPath !== "none" || (style.clip !== "auto" && style.clip !== "");
          const hidden = box.width <= 1 || box.height <= 1 || clipped || style.visibility === "hidden" || el.closest("[hidden]");
          return !hidden && box.height < 44;
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().height)}px`),
    );
    expect(small, `small touch targets on ${route}`).toEqual([]);
  }
});
