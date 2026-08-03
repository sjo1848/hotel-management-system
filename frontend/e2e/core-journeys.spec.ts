import { expect, test } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const username = process.env.E2E_USERNAME ?? "admin";
const password = process.env.E2E_PASSWORD ?? "admin123";

async function login(page: import("@playwright/test").Page) {
  await expect(async () => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Hotel (nombre o ID)")).toBeVisible();
    await expect(page.getByLabel("Usuario Global")).toBeVisible();
    await expect(page.getByLabel("Clave de Acceso")).toBeVisible();
  }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });

  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(username);
  await page.getByLabel("Clave de Acceso").fill(password);

  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("auth lifecycle: login and logout", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Centro de control")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar Sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("booking lifecycle: bookings list is accessible", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Reservas" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Recepción$/ })).toBeVisible();
});

test("billing journey: cash closure widget is visible in dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Caja del turno")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar turno" })).toBeVisible();
});

test("dashboard journey: control center queue and CTA are actionable", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Necesita atención")).toBeVisible();

  const cta = page
    .getByRole("button", {
      name: /Ajustar inventario|Ver reservas|Abrir tendencias|Ir a limpieza|Ver calendario/,
    })
    .first();

  const retryButton = page.getByRole("button", { name: "Reintentar" });
  await expect(async () => {
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
    }
    await expect(cta).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000, intervals: [1_000, 2_000, 3_000] });

  await cta.click();

  await expect(page).toHaveURL(/\/(rooms|bookings|reports|housekeeping|calendar)$/);
});

test("rbac/admin journey: users and reports sections are reachable", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "Usuarios" }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText("Control de Acceso")).toBeVisible();

  await page.getByRole("link", { name: "Tendencias" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Reportes$/ })).toBeVisible();
});
