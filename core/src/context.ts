import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type RequestContext = {
  correlationId: string;
  module?: string;
  fn?: string;
  memberId?: string;
};

const als = new AsyncLocalStorage<RequestContext>();

export const currentContext = (): RequestContext | undefined => als.getStore();

export function withContext<T>(patch: Partial<RequestContext>, run: () => T): T {
  const base = als.getStore() ?? { correlationId: randomUUID() };
  return als.run({ ...base, ...patch }, run);
}
