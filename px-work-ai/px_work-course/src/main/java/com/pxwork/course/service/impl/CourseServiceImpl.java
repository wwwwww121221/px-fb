package com.pxwork.course.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.CourseAssignment;
import com.pxwork.course.entity.CourseChapter;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.entity.CourseResource;
import com.pxwork.course.entity.Exam;
import com.pxwork.course.entity.Question;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.mapper.CourseMapper;
import com.pxwork.course.mapper.CourseResourceMapper;
import com.pxwork.course.service.CourseAssignmentService;
import com.pxwork.course.service.CourseChapterService;
import com.pxwork.course.service.CourseHourService;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.ExamService;
import com.pxwork.course.service.QuestionService;
import com.pxwork.course.service.UserCourseEnrollmentService;

@Service
public class CourseServiceImpl extends ServiceImpl<CourseMapper, Course> implements CourseService {

    @Autowired
    private CourseChapterService courseChapterService;

    @Autowired
    private CourseHourService courseHourService;

    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;

    @Autowired
    private ExamService examService;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private CourseResourceMapper courseResourceMapper;

    @Autowired
    private CourseAssignmentService courseAssignmentService;

    @Override
    public Course getCourseDetails(Long courseId) {
        Course course = getById(courseId);
        if (course == null) {
            return null;
        }

        // 获取章节
        LambdaQueryWrapper<CourseChapter> chapterQueryWrapper = new LambdaQueryWrapper<>();
        chapterQueryWrapper.eq(CourseChapter::getCourseId, courseId);
        chapterQueryWrapper.orderByAsc(CourseChapter::getSort);
        List<CourseChapter> chapters = courseChapterService.list(chapterQueryWrapper);

        if (chapters != null && !chapters.isEmpty()) {
            List<Long> chapterIds = chapters.stream().map(CourseChapter::getId).collect(Collectors.toList());
            
            // 获取所有相关课时
            LambdaQueryWrapper<CourseHour> hourQueryWrapper = new LambdaQueryWrapper<>();
            hourQueryWrapper.in(CourseHour::getChapterId, chapterIds);
            hourQueryWrapper.orderByAsc(CourseHour::getSort);
            List<CourseHour> allHours = courseHourService.list(hourQueryWrapper);

            // 分组
            Map<Long, List<CourseHour>> hoursMap = allHours.stream()
                    .collect(Collectors.groupingBy(CourseHour::getChapterId));

            // 组装
            for (CourseChapter chapter : chapters) {
                chapter.setHours(hoursMap.getOrDefault(chapter.getId(), new ArrayList<>()));
            }
        }

        course.setChapters(chapters);
        return course;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean removeCourseWithRelations(Long courseId) {
        // 获取所有章节
        LambdaQueryWrapper<CourseChapter> chapterQueryWrapper = new LambdaQueryWrapper<>();
        chapterQueryWrapper.eq(CourseChapter::getCourseId, courseId);
        List<CourseChapter> chapters = courseChapterService.list(chapterQueryWrapper);

        if (chapters != null && !chapters.isEmpty()) {
            for (CourseChapter chapter : chapters) {
                // 调用级联删除章节的方法
                courseChapterService.removeChapterWithHours(chapter.getId());
            }
        }

        // 1. 清理学员选课记录
        userCourseEnrollmentService.remove(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getCourseId, courseId));

        // 2. 清理该课程下的考试记录
        examService.remove(new LambdaQueryWrapper<Exam>()
                .eq(Exam::getCourseId, courseId));

        // 3. 保留题库资产：将该课程专属的题目解绑，归还到 course_id = 0 的公共题库中
        Question updateQuestion = new Question();
        updateQuestion.setCourseId(0L);
        questionService.update(updateQuestion, new LambdaQueryWrapper<Question>()
                .eq(Question::getCourseId, courseId));

        // 4. 清理课程关联的素材资料（只是解绑，不删物理文件）
        courseResourceMapper.delete(new LambdaQueryWrapper<CourseResource>()
                .eq(CourseResource::getCourseId, courseId));

        // 5. 清理课程作业配置
        courseAssignmentService.remove(new LambdaQueryWrapper<CourseAssignment>()
                .eq(CourseAssignment::getCourseId, courseId));

        // 删除课程本身
        return removeById(courseId);
    }

    @Override
    public List<Course> getPublishedCourses() {
        return list(new LambdaQueryWrapper<Course>()
                .eq(Course::getStatus, 1) // 1: 已发布
                .orderByDesc(Course::getCreatedAt));
    }
}
