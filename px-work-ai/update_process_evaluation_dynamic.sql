SET @has_score_progress = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_evaluations' AND COLUMN_NAME = 'score_progress'
);
SET @has_score_prep = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_evaluations' AND COLUMN_NAME = 'score_prep'
);
SET @has_score_interaction = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_evaluations' AND COLUMN_NAME = 'score_interaction'
);
SET @has_score_discussion = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_evaluations' AND COLUMN_NAME = 'score_discussion'
);
SET @has_score_practical = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_evaluations' AND COLUMN_NAME = 'score_practical'
);
SET @has_evaluation_details = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'process_evaluations' AND COLUMN_NAME = 'evaluation_details'
);

SET @sql_drop_score_progress = IF(
  @has_score_progress = 1,
  'ALTER TABLE `process_evaluations` DROP COLUMN `score_progress`',
  'SELECT 1'
);
PREPARE stmt_drop_score_progress FROM @sql_drop_score_progress;
EXECUTE stmt_drop_score_progress;
DEALLOCATE PREPARE stmt_drop_score_progress;

SET @sql_drop_score_prep = IF(
  @has_score_prep = 1,
  'ALTER TABLE `process_evaluations` DROP COLUMN `score_prep`',
  'SELECT 1'
);
PREPARE stmt_drop_score_prep FROM @sql_drop_score_prep;
EXECUTE stmt_drop_score_prep;
DEALLOCATE PREPARE stmt_drop_score_prep;

SET @sql_drop_score_interaction = IF(
  @has_score_interaction = 1,
  'ALTER TABLE `process_evaluations` DROP COLUMN `score_interaction`',
  'SELECT 1'
);
PREPARE stmt_drop_score_interaction FROM @sql_drop_score_interaction;
EXECUTE stmt_drop_score_interaction;
DEALLOCATE PREPARE stmt_drop_score_interaction;

SET @sql_drop_score_discussion = IF(
  @has_score_discussion = 1,
  'ALTER TABLE `process_evaluations` DROP COLUMN `score_discussion`',
  'SELECT 1'
);
PREPARE stmt_drop_score_discussion FROM @sql_drop_score_discussion;
EXECUTE stmt_drop_score_discussion;
DEALLOCATE PREPARE stmt_drop_score_discussion;

SET @sql_drop_score_practical = IF(
  @has_score_practical = 1,
  'ALTER TABLE `process_evaluations` DROP COLUMN `score_practical`',
  'SELECT 1'
);
PREPARE stmt_drop_score_practical FROM @sql_drop_score_practical;
EXECUTE stmt_drop_score_practical;
DEALLOCATE PREPARE stmt_drop_score_practical;

SET @sql_add_evaluation_details = IF(
  @has_evaluation_details = 0,
  'ALTER TABLE `process_evaluations` ADD COLUMN `evaluation_details` JSON NULL COMMENT ''评价明细JSON'' AFTER `course_id`',
  'SELECT 1'
);
PREPARE stmt_add_evaluation_details FROM @sql_add_evaluation_details;
EXECUTE stmt_add_evaluation_details;
DEALLOCATE PREPARE stmt_add_evaluation_details;
