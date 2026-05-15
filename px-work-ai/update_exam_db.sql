INSERT INTO `sys_dicts` (`dict_type`, `dict_label`, `dict_value`, `sort`, `created_at`, `updated_at`)
SELECT 'question_type', '单选题', 'single_choice', 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_dicts` WHERE `dict_type` = 'question_type' AND `dict_value` = 'single_choice'
);

INSERT INTO `sys_dicts` (`dict_type`, `dict_label`, `dict_value`, `sort`, `created_at`, `updated_at`)
SELECT 'question_type', '简答题', 'short_answer', 2, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_dicts` WHERE `dict_type` = 'question_type' AND `dict_value` = 'short_answer'
);

INSERT INTO `sys_dicts` (`dict_type`, `dict_label`, `dict_value`, `sort`, `created_at`, `updated_at`)
SELECT 'question_type', '案例分析题', 'case_analysis', 3, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_dicts` WHERE `dict_type` = 'question_type' AND `dict_value` = 'case_analysis'
);

INSERT INTO `sys_dicts` (`dict_type`, `dict_label`, `dict_value`, `sort`, `created_at`, `updated_at`)
SELECT 'question_type', '实操应用题', 'practical_application', 4, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `sys_dicts` WHERE `dict_type` = 'question_type' AND `dict_value` = 'practical_application'
);

CREATE TABLE IF NOT EXISTS `question_categories` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `parent_id` bigint NOT NULL DEFAULT '0',
  `name` varchar(100) NOT NULL,
  `sort` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `questions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `course_id` bigint DEFAULT NULL,
  `category_id` bigint NOT NULL DEFAULT '0',
  `question_type` varchar(100) NOT NULL,
  `content` text NOT NULL,
  `options` json DEFAULT NULL,
  `standard_answer` text,
  `analysis` text,
  `industry_tag` varchar(100) DEFAULT NULL,
  `job_role_tag` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_question_type` (`question_type`),
  KEY `idx_industry_tag` (`industry_tag`),
  KEY `idx_job_role_tag` (`job_role_tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exams` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `course_id` bigint NOT NULL,
  `title` varchar(255) NOT NULL,
  `duration` int NOT NULL DEFAULT '60',
  `weight_process` decimal(5,2) NOT NULL DEFAULT '0.30',
  `weight_end` decimal(5,2) NOT NULL DEFAULT '0.70',
  `weight_practical` decimal(5,2) NOT NULL DEFAULT '0.00',
  `pass_total_score` decimal(5,2) NOT NULL DEFAULT '60.00',
  `pass_process_score` decimal(5,2) NOT NULL DEFAULT '21.00',
  `pass_end_score` decimal(5,2) NOT NULL DEFAULT '42.00',
  `pass_practical_score` decimal(5,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `exam_questions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exam_id` bigint NOT NULL,
  `question_id` bigint NOT NULL,
  `score` decimal(7,2) NOT NULL DEFAULT '0.00',
  `sort` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exam_question` (`exam_id`, `question_id`),
  KEY `idx_question_id` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_exams` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `course_id` bigint NOT NULL,
  `exam_id` bigint NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `start_time` datetime DEFAULT NULL,
  `submit_time` datetime DEFAULT NULL,
  `objective_score` decimal(7,2) DEFAULT '0.00',
  `subjective_score` decimal(7,2) DEFAULT '0.00',
  `practical_score` decimal(7,2) DEFAULT '0.00',
  `final_score` decimal(7,2) DEFAULT '0.00',
  `is_passed` tinyint NOT NULL DEFAULT '0',
  `make_up_count` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_user_exam` (`user_id`, `exam_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_exam_answers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_exam_id` bigint NOT NULL,
  `question_id` bigint NOT NULL,
  `user_answer` text,
  `is_correct` tinyint DEFAULT NULL,
  `score` decimal(7,2) DEFAULT '0.00',
  `ai_comment` text,
  `teacher_comment` text,
  PRIMARY KEY (`id`),
  KEY `idx_user_exam_id` (`user_exam_id`),
  KEY `idx_question_id` (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `course_id` bigint NOT NULL,
  `cert_no` varchar(100) NOT NULL,
  `issue_date` date DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cert_no` (`cert_no`),
  KEY `idx_user_course` (`user_id`, `course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificate_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `certificate_id` bigint NOT NULL,
  `receiver_name` varchar(100) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `address` varchar(500) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_certificate_id` (`certificate_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
