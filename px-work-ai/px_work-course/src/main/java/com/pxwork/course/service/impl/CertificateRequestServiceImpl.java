package com.pxwork.course.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.CertificateRequest;
import com.pxwork.course.mapper.CertificateRequestMapper;
import com.pxwork.course.service.CertificateRequestService;
import org.springframework.stereotype.Service;

@Service
public class CertificateRequestServiceImpl extends ServiceImpl<CertificateRequestMapper, CertificateRequest> implements CertificateRequestService {
}
