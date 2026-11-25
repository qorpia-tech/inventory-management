import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, freshDemo, goToStep, openPanel, stat } from "./helpers";

test.describe("Spec §5 demo script on a phone", () => {
  test("walks the six steps with the exact numbers", async ({ page, context }) => {
    const refs = await freshDemo(page);
    await expectNoHorizontalOverflow(page);

    // Step 1: open the wedding and ask for 100 cups.
    await goToStep(page, 1);
    await expect(page).toHaveURL(new RegExp(`agenda/evento/\\?id=${refs.weddingId}`));
    await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();
    const cups = page.getByRole("listitem").filter({ has: page.getByText("Copa de vino", { exact: true }) });
    await expect(cups.getByLabel("Cantidad solicitada", { exact: true })).toHaveValue("100");
    await expect(stat(cups, "Disponible")).toHaveText(/Disponible\s*90/);
    await expect(stat(cups, "Faltan")).toHaveText(/Faltan\s*10/);
    await expect(page.getByText("Copa de vino: piden 100, disponibles 90, faltan 10")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Confirming 100 fails with the per-line shortage and the draft stays.
    await page.getByRole("button", { name: "Confirmar reserva" }).click();
    await expect(page.getByText("No se confirmó: falta stock. El borrador sigue igual.")).toBeVisible();
    await expect(page.getByText("Solicitado 100 · Disponible 90 · Faltan 10")).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true }).first()).toBeVisible();

    // Step 2: change to 90 and confirm; another event in the same window finds zero.
    const quantity = cups.getByLabel("Cantidad solicitada", { exact: true });
    await quantity.fill("90");
    await quantity.press("Enter");
    await expect(stat(cups, "Faltante")).toHaveText(/Faltante\s*0/);
    await page.getByRole("button", { name: "Confirmar reserva" }).click();
    await expect(page.getByText("Reserva confirmada.")).toBeVisible();
    await expect(page.getByText("Confirmado", { exact: true }).first()).toBeVisible();
    const confirmedCups = page.getByRole("listitem").filter({ has: page.getByText("Copa de vino", { exact: true }) });
    await expect(stat(confirmedCups, "Confirmado")).toHaveText(/Confirmado\s*90/);
    await expect(confirmedCups.getByText("Libres para otro evento en esta franja: 0")).toBeVisible();

    // Step 3: dispatch from the phone as warehouse; a reload keeps the record.
    await goToStep(page, 3);
    await expect(page).toHaveURL(/almacen\/evento\/.*modo=despacho/);
    await expect(page.getByRole("button", { name: "Despacho", pressed: true })).toBeVisible();
    await page.getByRole("button", { name: /Registrar despacho \(140\)/ }).click();
    await expect(page.getByText("Despacho registrado.")).toBeVisible();
    await expect(stat(page.locator("main"), "Fuera del almacén")).toHaveText(/Fuera del almacén\s*90/);
    await expectNoHorizontalOverflow(page);
    await page.reload();
    await expect(stat(page.locator("main"), "Fuera del almacén")).toHaveText(/Fuera del almacén\s*90/);

    // Step 4: 86 good and 2 broken, with a double tap on the button.
    await goToStep(page, 4);
    await expect(page).toHaveURL(/modo=devolucion/);
    const returnCard = page.getByRole("listitem").filter({ has: page.getByText("Copa de vino", { exact: true }) });
    await returnCard.getByLabel("Sanas", { exact: true }).fill("86");
    await returnCard.getByLabel("Sanas", { exact: true }).press("Enter");
    await returnCard.getByLabel("Rotas", { exact: true }).fill("2");
    await returnCard.getByLabel("Rotas", { exact: true }).press("Enter");
    await returnCard.getByLabel("Motivo de la rotura").fill("Se rompieron durante el brindis");
    await page.getByRole("button", { name: /Registrar devolución \(88\)/ }).dblclick();
    await expect(page.getByText("Devolución registrada.")).toBeVisible();
    await expect(stat(page.locator("main"), "Pendiente de devolución")).toHaveText(/Pendiente de devolución\s*2/);
    await expect(page.getByText("En curso", { exact: true }).first()).toBeVisible();

    // Step 5: the last 2 go to washing; pending drops to zero.
    await returnCard.getByLabel("Para lavado", { exact: true }).fill("2");
    await returnCard.getByLabel("Para lavado", { exact: true }).press("Enter");
    await page.getByRole("button", { name: /Registrar devolución \(2\)/ }).click();
    await expect(page.getByText("Devolución registrada.")).toBeVisible();
    await expect(stat(page.locator("main"), "Pendiente de devolución")).toHaveText(/Pendiente de devolución\s*0/);

    // The coordinator can close; 2 stay in washing linked to this return; one receipt per tap.
    await openPanel(page);
    await page.getByRole("radio", { name: /Coordinador/ }).click();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.goto(`/agenda/evento/?id=${refs.weddingId}`);
    await expect(page.getByText("2 en lavado")).toBeVisible();
    const history = page.getByRole("list").filter({ hasText: "Devolución" });
    await expect(history.getByText(/^Devolución/)).toHaveCount(3); // 86 good + 2 broken (one movement) + 2 washing
    await page.getByRole("button", { name: "Cerrar evento" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cerrar evento" }).click();
    await expect(page.getByText("Evento cerrado.")).toBeVisible();
    await expect(page.getByText("Cerrado", { exact: true }).first()).toBeVisible();

    // Step 6: attendance and the landing.
    await goToStep(page, 6);
    await expect(page).toHaveURL(/personal/);
    await expect(page.getByText(/Convocatoria: .*16:00/)).toBeVisible();
    await expect(page.getByText(/llegó 16:12/)).toBeVisible();
    await expect(page.getByText("12 min tarde")).toBeVisible();
    await expect(page.getByText("Sin registro")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>WhatsApp</p>" }));
    await page.goto("/c/valtiera/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu evento, servido");
    await expectNoHorizontalOverflow(page);
    // The visitor taps the hero call to action, which jumps to the inquiry form.
    await page.getByRole("link", { name: "Consultar por WhatsApp" }).first().click();
    await expect(page).toHaveURL(/#consulta$/);
    await page.getByText("Bodas", { exact: true }).last().click();
    const future = await page.evaluate(() => new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10));
    await page.getByLabel("Fecha del evento").fill(future);
    await page.getByLabel("Distrito").selectOption("Barranco");
    await page.getByLabel("Invitados").fill("120");
    const message = page.getByLabel("Mensaje para WhatsApp");
    await expect(message).toHaveValue(/servicio de bodas .* en Barranco, para 120 invitados/);
    await message.fill(`${await message.inputValue()} Somos vegetarianos.`);
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Abrir WhatsApp" }).click();
    const popup = await popupPromise;
    const url = new URL(popup.url());
    expect(url.origin + url.pathname).toBe("https://wa.me/");
    expect(url.searchParams.get("text")).toContain("120 invitados");
    expect(url.searchParams.get("text")).toContain("Somos vegetarianos.");
    await popup.close();

    // Every step of the guided tour is complete.
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Panel de la demo/ }).first()).toContainText("6/6");
  });
});
