package com.pxwork.common.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FrontendLoginRequest {

    @NotBlank(message = "身份证号不能为空")
    private String idCard;

    @NotBlank(message = "密码不能为空")
    private String password;
}
