SET @course_categories_industry_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_categories'
    AND COLUMN_NAME = 'industry'
);
SET @course_categories_industry_sql = IF(
  @course_categories_industry_exists = 0,
  'ALTER TABLE `course_categories` ADD COLUMN `industry` varchar(100) DEFAULT NULL COMMENT ''所属行业(关联字典表value)''',
  'SELECT 1'
);
PREPARE stmt_course_categories_industry FROM @course_categories_industry_sql;
EXECUTE stmt_course_categories_industry;
DEALLOCATE PREPARE stmt_course_categories_industry;

SET @courses_credit_hours_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'credit_hours'
);
SET @courses_credit_hours_sql = IF(
  @courses_credit_hours_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `credit_hours` decimal(5,1) DEFAULT ''0.0'' COMMENT ''课程学时''',
  'SELECT 1'
);
PREPARE stmt_courses_credit_hours FROM @courses_credit_hours_sql;
EXECUTE stmt_courses_credit_hours;
DEALLOCATE PREPARE stmt_courses_credit_hours;

SET @courses_target_roles_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'target_roles'
);
SET @courses_target_roles_sql = IF(
  @courses_target_roles_exists = 0,
  'ALTER TABLE `courses` ADD COLUMN `target_roles` varchar(255) DEFAULT NULL COMMENT ''适用岗位(多个岗位用逗号分隔，关联字典表value)''',
  'SELECT 1'
);
PREPARE stmt_courses_target_roles FROM @courses_target_roles_sql;
EXECUTE stmt_courses_target_roles;
DEALLOCATE PREPARE stmt_courses_target_roles;

ALTER TABLE `course_hours`
MODIFY COLUMN `type` tinyint NOT NULL DEFAULT '1' COMMENT '类型: 1-视频, 2-图文, 3-文档附件';
