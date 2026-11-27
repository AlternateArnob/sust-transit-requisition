-- Runs once, the first time the MySQL container initialises its data volume.
-- Creates the integration-test database and lets the application user use it.
CREATE DATABASE IF NOT EXISTS sust_transit_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON sust_transit_test.* TO 'sust_transit'@'%';
FLUSH PRIVILEGES;
