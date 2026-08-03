import { expect, test, type Cookie, type Page } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const adminUsername = process.env.E2E_USERNAME ?? "admin";
const adminPassword = process.env.E2E_PASSWORD ?? "demo2026pass";

const demoCredentials: Record<string, { username: string; password: string }> = {
  ops: { username: "ops_demo", password: "demo2026pass" },
  receptionist: { username: "recepcion_demo", password: "demo2026pass" },
  housekeeping: { username: "housekeeping_demo", password: "demo2026pass" },
  saas_admin: { username: "saas_admin_demo", password: "demo2026pass" },
};

const authCookies = new Map<string, Cookie[]>();

async function login(
  page: Page,
  credentials: { username: string; password: string } = { username: adminUsername, password: adminPassword },
) {
  const cacheKey = credentials.username;
  const cached = authCookies.get(cacheKey);
  if (cached) {
    await page.context().addCookies(cached);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login$/);
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(credentials.username);
  await page.getByLabel("Clave de Acceso").fill(credentials.password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/(?:bookings)?$/);
  authCookies.set(cacheKey, await page.context().cookies());
}

async function openRooms(page: Page) {
  await page.goto("/rooms");
  const inventoryTab = page.getByRole("tab", { name: "Inventario" });
  try {
    await expect(inventoryTab).toBeVisible({ timeout: 5_000 });
  } catch {
    await page.reload();
    await expect(inventoryTab).toBeVisible();
  }
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

function roomJson(id: string, number: string, type: string, status: string, priceCents = 250000) {
  return { id, hotel_id: hotelId, room_number: number, room_type: type, status, price_cents: priceCents };
}

test("rooms role smoke: admin opens /rooms with Inventario active and four tabs", async ({ page }) => {
  await login(page);
  await openRooms(page);

  await expect(page.getByRole("tab", { name: "Inventario" })).toHaveAttribute("aria-selected", "true");
  for (const name of ["Disponibilidad", "Planificador", "Bloqueos"]) {
    await expect(page.getByRole("tab", { name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Ver detalle de habitación 101" }).first()).toBeVisible();
});

test("rooms role smoke: search finds a deterministic room", async ({ page }) => {
  await login(page);
  await openRooms(page);

  await page.getByLabel("Buscar en el inventario").fill("101");
  await expect(page.getByRole("button", { name: "Ver detalle de habitación 101" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver detalle de habitación 102" }).first()).not.toBeVisible();
});

test("rooms role smoke: selection opens the inline detail at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openRooms(page);

  await page.getByRole("button", { name: "Ver detalle de habitación 101" }).first().click();
  await expect(page.getByRole("heading", { name: "Habitación 101" })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("rooms role smoke: selection opens the sheet below 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await openRooms(page);

  await page.getByRole("button", { name: "Ver detalle de habitación 101" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Habitación 101" })).toBeVisible();
});

test("rooms role smoke: admin sees mutable Configuración and Bloqueos tabs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await openRooms(page);

  await page.getByRole("button", { name: "Ver detalle de habitación 101" }).first().click();
  await expect(page.getByRole("tab", { name: "Configuración" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Bloqueos" }).last()).toBeVisible();
});

test("rooms role smoke: ops has no creation, configuration or hold management", async ({ page }) => {
  await login(page, demoCredentials.ops);
  await openRooms(page);

  await expect(page.getByRole("button", { name: /Nueva habitación/ })).not.toBeVisible();

  await page.getByRole("button", { name: "Ver detalle de habitación 101" }).first().click();
  await expect(page.getByRole("heading", { name: "Habitación 101" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Configuración" })).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "Bloqueos" }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear bloqueo" })).not.toBeVisible();
});

test("rooms role smoke: ops applies a valid bulk transition after confirming", async ({ page }) => {
  await login(page, demoCredentials.ops);
  await openRooms(page);

  const bulkRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/rooms/bulk-status") &&
      request.method() === "POST",
  );

  await page.getByLabel("Seleccionar habitación 101").check();
  await expect(page.getByText(/1 habitaciones seleccionadas/)).toBeVisible();

  await page.getByRole("button", { name: "Marcar disponibles" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();

  const request = await bulkRequest;
  expect(request.postDataJSON()).toMatchObject({
    status: "AVAILABLE",
    room_ids: ["90000000-0000-0000-0000-000000000101"],
  });
});

test("rooms role smoke: an invalid batch never reaches the backend", async ({ page }) => {
  await login(page, demoCredentials.ops);
  await openRooms(page);

  let bulkRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/rooms/bulk-status") && request.method() === "POST") {
      bulkRequests += 1;
    }
  });

  await page.getByLabel("Seleccionar habitación 101").check();
  await expect(page.getByText(/Bloquean:/)).toBeVisible();

  const invalidTarget = page.getByRole("button", { name: "Enviar a limpieza" });
  await expect(invalidTarget).toBeDisabled();

  expect(bulkRequests).toBe(0);
});

test("rooms role smoke: receptionist sees Disponibilidad and can open a booking", async ({ page }) => {
  await page.route("**/api/v1/rooms/available*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([roomJson("90000000-0000-0000-0000-000000000101", "101", "SINGLE", "Available")]),
    }),
  );

  await login(page, demoCredentials.receptionist);
  await openRooms(page);
  await page.getByRole("tab", { name: "Disponibilidad" }).click();

  await page.getByRole("button", { name: "Seleccionar entrada y salida" }).click();
  const days = page.locator(".rdp-month").first().locator(".rdp-day_button:not(.rdp-outside):not([disabled])");
  await days.nth(0).click();
  await days.nth(1).click();

  await page.getByRole("button", { name: "Buscar Habitaciones" }).click();
  await expect(page.getByText("Habitación 101")).toBeVisible();

  await page.getByRole("button", { name: "Reservar" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Resumen de Estancia")).toBeVisible();
});

test("rooms role smoke: selecting a range does not fire a request until Buscar", async ({ page }) => {
  let availabilityRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/rooms/available")) {
      availabilityRequests += 1;
    }
  });

  await login(page, demoCredentials.receptionist);
  await openRooms(page);
  await page.getByRole("tab", { name: "Disponibilidad" }).click();

  expect(availabilityRequests).toBe(0);

  await page.getByRole("button", { name: "Seleccionar entrada y salida" }).click();
  const days = page.locator(".rdp-month").first().locator(".rdp-day_button:not(.rdp-outside):not([disabled])");
  await days.nth(0).click();
  await days.nth(1).click();

  await expect(page.getByRole("button", { name: "Buscar Habitaciones" })).toBeEnabled();
  expect(availabilityRequests).toBe(0);

  await page.getByRole("button", { name: "Buscar Habitaciones" }).click();
  await expect.poll(() => availabilityRequests).toBe(1);
});

test("rooms role smoke: availability results do not change the inventory counter", async ({ page }) => {
  await page.route("**/api/v1/rooms/available*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([roomJson("90000000-0000-0000-0000-000000000101", "101", "SINGLE", "Available")]),
    }),
  );

  await login(page, demoCredentials.receptionist);
  await openRooms(page);

  const inventoryPanel = page.getByRole("tabpanel", { name: "Inventario" });
  await expect(inventoryPanel.getByText("Disponibles")).toBeVisible();
  const counterBefore = await inventoryPanel.getByText("Disponibles").innerText();

  await page.getByRole("tab", { name: "Disponibilidad" }).click();
  await page.getByRole("button", { name: "Seleccionar entrada y salida" }).click();
  const days = page.locator(".rdp-month").first().locator(".rdp-day_button:not(.rdp-outside):not([disabled])");
  await days.nth(0).click();
  await days.nth(1).click();
  await page.getByRole("button", { name: "Buscar Habitaciones" }).click();
  await expect(page.getByText(/1 habitaciones encontradas/)).toBeVisible();

  await page.getByRole("tab", { name: "Inventario" }).click();
  await expect(inventoryPanel.getByText("Disponibles")).toBeVisible();
  await expect(inventoryPanel.getByText("Disponibles")).toContainText(counterBefore);
});

test("rooms role smoke: planner loads on open, not before", async ({ page }) => {
  let holdBoardRequests = 0;
  let bookingsRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/rooms/holds/board")) {
      holdBoardRequests += 1;
    }
    if (request.url().includes("/api/v1/bookings") && request.method() === "GET") {
      bookingsRequests += 1;
    }
  });

  await login(page);
  await openRooms(page);
  await expect(page.getByRole("tab", { name: "Inventario" })).toHaveAttribute("aria-selected", "true");
  expect(holdBoardRequests).toBe(0);
  expect(bookingsRequests).toBe(0);

  await page.getByRole("tab", { name: "Planificador" }).click();
  await expect(page.getByText("Planner operativo 7 días")).toBeVisible();
  await expect.poll(() => holdBoardRequests).toBe(1);
  await expect.poll(() => bookingsRequests).toBe(1);
});

test("rooms role smoke: Bloqueos rejects a range wider than 31 days", async ({ page }) => {
  await login(page);
  await openRooms(page);
  await page.getByRole("tab", { name: "Bloqueos" }).click();

  await expect(page.getByLabel("Desde")).toBeVisible();
  await page.getByLabel("Hasta").fill("2026-10-01");

  await expect(page.getByText("El rango máximo es de 31 días.")).toBeVisible();
});

test("rooms role smoke: Maintenance routes to Housekeeping without local mutation", async ({ page }) => {
  await page.route("**/api/v1/rooms", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        roomJson("90000000-0000-0000-0000-000000000101", "101", "SINGLE", "Available"),
        roomJson("90000000-0000-0000-0000-000000000104", "104", "SINGLE", "Maintenance"),
      ]),
    }),
  );

  await login(page);
  await openRooms(page);

  await page.getByRole("button", { name: "Ver detalle de habitación 104" }).first().click();
  await expect(page.getByText("Resolver mantenimiento antes de volver a vender")).toBeVisible();
  await page.getByRole("tab", { name: "Operación" }).click();
  await expect(
    page.getByText("El caso debe resolverse desde Housekeeping; luego la habitación vuelve a Dirty."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Marcar disponible/ })).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Enviar a limpieza/ })).not.toBeVisible();
});

