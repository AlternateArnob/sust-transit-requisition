import type { Knex } from "knex";

// Part 1 §10.2 — reference data and files. `files` is created before `users` because
// users.signature_file_id references it. Migrations are self-contained on purpose: they must
// never change meaning if config/constants.ts changes later (tests guard against drift).
const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE directory_units (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      kind        ENUM('Department','Office') NOT NULL,
      name        VARCHAR(200) NOT NULL,
      school      VARCHAR(200) NULL,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY uq_directory_name (name)
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE files (
      id             CHAR(36) PRIMARY KEY,
      owner_user_id  CHAR(36) NOT NULL,
      purpose        ENUM('signature','supporting_document') NOT NULL,
      original_name  VARCHAR(255) NOT NULL,
      mime_type      VARCHAR(100) NOT NULL,
      size_bytes     INT UNSIGNED NOT NULL,
      storage_name   VARCHAR(100) NOT NULL,
      sha256         CHAR(64) NOT NULL,
      created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY ix_files_owner (owner_user_id)
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TABLE IF EXISTS files");
  await knex.raw("DROP TABLE IF EXISTS directory_units");
}
