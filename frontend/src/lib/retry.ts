export type RetryOptions = {
  retries?: number;
  initialDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown) => boolean;
};

type MaybeApiError = {
  status?: number;
  code?: string;
  message?: string;
};

export const isRetryableError = (error: unknown): boolean => {
  const typed = error as MaybeApiError | undefined;
  if (!typed) return true;
  if (typed.code === "INFRA_ERROR") return true;
  if (typeof typed.status === "number" && typed.status >= 500) return true;
  if (typeof typed.status === "number" && typed.status === 429) return true;
  if (typeof typed.message === "string") {
    const normalized = typed.message.toLowerCase();
    if (normalized.includes("network") || normalized.includes("timeout")) return true;
  }
  return false;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const {
    retries = 2,
    initialDelayMs = 250,
    factor = 2,
    shouldRetry = isRetryableError,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      await sleep(delay);
      delay *= factor;
      attempt += 1;
    }
  }
};
