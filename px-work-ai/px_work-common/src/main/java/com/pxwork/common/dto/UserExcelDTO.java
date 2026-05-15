package com.pxwork.common.dto;

import com.alibaba.excel.annotation.ExcelProperty;

public class UserExcelDTO {

    @ExcelProperty("姓名")
    private String name;

    @ExcelProperty("登录账号")
    private String account;

    @ExcelProperty("工号")
    private String jobNo;

    @ExcelProperty("所属部门")
    private String deptName;

    @ExcelProperty("科室")
    private String office;

    @ExcelProperty("岗位角色")
    private String jobRole;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAccount() {
        return account;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public String getJobNo() {
        return jobNo;
    }

    public void setJobNo(String jobNo) {
        this.jobNo = jobNo;
    }

    public String getDeptName() {
        return deptName;
    }

    public void setDeptName(String deptName) {
        this.deptName = deptName;
    }

    public String getOffice() {
        return office;
    }

    public void setOffice(String office) {
        this.office = office;
    }

    public String getJobRole() {
        return jobRole;
    }

    public void setJobRole(String jobRole) {
        this.jobRole = jobRole;
    }
}
