package com.pxwork.course.service.impl;

import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.OfflineSignSession;
import com.pxwork.course.mapper.OfflineSignSessionMapper;
import com.pxwork.course.service.OfflineSignSessionService;

@Service
public class OfflineSignSessionServiceImpl extends ServiceImpl<OfflineSignSessionMapper, OfflineSignSession> implements OfflineSignSessionService {
}
