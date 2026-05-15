-- 防止同一学员对同一张证书发起并发重复的邮寄申请
SET @certificate_requests_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'certificate_requests'
);
SET @uk_user_cert_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'certificate_requests'
    AND INDEX_NAME = 'uk_user_cert'
);
SET @uk_user_cert_sql = IF(
  @certificate_requests_table_exists = 1 AND @uk_user_cert_exists = 0,
  'ALTER TABLE `certificate_requests` ADD UNIQUE KEY `uk_user_cert` (`user_id`, `certificate_id`)',
  'SELECT 1'
);
PREPARE stmt_uk_user_cert FROM @uk_user_cert_sql;
EXECUTE stmt_uk_user_cert;
DEALLOCATE PREPARE stmt_uk_user_cert;
