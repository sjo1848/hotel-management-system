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

test("reception role smoke: booking center opens from bookings list", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await login(page);
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();

  await page.getByRole("tab", { name: /Reservas/ }).click();
  await page.getByRole("button", { name: "Gestionar" }).first().click();
  await expect(
    page.getByText(/Revisá el bloqueo y completá una sola próxima acción/),
  ).toBeVisible();
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
