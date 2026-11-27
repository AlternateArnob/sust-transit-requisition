import type { Knex } from "knex";

// Part 1 §8.2 caps OTP sends at 5 per email per hour, but §10.2 keeps a single, replaced row per
// email, which loses the history needed to count. These two columns carry the count across resends.
// The row is updated in place instead of deleted and re-inserted.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE otp_challenges
      ADD COLUMN send_count TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER last_sent_at,
      ADD COLUMN send_window_started_at DATETIME(3) NULL AFTER send_count
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE otp_challenges
      DROP COLUMN send_window_started_at,
      DROP COLUMN send_count
  `);
}
