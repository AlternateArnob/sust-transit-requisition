import type { Knex } from "knex";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";

export async function up(knex: Knex): Promise<void> {
  // DEVIATION FROM PART 1 §10.2: the DDL there declares `UNIQUE KEY uq_notif_dedupe (dedupe_key)` but
  // never defines the column, which MySQL rejects. Step 19's notifyUsers() takes an optional
  // `dedupeKey`, so the column is nullable (MySQL allows many NULLs under a unique key).
  await knex.raw(`
    CREATE TABLE notifications (
      id                CHAR(36) PRIMARY KEY,
      recipient_user_id CHAR(36) NOT NULL,
      type              VARCHAR(60) NOT NULL,
      message           VARCHAR(1000) NOT NULL,
      link_type         ENUM('requisition','user') NOT NULL,
      link_id           VARCHAR(64) NOT NULL,
      dedupe_key        VARCHAR(190) NULL,
      is_read           TINYINT(1) NOT NULL DEFAULT 0,
      read_at           DATETIME(3) NULL,
      created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_notif_dedupe (dedupe_key),
      KEY ix_notif_recipient (recipient_user_id, is_read, created_at),
      CONSTRAINT fk_notif_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE audit_logs (
      id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      actor_user_id  CHAR(36) NULL,
      actor_role     VARCHAR(40) NULL,
      action         VARCHAR(80) NOT NULL,
      entity_type    VARCHAR(40) NOT NULL,
      entity_id      VARCHAR(64) NOT NULL,
      before_json    JSON NULL,
      after_json     JSON NULL,
      ip             VARCHAR(45) NULL,
      request_id     VARCHAR(64) NULL,
      created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY ix_audit_entity (entity_type, entity_id, created_at),
      KEY ix_audit_actor (actor_user_id, created_at)
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TABLE IF EXISTS audit_logs");
  await knex.raw("DROP TABLE IF EXISTS notifications");
}
