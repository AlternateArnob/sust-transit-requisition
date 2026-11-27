import { mkdirSync, readdirSync, rmSync } from "node:fs";

/** A real 1x1 PNG. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** A valid 1x1 PNG, optionally followed by `padding` extra bytes (still starts like a PNG). */
export const tinyPng = (padding = 0): Buffer =>
  padding > 0 ? Buffer.concat([PNG_1X1, Buffer.alloc(padding, 0x20)]) : Buffer.from(PNG_1X1);

/** The smallest byte sequence that starts like a JPEG (SOI + APP0 marker) and ends with EOI. */
export const tinyJpeg = (): Buffer =>
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

export const tinyPdf = (): Buffer => Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

export const pngDataUrl = (buffer: Buffer = tinyPng()): string =>
  `data:image/png;base64,${buffer.toString("base64")}`;

const uploadDir = (): string => process.env.UPLOAD_DIR as string;

/** Empties the test upload directory (call in `beforeEach`). */
export function resetUploads(): void {
  rmSync(uploadDir(), { recursive: true, force: true });
  mkdirSync(uploadDir(), { recursive: true });
}

/** Names of the files currently in the test upload directory. */
export const listUploads = (): string[] => readdirSync(uploadDir()).sort();
