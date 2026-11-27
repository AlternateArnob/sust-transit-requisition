import { z } from "zod";

// Part 1 §7.3: `page` (default 1), `pageSize` (default 20, max 100). Query values arrive as strings.
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export const offsetFor = (page: number, pageSize: number): number => (page - 1) * pageSize;

/** Escapes `%`, `_` and `\` so user text matches literally inside `LIKE '%…%'`. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export const toPage = <T>(data: T[], page: number, pageSize: number, total: number): Page<T> => ({
  data,
  meta: { page, pageSize, total },
});
