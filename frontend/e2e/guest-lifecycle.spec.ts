import { expect, test, type Page } from "@playwright/test";

const hotelId = process.env.E2E_HOTEL_ID ?? "00000000-0000-0000-0000-000000000001";
const username = process.env.E2E_USERNAME ?? "admin";
const password = process.env.E2E_PASSWORD ?? "demo2026pass";

test.describe.configure({ retries: 0 });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Hotel (nombre o ID)").fill(hotelId);
  await page.getByLabel("Usuario Global").fill(username);
  await page.getByLabel("Clave de Acceso").fill(password);
  await page.getByRole("button", { name: "Acceder al Sistema" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function parseArgentineCurrency(value: string): number {
  const normalized = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function formatArgentineCurrency(value: number): string {
  return `$${value.toLocaleString("es-AR")}`;
}

async function openBookingTab(page: Page, label: RegExp) {
  const backToCase = page.getByRole("button", { name: "Volver al caso" });
  if (await backToCase.isVisible().catch(() => false)) {
    await backToCase.click();
  }

  // The reopened case is rendered by BookingDetailsSheet -> BookingCaseWorkspace,
  // whose tablist always renders Resumen/Operación/Cuenta/Historial directly
  // (there is no "Más" tab to fall back to). Wait for the case workspace and
  // click the direct tab with auto-waiting instead of probing with count(),
  // which races with rendering and used to fall through to a nonexistent
  // "Más" tab and hang.
  await expect(page.getByRole("button", { name: /Más opciones del caso/i })).toBeVisible();
  await page.getByRole("tab", { name: label }).filter({ visible: true }).first().click();
}

async function reopenBookingCase(page: Page, guestName: string, bookingId: string) {
  // Wait for Reception to be rendered before deciding how to reach the
  // Reservas view: desktop shows the tab directly, mobile hides it in the
  // "Más vistas" overflow menu.
  const receptionTablist = page.getByRole("tablist", { name: "Vistas de recepción" });
  await expect(receptionTablist).toBeVisible();

  const reservationsTab = page.getByRole("tab", { name: /^Reservas/i }).filter({ visible: true }).first();
  if (await reservationsTab.count()) {
    await reservationsTab.click();
  } else {
    await page.getByRole("button", { name: /Más vistas/ }).click();
    await page.getByRole("menu").getByRole("tab", { name: /^Reservas/i }).click();
  }
  const bookingsSearch = page.getByPlaceholder("Buscar por huésped o ID...");
  await expect(bookingsSearch).toBeVisible();
  await bookingsSearch.fill(guestName);
  const bookingsPayload = await page.evaluate(async () => {
    const response = await fetch("/api/v1/bookings");
    if (!response.ok) {
      throw new Error(`Bookings lookup failed with ${response.status}`);
    }
    return response.json();
  });
  const reopenedBooking = Array.isArray(bookingsPayload)
    ? bookingsPayload.find((booking) => booking?.id === bookingId)
    : undefined;
  expect(reopenedBooking?.id).toBe(bookingId);
  const manageButton = page.getByRole("button", { name: "Gestionar" }).first();
  if (await manageButton.isVisible().catch(() => false)) {
    await manageButton.click();
  } else {
    // The mobile reservations view exposes each filtered booking as the
    // actionable button; it has no separate "Gestionar" action.
    const guestPattern = new RegExp(guestName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const bookingButton = page.getByRole("button", { name: guestPattern }).first();
    await expect(bookingButton).toBeVisible();
    await bookingButton.click();
    await expect(manageButton).toBeVisible();
    await manageButton.click();
  }
  await expect(page.getByRole("button", { name: /Más opciones del caso/i })).toBeVisible();
}

test("guest lifecycle: walk-in, check-in, charge, payment, checkout and room release", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const viewportWidth = Number.parseInt(process.env.E2E_VIEWPORT_WIDTH ?? "", 10);
  if (Number.isFinite(viewportWidth) && viewportWidth > 0) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
  }
  const uniqueToken = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const guestName = `E2E Lifecycle ${uniqueToken}`;
  const paymentReference = `POS-${uniqueToken}`;
  const relevantConsoleErrors: string[] = [];

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /HMS Error|factura solicitada|booking invoice/i.test(message.text())
    ) {
      relevantConsoleErrors.push(message.text());
    }
  });

  await login(page);
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Nueva Reserva" }).first().click();

  const walkInSheet = page.getByRole("dialog");
  await expect(walkInSheet.getByRole("heading", { name: "Walk-in / nueva reserva" })).toBeVisible();
  const isMobile = Number.isFinite(viewportWidth) && viewportWidth <= 430;
  const futureCheckIn = new Date();
  const dateOffset = Number.isFinite(viewportWidth) && viewportWidth > 0 ? 7 + (viewportWidth % 100) : 7;
  futureCheckIn.setDate(futureCheckIn.getDate() + dateOffset);
  const futureCheckOut = new Date(futureCheckIn);
  futureCheckOut.setDate(futureCheckOut.getDate() + 1);
  await walkInSheet.getByLabel("Check-in").fill(futureCheckIn.toISOString().slice(0, 10));
  await walkInSheet.getByLabel("Check-out").fill(futureCheckOut.toISOString().slice(0, 10));
  if (isMobile) {
    await walkInSheet.getByRole("button", { name: "Siguiente" }).click();
  }
  await walkInSheet.getByRole("button", { name: "Alta rapida" }).click();
  await walkInSheet.getByLabel("Nombre completo").fill(guestName);
  await walkInSheet.getByLabel("Email").fill(`e2e.lifecycle.${uniqueToken}@hmselite.local`);
  await walkInSheet.getByLabel("Telefono").fill("+54 11 5555 9901");
  if (isMobile) {
    await walkInSheet.getByRole("button", { name: "Siguiente" }).click();
  }

  let roomNumber: string | undefined;
  let accommodationTotal: number;
  if (isMobile) {
    await walkInSheet.getByRole("button", { name: /Habitación disponible/ }).click();
    const roomPicker = page.locator('[aria-labelledby="mobile-room-picker-title"]');
    await expect(roomPicker).toBeVisible();
    const roomOption = roomPicker.getByRole("button").filter({ hasText: /Habitaci[oó]n/ }).first();
    await expect(roomOption).toBeVisible();
    const roomText = (await roomOption.textContent()) ?? "";
    roomNumber = roomText.match(/Habitaci[oó]n\s+(\d+)/)?.[1];
    const nightlyRateText = roomText.match(/(\$[\d.,]+)\s*\/\s*noche/)?.[1];
    expect(roomNumber).toBeTruthy();
    expect(nightlyRateText).toBeTruthy();
    accommodationTotal = parseArgentineCurrency(nightlyRateText!);
    await roomOption.click();
    await expect(walkInSheet.getByRole("button", { name: /Asignada/ })).toBeVisible();
    await walkInSheet.getByRole("button", { name: "Siguiente" }).click();
  } else {
    const roomButton = walkInSheet
      .getByRole("button")
      .filter({ hasText: /Habitaci[oó]n \d+/ })
      .first();
    await expect(roomButton).toBeVisible();
    const roomText = (await roomButton.textContent()) ?? "";
    roomNumber = roomText.match(/Habitaci[oó]n\s+(\d+)/)?.[1];
    const estimatedTotalText = roomText.match(/Total estimado\s*(\$[\d.,]+)/)?.[1];
    expect(roomNumber).toBeTruthy();
    expect(estimatedTotalText).toBeTruthy();
    accommodationTotal = parseArgentineCurrency(estimatedTotalText!);
    await roomButton.click();
  }
  const accountTotal = accommodationTotal + 15;

  const createBookingRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/v1\/bookings$/.test(response.url()),
  );
  const createButton = page.getByRole("button", { name: "Crear y gestionar" });
  await expect(createButton).toBeVisible();
  await createButton.click({ noWaitAfter: true });
  const createResponse = await createBookingRequest;
  expect(createResponse.status()).toBe(201);
  const createdBooking = await createResponse.json();
  const bookingId = createdBooking?.id;
  expect(bookingId).toEqual(expect.any(String));

  // R1 (authoritative product contract): walk-in creation returns to Reception
  // and does NOT auto check-in the reservation.
  await expect(page.getByRole("tablist", { name: "Vistas de recepción" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Más opciones del caso/i })).toHaveCount(0);

  // Reopen the confirmed reservation explicitly from the Reservas list before
  // continuing the lifecycle. The case header must still show "Confirmada"
  // (no auto check-in happened on creation).
  await reopenBookingCase(page, guestName, bookingId);
  await expect(page.getByRole("dialog").getByText("Confirmada", { exact: true }).first()).toBeVisible();

  const firstInvoiceLookup = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /\/api\/v1\/bookings\/[^/]+\/invoice$/.test(response.url()),
  );
  await openBookingTab(page, /Cuenta/);
  expect((await firstInvoiceLookup).status()).toBe(404);
  if (isMobile) {
    await page.getByText("Últimos movimientos", { exact: true }).click();
  }
  await expect(page.getByText("Sin cargos extra registrados por el momento.")).toBeVisible();
  await expect(page.getByText("La factura solicitada no existe")).toHaveCount(0);

  await openBookingTab(page, /Operación/);
  await page.getByRole("checkbox", { name: /Identidad validada/ }).check();
  await page.getByRole("checkbox", { name: /Fechas y tarifa confirmadas/ }).check();
  await page.getByRole("checkbox", { name: /Contacto verificado/ }).check();
  if (isMobile) {
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.locator("#mobile-checkin-arrival-reference").fill(`Arrival ${uniqueToken}`);
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Confirmar ingreso" }).click();
  } else {
    await page.getByLabel("Referencia interna").fill(`Arrival ${uniqueToken}`);
    await page.getByRole("button", { name: "Confirmar ingreso y ocupar habitacion" }).click();
  }

  // R2 (authoritative product contract): check-in returns to Reception and does
  // NOT auto check out the stay. The case workspace must be closed and we must
  // be back on the reception workspace.
  await expect(page.getByRole("tablist", { name: "Vistas de recepción" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Más opciones del caso/i })).toHaveCount(0);

  // Reopen the same booking (now in-house) from the Reservas list. The case
  // header must show "En casa" (CheckedIn, no auto checkout).
  await reopenBookingCase(page, guestName, bookingId);
  await expect(page.getByRole("dialog").getByText("En casa", { exact: true }).first()).toBeVisible();

  await openBookingTab(page, /Cuenta/);
  const accountSection = page
    .getByText("Cuenta y cargos", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-3xl')][1]");
  await accountSection.getByRole("button", { name: "Desayuno $15" }).click();
  await expect(accountSection.getByText(formatArgentineCurrency(accountTotal), { exact: true }).first()).toBeVisible();

  await accountSection.getByRole("button", { name: "CARD" }).click();
  await accountSection.getByLabel("Monto a registrar").fill(String(accountTotal));
  await accountSection.getByLabel("Referencia de pago").fill(paymentReference);
  await accountSection.getByLabel("Nota operativa").fill("Cobro E2E lifecycle");
  const paymentRequest = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/v1\/bookings\/[^/]+\/payments$/.test(response.url()),
  );
  await accountSection.getByRole("button", { name: "Registrar cobro" }).click();
  const paymentResponse = await paymentRequest;
  expect(paymentResponse.status()).toBe(200);
  await expect(accountSection.getByText("Cuenta cobrada", { exact: true })).toBeVisible();
  await expect(accountSection.getByText(formatArgentineCurrency(accountTotal), { exact: true }).first()).toBeVisible();

  await openBookingTab(page, /Operación/);
  await page.getByRole("checkbox", { name: /Cuenta revisada/ }).check();
  await page.getByRole("checkbox", { name: /Habitacion liberada/ }).check();
  await page.getByRole("checkbox", { name: /Handoff a housekeeping/ }).check();
  await page.getByRole("button", { name: "Cuenta cobrada al cierre" }).click();
  await page.getByRole("button", { name: "Confirmar salida y enviar a limpieza" }).click();
  await expect(page.getByRole("button", { name: "Estadía cerrada" })).toBeVisible();
  await openBookingTab(page, /Cuenta/);
  await expect(accountSection.getByText(formatArgentineCurrency(accountTotal), { exact: true }).first()).toBeVisible();

  await page.goto("/housekeeping");
  await page.getByPlaceholder("Buscar habitación, tipo o huésped").fill(roomNumber!);
  await page.getByRole("button", { name: `Ver tarea habitación ${roomNumber}` }).click();

  await expect(page.getByRole("heading", { name: `Habitación ${roomNumber}`, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Acción" }).click();
  await expect(page.getByRole("button", { name: "Iniciar limpieza" })).toBeVisible();
  await expect(page.getByText(/Por limpiar/).first()).toBeVisible();
  await page.getByRole("button", { name: "Iniciar limpieza" }).click();
  await expect(page.getByRole("button", { name: "Finalizar limpieza" })).toBeVisible();
  await expect(page.getByText(/En limpieza/).first()).toBeVisible();
  await page.getByRole("button", { name: "Finalizar limpieza" }).click();
  await expect(page.getByText(/Lista/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Mantenimiento" }).click();
  await expect(page.getByRole("button", { name: "Abrir incidencia" })).toBeVisible();

  expect(relevantConsoleErrors).toEqual([]);
});
