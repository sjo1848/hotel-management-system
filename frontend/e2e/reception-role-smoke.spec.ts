import { expect, test } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const username = process.env.E2E_USERNAME ?? "recepcion_demo";
const password = process.env.E2E_PASSWORD ?? "demo2026pass";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");

  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(username);
  await page.getByLabel("Clave de Acceso").fill(password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();

  await expect(page).toHaveURL(/\/bookings$/);
}

test("reception role smoke: front desk navigation is scoped correctly", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("link", { name: "Recepción" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Red Global" })).toHaveCount(0);

  await page.getByRole("link", { name: "Recepción" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Foco del turno" })).toBeVisible();
});

test("reception role smoke: walk-in sheet keeps CTA visible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();

  await page.getByRole("button", { name: "Nueva Reserva" }).first().click();
  await expect(page.getByRole("heading", { name: "Walk-in / nueva reserva" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear y gestionar" })).toBeVisible();
});

test("reception role smoke: mobile walk-in selection preserves state at common widths", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);

  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/bookings");
    await page.getByRole("button", { name: "Nueva Reserva" }).first().click();
    await expect(page.getByRole("heading", { name: "Walk-in / nueva reserva" })).toBeVisible();

    await page.getByRole("button", { name: /Elegir de la base de huéspedes/ }).click();
    await expect(page.getByRole("heading", { name: "Seleccionar huésped" })).toBeVisible();
    await page.getByLabel("Buscar huésped").fill("Laura");
    await page.getByRole("button", { name: /Laura Mendez/ }).click();
    await expect(page.getByRole("button", { name: /Laura Mendez/ }).first()).toBeVisible();

    await page.getByRole("button", { name: /Habitación disponible/ }).click();
    await expect(page.getByRole("heading", { name: "Seleccionar habitación" })).toBeVisible();
    const roomSearch = page.getByLabel("Buscar habitación");
    await roomSearch.fill("2");
    await roomSearch.fill("");
    const roomOption = page.getByRole("dialog").getByRole("button").filter({ hasText: /Habitaci[oó]n/ }).first();
    await expect(roomOption).toBeVisible();
    await roomOption.click();
    await expect(page.getByRole("button", { name: /Asignada/ })).toBeVisible();

    await page.getByRole("button", { name: "Crear y gestionar" }).click();
    await expect(page.getByRole("button", { name: /Más opciones del caso/i })).toBeVisible();
  }
});

test("reception performance: mobile menu opens without extra requests", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await login(page);

  const requestUrls: string[] = [];
  page.on("request", (request) => requestUrls.push(request.url()));
  const openButton = page.getByRole("button", { name: "Abrir menú móvil" });
  const samples: number[] = [];

  await page.waitForTimeout(1000);
  requestUrls.length = 0;
  await openButton.click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  requestUrls.length = 0;

  for (let index = 0; index < 10; index += 1) {
    const startedAt = await page.evaluate(() => performance.now());
    await openButton.click();
    await page.getByRole("dialog").waitFor({ state: "visible" });
    await expect(page.getByRole("dialog").getByText("Recepción y control", { exact: true })).toBeVisible();
    samples.push((await page.evaluate(() => performance.now())) - startedAt);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }

  const sortedSamples = [...samples].sort((left, right) => left - right);
  const median = sortedSamples[Math.floor(sortedSamples.length / 2)];
  console.log(`[mobile-menu-perf] samples_ms=${samples.map((sample) => sample.toFixed(1)).join(",")} median_ms=${median.toFixed(1)} requests=${requestUrls.length}`);
  expect(median).toBeLessThan(350);
  expect(requestUrls).toEqual([]);
});

test("reception role smoke: booking center opens from bookings list", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await login(page);
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();

  // At mobile widths the fourth and fifth workspace views are intentionally
  // behind the "Más" overflow menu. Select the current UI surface first.
  await page.getByRole("tab", { name: /^Más/ }).click();
  await page.getByRole("tab", { name: /Reservas/ }).click();
  const firstBookingCard = page.locator(".motion-refresh.space-y-3 > div").first();
  await expect(firstBookingCard).toBeVisible();
  await firstBookingCard.getByRole("button").first().click();
  await firstBookingCard.getByRole("button", { name: "Gestionar" }).click();
  await expect(page.getByRole("button", { name: /Más opciones del caso/i })).toBeVisible();
  await page.getByRole("button", { name: /Más opciones del caso/i }).click();
  await expect(page.getByRole("menu").getByText("Próxima acción", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible();
});

test("reception role smoke: compact guide navigates without marking progress", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();

  await expect(page.getByRole("button", { name: /Siguiente: Abrí un caso del turno/ })).toBeVisible();
  await expect(page.getByText(/0\/5/).first()).toBeVisible();

  await page.getByRole("button", { name: /Siguiente: Abrí un caso del turno/ }).click();

  await expect(page.getByText(/0\/5 completado/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Reiniciar/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salir del modo guiado" })).toBeVisible();

  await page.getByRole("button", { name: /Ir a la cola/ }).first().click();
  await expect(page.locator("#front-desk-board")).toBeInViewport();
});

test("reception role smoke: board search shows the no-match state", async ({ page }) => {
  await login(page);

  await expect(page.getByLabel(/Buscar en el turno/)).toBeVisible();
  await page.getByLabel(/Buscar en el turno/).fill("caso inexistente zzz");

  await expect(
    page.getByText(/No hay casos que coincidan con la busqueda y el filtro actuales/),
  ).toBeVisible();
});

test("reception role smoke: layout has no horizontal overflow on common widths", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();

  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
  }
});