test("rooms role smoke: availability failure keeps inventory usable", async ({ page }) => {
  await page.route("**/api/v1/rooms/available*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await login(page, demoCredentials.receptionist);
  await openRooms(page);
  await page.getByRole("tab", { name: "Disponibilidad" }).click();

  await page.getByRole("button", { name: "Seleccionar entrada y salida" }).click();
  const days = page.locator(".rdp-month").first().locator(".rdp-day_button:not(.rdp-outside):not([disabled])");
  await days.nth(0).click();
  await days.nth(1).click();
  await page.getByRole("button", { name: "Buscar Habitaciones" }).click();

  await expect(page.getByText("No se pudo cargar la disponibilidad", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();

  await page.getByRole("tab", { name: "Inventario" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Inventario" }).getByRole("button", {
      name: "Ver detalle de habitación 101",
    }).first(),
  ).toBeVisible();
});

test("rooms role smoke: holds failure keeps the planner partially usable", async ({ page }) => {
  await page.route("**/api/v1/rooms/holds/board*", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );

  await login(page);
  await openRooms(page);
  await page.getByRole("tab", { name: "Planificador" }).click();

  await expect(page.getByText("Planner operativo 7 días")).toBeVisible();
  await expect(
    page.getByRole("tabpanel", { name: "Planificador" }).getByText("101", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Inventario" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Inventario" }).getByRole("button", {
      name: "Ver detalle de habitación 101",
    }).first(),
  ).toBeVisible();
});

test("rooms role smoke: tabs are keyboard navigable", async ({ page }) => {
  await login(page);
  await openRooms(page);

  const inventario = page.getByRole("tab", { name: "Inventario" });
  await inventario.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Disponibilidad" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Planificador" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(inventario).toHaveAttribute("aria-selected", "true");
});

test("rooms role smoke: mobile 390px has no page overflow", async ({ page }) => {
  await login(page);
  await openRooms(page);
  await expectNoHorizontalOverflow(page, 390, 844);
});

test("rooms role smoke: mobile planner uses day selector and list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await openRooms(page);

  await page.getByRole("tab", { name: "Planificador" }).click();
  await expect(page.getByRole("button", { name: "Día anterior" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Día siguiente" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver detalle" }).first()).toBeVisible();
});

test("rooms role smoke: closing the detail restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await openRooms(page);

  const trigger = page.getByRole("button", { name: "Ver detalle de habitación 101" }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cerrar detalle" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
