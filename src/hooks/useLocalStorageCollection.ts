import { useEffect, useState } from "react";

export default function useLocalStorageCollection<T extends { id: string }>(
  storageKey: string,
) {
  const [items, setItems] = useState<T[]>(() => {
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Failed to parse localStorage key "${storageKey}"`, error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (error) {
      console.error(`Failed to write localStorage key "${storageKey}"`, error);
    }
  }, [items, storageKey]);

  function add(item: T) {
    setItems((current) => [...current, item]);
  }

  function update(updated: T) {
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return { items, setItems, add, update, remove };
}
