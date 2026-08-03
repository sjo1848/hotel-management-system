import { expect, test, type Page } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const adminUsername = process.env.E2E_USERNAME ?? "admin";
const adminPassword = process.env.E2E_PASSWORD ?? "demo2026pass";

const demoCredentials: Record<string, { username: string; password: string }> = {
  receptionist: { username: "recepcion_demo", password: "demo2026pass" },
  housekeeping: { username: "housekeeping_demo", password: "demo2026pass" },
  saas_admin: { username: "saas_admin_demo", password: "demo2026pass" },
};

async function login(
  page: Page,
  credentials: { username: string; password: string } = { username: adminUsername, password: adminPassword },
) {
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(credentials.username);
  await page.getByLabel("Clave de Acceso").fill(credentials.password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function expectNoHorizontalOverflow(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
}

test("dashboard role smoke: admin lands on control center with Operación active", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { level: 1, name: "Centro de control" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Operación" })).toHaveAttribute("aria-selected", "true");
});

test("dashboard role smoke: Operación exposes queue, pulse and cash blocks", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Necesita atención")).toBeVisible();
  await expect(page.getByText("Pulso del hotel")).toBeVisible();
  await expect(page.getByText("Caja del turno")).toBeVisible();
});

test("dashboard role smoke: a priority CTA navigates to a permitted module", async ({ page }) => {
  await login(page);
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

test("dashboard role smoke: Rendimiento loads reports with default 30-day range", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: "Rendimiento" }).click();

  await expect(page.getByRole("button", { name: "30 días" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Tendencia de ingresos")).toBeVisible();
  await expect(page.getByText("Tendencia de ocupación")).toBeVisible();
  await expect(page.getByText(/Periodo:/)).toBeVisible();
});

test("dashboard role smoke: range switch to 7 days does not reload the page", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: "Rendimiento" }).click();
  await expect(page.getByRole("button", { name: "30 días" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "7 días" }).click();

  await expect(page.getByRole("button", { name: "7 días" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Tendencia de ingresos")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("dashboard role smoke: cash close sheet opens, validates and can be cancelled", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Cerrar turno" }).click();

  await expect(page.getByRole("heading", { name: "Arqueo y handoff de turno" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "Confirmar arqueo y cerrar" });
  await expect(confirm).toBeDisabled();

  await page.getByLabel("Entregar a").fill("Turno noche");
  await page.getByLabel("Notas de entrega").fill("Novedades registradas");
  await expect(confirm).toBeEnabled();

  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Arqueo y handoff de turno" })).toHaveCount(0);
});

test("dashboard role smoke: cash balance failure keeps operational priorities visible", async ({ page }) => {
  await page.route("**/api/v1/billing/balance", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await login(page);

  await expect(page.getByText("Necesita atención")).toBeVisible();
  await expect(page.getByText("Pulso del hotel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar caja" })).toBeVisible();
});

test("dashboard role smoke: revenue failure keeps occupancy visible", async ({ page }) => {
  await page.route("**/api/v1/reports/revenue*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await login(page);
  await page.getByRole("tab", { name: "Rendimiento" }).click();

  await expect(page.getByText("No se pudo cargar tendencia de ingresos")).toBeVisible();
  await expect(page.getByText("Tendencia de ocupación")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("dashboard role smoke: tabs are keyboard navigable", async ({ page }) => {
  await login(page);
  const operationTab = page.getByRole("tab", { name: "Operación" });
  await operationTab.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("tab", { name: "Rendimiento" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Rendimiento" })).toBeVisible();

  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Operación" })).toHaveAttribute("aria-selected", "true");
});

test("dashboard role smoke: receptionist reaching / is redirected to bookings", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(demoCredentials.receptionist.username);
  await page.getByLabel("Clave de Acceso").fill(demoCredentials.receptionist.password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
});

test("dashboard role smoke: housekeeping reaching / is redirected to housekeeping", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(demoCredentials.housekeeping.username);
  await page.getByLabel("Clave de Acceso").fill(demoCredentials.housekeeping.password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/housekeeping$/);
});

test("dashboard role smoke: saas_admin reaching / is redirected to network", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(demoCredentials.saas_admin.username);
  await page.getByLabel("Clave de Acceso").fill(demoCredentials.saas_admin.password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/network$/);
});

test("dashboard role smoke: no horizontal overflow at mobile widths", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("tab", { name: "Operación" })).toHaveAttribute("aria-selected", "true");
  await expectNoHorizontalOverflow(page, 390, 844);
  await expectNoHorizontalOverflow(page, 768, 1024);
});

test("dashboard role smoke: Operación fits within a desktop viewport", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("tab", { name: "Operación" })).toHaveAttribute("aria-selected", "true");
  await expectNoHorizontalOverflow(page, 1280, 900);
  await expectNoHorizontalOverflow(page, 1440, 900);
});
