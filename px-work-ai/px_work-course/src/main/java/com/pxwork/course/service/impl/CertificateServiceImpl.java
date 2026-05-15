package com.pxwork.course.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.Certificate;
import com.pxwork.course.mapper.CertificateMapper;
import com.pxwork.course.service.CertificateService;
import org.springframework.stereotype.Service;

@Service
public class CertificateServiceImpl extends ServiceImpl<CertificateMapper, Certificate> implements CertificateService {
}
