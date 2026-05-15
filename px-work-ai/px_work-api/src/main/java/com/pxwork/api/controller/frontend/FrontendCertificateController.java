package com.pxwork.api.controller.frontend;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.pxwork.common.entity.User;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;
import com.pxwork.course.entity.Certificate;
import com.pxwork.course.entity.CertificateRequest;
import com.pxwork.course.entity.Course;
import com.pxwork.course.service.CertificateRequestService;
import com.pxwork.course.service.CertificateService;
import com.pxwork.course.service.CourseService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Tag(name = "4.7 前台-证书与公示")
@RestController
@RequestMapping("/frontend/certificates")
public class FrontendCertificateController {

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private CertificateRequestService certificateRequestService;

    @Autowired
    private UserService userService;

    @Autowired
    private CourseService courseService;

    @Operation(summary = "证书公示名单")
    @GetMapping("/public")
    public Result<List<CertificateVO>> publicList() {
        LocalDate fromDate = LocalDate.now().minusDays(3);
        List<Certificate> list = certificateService.list(new LambdaQueryWrapper<Certificate>()
                .eq(Certificate::getStatus, 0)
                .ge(Certificate::getIssueDate, fromDate)
                .orderByDesc(Certificate::getIssueDate));
        return Result.success(buildCertificateVOList(list, null));
    }

    @Operation(summary = "我的证书")
    @GetMapping("/my")
    public Result<List<CertificateVO>> myCertificates() {
        long userId = StpUserUtil.getLoginIdAsLong();
        List<Certificate> list = certificateService.list(new LambdaQueryWrapper<Certificate>()
                .eq(Certificate::getUserId, userId)
                .eq(Certificate::getStatus, 1)
                .orderByDesc(Certificate::getIssueDate));
        return Result.success(buildCertificateVOList(list, userId));
    }

    @Operation(summary = "申请纸质邮寄")
    @PostMapping("/{id}/requests")
    public Result<Boolean> createRequest(@PathVariable Long id, @RequestBody @Validated CertificateRequestBody body) {
        long userId = StpUserUtil.getLoginIdAsLong();
        Certificate certificate = certificateService.getById(id);
        if (certificate == null || !certificate.getUserId().equals(userId)) {
            return Result.fail("证书不存在");
        }
        if (Integer.valueOf(0).equals(certificate.getStatus())) {
            return Result.fail("证书尚在公示期，暂无法申请纸质邮寄");
        }
        long exists = certificateRequestService.count(new LambdaQueryWrapper<CertificateRequest>()
                .eq(CertificateRequest::getUserId, userId)
                .eq(CertificateRequest::getCertificateId, id));
        if (exists > 0) {
            return Result.fail("已提交纸质申请");
        }
        CertificateRequest request = new CertificateRequest();
        request.setUserId(userId);
        request.setCertificateId(id);
        request.setReceiverName(body.getReceiverName());
        request.setPhone(body.getPhone());
        request.setAddress(body.getAddress());
        request.setStatus(0);
        return Result.success(certificateRequestService.save(request));
    }

    @Operation(summary = "我的纸质申请记录")
    @GetMapping("/requests/my")
    public Result<List<CertificateRequestVO>> myRequests() {
        long userId = StpUserUtil.getLoginIdAsLong();
        List<CertificateRequest> requests = certificateRequestService.list(new LambdaQueryWrapper<CertificateRequest>()
                .eq(CertificateRequest::getUserId, userId)
                .orderByDesc(CertificateRequest::getId));
        return Result.success(buildRequestVOList(requests));
    }

    private List<CertificateVO> buildCertificateVOList(List<Certificate> certificates, Long fixedUserId) {
        if (certificates == null || certificates.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> userIds = certificates.stream()
                .map(c -> fixedUserId != null ? fixedUserId : c.getUserId())
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        Set<Long> courseIds = certificates.stream()
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

        return certificates.stream().map(cert -> {
            Long targetUserId = fixedUserId != null ? fixedUserId : cert.getUserId();
            CertificateVO vo = new CertificateVO();
            vo.setId(cert.getId());
            vo.setCertNo(cert.getCertNo());
            vo.setIssueDate(cert.getIssueDate());
            vo.setUserName(userNameMap.getOrDefault(targetUserId, "未知"));
            vo.setCourseName(courseNameMap.getOrDefault(cert.getCourseId(), "未知课程"));
            return vo;
        }).collect(Collectors.toList());
    }

    private List<CertificateRequestVO> buildRequestVOList(List<CertificateRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> certIds = requests.stream()
                .map(CertificateRequest::getCertificateId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        List<Certificate> certs = certIds.isEmpty() ? Collections.emptyList() : certificateService.listByIds(certIds);
        Map<Long, Certificate> certMap = certs.stream().collect(Collectors.toMap(Certificate::getId, c -> c, (a, b) -> a));
        Set<Long> courseIds = certs.stream()
                .map(Certificate::getCourseId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        Map<Long, String> courseNameMap = courseIds.isEmpty()
                ? Collections.emptyMap()
                : courseService.listByIds(courseIds).stream()
                .collect(Collectors.toMap(Course::getId, Course::getName, (a, b) -> a));

        return requests.stream().map(req -> {
            Certificate cert = certMap.get(req.getCertificateId());
            CertificateRequestVO vo = new CertificateRequestVO();
            vo.setId(req.getId());
            vo.setCertificateId(req.getCertificateId());
            vo.setCertNo(cert == null ? "" : cert.getCertNo());
            vo.setCourseName(cert == null ? "" : courseNameMap.getOrDefault(cert.getCourseId(), ""));
            vo.setReceiverName(req.getReceiverName());
            vo.setPhone(req.getPhone());
            vo.setAddress(req.getAddress());
            vo.setStatus(req.getStatus());
            vo.setStatusText(statusText(req.getStatus()));
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
    public static class CertificateVO {
        private Long id;
        private String certNo;
        private LocalDate issueDate;
        private String userName;
        private String courseName;
    }

    @Data
    public static class CertificateRequestBody {
        @NotBlank(message = "收件人不能为空")
        private String receiverName;
        @NotBlank(message = "联系电话不能为空")
        private String phone;
        @NotBlank(message = "收件地址不能为空")
        private String address;
    }

    @Data
    public static class CertificateRequestVO {
        private Long id;
        private Long certificateId;
        private String certNo;
        private String courseName;
        private String receiverName;
        private String phone;
        private String address;
        private Integer status;
        private String statusText;
    }
}
