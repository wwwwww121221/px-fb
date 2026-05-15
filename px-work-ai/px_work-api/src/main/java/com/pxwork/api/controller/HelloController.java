package com.pxwork.api.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "1.6 系统-健康检查")
@RestController
public class HelloController {

    @GetMapping("/")
    public String hello() {
        return "恭喜！你的 PxWork 后端系统已经成功运行！";
    }
}
