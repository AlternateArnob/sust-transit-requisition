import type { Knex } from "knex";
import { DEPARTMENT_SEEDS, OFFICE_SEEDS } from "./data/directory.js";

/**
 * Departments and offices (Part 1 §16.1). Safe to run repeatedly: an existing name is updated in
 * place, and `is_active` is left alone so a unit someone switched off stays off.
 */
export async function seed(knex: Knex): Promise<void> {
  const rows = [
    ...DEPARTMENT_SEEDS.map((unit) => ({
      kind: "Department",
      name: unit.name,
      school: unit.school,
    })),
    ...OFFICE_SEEDS.map((name) => ({ kind: "Office", name, school: null })),
  ];
  await knex("directory_units").insert(rows).onConflict("name").merge(["kind", "school"]);
}
