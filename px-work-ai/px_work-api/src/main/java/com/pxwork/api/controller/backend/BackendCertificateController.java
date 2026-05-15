package com.pxwork.api.controller.backend;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.pxwork.common.entity.User;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.Certificate;
import com.pxwork.course.entity.Course;
import com.pxwork.course.service.CertificateService;
import com.pxwork.course.service.CourseService;

import cn.dev33.satoken.annotation.SaCheckPermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;

@Tag(name = "3.5 后台-证书管理")
@RestController
@RequestMapping("/backend/certificates")
public class BackendCertificateController {

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private UserService userService;

    @Autowired
    private CourseService courseService;

    @Operation(summary = "管理端证书分页列表")
    @SaCheckPermission("certificate:update")
    @GetMapping("/list")
    public Result<Page<CertificateVO>> list(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer status) {
        Page<Certificate> page = new Page<>(current, size);
        LambdaQueryWrapper<Certificate> wrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            wrapper.eq(Certificate::getStatus, status);
        }
        wrapper.orderByDesc(Certificate::getIssueDate).orderByDesc(Certificate::getId);
        Page<Certificate> certPage = certificateService.page(page, wrapper);

        Page<CertificateVO> resultPage = new Page<>(current, size, certPage.getTotal());
        resultPage.setRecords(buildVOList(certPage.getRecords()));
        return Result.success(resultPage);
    }

    @Operation(summary = "手动结束证书公示使其生效")
    @SaCheckPermission("certificate:update")
    @PutMapping("/{id}/effect")
    public Result<Boolean> effect(@PathVariable Long id) {
        Certificate certificate = certificateService.getById(id);
        if (certificate == null) {
            return Result.fail("证书不存在");
        }
        certificate.setStatus(1);
        return Result.success(certificateService.updateById(certificate));
    }

    private List<CertificateVO> buildVOList(List<Certificate> certs) {
        if (certs == null || certs.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> userIds = certs.stream()
                .map(Certificate::getUserId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        Set<Long> courseIds = certs.stream()
                .map(Certificate::getCourseId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());

        Map<Long, String> userNameMap = userIds.isEmpty()
                ? Collections.emptyMap()
                : userService.listByIds(userIds).stream()
                        .collect(Collectors.toMap(User::getId, User::getName, (a, b) -> a));
        Map<Long, String> courseNameMap = courseIds.isEmpty()
                ? Collections.emptyMap()
                : courseService.listByIds(courseIds).stream()
                        .collect(Collectors.toMap(Course::getId, Course::getName, (a, b) -> a));

        return certs.stream().map(cert -> {
            CertificateVO vo = new CertificateVO();
            vo.setId(cert.getId());
            vo.setCertNo(cert.getCertNo());
            vo.setUserName(userNameMap.getOrDefault(cert.getUserId(), "未知学员"));
            vo.setCourseName(courseNameMap.getOrDefault(cert.getCourseId(), "未知课程"));
            vo.setIssueDate(cert.getIssueDate());
            vo.setStatus(cert.getStatus());
            return vo;
        }).collect(Collectors.toList());
    }

    @Data
    public static class CertificateVO {
        private Long id;
        private String certNo;
        private String userName;
        private String courseName;
        private LocalDate issueDate;
        private Integer status;
    }
}
