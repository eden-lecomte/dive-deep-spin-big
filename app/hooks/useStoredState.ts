import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const STORAGE_EVENT = "wheel-storage";

function readStoredValue<T>(key: string, initialValue: T, storage: Storage) {
  const raw = storage.getItem(key);
  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      storage.removeItem(key);
    }
  }
  return initialValue;
}

function serializeValue<T>(value: T) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function useStoredState<T>(
  key: string,
  initialValue: T,
  storage: Storage | null
) {
  const listenersRef = useRef(new Set<() => void>());
  const valueRef = useRef<T>(initialValue);
  const serializedRef = useRef<string | null>(serializeValue(initialValue));

  const emit = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const updateFromStorage = useCallback(() => {
    if (!storage) return;
    const nextValue = readStoredValue(key, initialValue, storage);
    const nextSerialized = serializeValue(nextValue);
    if (nextSerialized === serializedRef.current) return;
    valueRef.current = nextValue;
    serializedRef.current = nextSerialized;
    emit();
  }, [emit, initialValue, key, storage]);

  const subscribe = useCallback(
    (callback: () => void) => {
      listenersRef.current.add(callback);
      if (!storage) {
        return () => listenersRef.current.delete(callback);
      }

      const handler = (event: Event) => {
        if (event instanceof StorageEvent) {
          if (event.key !== key) return;
          updateFromStorage();
          return;
        }
        const custom = event as CustomEvent<{ key?: string }>;
        if (custom.detail?.key === key) {
          updateFromStorage();
        }
      };

      window.addEventListener("storage", handler);
      window.addEventListener(STORAGE_EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(STORAGE_EVENT, handler);
        listenersRef.current.delete(callback);
      };
    },
    [key, storage, updateFromStorage]
  );

  const getSnapshot = useCallback(() => valueRef.current, []);
  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!storage) return;
    updateFromStorage();
  }, [storage, updateFromStorage]);

  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (!storage) return;
      const nextValue =
        typeof value === "function"
          ? (value as (prev: T) => T)(valueRef.current)
          : value;
      const nextSerialized = serializeValue(nextValue);
      if (nextSerialized === serializedRef.current) return;
      valueRef.current = nextValue;
      serializedRef.current = nextSerialized;
      storage.setItem(key, nextSerialized ?? "null");
      emit();
      window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }));
    },
    [emit, key, storage]
  );

  return [state, setState] as const;
}

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const storage = typeof window === "undefined" ? null : window.localStorage;
  return useStoredState(key, initialValue, storage);
}

export function useSessionStorageState<T>(key: string, initialValue: T) {
  const storage = typeof window === "undefined" ? null : window.sessionStorage;
  return useStoredState(key, initialValue, storage);
}
