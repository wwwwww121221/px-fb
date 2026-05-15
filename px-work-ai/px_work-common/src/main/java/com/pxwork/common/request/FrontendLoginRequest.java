package com.pxwork.common.request;

import jakarta.validation.constraints.NotBlank;

public class FrontendLoginRequest {

    @NotBlank(message = "登录账号不能为空")
    private String account;

    private String idCard;

    @NotBlank(message = "密码不能为空")
    private String password;

    public String getAccount() {
        return account;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public String getIdCard() {
        return idCard;
    }

    public void setIdCard(String idCard) {
        this.idCard = idCard;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
