import { ApiErrorContract, parseApiErrorMessage } from "@/api/client";

export type ApiClientError = {
  status?: number;
  message: string;
  code?: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

const ERROR_MESSAGES_BY_CODE: Record<string, string> = {
  UNAUTHORIZED: "Tu sesión expiró o no es válida. Iniciá sesión nuevamente.",
  FORBIDDEN: "No tenés permisos para realizar esta acción.",
  INVALID_INPUT: "Revisá los datos ingresados e intentá de nuevo.",
  INFRA_ERROR: "Error interno temporal. Intentá nuevamente en unos minutos.",
  ROOM_NOT_FOUND: "La habitación solicitada no existe.",
  HOTEL_NOT_FOUND: "El hotel solicitado no existe.",
  HOTEL_ALREADY_EXISTS: "Ya existe un hotel con ese nombre.",
  ROOM_ALREADY_EXISTS: "Ya existe una habitación con ese número.",
  GUEST_ALREADY_EXISTS: "Ya existe un huésped con ese email en este hotel.",
  GUEST_NOT_FOUND: "El huésped solicitado no existe.",
  USER_ALREADY_EXISTS: "Ya existe un usuario con ese nombre en este hotel.",
  USER_NOT_FOUND: "El usuario solicitado no existe.",
  INVALID_ROOM_STATUS_TRANSITION: "La transición de estado de habitación no está permitida.",
  ROOM_NOT_AVAILABLE: "La habitación no está disponible para las fechas seleccionadas.",
  INVALID_BOOKING_DATES: "Las fechas de reserva no son válidas.",
  BOOKING_NOT_FOUND: "La reserva solicitada no existe.",
  INVOICE_NOT_FOUND: "La factura solicitada no existe.",
};

export const resolveErrorMessageByCode = (
  errorCode: string | undefined,
  fallbackMessage: string,
): string => {
  if (!errorCode) return fallbackMessage;
  return ERROR_MESSAGES_BY_CODE[errorCode] || fallbackMessage;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const typedError = error as Partial<ApiClientError> & {
    response?: { data?: ApiErrorContract };
  };
  const responsePayload = typedError.response?.data;
  const hasExplicitResponseMessage =
    typeof responsePayload?.message === "string" || typeof responsePayload?.error === "string";
  const responseMessage = hasExplicitResponseMessage
    ? parseApiErrorMessage(responsePayload)
    : "";
  const codeFromPayload =
    typeof responsePayload?.error_code === "string" ? responsePayload.error_code : undefined;
  const code =
    typeof typedError.code === "string" && typedError.code.trim() !== ""
      ? typedError.code
      : codeFromPayload;

  // UX decisions must prioritize stable error_code over free-text message.
  if (code) {
    const fallbackFromPayload =
      responseMessage ||
      (typeof typedError.message === "string" && typedError.message.trim() !== ""
        ? typedError.message
        : fallback);
    return resolveErrorMessageByCode(code, fallbackFromPayload);
  }

  if (typeof typedError.message === "string" && typedError.message.trim() !== "") {
    return typedError.message;
  }

  return responseMessage || fallback;
};
