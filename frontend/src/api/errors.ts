import { ApiErrorContract, parseApiErrorMessage } from "@/api/client";

export type ApiClientError = {
  status?: number;
  message: string;
  code?: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const typedError = error as Partial<ApiClientError> & {
    response?: { data?: ApiErrorContract };
  };

  if (typeof typedError.message === "string" && typedError.message.trim() !== "") {
    return typedError.message;
  }

  const responseMessage = parseApiErrorMessage(typedError.response?.data);
  return responseMessage || fallback;
};
