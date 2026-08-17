export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    const msg =
      body.message || body.error || `Request failed with status ${res.status}`;
    throw new ApiError(res.status, String(msg));
  }
  return res.json() as Promise<T>;
}

export async function fetchList<T>(
  url: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<{ data: T[]; total: number; page: number; pageSize: number }> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const qs = sp.toString();
  const full = qs ? `${url}?${qs}` : url;
  return fetchApi<{ data: T[]; total: number; page: number; pageSize: number }>(
    full,
  );
}

export async function fetchOne<T>(
  url: string,
): Promise<{ data: T }> {
  return fetchApi<{ data: T }>(url);
}

export async function mutate<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  return fetchApi<T>(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
