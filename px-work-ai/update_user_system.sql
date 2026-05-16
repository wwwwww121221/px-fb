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
SET @has_office = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'office'
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
  IF(@has_office = 0, 'ADD COLUMN `office` varchar(100) NOT NULL DEFAULT '''' COMMENT ''科室'' AFTER `enterprise`, ', ''),
  IF(@has_job_role = 0, 'ADD COLUMN `job_role` varchar(100) NOT NULL DEFAULT '''' COMMENT ''岗位(关联字典表value)'' AFTER `office`, ', ''),
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

-- 4) 初始化默认权限菜单（为空时才插入）
INSERT INTO `admin_menus` (`id`, `parent_id`, `name`, `path`, `component`, `perms`, `type`, `sort`)
SELECT * FROM (
  SELECT 1000 AS id, 0 AS parent_id, '系统管理' AS name, NULL AS path, NULL AS component, NULL AS perms, 1 AS type, 10 AS sort
  UNION ALL SELECT 1001, 1000, '查看权限树', NULL, NULL, 'system:menu:list', 3, 11
  UNION ALL SELECT 1002, 1000, '角色列表', NULL, NULL, 'system:role:list', 3, 12
  UNION ALL SELECT 1003, 1000, '新增角色', NULL, NULL, 'system:role:add', 3, 13
  UNION ALL SELECT 1004, 1000, '修改角色', NULL, NULL, 'system:role:update', 3, 14
  UNION ALL SELECT 1005, 1000, '删除角色', NULL, NULL, 'system:role:delete', 3, 15
  UNION ALL SELECT 1006, 1000, '分配角色权限', NULL, NULL, 'system:role:assign', 3, 16
  UNION ALL SELECT 1010, 1000, '管理员列表', NULL, NULL, 'system:admin:list', 3, 20
  UNION ALL SELECT 1011, 1000, '新增管理员', NULL, NULL, 'system:admin:add', 3, 21
  UNION ALL SELECT 1012, 1000, '修改管理员', NULL, NULL, 'system:admin:update', 3, 22
  UNION ALL SELECT 1013, 1000, '删除管理员', NULL, NULL, 'system:admin:delete', 3, 23
  UNION ALL SELECT 2000, 0, '课程管理', NULL, NULL, NULL, 1, 30
  UNION ALL SELECT 2001, 2000, '课程列表', NULL, NULL, 'course:list', 3, 31
  UNION ALL SELECT 2002, 2000, '新增课程', NULL, NULL, 'course:add', 3, 32
  UNION ALL SELECT 2003, 2000, '修改课程', NULL, NULL, 'course:update', 3, 33
  UNION ALL SELECT 2004, 2000, '删除课程', NULL, NULL, 'course:delete', 3, 34
  UNION ALL SELECT 2005, 2000, '查询课程', NULL, NULL, 'course:query', 3, 35
  UNION ALL SELECT 3000, 0, '证书管理', NULL, NULL, NULL, 1, 40
  UNION ALL SELECT 3001, 3000, '证书更新', NULL, NULL, 'certificate:update', 3, 41
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `admin_menus` LIMIT 1);
