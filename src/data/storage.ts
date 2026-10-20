export function getStorageItem<T>(key: string, defaultValue: T): T {
  const storedValue = localStorage.getItem(key);

  if (!storedValue) {
    return defaultValue;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}
