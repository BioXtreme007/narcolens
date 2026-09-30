import type { DocKey } from '@/lib/ocr';

export type CasePatch = Partial<Record<DocKey, string>>;

type Listener = (patch: CasePatch) => void;

const listeners = new Set<Listener>();
let queued: CasePatch | null = null;

export function publishCase(patch: CasePatch) {
  queued = patch;
  listeners.forEach((listener) => listener(patch));
}

export function subscribeCase(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function takeQueuedCase() {
  const patch = queued;
  queued = null;
  return patch;
}
