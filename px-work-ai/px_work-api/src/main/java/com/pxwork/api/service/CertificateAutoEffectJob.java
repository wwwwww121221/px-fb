package com.pxwork.api.service;

import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.pxwork.course.entity.Certificate;
import com.pxwork.course.service.CertificateService;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class CertificateAutoEffectJob {

    @Autowired
    private CertificateService certificateService;

    // 每天 00:10 执行一次：将公示满 3 天的证书自动生效
    @Scheduled(cron = "0 10 0 * * ?")
    public void autoEffectCertificates() {
        LocalDate cutoffDate = LocalDate.now().minusDays(3);
        LambdaUpdateWrapper<Certificate> wrapper = new LambdaUpdateWrapper<Certificate>()
                .eq(Certificate::getStatus, 0)
                .le(Certificate::getIssueDate, cutoffDate)
                .set(Certificate::getStatus, 1);
        boolean updated = certificateService.update(wrapper);
        log.info("certificate auto effect job finished, cutoffDate={}, updated={}", cutoffDate, updated);
    }
}
