package com.pxwork.course.entity;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("offline_sign_sessions")
public class OfflineSignSession implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long courseId;

    private String title;

    private String description;

    private Integer signMethod;

    private Integer needSignOut;

    private LocalDateTime signInStartAt;

    private LocalDateTime signInEndAt;

    private LocalDateTime signOutStartAt;

    private LocalDateTime signOutEndAt;

    private String qrCode;

    private String passCode;

    private String locationName;

    private BigDecimal latitude;

    private BigDecimal longitude;

    private Integer radiusMeters;

    private Integer status;

    private Long createdBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private List<Long> departmentIds;
}
