import type { Knex } from "knex";
import { v4 as uuid } from "uuid";
import { DEFAULT_SEED_ADMIN_PASSWORD } from "../src/config/constants.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/services/password.js";
import { SEED_ACCOUNTS } from "./data/adminAccounts.js";

/**
 * The three privileged accounts (Part 1 §16.2): verified and active, password from
 * `SEED_ADMIN_PASSWORD`. An account that already exists is left untouched, so re-running the seed
 * never resets a password someone has changed. In production the well-known development password
 * is refused (the first Super Admin is created as described in the deployment runbook).
 */
export async function seed(knex: Knex): Promise<void> {
  if (env.NODE_ENV === "production" && env.SEED_ADMIN_PASSWORD === DEFAULT_SEED_ADMIN_PASSWORD) {
    throw new Error(
      "Refusing to seed admin accounts in production with the default SEED_ADMIN_PASSWORD. " +
        "Set SEED_ADMIN_PASSWORD to a strong secret first.",
    );
  }

  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
  for (const account of SEED_ACCOUNTS) {
    const existing = await knex("users").where({ email: account.email }).first("id");
    if (existing) continue;
    await knex("users").insert({
      id: uuid(),
      email: account.email,
      role: account.role,
      full_name: account.fullName,
      password_hash: passwordHash,
      is_verified: 1,
      is_active: 1,
    });
  }
}
