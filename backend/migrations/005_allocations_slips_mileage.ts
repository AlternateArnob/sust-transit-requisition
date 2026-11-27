import type { Knex } from "knex";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE allocations (
      id              CHAR(36) PRIMARY KEY,
      requisition_id  VARCHAR(16) NOT NULL,
      trip_id         CHAR(36) NOT NULL,
      vehicle_id      CHAR(36) NOT NULL,
      driver_id       CHAR(36) NULL,
      alloc_date      DATE NOT NULL,
      start_time      TIME NOT NULL,
      end_time        TIME NOT NULL,
      allocated_by    CHAR(36) NOT NULL,
      allocated_at    DATETIME(3) NOT NULL,
      notes           VARCHAR(500) NULL,
      UNIQUE KEY uq_alloc_trip (trip_id),
      KEY ix_alloc_vehicle_date (vehicle_id, alloc_date, start_time),
      KEY ix_alloc_req (requisition_id),
      CONSTRAINT fk_alloc_req     FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
      CONSTRAINT fk_alloc_trip    FOREIGN KEY (trip_id)        REFERENCES trips(id) ON DELETE CASCADE,
      CONSTRAINT fk_alloc_vehicle FOREIGN KEY (vehicle_id)     REFERENCES vehicles(id) ON DELETE RESTRICT,
      CONSTRAINT fk_alloc_driver  FOREIGN KEY (driver_id)      REFERENCES drivers(id)  ON DELETE SET NULL,
      CONSTRAINT fk_alloc_by      FOREIGN KEY (allocated_by)   REFERENCES users(id)
    ) ${TABLE_OPTIONS}
  `);

  // Append-only history. No foreign keys on purpose: history must survive later deletions.
  await knex.raw(`
    CREATE TABLE allocation_history (
      id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      trip_id         CHAR(36) NOT NULL,
      requisition_id  VARCHAR(16) NOT NULL,
      event           ENUM('assigned','reassigned','removed','released_on_reject','released_on_send_back') NOT NULL,
      vehicle_id      CHAR(36) NULL,
      driver_id       CHAR(36) NULL,
      actor_user_id   CHAR(36) NULL,
      occurred_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY ix_ah_trip (trip_id),
      KEY ix_ah_vehicle (vehicle_id)
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE duty_slips (
      id                 CHAR(36) PRIMARY KEY,
      requisition_id     VARCHAR(16) NOT NULL,
      driver_id          CHAR(36) NULL,
      driver_name        VARCHAR(150) NOT NULL,
      driver_designation VARCHAR(50) NOT NULL,
      generated_by       CHAR(36) NOT NULL,
      generated_at       DATETIME(3) NOT NULL,
      superseded_by_id   CHAR(36) NULL,
      KEY ix_ds_req_driver (requisition_id, driver_id, generated_at),
      CONSTRAINT fk_ds_req FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);

  // Snapshot columns keep old slips readable after a vehicle is edited or deleted.
  await knex.raw(`
    CREATE TABLE duty_slip_trips (
      duty_slip_id                CHAR(36) NOT NULL,
      trip_id                     CHAR(36) NOT NULL,
      vehicle_id                  CHAR(36) NULL,
      vehicle_registration_number VARCHAR(100) NOT NULL,
      vehicle_category            VARCHAR(50) NOT NULL,
      trip_date                   DATE NOT NULL,
      start_time                  TIME NOT NULL,
      end_time                    TIME NOT NULL,
      route                       VARCHAR(600) NOT NULL,
      PRIMARY KEY (duty_slip_id, trip_id),
      CONSTRAINT fk_dst_slip FOREIGN KEY (duty_slip_id) REFERENCES duty_slips(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE confirmation_slips (
      id              CHAR(36) PRIMARY KEY,
      requisition_id  VARCHAR(16) NOT NULL,
      generated_by    CHAR(36) NOT NULL,
      generated_at    DATETIME(3) NOT NULL,
      snapshot        JSON NOT NULL,
      KEY ix_cs_req (requisition_id),
      CONSTRAINT fk_cs_req FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE mileage_entries (
      id              CHAR(36) PRIMARY KEY,
      requisition_id  VARCHAR(16) NOT NULL,
      trip_id         CHAR(36) NOT NULL,
      distance_km     DECIMAL(8,2) NOT NULL,
      recorded_by     CHAR(36) NOT NULL,
      recorded_at     DATETIME(3) NOT NULL,
      UNIQUE KEY uq_mileage_trip (trip_id),
      KEY ix_mileage_req (requisition_id),
      CONSTRAINT fk_mil_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      CONSTRAINT fk_mil_req  FOREIGN KEY (requisition_id) REFERENCES requisitions(id) ON DELETE CASCADE,
      CONSTRAINT ck_mil_pos CHECK (distance_km > 0)
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TABLE IF EXISTS mileage_entries");
  await knex.raw("DROP TABLE IF EXISTS confirmation_slips");
  await knex.raw("DROP TABLE IF EXISTS duty_slip_trips");
  await knex.raw("DROP TABLE IF EXISTS duty_slips");
  await knex.raw("DROP TABLE IF EXISTS allocation_history");
  await knex.raw("DROP TABLE IF EXISTS allocations");
}
