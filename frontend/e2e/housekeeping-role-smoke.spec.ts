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

test("housekeeping role smoke: compact guide and queue stay usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  await expect(page.getByRole("region", { name: "Siguiente tarea" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Turno/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualizar turno" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Tarea de habitación/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar detalle" })).toBeVisible();
});

test("housekeeping role smoke: guide selects dirty filter without executing", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("region", { name: "Asistente guiado" })).toBeVisible();

  await page.getByRole("button", { name: /Siguiente:/ }).click();
  await page.getByRole("button", { name: /Tomá una habitación dirty/ }).click();

  await expect(page.getByRole("button", { name: /Por limpiar/ })).toHaveAttribute("aria-pressed", "true");
});

test("housekeeping role smoke: layout has no horizontal overflow on common widths", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 2, name: /^Housekeeping$/ })).toBeVisible();

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
