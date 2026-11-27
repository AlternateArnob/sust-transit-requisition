import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v4 as uuid } from "uuid";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

// Where uploaded files live on disk and how their type is decided (Part 1 §14). Files sit in
// `UPLOAD_DIR`, outside any public directory, under a random server-made name; the original name
// only ever exists as a database column.

export type FileKind = "png" | "jpeg" | "pdf";

export interface DetectedFile {
  kind: FileKind;
  mime: string;
  /** Extension used for the stored file name. */
  ext: string;
}

const KINDS: Readonly<Record<FileKind, DetectedFile>> = {
  png: { kind: "png", mime: "image/png", ext: "png" },
  jpeg: { kind: "jpeg", mime: "image/jpeg", ext: "jpg" },
  pdf: { kind: "pdf", mime: "application/pdf", ext: "pdf" },
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PDF_SIGNATURE = Buffer.from("%PDF-", "latin1");

/**
 * Decides the file type from its first bytes ("magic bytes"), never from the file name or the
 * `Content-Type` the client claims (Part 1 §8.5, §14). Returns `null` for anything else.
 */
export function detectFileType(buffer: Buffer): DetectedFile | null {
  if (buffer.length >= 16 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    // A real PNG starts with an IHDR chunk straight after the signature.
    if (buffer.subarray(12, 16).toString("latin1") === "IHDR") return KINDS.png;
    return null;
  }
  if (buffer.length >= 4 && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) return KINDS.jpeg;
  if (buffer.length >= 5 && buffer.subarray(0, 5).equals(PDF_SIGNATURE)) return KINDS.pdf;
  return null;
}

/** Absolute upload directory (`UPLOAD_DIR` is resolved against the working directory). */
export const uploadRoot = (): string => path.resolve(env.UPLOAD_DIR);

/** UUID + a known extension: the only shape `storedFilePath` accepts, so no name can escape the directory. */
const STORAGE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|pdf)$/;

export const isValidStorageName = (storageName: string): boolean => STORAGE_NAME.test(storageName);

export function storedFilePath(storageName: string): string {
  if (!isValidStorageName(storageName)) throw new Error(`Invalid storage name: ${storageName}`);
  return path.join(uploadRoot(), storageName);
}

export interface WrittenFile {
  storageName: string;
  sha256: string;
  sizeBytes: number;
}

/** Writes already-validated bytes to a new randomly named file (never overwrites, owner-only). */
export async function writeStoredFile(
  buffer: Buffer,
  detected: DetectedFile,
): Promise<WrittenFile> {
  const storageName = `${uuid()}.${detected.ext}`;
  await mkdir(uploadRoot(), { recursive: true });
  await writeFile(storedFilePath(storageName), buffer, { flag: "wx", mode: 0o600 });
  return {
    storageName,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    sizeBytes: buffer.length,
  };
}

/** Removes a stored file. A file that is already gone is fine; other failures are logged, never thrown. */
export async function deleteStoredFile(storageName: string): Promise<void> {
  try {
    await unlink(storedFilePath(storageName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    logger.error({ err: error, storageName }, "Could not delete stored file");
  }
}

/**
 * A safe value for `files.original_name` (VARCHAR(255)): no path, no control characters, never
 * empty. It is only ever displayed or offered as a download name.
 */
export function sanitizeOriginalName(name: string | undefined, fallback: string): string {
  const base = (name ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const result = cleaned.length > 0 ? cleaned : fallback;
  return result.length > 255 ? result.slice(result.length - 255) : result;
}

/** `data:image/png;base64,...` as the browser's FileReader produces it (no whitespace). */
const IMAGE_DATA_URL =
  /^data:image\/(?:png|jpe?g);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/i;

/**
 * Decodes a PNG/JPEG data URL (the transitional way to send a signature, Part 1 §14) into bytes,
 * or returns `null` when it is not strictly well-formed. The declared type is not trusted: the
 * caller still runs `detectFileType` on the result.
 */
export function decodeImageDataUrl(dataUrl: string): Buffer | null {
  const match = IMAGE_DATA_URL.exec(dataUrl);
  const payload = match?.[1];
  if (!payload) return null; // not a data URL, or nothing after the comma
  return Buffer.from(payload, "base64");
}
