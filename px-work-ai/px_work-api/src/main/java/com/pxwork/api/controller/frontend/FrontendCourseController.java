package com.pxwork.api.controller.frontend;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.Certificate;
import com.pxwork.course.entity.Course;
import com.pxwork.course.entity.CourseChapter;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.entity.CourseResource;
import com.pxwork.course.entity.Exam;
import com.pxwork.course.entity.UserCourseEnrollment;
import com.pxwork.course.entity.UserCourseResult;
import com.pxwork.course.service.CertificateService;
import com.pxwork.course.service.CourseChapterService;
import com.pxwork.course.service.CourseHourService;
import com.pxwork.course.service.CourseResourceService;
import com.pxwork.course.service.CourseService;
import com.pxwork.course.service.ExamService;
import com.pxwork.course.service.UserCourseEnrollmentService;
import com.pxwork.course.service.UserCourseResultService;
import com.pxwork.resource.entity.Resource;
import com.pxwork.resource.service.ResourceService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;

@Tag(name = "4.2 前台-选课与课程大厅")
@RestController
@RequestMapping("/frontend/course")
public class FrontendCourseController {

    @Autowired
    private CourseService courseService;

    @Autowired
    private UserCourseEnrollmentService userCourseEnrollmentService;

    @Autowired
    private CourseChapterService courseChapterService;
    
    @Autowired
    private CourseHourService courseHourService;
    
    @Autowired
    private CourseResourceService courseResourceService;
    
    @Autowired
    private ExamService examService;

    @Autowired
    private UserCourseResultService userCourseResultService;

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private ResourceService resourceService;

    @Operation(summary = "获取已发布课程列表", description = "获取所有已发布且对学员可见的课程列表")
    @GetMapping("/list")
    public Result<List<Course>> list() {
        return Result.success(courseService.getPublishedCourses());
    }
    
    @Operation(summary = "获取课程详情(含大纲/课时/资源/考试大礼包)")
    @GetMapping("/detail/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        Course course = courseService.getCourseDetails(id);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        if (course.getStatus() != null && course.getStatus() == 0) {
            return Result.fail("课程未发布或已下架");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("course", course);

        // 3. 查出该课程的所有【章节】
        List<CourseChapter> chapters = courseChapterService.list(
                new LambdaQueryWrapper<CourseChapter>().eq(CourseChapter::getCourseId, id));
        result.put("chapters", chapters);

        // 4. 🔴 终极备用方案：重组树形结构，完美迎合前端组件！
        List<CourseHour> hours = new ArrayList<>();
        List<Map<String, Object>> chapterTree = new ArrayList<>(); 
        
        if (!chapters.isEmpty()) {
            List<Long> chapterIds = chapters.stream().map(CourseChapter::getId).collect(Collectors.toList());
            
            hours = courseHourService.list(
                    new LambdaQueryWrapper<CourseHour>()
                            .in(CourseHour::getChapterId, chapterIds)
                            .orderByAsc(CourseHour::getSort));

            Map<Long, List<CourseHour>> hourMap = hours.stream().collect(Collectors.groupingBy(CourseHour::getChapterId));

            for (CourseChapter chapter : chapters) {
                // 直接创建一个展平的 Map
                Map<String, Object> node = new java.util.LinkedHashMap<>();
                node.put("id", chapter.getId());
                node.put("title", chapter.getName());
                node.put("sort", chapter.getSort());
                // 🔴 核心改动：把该章节下的课时列表，直接塞进一个叫 children 的字段里！
                node.put("children", hourMap.getOrDefault(chapter.getId(), new ArrayList<>())); 
                chapterTree.add(node);
            }
        }
        result.put("hours", hours); 
        result.put("chapterTree", chapterTree); // 现在它是一个标准的、带 children 的树形数组了

        // 5. 汇总该课程的资料：课程级挂载资料 + 各课时绑定资料
        java.util.LinkedHashSet<Long> resourceIds = new java.util.LinkedHashSet<>();
        List<CourseResource> courseResources = courseResourceService.list(
                new LambdaQueryWrapper<CourseResource>().eq(CourseResource::getCourseId, id));
        courseResources.stream()
                .map(CourseResource::getResourceId)
                .filter(resourceId -> resourceId != null && resourceId > 0)
                .forEach(resourceIds::add);
        hours.stream()
                .map(CourseHour::getResourceId)
                .filter(resourceId -> resourceId != null && resourceId > 0)
                .forEach(resourceIds::add);

        List<Resource> actualResources = new java.util.ArrayList<>();
        if (!resourceIds.isEmpty()) {
            List<Resource> resources = resourceService.listByIds(resourceIds);
            Map<Long, Resource> resourceMap = resources.stream()
                    .collect(Collectors.toMap(Resource::getId, resource -> resource, (left, right) -> left));
            resourceIds.forEach(resourceId -> {
                Resource resource = resourceMap.get(resourceId);
                if (resource != null) {
                    actualResources.add(resource);
                }
            });
        }

        result.put("resources", actualResources);

        // 6. 查出该课程关联的所有【考试】
        List<Exam> exams = examService.list(
                new LambdaQueryWrapper<Exam>().eq(Exam::getCourseId, id));
        result.put("exams", exams);

        return Result.success(result);
    }

