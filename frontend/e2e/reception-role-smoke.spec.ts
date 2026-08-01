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
  await expect(page.getByRole("heading", { level: 3, name: "Turno de recepción" })).toBeVisible();
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

  await page.getByRole("button", { name: "Gestionar" }).first().click();
  await expect(page.getByText("Centro operativo de la estadia.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible();
});
