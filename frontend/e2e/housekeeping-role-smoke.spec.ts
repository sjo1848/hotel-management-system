import { expect, test } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const username = process.env.E2E_USERNAME ?? "housekeeping_demo";
const password = process.env.E2E_PASSWORD ?? "demo2026pass";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");

  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(username);
  await page.getByLabel("Clave de Acceso").fill(password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();

  await expect(page).toHaveURL(/\/housekeeping$/);
}

test("housekeeping role smoke: navigation is scoped correctly", async ({ page }) => {
  await login(page);

  await expect(page.getByRole("link", { name: "Housekeeping" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Red Global" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /^Housekeeping$/ })).toBeVisible();
});

test("housekeeping role smoke: guided rail and board stay usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await expect(page.getByText("Modo guiado")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ocultar guía|Activar guía/ }).first()).toBeVisible();
  await expect(page.getByText("Que conviene mover primero")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refrescar" })).toBeVisible();
});
