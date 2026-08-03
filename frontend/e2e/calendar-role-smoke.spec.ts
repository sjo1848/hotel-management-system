import { expect, test, type Cookie, type Page } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const admin = { username: process.env.E2E_USERNAME ?? "admin", password: process.env.E2E_PASSWORD ?? "demo2026pass" };
const roles = {
  receptionist: { username: "recepcion_demo", password: "demo2026pass" },
  housekeeping: { username: "housekeeping_demo", password: "demo2026pass" },
};
const cookiesByUser = new Map<string, Cookie[]>();

const date = (offset: number) => {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

const rooms = [
  { id: "r1", hotel_id: hotelId, room_number: "101", room_type: "DOUBLE", status: "Available", price_cents: 100 },
  { id: "r2", hotel_id: hotelId, room_number: "102", room_type: "SUITE", status: "Dirty", price_cents: 200 },
];
const bookings = [{ id: "b1", hotel_id: hotelId, room_id: "r1", guest_id: "g1", guest_name: "Ana Gómez", check_in: date(1), check_out: date(3), total_price_cents: 100, status: "Confirmed", operational_data: {} }];
const holds = [{ hold_id: "h1", room_id: "r2", room_number: "102", room_type: "SUITE", start_date: date(2), end_date: date(4), hold_type: "Maintenance", reason: "Obra programada" }];

async function login(page: Page, credentials = admin, expectAccess = true) {
  const cached = cookiesByUser.get(credentials.username);
  if (cached) {
    await page.context().addCookies(cached);
    if (expectAccess) {
      await page.goto("/calendar");
      await expect(page.getByRole("heading", { name: "Calendario" })).toBeVisible();
    }
    return;
  }
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(credentials.username);
  await page.getByLabel("Clave de Acceso").fill(credentials.password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  cookiesByUser.set(credentials.username, await page.context().cookies());
  if (expectAccess) {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendario" })).toBeVisible();
  }
}

async function stubCalendar(page: Page, options: { rooms?: unknown[]; bookings?: unknown[]; holds?: unknown[] } = {}) {
  await page.route("**/api/v1/rooms", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.rooms ?? rooms) }));
  await page.route("**/api/v1/bookings*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.bookings ?? bookings) }));
  await page.route("**/api/v1/rooms/holds/board*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.holds ?? holds) }));
}

async function openCalendar(page: Page, credentials = admin) {
  await login(page, credentials);
  await expect(page.getByText(/reservas activas/)).toBeVisible();
}

test("calendar role smoke: admin opens Calendario", async ({ page }) => {
  await stubCalendar(page);
  await openCalendar(page);
  await expect(page.getByText("Ocupación, movimientos y bloqueos por fecha")).toBeVisible();
});

test("calendar role smoke: desktop defaults to 14-day Timeline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubCalendar(page);
  await openCalendar(page);
  await expect(page.getByRole("button", { name: "14 días" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("table", { name: "Timeline de ocupación" })).toBeVisible();
});

test("calendar role smoke: temporal navigation changes the range", async ({ page }) => {
  await stubCalendar(page);
  await openCalendar(page);
  const before = await page.locator('[aria-live="polite"]').innerText();
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.locator('[aria-live="polite"]')).not.toHaveText(before);
  await page.getByRole("button", { name: "Hoy" }).click();
  await expect(page.locator('[aria-live="polite"]')).toContainText("02");
});

test("calendar role smoke: 7 and 30 days change columns and request range", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/v1/bookings")) requests.push(request.url()); });
  await stubCalendar(page);
  await openCalendar(page);
  await page.getByRole("button", { name: "7 días" }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "30 días" }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(1);
});

test("calendar role smoke: checkout is not an occupied night", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubCalendar(page);
  await openCalendar(page);
  const reservationBars = page.getByRole("button", { name: /Reserva: Ana Gómez/ });
  await expect(reservationBars).toHaveCount(2);
});

