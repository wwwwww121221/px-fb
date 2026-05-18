ALTER TABLE user_course_results
    ADD COLUMN grading_status TINYINT NOT NULL DEFAULT 0 COMMENT '成绩发布状态：0=评阅中，1=已发布' AFTER is_passed;
