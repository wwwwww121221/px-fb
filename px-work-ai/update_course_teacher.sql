-- 为课程表增加负责讲师字段
SET @teacher_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'teacher_id'
);
SET @teacher_id_sql = IF(
  @teacher_id_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `teacher_id` bigint DEFAULT NULL COMMENT ''负责讲师ID'' AFTER `category_id`',
  'SELECT 1'
);
PREPARE stmt_teacher_id FROM @teacher_id_sql;
EXECUTE stmt_teacher_id;
DEALLOCATE PREPARE stmt_teacher_id;
