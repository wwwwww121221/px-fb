package com.pxwork.api.controller.resource;

import java.util.ArrayList;
import java.util.List;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.pxwork.common.service.MinioService;
import com.pxwork.common.utils.Result;
import com.pxwork.resource.entity.Resource;
import com.pxwork.resource.entity.ResourceCategory;
import com.pxwork.resource.service.ResourceCategoryService;
import com.pxwork.resource.service.ResourceService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;

/**
 * <p>
 * 文件上传 前端控制器
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Slf4j
@Tag(name = "2.5 后台-素材资源管理")
@RestController
@RequestMapping("/upload")
public class UploadController {

    @Autowired
    private ResourceService resourceService;

    @Autowired
    private MinioService minioService;

    @Autowired
    private ResourceCategoryService resourceCategoryService;

    @Operation(summary = "上传文件", description = "上传文件并根据module存放到不同子目录")
    @PostMapping(value = "/{module}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<Resource> upload(
            @PathVariable String module,
            @RequestParam(value = "categoryId", required = false, defaultValue = "0") Long categoryId,
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return Result.fail("文件为空");
        }

        try {
            String subDir = "";
            if (categoryId != null && categoryId > 0) {
                ResourceCategory category = resourceCategoryService.getById(categoryId);
                if (category == null) {
                    return Result.fail("分类不存在");
                }
                subDir = buildCategoryPath(categoryId);
            }

            String originalFilename = file.getOriginalFilename();
            String fileUrl = minioService.uploadFile(file, module, subDir);

            Resource resource = new Resource();
            resource.setName(originalFilename);
            resource.setType(file.getContentType());
            resource.setUrl(fileUrl);
            resource.setSize(file.getSize());
            resource.setDuration(0);
            resource.setCategoryId(categoryId == null ? 0L : categoryId);

            resourceService.save(resource);

            return Result.success(resource);

        } catch (Exception e) {
            log.error("文件上传失败", e);
            return Result.fail("文件上传失败: " + e.getMessage());
        }
    }

    private String buildCategoryPath(Long categoryId) {
        List<String> pathParts = new ArrayList<>();
        Long currentId = categoryId;
        int guard = 0;
        while (currentId != null && currentId > 0 && guard++ < 20) {
            ResourceCategory category = resourceCategoryService.getById(currentId);
            if (category == null) {
                break;
            }
            if (StringUtils.isNotBlank(category.getName())) {
                pathParts.add(0, category.getName().trim());
            }
            currentId = category.getParentId();
        }
        return String.join("/", pathParts);
    }
}