test("calendar role smoke: conflict is visible and selectable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubCalendar(page, { bookings: [bookings[0], { ...bookings[0], id: "b2", check_in: date(2), check_out: date(4), guest_name: "Luis Pérez" }] });
  await openCalendar(page);
  await expect(page.getByRole("button", { name: /Conflicto/ })).toBeVisible();
  await page.getByRole("button", { name: /Conflicto/ }).click();
  await expect(page.getByText("Contexto seleccionado")).toBeVisible();
});

test("calendar role smoke: hold is visible and read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubCalendar(page);
  await openCalendar(page);
  await expect(page.getByRole("button", { name: /Bloqueo: Maintenance/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Bloqueo: Maintenance/ }).first().click();
  await expect(page.getByText(/Obra programada/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar|Guardar bloqueo|Crear bloqueo/ })).not.toBeVisible();
});

test("calendar role smoke: booking selection opens desktop detail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubCalendar(page);
  await openCalendar(page);
  await page.getByRole("button", { name: /Reserva: Ana Gómez/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("calendar role smoke: booking selection opens tablet sheet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await stubCalendar(page);
  await openCalendar(page);
  await page.locator('[aria-label="Día de agenda"] button').nth(1).click();
  await page.getByRole("button", { name: /Habitación 101.*Ana Gómez/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("calendar role smoke: authorized update refreshes the booking range", async ({ page }) => {
  let updates = 0;
  await page.route("**/api/v1/bookings/b1", async (route) => { updates += 1; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bookings[0]) }); });
  await stubCalendar(page);
  await openCalendar(page);
  await page.getByRole("button", { name: /Reserva: Ana Gómez/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(updates).toBe(0);
});

test("calendar role smoke: receptionist can read calendar data", async ({ page }) => {
  await stubCalendar(page);
  await openCalendar(page, roles.receptionist);
  await expect(page.getByText("Ana Gómez").first()).toBeVisible();
});

test("calendar role smoke: housekeeping cannot access calendar", async ({ page }) => {
  await login(page, roles.housekeeping, false);
  await page.goto("/calendar");
  await expect(page).not.toHaveURL(/\/calendar$/);
});

test("calendar role smoke: bookings error preserves rooms and holds", async ({ page }) => {
  await page.route("**/api/v1/rooms", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rooms) }));
  await page.route("**/api/v1/bookings*", (route) => route.fulfill({ status: 500, body: "{}" }));
  await page.route("**/api/v1/rooms/holds/board*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(holds) }));
  await openCalendar(page);
  await expect(page.getByText("No se pudieron cargar las reservas")).toBeVisible();
  await expect(page.getByText("101")).toBeVisible();
});

test("calendar role smoke: holds error preserves bookings", async ({ page }) => {
  await page.route("**/api/v1/rooms", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rooms) }));
  await page.route("**/api/v1/bookings*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bookings) }));
  await page.route("**/api/v1/rooms/holds/board*", (route) => route.fulfill({ status: 500, body: "{}" }));
  await openCalendar(page);
  await expect(page.getByText("No se pudieron cargar los bloqueos")).toBeVisible();
  await expect(page.getByText("Ana Gómez").first()).toBeVisible();
});

test("calendar role smoke: mobile Agenda groups movements", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubCalendar(page);
  await openCalendar(page);
  await expect(page.getByRole("button", { name: "Agenda" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1 llegadas")).toBeVisible();
});

test("calendar role smoke: keyboard can select a reservation bar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stubCalendar(page);
  await openCalendar(page);
  const bar = page.getByRole("button", { name: /Reserva: Ana Gómez/ }).first();
  await bar.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("calendar role smoke: closing detail returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubCalendar(page);
  await openCalendar(page);
  await page.locator('[aria-label="Día de agenda"] button').nth(1).click();
  const bar = page.getByRole("button", { name: /Habitación 101.*Ana Gómez/ }).first();
  await bar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Cerrar/ }).first().click();
  await expect(dialog).not.toBeVisible();
  await expect(bar).toBeFocused();
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`calendar role smoke: no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubCalendar(page);
    await openCalendar(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}
