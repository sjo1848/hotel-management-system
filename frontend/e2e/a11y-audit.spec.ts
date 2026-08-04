import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const password = process.env.E2E_PASSWORD ?? "demo2026pass";

const roles: Record<string, { username: string; route: string }> = {
  admin: { username: "admin", route: "/" },
  receptionist: { username: "recepcion_demo", route: "/bookings" },
  housekeeping: { username: "housekeeping_demo", route: "/housekeeping" },
  ops: { username: "ops_demo", route: "/" },
  saas_admin: { username: "saas_admin_demo", route: "/network" },
};

// Critical routes under the admin role that expose the core workspaces.
const adminRoutes = ["/", "/bookings", "/calendar", "/rooms", "/guests", "/housekeeping", "/users", "/reports"];

async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(username);
  await page.getByLabel("Clave de Acceso").fill(password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).not.toHaveURL(/\/login/);
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

for (const [role, cfg] of Object.entries(roles)) {
  test(`a11y: ${role} dashboard/home has no axe violations`, async ({ page }) => {
    await login(page, cfg.username);
    if (cfg.route !== "/") {
      await page.goto(cfg.route);
    }
    await expect(page.locator("main")).toBeVisible();
    await audit(page, `${role}-home`);
  });
}

for (const route of adminRoutes) {
  if (route === "/") continue;
  test(`a11y: admin ${route} has no axe violations`, async ({ page }) => {
    await login(page, "admin");
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await audit(page, `admin-${route}`);
  });
}