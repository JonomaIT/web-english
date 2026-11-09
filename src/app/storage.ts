import { useCallback, useState } from "react";

// Per-browser conveniences (settings, theme): remembered in localStorage when it works, kept in
// memory when it is blocked.

function read<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : { ...fallback, ...(JSON.parse(saved) as T) };
  } catch {
    return fallback;
  }
}

export function usePersistentState<T extends object>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  const save = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // not remembered, still applied
      }
    },
    [key],
  );
  return [value, save] as const;
}
