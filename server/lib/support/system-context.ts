import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<{ system: true }>();

export const runAsSystem = <T>(fn: () => Promise<T>): Promise<T> => storage.run({ system: true }, fn);

export const isSystemContext = (): boolean => storage.getStore()?.system === true;
