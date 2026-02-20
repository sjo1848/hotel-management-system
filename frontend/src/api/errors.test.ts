import { describe, expect, it } from "vitest";
import { getErrorMessage, resolveErrorMessageByCode } from "./errors";

describe("api error parser", () => {
  it("prioritizes stable error_code over free-text message", () => {
    const message = getErrorMessage(
      {
        message: "mensaje legacy no contractual",
        code: "FORBIDDEN",
      },
      "fallback",
    );

    expect(message).toBe("No tenés permisos para realizar esta acción.");
  });

  it("resolves code from response payload when top-level code is absent", () => {
    const message = getErrorMessage(
      {
        response: {
          data: {
            error_code: "BOOKING_NOT_FOUND",
            message: "legacy not found message",
          },
        },
      },
      "fallback",
    );

    expect(message).toBe("La reserva solicitada no existe.");
  });

  it("falls back to response message for unknown error_code", () => {
    const message = getErrorMessage(
      {
        response: {
          data: {
            error_code: "UNKNOWN_CODE",
            message: "mensaje desde backend",
          },
        },
      },
      "fallback",
    );

    expect(message).toBe("mensaje desde backend");
  });

  it("uses default fallback when there is no useful payload", () => {
    expect(getErrorMessage({}, "fallback general")).toBe("fallback general");
  });

  it("resolveErrorMessageByCode returns fallback for undefined code", () => {
    expect(resolveErrorMessageByCode(undefined, "fallback")).toBe("fallback");
  });
});
