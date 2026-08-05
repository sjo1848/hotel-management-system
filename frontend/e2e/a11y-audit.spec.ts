import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const username = process.env.E2E_USERNAME ?? "admin";
const password = process.env.E2E_PASSWORD ?? "admin123";

// Core admin workspaces plus the shared login surface.
const adminRoutes = ["/", "/bookings", "/calendar", "/rooms", "/guests", "/housekeeping", "/users", "/reports"];

async function login(page: Page) {
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

async function audit(page: Page, label: string) {
  const url = page.url();
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations;

  console.log(`[a11y] ${label} (${url.replace(/^.*:\d+/, "")}): ${violations.length} serious/critical violations detected`);

  for (const v of violations) {
    console.log(`  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`);
  }

  expect(violations).toEqual([]);
}

test("a11y: login page has no axe violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await audit(page, "login");
});

test("a11y: admin dashboard/home has no axe violations", async ({ page }) => {
  await login(page);
  await expect(page.locator("main")).toBeVisible();
  await audit(page, "admin-home");
});

for (const route of adminRoutes) {
  if (route === "/") continue;
  test(`a11y: admin ${route} has no axe violations`, async ({ page }) => {
    await login(page);
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await audit(page, `admin-${route}`);
  });
}