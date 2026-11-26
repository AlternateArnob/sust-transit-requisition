import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const domainDir = fileURLToPath(new URL("../../../src/domain/", import.meta.url));
const files = readdirSync(domainDir).filter((name) => name.endsWith(".ts"));

/** Step 3 contract: domain code is pure. No Express, Knex, database, env or process access. */
describe("src/domain stays pure", () => {
  it("contains the expected modules", () => {
    expect(files.sort()).toEqual(
      [
        "allocationGuards.ts",
        "applicationNumber.ts",
        "mileage.ts",
        "permissions.ts",
        "recommendation.ts",
        "requisitionStatus.ts",
        "schedule.ts",
        "slips.ts",
        "validators.ts",
        "vehicleEligibility.ts",
      ].sort(),
    );
  });

  for (const file of files) {
    describe(file, () => {
      const raw = readFileSync(`${domainDir}${file}`, "utf8");
      // Comments may legitimately mention these things; only real code is checked.
      const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
        (match) => match[1] as string,
      );

      it("does not import Express, Knex, the database, the env config or Node built-ins", () => {
        for (const specifier of imports) {
          expect(specifier, `${file} imports ${specifier}`).not.toMatch(
            /^(express|knex|mysql2|node:|fs|path)|\/db\/|config\/env|config\/logger/,
          );
        }
      });

      it("never touches process.env", () => {
        expect(source).not.toMatch(/process\.env/);
      });

      it("never calls new Date() without an argument (the clock is passed in)", () => {
        expect(source).not.toMatch(/new Date\(\s*\)/);
      });
    });
  }
});
