-- Convert courses.course_mode to multi-select storage like '1,3'

SET @course_mode_type = (
  SELECT DATA_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'course_mode'
  LIMIT 1
);

SET @alter_course_mode_sql = IF(
  @course_mode_type IS NULL,
  'ALTER TABLE `courses` ADD COLUMN `course_mode` varchar(32) NOT NULL DEFAULT ''1'' COMMENT ''授课方式: 1-线上录播,2-线上直播,3-线下集中授课，可多选逗号分隔''',
  IF(
    @course_mode_type = 'varchar',
    'ALTER TABLE `courses` MODIFY COLUMN `course_mode` varchar(32) NOT NULL DEFAULT ''1'' COMMENT ''授课方式: 1-线上录播,2-线上直播,3-线下集中授课，可多选逗号分隔''',
    'ALTER TABLE `courses` MODIFY COLUMN `course_mode` varchar(32) NOT NULL DEFAULT ''1'' COMMENT ''授课方式: 1-线上录播,2-线上直播,3-线下集中授课，可多选逗号分隔'''
  )
);

PREPARE stmt_alter_course_mode_multi FROM @alter_course_mode_sql;
EXECUTE stmt_alter_course_mode_multi;
DEALLOCATE PREPARE stmt_alter_course_mode_multi;

UPDATE `courses`
SET `course_mode` = '1'
WHERE `course_mode` IS NULL OR TRIM(`course_mode`) = '';
