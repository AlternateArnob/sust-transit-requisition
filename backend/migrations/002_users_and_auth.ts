import type { Knex } from "knex";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";

export async function up(knex: Knex): Promise<void> {
  // email is always stored lower-case and trimmed by the service; the ci collation is a second guard.
  await knex.raw(`
    CREATE TABLE users (
      id                  CHAR(36) PRIMARY KEY,
      email               VARCHAR(255) NOT NULL,
      role                ENUM('Applicant','DepartmentHead','TransportInCharge','TransportAdministrator','SuperAdmin') NOT NULL,
      applicant_profile   ENUM('Teacher','Student','Officer') NULL,
      full_name           VARCHAR(150) NULL,
      mobile              VARCHAR(30)  NULL,
      password_hash       VARCHAR(255) NULL,
      signature_file_id   CHAR(36) NULL,
      student_reg_number  VARCHAR(50)  NULL,
      department          VARCHAR(200) NULL,
      office              VARCHAR(200) NULL,
      designation         VARCHAR(150) NULL,
      head_of_department  VARCHAR(200) NULL,
      head_of_office      VARCHAR(200) NULL,
      is_verified         TINYINT(1) NOT NULL DEFAULT 0,
      is_active           TINYINT(1) NOT NULL DEFAULT 1,
      failed_login_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      locked_until        DATETIME(3) NULL,
      last_login_at       DATETIME(3) NULL,
      created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_users_email (email),
      KEY ix_users_role (role),
      KEY ix_users_head_dept (head_of_department),
      KEY ix_users_head_office (head_of_office),
      CONSTRAINT fk_users_signature FOREIGN KEY (signature_file_id) REFERENCES files(id) ON DELETE SET NULL
    ) ${TABLE_OPTIONS}
  `);

  // One active challenge per email: a resend replaces the row.
  await knex.raw(`
    CREATE TABLE otp_challenges (
      id           CHAR(36) PRIMARY KEY,
      email        VARCHAR(255) NOT NULL,
      code_hash    VARCHAR(255) NOT NULL,
      purpose      ENUM('registration','resume') NOT NULL DEFAULT 'registration',
      expires_at   DATETIME(3) NOT NULL,
      attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
      last_sent_at DATETIME(3) NOT NULL,
      created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_otp_email (email)
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE refresh_tokens (
      id          CHAR(36) PRIMARY KEY,
      user_id     CHAR(36) NOT NULL,
      family_id   CHAR(36) NOT NULL,
      token_hash  CHAR(64) NOT NULL,
      expires_at  DATETIME(3) NOT NULL,
      revoked_at  DATETIME(3) NULL,
      replaced_by CHAR(36) NULL,
      user_agent  VARCHAR(255) NULL,
      ip          VARCHAR(45)  NULL,
      created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_rt_hash (token_hash),
      KEY ix_rt_user (user_id),
      KEY ix_rt_family (family_id),
      CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TABLE IF EXISTS refresh_tokens");
  await knex.raw("DROP TABLE IF EXISTS otp_challenges");
  await knex.raw("DROP TABLE IF EXISTS users");
}
