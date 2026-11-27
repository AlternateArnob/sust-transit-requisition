import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEPARTMENT_SEEDS, OFFICE_SEEDS } from "../../seeds/data/directory.js";

const frontendFile = fileURLToPath(
  new URL("../../../frontend/src/shared/config/sustDirectory.ts", import.meta.url),
);

/** Quoted strings of one `export const NAME: string[] = [ ... ]` block, in order. */
function readFrontendList(source: string, name: string): string[] {
  const block = new RegExp(`export const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\]\\.sort`).exec(
    source,
  )?.[1];
  if (!block) throw new Error(`Could not find ${name} in the frontend directory file`);
  return [...block.matchAll(/^\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map(
    (match) => JSON.parse(`"${match[1]}"`) as string,
  );
}

describe("directory seed data", () => {
  it("has 27 departments and 15 offices (Part 1 §16.1)", () => {
    expect(DEPARTMENT_SEEDS).toHaveLength(27);
    expect(OFFICE_SEEDS).toHaveLength(15);
  });

  it("has unique names, with no name shared between a department and an office", () => {
    const names = [...DEPARTMENT_SEEDS.map((unit) => unit.name), ...OFFICE_SEEDS];
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);
  });

  it("gives every department a school and has no stray whitespace in any name", () => {
    for (const unit of DEPARTMENT_SEEDS) {
      expect(unit.school.length).toBeGreaterThan(0);
      expect(unit.name).toBe(unit.name.trim());
    }
    for (const office of OFFICE_SEEDS) expect(office).toBe(office.trim());
  });

  // Names are exact-match routing keys, so the seed must never drift from what the frontend shows.
  // The frontend lives in the same repository; the check is skipped if the backend is checked out alone.
  describe.skipIf(!existsSync(frontendFile))("matches the frontend's sustDirectory.ts", () => {
    const source = existsSync(frontendFile) ? readFileSync(frontendFile, "utf8") : "";

    it("has the same departments", () => {
      expect(DEPARTMENT_SEEDS.map((unit) => unit.name).sort()).toEqual(
        readFrontendList(source, "DEPARTMENTS").sort(),
      );
    });

    it("has the same offices", () => {
      expect([...OFFICE_SEEDS].sort()).toEqual(readFrontendList(source, "OFFICES").sort());
    });
  });
});