    @Operation(summary = "获取单个课时详情(学习/播放专用)")
    @GetMapping("/hour/{hourId}")
    public Result<Map<String, Object>> getHourDetail(@PathVariable Long hourId) {
        CourseHour hour = courseHourService.getById(hourId);
        if (hour == null) {
            return Result.fail("课时不存在");
        }
        
        Map<String, Object> result = new HashMap<>();
        result.put("hour", hour);
        
        if (hour.getResourceId() != null && hour.getResourceId() > 0) {
            Resource resource = resourceService.getById(hour.getResourceId());
            result.put("resource", resource);
        }
        
        return Result.success(result);
    }

    @Operation(summary = "选课")
    @PostMapping("/enroll/{courseId}")
    public Result<Boolean> enroll(@PathVariable Long courseId) {
        long userId = StpUserUtil.getLoginIdAsLong();
        Course course = courseService.getById(courseId);
        if (course == null) {
            return Result.fail("课程不存在");
        }
        long exists = userCourseEnrollmentService.count(new LambdaQueryWrapper<UserCourseEnrollment>()
                .eq(UserCourseEnrollment::getUserId, userId)
                .eq(UserCourseEnrollment::getCourseId, courseId));
        if (exists > 0) {
            return Result.fail("已选过该课程");
        }
        UserCourseEnrollment enrollment = new UserCourseEnrollment();
        enrollment.setUserId(userId);
        enrollment.setCourseId(courseId);
        enrollment.setStatus(0);
        return Result.success(userCourseEnrollmentService.save(enrollment));
    }

    @Operation(summary = "我的课程")
    @GetMapping("/my-courses")
    public Result<List<MyCourseVO>> myCourses() {
        long userId = StpUserUtil.getLoginIdAsLong();
        List<UserCourseEnrollment> enrollments = userCourseEnrollmentService.list(
                new LambdaQueryWrapper<UserCourseEnrollment>()
                        .eq(UserCourseEnrollment::getUserId, userId)
                        .orderByDesc(UserCourseEnrollment::getCreatedAt));
        if (enrollments.isEmpty()) {
            return Result.success(List.of());
        }
        Set<Long> courseIds = enrollments.stream().map(UserCourseEnrollment::getCourseId).collect(Collectors.toSet());
        List<Course> courses = courseService.list(new LambdaQueryWrapper<Course>().in(Course::getId, courseIds));
        List<Exam> exams = examService.list(new LambdaQueryWrapper<Exam>().in(Exam::getCourseId, courseIds));
        Map<Long, Long> examCountMap = exams.stream()
                .collect(Collectors.groupingBy(Exam::getCourseId, Collectors.counting()));
        List<UserCourseResult> courseResults = userCourseResultService.list(new LambdaQueryWrapper<UserCourseResult>()
                .eq(UserCourseResult::getUserId, userId)
                .in(UserCourseResult::getCourseId, courseIds));
        Map<Long, UserCourseResult> resultMap = courseResults.stream()
                .collect(Collectors.toMap(UserCourseResult::getCourseId, item -> item, (left, right) -> left));
        Set<Long> certifiedCourseIds = certificateService.list(new LambdaQueryWrapper<Certificate>()
                        .eq(Certificate::getUserId, userId)
                        .eq(Certificate::getStatus, 1)
                        .in(Certificate::getCourseId, courseIds))
                .stream()
                .map(Certificate::getCourseId)
                .collect(Collectors.toSet());
        Map<Long, Course> courseMap = new HashMap<>();
        for (Course course : courses) {
            courseMap.put(course.getId(), course);
        }
        List<MyCourseVO> result = enrollments.stream()
                .map(enrollment -> {
                    Course course = courseMap.get(enrollment.getCourseId());
                    if (course == null) {
                        return null;
                    }
                    MyCourseVO vo = new MyCourseVO();
                    vo.setCourseId(course.getId());
                    vo.setName(course.getName());
                    vo.setTitle(course.getTitle());
                    vo.setThumb(course.getThumb());
                    vo.setShortDesc(course.getShortDesc());
                    vo.setCreditHours(course.getCreditHours());
                    vo.setCourseStatus(course.getStatus());
                    vo.setLearningStatus(enrollment.getStatus());
                    boolean hasFinalExam = examCountMap.getOrDefault(course.getId(), 0L) > 0;
                    UserCourseResult courseResult = resultMap.get(course.getId());
                    boolean passedFinalExam = courseResult != null && Integer.valueOf(1).equals(courseResult.getIsPassed());
                    boolean hasCertificate = certifiedCourseIds.contains(course.getId());
                    vo.setHasFinalExam(hasFinalExam);
                    vo.setPassedFinalExam(passedFinalExam);
                    vo.setHasCertificate(hasCertificate);
                    return vo;
                })
                .filter(item -> item != null)
                .collect(Collectors.toList());
        return Result.success(result);
    }

    @Data
    public static class MyCourseVO {
        private Long courseId;
        private String name;
        private String title;
        private String thumb;
        private String shortDesc;
        private java.math.BigDecimal creditHours;
        private Integer courseStatus;
        private Integer learningStatus;
        private Boolean hasFinalExam;
        private Boolean passedFinalExam;
        private Boolean hasCertificate;
    }
}
