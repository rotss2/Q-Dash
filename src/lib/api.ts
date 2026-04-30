export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  let body: any = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch (error) {
    return { error: 'Invalid server response' };
  }

  if (!response.ok) {
    return { error: body?.error || body?.message || 'Request failed' };
  }

  return { data: body as T };
}

export const apiGet = <T>(path: string) => apiFetch<T>(path, { method: 'GET' });
export const apiPost = <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });
