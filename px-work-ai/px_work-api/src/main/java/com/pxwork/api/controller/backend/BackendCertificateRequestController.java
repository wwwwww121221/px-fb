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
import com.pxwork.course.entity.CertificateRequest;
import com.pxwork.course.entity.Course;
import com.pxwork.course.service.CertificateRequestService;
import com.pxwork.course.service.CertificateService;
import com.pxwork.course.service.CourseService;

import cn.dev33.satoken.annotation.SaCheckPermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;

@Tag(name = "3.5 后台-证书管理")
@RestController
@RequestMapping("/backend/certificate-requests")
public class BackendCertificateRequestController {

    @Autowired
    private CertificateRequestService certificateRequestService;

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private CourseService courseService;

    @Autowired
    private UserService userService;

    @Operation(summary = "纸质证书申请分页列表")
    @SaCheckPermission("certificate:update")
    @GetMapping("/list")
    public Result<Page<CertificateRequestVO>> list(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long certificateId) {
        Page<CertificateRequest> page = new Page<>(current, size);
        LambdaQueryWrapper<CertificateRequest> queryWrapper = new LambdaQueryWrapper<>();
        if (status != null) {
            queryWrapper.eq(CertificateRequest::getStatus, status);
        }
        if (userId != null && userId > 0) {
            queryWrapper.eq(CertificateRequest::getUserId, userId);
        }
        if (certificateId != null && certificateId > 0) {
            queryWrapper.eq(CertificateRequest::getCertificateId, certificateId);
        }
        queryWrapper.orderByDesc(CertificateRequest::getId);
        Page<CertificateRequest> requestPage = certificateRequestService.page(page, queryWrapper);

        List<CertificateRequestVO> records = buildVOList(requestPage.getRecords());
        Page<CertificateRequestVO> resultPage = new Page<>(current, size, requestPage.getTotal());
        resultPage.setRecords(records);
        return Result.success(resultPage);
    }

    @Operation(summary = "审核通过纸质申请")
    @SaCheckPermission("certificate:update")
    @PutMapping("/{id}/approve")
    public Result<Boolean> approve(@PathVariable Long id) {
        CertificateRequest request = certificateRequestService.getById(id);
        if (request == null) {
            return Result.fail("申请记录不存在");
        }
        if (Integer.valueOf(3).equals(request.getStatus())) {
            return Result.fail("该申请已标记为已邮寄");
        }
        request.setStatus(1);
        return Result.success(certificateRequestService.updateById(request));
    }

    @Operation(summary = "驳回纸质申请")
    @SaCheckPermission("certificate:update")
    @PutMapping("/{id}/reject")
    public Result<Boolean> reject(@PathVariable Long id) {
        CertificateRequest request = certificateRequestService.getById(id);
        if (request == null) {
            return Result.fail("申请记录不存在");
        }
        if (Integer.valueOf(3).equals(request.getStatus())) {
            return Result.fail("该申请已标记为已邮寄，无法驳回");
        }
        request.setStatus(2);
        return Result.success(certificateRequestService.updateById(request));
    }

    @Operation(summary = "标记纸质申请已邮寄")
    @SaCheckPermission("certificate:update")
    @PutMapping("/{id}/shipped")
    public Result<Boolean> shipped(@PathVariable Long id) {
        CertificateRequest request = certificateRequestService.getById(id);
        if (request == null) {
            return Result.fail("申请记录不存在");
        }
        if (!Integer.valueOf(1).equals(request.getStatus())) {
            return Result.fail("仅审核通过的申请可标记已邮寄");
        }
        request.setStatus(3);
        return Result.success(certificateRequestService.updateById(request));
    }

    private List<CertificateRequestVO> buildVOList(List<CertificateRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> userIds = requests.stream()
                .map(CertificateRequest::getUserId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        Set<Long> certIds = requests.stream()
                .map(CertificateRequest::getCertificateId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());

        Map<Long, User> userMap = userIds.isEmpty()
                ? Collections.emptyMap()
                : userService.listByIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, item -> item, (a, b) -> a));
        Map<Long, Certificate> certMap = certIds.isEmpty()
                ? Collections.emptyMap()
                : certificateService.listByIds(certIds).stream()
                .collect(Collectors.toMap(Certificate::getId, item -> item, (a, b) -> a));

        Set<Long> courseIds = certMap.values().stream()
                .map(Certificate::getCourseId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        Map<Long, Course> courseMap = courseIds.isEmpty() ? Collections.emptyMap()
                : courseService.listByIds(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, item -> item, (a, b) -> a));

        return requests.stream().map(item -> {
            User user = userMap.get(item.getUserId());
            Certificate cert = certMap.get(item.getCertificateId());
            Course course = cert == null ? null : courseMap.get(cert.getCourseId());
            CertificateRequestVO vo = new CertificateRequestVO();
            vo.setId(item.getId());
            vo.setUserId(item.getUserId());
            vo.setUserName(user == null ? "未知学员" : user.getName());
            vo.setCertificateId(item.getCertificateId());
            vo.setCertNo(cert == null ? "" : cert.getCertNo());
            vo.setCourseName(course == null ? "" : course.getName());
            vo.setIssueDate(cert == null ? null : cert.getIssueDate());
            vo.setReceiverName(item.getReceiverName());
            vo.setPhone(item.getPhone());
            vo.setAddress(item.getAddress());
            vo.setStatus(item.getStatus());
            vo.setStatusText(statusText(item.getStatus()));
            return vo;
        }).collect(Collectors.toList());
    }

    private String statusText(Integer status) {
        if (Integer.valueOf(0).equals(status)) {
            return "待审核";
        }
        if (Integer.valueOf(1).equals(status)) {
            return "审核通过";
        }
        if (Integer.valueOf(2).equals(status)) {
            return "已驳回";
        }
        if (Integer.valueOf(3).equals(status)) {
            return "已邮寄";
        }
        return "未知";
    }

    @Data
    public static class CertificateRequestVO {
        private Long id;
        private Long userId;
        private String userName;
        private Long certificateId;
        private String certNo;
        private String courseName;
        private LocalDate issueDate;
        private String receiverName;
        private String phone;
        private String address;
        private Integer status;
        private String statusText;
    }
}
