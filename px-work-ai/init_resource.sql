-- ==========================================
-- 3. 素材资源模块 (Resource Module)
-- ==========================================

-- 3.1 资源分类表 (resource_categories)
CREATE TABLE IF NOT EXISTS `resource_categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `parent_id` bigint NOT NULL DEFAULT '0' COMMENT '父级ID',
  `name` varchar(100) NOT NULL COMMENT '分类名称',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源分类表';

-- 3.2 资源库表 (resources)
CREATE TABLE IF NOT EXISTS `resources` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category_id` bigint NOT NULL DEFAULT '0' COMMENT '分类ID',
  `name` varchar(255) NOT NULL COMMENT '资源名称',
  `type` varchar(255) NOT NULL COMMENT '资源类型(如image, video)',
  `url` varchar(500) NOT NULL COMMENT '资源地址',
  `duration` int DEFAULT '0' COMMENT '时长(秒)',
  `size` bigint DEFAULT '0' COMMENT '文件大小(字节)',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资源库表';
