SET @courses_training_batch_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'training_batch'
);
SET @courses_training_batch_sql = IF(
  @courses_training_batch_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `training_batch` varchar(100) DEFAULT NULL COMMENT ''培训批次''',
  'SELECT 1'
);
PREPARE stmt_courses_training_batch FROM @courses_training_batch_sql;
EXECUTE stmt_courses_training_batch;
DEALLOCATE PREPARE stmt_courses_training_batch;

SET @courses_course_mode_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'course_mode'
);
SET @courses_course_mode_sql = IF(
  @courses_course_mode_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `course_mode` tinyint DEFAULT 1 COMMENT ''授课模式: 1-线上录播 2-线上直播 3-线下集中''',
  'SELECT 1'
);
PREPARE stmt_courses_course_mode FROM @courses_course_mode_sql;
EXECUTE stmt_courses_course_mode;
DEALLOCATE PREPARE stmt_courses_course_mode;

SET @courses_offline_location_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'offline_location'
);
SET @courses_offline_location_sql = IF(
  @courses_offline_location_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `offline_location` varchar(255) DEFAULT NULL COMMENT ''线下授课地点''',
  'SELECT 1'
);
PREPARE stmt_courses_offline_location FROM @courses_offline_location_sql;
EXECUTE stmt_courses_offline_location;
DEALLOCATE PREPARE stmt_courses_offline_location;

SET @course_hours_live_url_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_hours'
    AND COLUMN_NAME = 'live_url'
);
SET @course_hours_live_url_sql = IF(
  @course_hours_live_url_exists = 0,
  'ALTER TABLE `course_hours` ADD COLUMN `live_url` varchar(500) DEFAULT NULL COMMENT ''直播链接''',
  'SELECT 1'
);
PREPARE stmt_course_hours_live_url FROM @course_hours_live_url_sql;
EXECUTE stmt_course_hours_live_url;
DEALLOCATE PREPARE stmt_course_hours_live_url;

SET @course_hours_playback_url_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_hours'
    AND COLUMN_NAME = 'playback_url'
);
SET @course_hours_playback_url_sql = IF(
  @course_hours_playback_url_exists = 0,
  'ALTER TABLE `course_hours` ADD COLUMN `playback_url` varchar(500) DEFAULT NULL COMMENT ''回放链接''',
  'SELECT 1'
);
PREPARE stmt_course_hours_playback_url FROM @course_hours_playback_url_sql;
EXECUTE stmt_course_hours_playback_url;
DEALLOCATE PREPARE stmt_course_hours_playback_url;

CREATE TABLE IF NOT EXISTS `user_course_enrollments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '学员ID',
  `course_id` bigint NOT NULL COMMENT '课程ID',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '状态 0-学习中 1-已学完',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_course` (`user_id`, `course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='选课表';

CREATE TABLE IF NOT EXISTS `course_assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `course_id` bigint NOT NULL COMMENT '课程ID',
  `title` varchar(255) NOT NULL COMMENT '作业标题',
  `content` text COMMENT '作业内容',
  `attachment_url` varchar(500) DEFAULT NULL COMMENT '附件链接',
  `deadline` datetime DEFAULT NULL COMMENT '截止时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='作业表';

CREATE TABLE IF NOT EXISTS `assignment_submissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `assignment_id` bigint NOT NULL COMMENT '作业ID',
  `user_id` bigint NOT NULL COMMENT '学员ID',
  `content` text COMMENT '提交内容',
  `attachment_url` varchar(500) DEFAULT NULL COMMENT '附件链接',
  `score` decimal(5,2) DEFAULT NULL COMMENT '得分',
  `comment` varchar(500) DEFAULT NULL COMMENT '评语',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '状态 0-待批改 1-已批改',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_assignment_user` (`assignment_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='作业提交表';

CREATE TABLE IF NOT EXISTS `process_evaluations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '学员ID',
  `course_id` bigint NOT NULL COMMENT '课程ID',
  `score_progress` decimal(5,2) DEFAULT '0.00' COMMENT '进度分',
  `score_prep` decimal(5,2) DEFAULT '0.00' COMMENT '预习分',
  `score_interaction` decimal(5,2) DEFAULT '0.00' COMMENT '互动分',
  `score_discussion` decimal(5,2) DEFAULT '0.00' COMMENT '讨论分',
  `score_practical` decimal(5,2) DEFAULT '0.00' COMMENT '实操分',
  `total_score` decimal(5,2) DEFAULT '0.00' COMMENT '总分,满分30',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_course` (`user_id`, `course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='过程评价表';

CREATE TABLE IF NOT EXISTS `offline_attendance` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '学员ID',
  `course_id` bigint NOT NULL COMMENT '课程ID',
  `punch_time` datetime NOT NULL COMMENT '打卡时间',
  `punch_type` tinyint NOT NULL COMMENT '打卡类型 1-早打卡 2-晚打卡',
  `location` varchar(255) DEFAULT NULL COMMENT '打卡地点',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_course` (`user_id`, `course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='线下打卡表';

CREATE TABLE IF NOT EXISTS `live_rooms` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `hour_id` bigint NOT NULL COMMENT '关联课时ID',
  `room_name` varchar(255) NOT NULL COMMENT '直播间名称',
  `room_no` varchar(100) NOT NULL COMMENT '全局唯一房间号',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '状态: 0-未开始, 1-直播中, 2-已结束',
  `start_time` datetime DEFAULT NULL,
  `end_time` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_room_no` (`room_no`),
  KEY `idx_hour_id` (`hour_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='直播间表';
