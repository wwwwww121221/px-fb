-- 1. 创建资源分类表
CREATE TABLE IF NOT EXISTS `resource_categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `parent_id` bigint NOT NULL DEFAULT '0' COMMENT '父级ID',
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源分类表';

-- 2. 修改资源表 (添加 category_id 和 size 字段)
-- 如果您的 resources 表是新建的，可以直接使用 init.sql 中的定义。
-- 如果表已存在，请执行以下 SQL：

SET @category_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resources'
    AND COLUMN_NAME = 'category_id'
);
SET @category_id_sql = IF(
  @category_id_exists = 0,
  'ALTER TABLE `resources` ADD COLUMN `category_id` bigint NOT NULL DEFAULT ''0'' COMMENT ''分类ID'' AFTER `id`',
  'SELECT 1'
);
PREPARE stmt_category_id FROM @category_id_sql;
EXECUTE stmt_category_id;
DEALLOCATE PREPARE stmt_category_id;

SET @size_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'resources'
    AND COLUMN_NAME = 'size'
);
SET @size_sql = IF(
  @size_exists = 0,
  'ALTER TABLE `resources` ADD COLUMN `size` bigint DEFAULT ''0'' COMMENT ''文件大小(字节)'' AFTER `duration`',
  'SELECT 1'
);
PREPARE stmt_size FROM @size_sql;
EXECUTE stmt_size;
DEALLOCATE PREPARE stmt_size;

-- 调整字段长度 (可选)
ALTER TABLE `resources` MODIFY COLUMN `type` varchar(255) NOT NULL COMMENT '资源类型';
ALTER TABLE `resources` MODIFY COLUMN `url` varchar(500) NOT NULL COMMENT '资源地址';
