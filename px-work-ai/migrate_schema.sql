SET @courses_status_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'status'
);
SET @courses_status_sql = IF(
  @courses_status_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `status` tinyint(1) DEFAULT ''0'' COMMENT ''状态 1:已发布 0:未发布''',
  'SELECT 1'
);
PREPARE stmt_courses_status FROM @courses_status_sql;
EXECUTE stmt_courses_status;
DEALLOCATE PREPARE stmt_courses_status;

SET @courses_title_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'title'
);
SET @courses_title_sql = IF(
  @courses_title_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `title` varchar(255) DEFAULT NULL COMMENT ''课程标题'' AFTER `name`',
  'SELECT 1'
);
PREPARE stmt_courses_title FROM @courses_title_sql;
EXECUTE stmt_courses_title;
DEALLOCATE PREPARE stmt_courses_title;

SET @questions_course_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'course_id'
);
SET @questions_course_id_sql = IF(
  @questions_course_id_exists = 0,
  'ALTER TABLE questions ADD COLUMN course_id bigint DEFAULT NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt_questions_course_id FROM @questions_course_id_sql;
EXECUTE stmt_questions_course_id;
DEALLOCATE PREPARE stmt_questions_course_id;

SET @questions_category_id_default_ok = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'category_id'
    AND (COLUMN_DEFAULT IS NOT NULL OR IS_NULLABLE = 'YES')
);
SET @questions_category_id_sql = IF(
  @questions_category_id_default_ok = 0,
  'ALTER TABLE questions MODIFY COLUMN category_id bigint NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt_questions_category_id FROM @questions_category_id_sql;
EXECUTE stmt_questions_category_id;
DEALLOCATE PREPARE stmt_questions_category_id;
