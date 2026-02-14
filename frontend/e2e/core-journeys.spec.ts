import { expect, test } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "Hotel Sede Central";
const username = process.env.E2E_USERNAME ?? "admin";
const password = process.env.E2E_PASSWORD ?? "admin123";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");

  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(username);
  await page.getByLabel("Clave de Acceso").fill(password);

  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("auth lifecycle: login and logout", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Vista General")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar Sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("booking lifecycle: bookings list is accessible", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Reservas" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 2, name: /^Reservas$/ })).toBeVisible();
});

test("billing journey: cash closure widget is visible in dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Cierre de Caja")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finalizar Turno y Cerrar Caja" }),
  ).toBeVisible();
});

test("rbac/admin journey: users and reports sections are reachable", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "Usuarios" }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText("Control de Acceso")).toBeVisible();

  await page.getByRole("link", { name: "Tendencias" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByText("Analítica Avanzada")).toBeVisible();
});
