import type { Knex } from "knex";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";

export async function up(knex: Knex): Promise<void> {
  // Atomic application-number sequence (Part 1 §10.4).
  await knex.raw(`
    CREATE TABLE requisition_counters (
      year         SMALLINT UNSIGNED PRIMARY KEY,
      last_number  INT UNSIGNED NOT NULL
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE requisitions (
      id                          VARCHAR(16) PRIMARY KEY,
      requester_id                CHAR(36) NOT NULL,
      requester_name              VARCHAR(150) NOT NULL,
      applicant_profile           ENUM('Teacher','Student','Officer') NULL,
      department                  VARCHAR(200) NULL,
      contact_number              VARCHAR(30) NULL,
      requisition_type            ENUM('Personal','Departmental/Official','Club') NOT NULL,
      purpose                     TEXT NOT NULL,
      start_date                  DATE NULL,
      end_date                    DATE NULL,
      schedule_type               ENUM('Single') NOT NULL DEFAULT 'Single',
      status                      ENUM('Draft','Pending Recommendation','Information Requested','Recommended',
                                       'Pending on Transport Office','Pending Administrator','Partially Approved',
                                       'Approved','Completed','Ready for Accounts','Rejected') NOT NULL,
      recommender_id              CHAR(36) NULL,
      recommender_name            VARCHAR(150) NULL,
      recommender_message         TEXT NULL,
      recommended_at              DATETIME(3) NULL,
      transport_office_remarks    TEXT NULL,
      send_back_note              TEXT NULL,
      sent_back_by                VARCHAR(150) NULL,
      sent_back_at                DATETIME(3) NULL,
      resubmitted_at              DATETIME(3) NULL,
      supporting_document_file_id CHAR(36) NULL,
      created_at                  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at                  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY ix_req_requester (requester_id, created_at),
      KEY ix_req_status (status, created_at),
      KEY ix_req_dept_status (department, status),
      KEY ix_req_recommender (recommender_id),
      CONSTRAINT fk_req_requester   FOREIGN KEY (requester_id)   REFERENCES users(id),
      CONSTRAINT fk_req_recommender FOREIGN KEY (recommender_id) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_req_doc         FOREIGN KEY (supporting_document_file_id) REFERENCES files(id) ON DELETE SET NULL
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE trips (
      id                 CHAR(36) PRIMARY KEY,
      requisition_id     VARCHAR(16) NOT NULL,
      position           SMALLINT UNSIGNED NOT NULL,
      trip_date          DATE NOT NULL,
      start_time         TIME NOT NULL,
      end_time           TIME NOT NULL,
      vehicle_category   ENUM('Jeep','Car','Mitsubishi Bus','Hino Bus','Tata Bus','Eicher Bus','Minibus','Minibus A/C','Microbus','Pickup','Any') NOT NULL DEFAULT 'Any',
      route              VARCHAR(600) NOT NULL,
      stoppage_sequence  JSON NOT NULL,
      passenger_groups   JSON NOT NULL,
      status             ENUM('Pending','Approved','Rejected','Completed') NOT NULL DEFAULT 'Pending',
      rejection_reason   ENUM('Vehicle unavailable','Driver unavailable','Schedule conflict','Other') NULL,
      rejection_remarks  TEXT NULL,
      created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY ix_trip_req (requisition_id, position),
      KEY ix_trip_date (trip_date),
      CONSTRAINT fk_trip_req FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
      CONSTRAINT ck_trip_times CHECK (end_time >= start_time)
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TABLE IF EXISTS trips");
  await knex.raw("DROP TABLE IF EXISTS requisitions");
  await knex.raw("DROP TABLE IF EXISTS requisition_counters");
}
