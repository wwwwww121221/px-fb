package com.pxwork.common.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BackendLoginRequest {

    @NotBlank(message = "邮箱/密码不能为空")
    private String email;

    @NotBlank(message = "邮箱/密码不能为空")
    private String password;
}
