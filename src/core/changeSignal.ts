/** A minimal "something changed" signal for modules that hold state outside Svelte. */
export interface ChangeSignal {
  /** Call `listener` on every change; returns a function that stops listening. */
  subscribe(listener: () => void): () => void;
  notify(): void;
}

export function createChangeSignal(): ChangeSignal {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) listener();
    },
  };
}
