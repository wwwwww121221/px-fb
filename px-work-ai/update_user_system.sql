-- 用户体系与分类模块改造

-- 1) 新增数据字典表
CREATE TABLE IF NOT EXISTS `sys_dicts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `dict_type` varchar(50) NOT NULL COMMENT '字典类型(如 job_role, industry)',
  `dict_label` varchar(100) NOT NULL COMMENT '展示标签(如 管理人员, 电动工具)',
  `dict_value` varchar(100) NOT NULL COMMENT '实际存储值',
  `sort` int DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统数据字典表';

-- 2) 改造学员表 users
SET @has_uk_email = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_email'
);
SET @sql_drop_uk_email = IF(@has_uk_email > 0, 'ALTER TABLE `users` DROP INDEX `uk_email`', 'SELECT 1');
PREPARE stmt_drop_uk_email FROM @sql_drop_uk_email;
EXECUTE stmt_drop_uk_email;
DEALLOCATE PREPARE stmt_drop_uk_email;

SET @has_id_card = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id_card'
);
SET @has_enterprise = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'enterprise'
);
SET @has_job_role = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'job_role'
);
SET @has_industry = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'industry'
);
SET @has_is_first_login = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_first_login'
);
SET @has_uk_id_card = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_id_card'
);

SET @sql_alter_users = CONCAT(
  'ALTER TABLE `users` ',
  IF(@has_id_card = 0, 'ADD COLUMN `id_card` varchar(18) NOT NULL DEFAULT '''' COMMENT ''身份证号(登录账号)'' AFTER `avatar`, ', ''),
  IF(@has_enterprise = 0, 'ADD COLUMN `enterprise` varchar(100) NOT NULL DEFAULT '''' COMMENT ''所属企业'' AFTER `id_card`, ', ''),
  IF(@has_job_role = 0, 'ADD COLUMN `job_role` varchar(100) NOT NULL DEFAULT '''' COMMENT ''岗位(关联字典表value)'' AFTER `enterprise`, ', ''),
  IF(@has_industry = 0, 'ADD COLUMN `industry` varchar(100) NOT NULL DEFAULT '''' COMMENT ''所属行业(关联字典表value)'' AFTER `job_role`, ', ''),
  IF(@has_is_first_login = 0, 'ADD COLUMN `is_first_login` tinyint(1) DEFAULT 1 COMMENT ''是否首次登录 1:是 0:否'' AFTER `password`, ', ''),
  IF(@has_uk_id_card = 0, 'ADD UNIQUE KEY `uk_id_card` (`id_card`)', ''),
  ';'
);
SET @sql_alter_users = REPLACE(@sql_alter_users, ', ;', ';');
PREPARE stmt_alter_users FROM @sql_alter_users;
EXECUTE stmt_alter_users;
DEALLOCATE PREPARE stmt_alter_users;

-- 3) 新增 RBAC 菜单与角色菜单关联
CREATE TABLE IF NOT EXISTS `admin_menus` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `parent_id` bigint NOT NULL DEFAULT '0' COMMENT '父级ID',
  `name` varchar(100) NOT NULL COMMENT '菜单名称',
  `path` varchar(200) DEFAULT NULL COMMENT '路由路径',
  `component` varchar(200) DEFAULT NULL COMMENT '组件路径',
  `perms` varchar(200) DEFAULT NULL COMMENT '权限标识',
  `type` tinyint NOT NULL COMMENT '类型:1目录 2菜单 3按钮',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='后台菜单权限表';

CREATE TABLE IF NOT EXISTS `admin_role_menu` (
  `role_id` bigint NOT NULL COMMENT '角色ID',
  `menu_id` bigint NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (`role_id`, `menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色菜单关联表';
