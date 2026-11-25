import type { Knex } from "knex";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";

export async function up(knex: Knex): Promise<void> {
  // No permanent_vehicle_id here: the driver<->vehicle link lives ONLY in vehicles.permanent_driver_id.
  await knex.raw(`
    CREATE TABLE drivers (
      id           CHAR(36) PRIMARY KEY,
      name         VARCHAR(150) NOT NULL,
      designation  ENUM('Supervisor Driver','Senior Driver','Driver','Driver (Grade-1)','Driver (Outsourced)') NOT NULL,
      phone        VARCHAR(30) NULL,
      status       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
      created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ${TABLE_OPTIONS}
  `);

  // "Reserved For" was removed from the product: there is intentionally NO reserved_for column.
  await knex.raw(`
    CREATE TABLE vehicles (
      id                        CHAR(36) PRIMARY KEY,
      registration_number       VARCHAR(100) NOT NULL,
      category                  ENUM('Jeep','Car','Mitsubishi Bus','Hino Bus','Tata Bus','Eicher Bus','Minibus','Minibus A/C','Microbus','Pickup') NOT NULL,
      fuel_type                 VARCHAR(50) NULL,
      operational_status        ENUM('Active','Under Maintenance','Out-of-Service') NOT NULL DEFAULT 'Active',
      available_for_requisition TINYINT(1) NOT NULL DEFAULT 1,
      permanent_driver_id       CHAR(36) NULL,
      created_at                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_vehicle_reg (registration_number),
      UNIQUE KEY uq_vehicle_driver (permanent_driver_id),
      CONSTRAINT fk_vehicle_driver FOREIGN KEY (permanent_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE vehicle_off_days (
      id          CHAR(36) PRIMARY KEY,
      vehicle_id  CHAR(36) NOT NULL,
      type        ENUM('One-time','Recurring') NOT NULL,
      off_date    DATE NULL,
      weekday     ENUM('Sun','Mon','Tue','Wed','Thu','Fri','Sat') NULL,
      reason      VARCHAR(255) NULL,
      created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY ix_offday_vehicle (vehicle_id, off_date),
      CONSTRAINT fk_offday_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      CONSTRAINT ck_offday_shape CHECK (
        (type = 'One-time'  AND off_date IS NOT NULL AND weekday IS NULL) OR
        (type = 'Recurring' AND weekday  IS NOT NULL AND off_date IS NULL)
      )
    ) ${TABLE_OPTIONS}
  `);

  // Per vehicle and weekday, the time the vehicle is "free after". No row = free all day.
  await knex.raw(`
    CREATE TABLE student_transport_vehicles (
      id          CHAR(36) PRIMARY KEY,
      vehicle_id  CHAR(36) NOT NULL,
      created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_stv_vehicle (vehicle_id),
      CONSTRAINT fk_stv_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);

  await knex.raw(`
    CREATE TABLE student_transport_slots (
      entry_id    CHAR(36) NOT NULL,
      weekday     ENUM('Sun','Mon','Tue','Wed','Thu','Fri','Sat') NOT NULL,
      free_after  TIME NOT NULL,
      PRIMARY KEY (entry_id, weekday),
      CONSTRAINT fk_sts_entry FOREIGN KEY (entry_id) REFERENCES student_transport_vehicles(id) ON DELETE CASCADE
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP TABLE IF EXISTS student_transport_slots");
  await knex.raw("DROP TABLE IF EXISTS student_transport_vehicles");
  await knex.raw("DROP TABLE IF EXISTS vehicle_off_days");
  await knex.raw("DROP TABLE IF EXISTS vehicles");
  await knex.raw("DROP TABLE IF EXISTS drivers");
}
