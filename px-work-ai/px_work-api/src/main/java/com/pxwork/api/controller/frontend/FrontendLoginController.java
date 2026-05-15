package com.pxwork.api.controller.frontend;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pxwork.common.entity.User;
import com.pxwork.common.request.FrontendLoginRequest;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.common.utils.StpUserUtil;

import cn.dev33.satoken.secure.SaSecureUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Tag(name = "4.0 前台-学员登录认证")
@RestController
@RequestMapping("/frontend")
public class FrontendLoginController {

    @Autowired
    private UserService userService;

    @Operation(summary = "学员登录")
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody @Validated FrontendLoginRequest loginRequest) {
        try {
            Map<String, Object> loginInfo = userService.login(loginRequest);
            Map<String, Object> tokenInfo = new HashMap<>(loginInfo);
            tokenInfo.put("tokenName", StpUserUtil.getStpLogic().getTokenName());
            tokenInfo.put("tokenValue", loginInfo.get("token"));
            return Result.success(tokenInfo);
        } catch (RuntimeException e) {
            return Result.fail(e.getMessage());
        } catch (Exception e) {
            return Result.fail("登录失败，请稍后重试");
        }
    }

    @Operation(summary = "学员注销登录")
    @DeleteMapping("/logout")
    public Result<String> logout() {
        StpUserUtil.logout();
        return Result.success("注销成功");
    }

    @Operation(summary = "获取当前学员信息")
    @GetMapping("/user/info")
    public Result<User> userInfo() {
        long userId = StpUserUtil.getLoginIdAsLong();
        User user = userService.getById(userId);
        if (user != null) {
            user.setPassword(null);
        }
        return Result.success(user);
    }

    @Operation(summary = "首次登录修改密码")
    @PutMapping("/user/update-password")
    public Result<Boolean> updatePassword(@RequestBody @Validated UpdatePasswordRequest request) {
        long userId = StpUserUtil.getLoginIdAsLong();
        User user = userService.getById(userId);
        if (user == null) {
            return Result.fail("用户不存在");
        }
        String oldPassword = SaSecureUtil.sha256(request.getOldPassword());
        if (!oldPassword.equals(user.getPassword())) {
            return Result.fail("旧密码错误");
        }
        String regex = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,16}$";
        if (!Pattern.matches(regex, request.getNewPassword())) {
            return Result.fail("新密码需为8-16位且包含字母、数字、特殊符号");
        }
        User updateUser = new User();
        updateUser.setId(userId);
        updateUser.setPassword(SaSecureUtil.sha256(request.getNewPassword()));
        updateUser.setIsFirstLogin(0);
        return Result.success(userService.updateById(updateUser));
    }

    @Data
    public static class UpdatePasswordRequest {
        @NotBlank(message = "旧密码不能为空")
        private String oldPassword;
        @NotBlank(message = "新密码不能为空")
        private String newPassword;
    }
}
