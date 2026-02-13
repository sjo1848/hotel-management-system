import client from "@/api/client";

export const apiGet = async <T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> => {
  const response = await client.get(path, { params });
  return response.data as T;
};

export const apiPost = async <TRequest, TResponse>(
  path: string,
  payload: TRequest,
): Promise<TResponse> => {
  const response = await client.post(path, payload);
  return response.data as TResponse;
};

export const apiPatch = async <TRequest, TResponse>(
  path: string,
  payload: TRequest,
): Promise<TResponse> => {
  const response = await client.patch(path, payload);
  return response.data as TResponse;
};

export const apiDelete = async <TResponse>(path: string): Promise<TResponse> => {
  const response = await client.delete(path);
  return response.data as TResponse;
};
