import { describe, expect, it } from "vitest";
import {
  decodeImageDataUrl,
  detectFileType,
  isValidStorageName,
  sanitizeOriginalName,
  storedFilePath,
} from "../../src/services/fileStorage.js";
import { pngDataUrl, tinyJpeg, tinyPdf, tinyPng } from "../helpers/files.js";

describe("detectFileType", () => {
  it("recognises a PNG, a JPEG and a PDF by their first bytes", () => {
    expect(detectFileType(tinyPng())).toMatchObject({ kind: "png", mime: "image/png", ext: "png" });
    expect(detectFileType(tinyJpeg())).toMatchObject({
      kind: "jpeg",
      mime: "image/jpeg",
      ext: "jpg",
    });
    expect(detectFileType(tinyPdf())).toMatchObject({
      kind: "pdf",
      mime: "application/pdf",
      ext: "pdf",
    });
  });

  it("rejects text, empty and too-short input", () => {
    expect(detectFileType(Buffer.from("this is not an image"))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
    expect(detectFileType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it("rejects a PNG signature that is not followed by an IHDR chunk", () => {
    const bad = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("not-a-png-chunk-at-all"),
    ]);
    expect(detectFileType(bad)).toBeNull();
  });

  it("rejects look-alikes: SVG, HTML and GIF", () => {
    expect(
      detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
    ).toBeNull();
    expect(detectFileType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectFileType(Buffer.from("GIF89a....."))).toBeNull();
  });

  it("decides by content, not by what the bytes are called", () => {
    // A PDF is a PDF whatever file name or declared type came with it.
    expect(detectFileType(tinyPdf())?.kind).toBe("pdf");
  });
});

describe("decodeImageDataUrl", () => {
  it("decodes a PNG data URL back to the original bytes", () => {
    const png = tinyPng();
    expect(decodeImageDataUrl(pngDataUrl(png))?.equals(png)).toBe(true);
  });

  it("accepts image/jpeg and image/jpg prefixes", () => {
    const jpeg = tinyJpeg();
    const b64 = jpeg.toString("base64");
    expect(decodeImageDataUrl(`data:image/jpeg;base64,${b64}`)?.equals(jpeg)).toBe(true);
    expect(decodeImageDataUrl(`data:image/jpg;base64,${b64}`)?.equals(jpeg)).toBe(true);
  });

  it.each([
    ["no prefix", "iVBORw0KGgo="],
    ["svg", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="],
    ["not base64", "data:image/png;utf8,hello"],
    ["empty payload", "data:image/png;base64,"],
    ["whitespace inside", "data:image/png;base64,iVBO Rw0K"],
    ["newline inside", "data:image/png;base64,iVBO\nRw0K"],
    ["bad length", "data:image/png;base64,iVBOR"],
    ["bad characters", "data:image/png;base64,iVB*Rw0K"],
    ["text file", "data:text/plain;base64,aGVsbG8="],
  ])("returns null for %s", (_name, value) => {
    expect(decodeImageDataUrl(value)).toBeNull();
  });

  it("only checks the shape: the bytes still need detectFileType", () => {
    const text = decodeImageDataUrl(
      `data:image/png;base64,${Buffer.from("hello!!!").toString("base64")}`,
    );
    expect(text).not.toBeNull();
    expect(detectFileType(text as Buffer)).toBeNull();
  });
});

describe("storage names", () => {
  const good = "3f2504e0-4f89-41d3-9a0c-0305e82c3301.png";

  it("accepts a UUID with a known extension only", () => {
    expect(isValidStorageName(good)).toBe(true);
    expect(isValidStorageName(good.replace(".png", ".jpg"))).toBe(true);
    expect(isValidStorageName(good.replace(".png", ".pdf"))).toBe(true);
    expect(isValidStorageName(good.replace(".png", ".exe"))).toBe(false);
    expect(isValidStorageName(good.replace(".png", ""))).toBe(false);
  });

  it.each(["../etc/passwd", "..\\windows\\win.ini", "/etc/passwd", `x/${good}`, `${good}/..`, ""])(
    "refuses to build a path from %j",
    (name) => {
      expect(isValidStorageName(name)).toBe(false);
      expect(() => storedFilePath(name)).toThrow(/Invalid storage name/);
    },
  );

  it("builds a path inside the upload directory", () => {
    expect(storedFilePath(good).startsWith(process.env.UPLOAD_DIR as string)).toBe(true);
  });
});

describe("sanitizeOriginalName", () => {
  it("keeps a normal name", () => {
    expect(sanitizeOriginalName("my signature.png", "x.png")).toBe("my signature.png");
  });

  it("drops any directory part, whichever slash was used", () => {
    expect(sanitizeOriginalName("../../etc/passwd", "x.png")).toBe("passwd");
    expect(sanitizeOriginalName("C:\\Users\\me\\sig.png", "x.png")).toBe("sig.png");
  });

  it("removes control characters", () => {
    expect(sanitizeOriginalName("a\u0000b\nc.png", "x.png")).toBe("abc.png");
  });

  it("falls back when nothing usable is left", () => {
    expect(sanitizeOriginalName(undefined, "signature.png")).toBe("signature.png");
    expect(sanitizeOriginalName("   ", "signature.png")).toBe("signature.png");
    expect(sanitizeOriginalName("dir/", "signature.png")).toBe("signature.png");
  });

  it("never exceeds the 255-character column", () => {
    expect(sanitizeOriginalName(`${"a".repeat(400)}.png`, "x.png")).toHaveLength(255);
  });
});
