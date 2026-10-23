export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public blockers: string[] = [],
  ) {
    super(message);
  }
}
export const authHeaders = () =>
  sessionStorage.getItem('studio-token')
    ? ({ Authorization: `Bearer ${sessionStorage.getItem('studio-token')}` } as Record<
        string,
        string
      >)
    : {};
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.VITE_STANDALONE === '1')
    return (await import('./standalone')).request<T>(url, options);
  const r = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
  const data = await r.json();
  if (!r.ok)
    throw new ApiError(data.error || 'İşlem tamamlanamadı.', r.status, data.blockers || []);
  return data;
}
export const post = <T>(url: string, body: unknown = {}) =>
  api<T>(url, { method: 'POST', body: JSON.stringify(body) });
export async function download(url: string, name: string) {
  if (import.meta.env.VITE_STANDALONE === '1')
    return (await import('./standalone')).exportProject(url, name);
  const r = await fetch(url, { headers: authHeaders() });
  if (!r.ok) throw new Error('Paket indirilemedi.');
  const blob = await r.blob();
  const src = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = src;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(src), 1000);
}
