package com.pxwork.common.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import lombok.Data;

@Data
public class UserExcelDTO {

    @ExcelProperty("姓名")
    private String name;

    @ExcelProperty("身份证号")
    private String idCard;

    @ExcelProperty("所属企业")
    private String enterprise;

    @ExcelProperty("岗位")
    private String jobRole;

    @ExcelProperty("所属行业")
    private String industry;
}
