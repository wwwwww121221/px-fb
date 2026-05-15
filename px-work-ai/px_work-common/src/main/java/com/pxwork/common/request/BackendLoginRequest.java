package com.pxwork.common.request;

import jakarta.validation.constraints.NotBlank;

public class BackendLoginRequest {

    @NotBlank(message = "账号/密码不能为空")
    private String account;

    private String email;

    @NotBlank(message = "账号/密码不能为空")
    private String password;

    public String getAccount() {
        return account;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
