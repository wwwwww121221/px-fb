SET @stmt = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offline_attendance' AND COLUMN_NAME = 'session_id'
  ),
  'SELECT 1',
  'ALTER TABLE `offline_attendance` ADD COLUMN `session_id` bigint DEFAULT NULL COMMENT ''session id'' AFTER `course_id`'
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offline_attendance' AND COLUMN_NAME = 'sign_method'
  ),
  'SELECT 1',
  'ALTER TABLE `offline_attendance` ADD COLUMN `sign_method` tinyint DEFAULT NULL COMMENT ''sign method 1-qr 2-location 3-passcode'' AFTER `punch_type`'
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offline_attendance' AND COLUMN_NAME = 'latitude'
  ),
  'SELECT 1',
  'ALTER TABLE `offline_attendance` ADD COLUMN `latitude` decimal(10,6) DEFAULT NULL COMMENT ''latitude'' AFTER `location`'
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offline_attendance' AND COLUMN_NAME = 'longitude'
  ),
  'SELECT 1',
  'ALTER TABLE `offline_attendance` ADD COLUMN `longitude` decimal(10,6) DEFAULT NULL COMMENT ''longitude'' AFTER `latitude`'
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @stmt = IF(
  EXISTS(
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offline_attendance' AND COLUMN_NAME = 'updated_at'
  ),
  'SELECT 1',
  'ALTER TABLE `offline_attendance` ADD COLUMN `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`'
);
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `offline_sign_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `course_id` bigint NOT NULL COMMENT 'course id',
  `title` varchar(255) NOT NULL COMMENT 'session title',
  `description` varchar(500) DEFAULT NULL COMMENT 'session description',
  `sign_method` tinyint NOT NULL COMMENT '1-qr 2-location 3-passcode',
  `need_sign_out` tinyint NOT NULL DEFAULT '0' COMMENT 'need sign out',
  `sign_in_start_at` datetime NOT NULL COMMENT 'sign in start time',
  `sign_in_end_at` datetime NOT NULL COMMENT 'sign in end time',
  `sign_out_start_at` datetime DEFAULT NULL COMMENT 'sign out start time',
  `sign_out_end_at` datetime DEFAULT NULL COMMENT 'sign out end time',
  `qr_code` varchar(128) DEFAULT NULL COMMENT 'qr raw code',
  `pass_code` varchar(64) DEFAULT NULL COMMENT 'passcode',
  `location_name` varchar(255) DEFAULT NULL COMMENT 'location name',
  `latitude` decimal(10,6) DEFAULT NULL COMMENT 'latitude',
  `longitude` decimal(10,6) DEFAULT NULL COMMENT 'longitude',
  `radius_meters` int NOT NULL DEFAULT '300' COMMENT 'radius meters',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT 'status',
  `created_by` bigint DEFAULT NULL COMMENT 'creator id',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_course_time` (`course_id`, `sign_in_start_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='offline sign sessions';

CREATE TABLE IF NOT EXISTS `offline_sign_session_departments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` bigint NOT NULL COMMENT 'session id',
  `department_id` bigint NOT NULL COMMENT 'department id',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_department` (`session_id`, `department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='offline sign session departments';
