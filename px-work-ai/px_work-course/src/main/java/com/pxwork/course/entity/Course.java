package com.pxwork.course.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import com.baomidou.mybatisplus.annotation.TableField;

/**
 * 课程主表
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("courses")
public class Course implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 课程名称
     */
    private String name;

    private String title;

    /**
     * 封面图
     */
    private String thumb;

    /**
     * 简短描述
     */
    private String shortDesc;

    /**
     * 是否必修 (1: 是, 0: 否)
     */
    private Integer isRequired;

    /**
     * 状态 (1: 已发布, 0: 未发布)
     */
    private Integer status;

    /**
     * 分类ID
     */
    private Long categoryId;

    /**
     * 负责讲师ID
     */
    private Long teacherId;

    public Long getTeacherId() {
        return teacherId;
    }

    public void setTeacherId(Long teacherId) {
        this.teacherId = teacherId;
    }

    private java.math.BigDecimal creditHours;

    private String targetRoles;

    private String trainingBatch;

    private Integer courseMode;

    private String offlineLocation;

    /**
     * 考试项权重
     */
    private BigDecimal weightExams;

    /**
     * 过程项权重
     */
    private BigDecimal weightProcess;

    /**
     * 实操项权重
     */
    private BigDecimal weightPractical;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @TableField(exist = false)
    private List<CourseChapter> chapters;
}
