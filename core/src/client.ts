/** Browser-side call to a module function. Offline writes to queueing modules are replayed by the service worker. */
export async function callFn<T>(module: string, fn: string, input: unknown = {}): Promise<T> {
  const res = await fetch(`/api/fn/${module}/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
  return (await res.json()) as T;
}

export { translator, type Messages, type Translate } from "./i18n";
