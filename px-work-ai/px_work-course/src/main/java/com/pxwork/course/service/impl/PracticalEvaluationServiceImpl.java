package com.pxwork.course.service.impl;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.PracticalEvaluation;
import com.pxwork.course.mapper.PracticalEvaluationMapper;
import com.pxwork.course.service.PracticalEvaluationService;

@Service
public class PracticalEvaluationServiceImpl extends ServiceImpl<PracticalEvaluationMapper, PracticalEvaluation>
        implements PracticalEvaluationService {
}
