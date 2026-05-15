-- 1) 课程权重字段（MySQL 5.7 兼容写法）
SET @has_weight_exams = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'weight_exams'
);
SET @sql_add_weight_exams = IF(
  @has_weight_exams = 0,
  'ALTER TABLE `courses` ADD COLUMN `weight_exams` DECIMAL(5,2) NOT NULL DEFAULT ''0.40'' COMMENT ''考试项权重'' AFTER `offline_location`',
  'SELECT 1'
);
PREPARE stmt_add_weight_exams FROM @sql_add_weight_exams;
EXECUTE stmt_add_weight_exams;
DEALLOCATE PREPARE stmt_add_weight_exams;

SET @has_weight_process = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'weight_process'
);
SET @sql_add_weight_process = IF(
  @has_weight_process = 0,
  'ALTER TABLE `courses` ADD COLUMN `weight_process` DECIMAL(5,2) NOT NULL DEFAULT ''0.30'' COMMENT ''过程项权重'' AFTER `weight_exams`',
  'SELECT 1'
);
PREPARE stmt_add_weight_process FROM @sql_add_weight_process;
EXECUTE stmt_add_weight_process;
DEALLOCATE PREPARE stmt_add_weight_process;

SET @has_weight_practical = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'weight_practical'
);
SET @sql_add_weight_practical = IF(
  @has_weight_practical = 0,
  'ALTER TABLE `courses` ADD COLUMN `weight_practical` DECIMAL(5,2) NOT NULL DEFAULT ''0.30'' COMMENT ''实操项权重'' AFTER `weight_process`',
  'SELECT 1'
);
PREPARE stmt_add_weight_practical FROM @sql_add_weight_practical;
EXECUTE stmt_add_weight_practical;
DEALLOCATE PREPARE stmt_add_weight_practical;

-- 2) 课程汇总结果表
CREATE TABLE IF NOT EXISTS `user_course_results` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `course_id` BIGINT NOT NULL,
  `exams_avg_score` DECIMAL(7,2) NOT NULL DEFAULT '0.00' COMMENT '考试项均分',
  `process_score` DECIMAL(7,2) NOT NULL DEFAULT '0.00' COMMENT '过程评价总分',
  `practical_score` DECIMAL(7,2) NOT NULL DEFAULT '0.00' COMMENT '实操总分',
  `total_score` DECIMAL(7,2) NOT NULL DEFAULT '0.00' COMMENT '最终汇总分',
  `is_passed` TINYINT NOT NULL DEFAULT '0' COMMENT '是否通过',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_course` (`user_id`, `course_id`),
  KEY `idx_course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学员课程汇总成绩';

-- 2.1) 课程维度实操评价表
CREATE TABLE IF NOT EXISTS `practical_evaluations` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `course_id` BIGINT NOT NULL,
  `total_score` DECIMAL(7,2) NOT NULL DEFAULT '0.00' COMMENT '百分制实操总分',
  `evaluation_details` JSON NULL COMMENT '实操评价明细JSON',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_course` (`user_id`, `course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='实操评价表';

-- 3) 清理 exams 表废弃权重字段（MySQL 5.7 兼容写法）
SET @has_exam_weight_process = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'weight_process'
);
SET @sql_drop_exam_weight_process = IF(
  @has_exam_weight_process = 1,
  'ALTER TABLE `exams` DROP COLUMN `weight_process`',
  'SELECT 1'
);
PREPARE stmt_drop_exam_weight_process FROM @sql_drop_exam_weight_process;
EXECUTE stmt_drop_exam_weight_process;
DEALLOCATE PREPARE stmt_drop_exam_weight_process;

SET @has_exam_weight_end = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'weight_end'
);
SET @sql_drop_exam_weight_end = IF(
  @has_exam_weight_end = 1,
  'ALTER TABLE `exams` DROP COLUMN `weight_end`',
  'SELECT 1'
);
PREPARE stmt_drop_exam_weight_end FROM @sql_drop_exam_weight_end;
EXECUTE stmt_drop_exam_weight_end;
DEALLOCATE PREPARE stmt_drop_exam_weight_end;

SET @has_exam_weight_practical = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'weight_practical'
);
SET @sql_drop_exam_weight_practical = IF(
  @has_exam_weight_practical = 1,
  'ALTER TABLE `exams` DROP COLUMN `weight_practical`',
  'SELECT 1'
);
PREPARE stmt_drop_exam_weight_practical FROM @sql_drop_exam_weight_practical;
EXECUTE stmt_drop_exam_weight_practical;
DEALLOCATE PREPARE stmt_drop_exam_weight_practical;

-- 4) 清理 exams 表中的冗余合格分字段（MySQL 5.7 兼容写法）
SET @has_exam_pass_process_score = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'pass_process_score'
);
SET @sql_drop_exam_pass_process_score = IF(
  @has_exam_pass_process_score = 1,
  'ALTER TABLE `exams` DROP COLUMN `pass_process_score`',
  'SELECT 1'
);
PREPARE stmt_drop_exam_pass_process_score FROM @sql_drop_exam_pass_process_score;
EXECUTE stmt_drop_exam_pass_process_score;
DEALLOCATE PREPARE stmt_drop_exam_pass_process_score;

SET @has_exam_pass_end_score = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'pass_end_score'
);
SET @sql_drop_exam_pass_end_score = IF(
  @has_exam_pass_end_score = 1,
  'ALTER TABLE `exams` DROP COLUMN `pass_end_score`',
  'SELECT 1'
);
PREPARE stmt_drop_exam_pass_end_score FROM @sql_drop_exam_pass_end_score;
EXECUTE stmt_drop_exam_pass_end_score;
DEALLOCATE PREPARE stmt_drop_exam_pass_end_score;

SET @has_exam_pass_practical_score = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exams' AND COLUMN_NAME = 'pass_practical_score'
);
SET @sql_drop_exam_pass_practical_score = IF(
  @has_exam_pass_practical_score = 1,
  'ALTER TABLE `exams` DROP COLUMN `pass_practical_score`',
  'SELECT 1'
);
PREPARE stmt_drop_exam_pass_practical_score FROM @sql_drop_exam_pass_practical_score;
EXECUTE stmt_drop_exam_pass_practical_score;
DEALLOCATE PREPARE stmt_drop_exam_pass_practical_score;

-- 5) 清理 user_exams 表中的 practical_score 字段（MySQL 5.7 兼容写法）
SET @has_user_exam_practical_score = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_exams' AND COLUMN_NAME = 'practical_score'
);
SET @sql_drop_user_exam_practical_score = IF(
  @has_user_exam_practical_score = 1,
  'ALTER TABLE `user_exams` DROP COLUMN `practical_score`',
  'SELECT 1'
);
PREPARE stmt_drop_user_exam_practical_score FROM @sql_drop_user_exam_practical_score;
EXECUTE stmt_drop_user_exam_practical_score;
DEALLOCATE PREPARE stmt_drop_user_exam_practical_score;
