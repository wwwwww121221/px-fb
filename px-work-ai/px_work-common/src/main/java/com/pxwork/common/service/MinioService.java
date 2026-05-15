package com.pxwork.common.service;

import java.net.URI;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.errors.ErrorResponseException;

@Service
public class MinioService {

    private final MinioClient minioClient;

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.public-endpoint:${minio.endpoint}}")
    private String publicEndpoint;

    @Value("${minio.bucket-name}")
    private String bucketName;

    public MinioService(MinioClient minioClient) {
        this.minioClient = minioClient;
    }

    public String uploadFile(MultipartFile file, String module) {
        return uploadFile(file, module, null);
    }

    public String uploadFile(MultipartFile file, String module, String subDir) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件不能为空");
        }

        String normalizedModule = normalizeModule(module);
        String normalizedSubDir = normalizeSubDir(subDir);
        String originalFilename = file.getOriginalFilename();
        String suffix = extractSuffix(originalFilename);
        List<String> pathSegments = new ArrayList<>();
        pathSegments.add(normalizedModule);
        if (!normalizedSubDir.isBlank()) {
            pathSegments.add(normalizedSubDir);
        }
        pathSegments.add(UUID.randomUUID() + suffix);
        String objectName = String.join("/", pathSegments);
        String contentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();

        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(contentType)
                            .build());
            return buildFileUrl(objectName);
        } catch (Exception e) {
            throw new RuntimeException("上传文件到 MinIO 失败", e);
        }
    }

    public void removeFile(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            return;
        }

        String objectName = parseObjectName(fileUrl);
        if (objectName == null || objectName.isBlank()) {
            return;
        }

        try {
            minioClient.removeObject(
                    RemoveObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("删除 MinIO 文件失败", e);
        }
    }

    public InputStream getObjectByUrl(String fileUrl) {
        String objectName = parseObjectName(fileUrl);
        return getObject(objectName);
    }

    public InputStream getObject(String objectName) {
        if (objectName == null || objectName.isBlank()) {
            throw new IllegalArgumentException("objectName 不能为空");
        }
        try {
            return minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("读取 MinIO 文件失败", e);
        }
    }

    public boolean objectExists(String objectName) {
        if (objectName == null || objectName.isBlank()) {
            return false;
        }
        try {
            minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .build());
            return true;
        } catch (ErrorResponseException e) {
            return false;
        } catch (Exception e) {
            throw new RuntimeException("检查 MinIO 文件是否存在失败", e);
        }
    }

    public void putObject(String objectName, InputStream stream, long size, String contentType) {
        if (objectName == null || objectName.isBlank()) {
            throw new IllegalArgumentException("objectName 不能为空");
        }
        if (stream == null) {
            throw new IllegalArgumentException("stream 不能为空");
        }
        String finalContentType = (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType;
        try {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(stream, size, -1)
                            .contentType(finalContentType)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("写入 MinIO 文件失败", e);
        }
    }

    public String buildPublicUrl(String objectName) {
        return buildFileUrl(objectName);
    }

    public String parseObjectNameFromUrl(String fileUrl) {
        return parseObjectName(fileUrl);
    }

    private String buildFileUrl(String objectName) {
        return publicEndpoint.replaceAll("/+$", "") + "/" + bucketName + "/" + objectName;
    }

    private String parseObjectName(String fileUrl) {
        URI uri = URI.create(fileUrl);
        String path = uri.getPath();
        String bucketPrefix = "/" + bucketName + "/";
        if (path == null || !path.startsWith(bucketPrefix)) {
            throw new IllegalArgumentException("文件 URL 不属于当前 MinIO Bucket: " + fileUrl);
        }
        return path.substring(bucketPrefix.length());
    }

    private String normalizeModule(String module) {
        if (module == null || module.isBlank()) {
            return "default";
        }
        String normalized = module.replace("\\", "/").trim();
        normalized = normalized.replaceAll("^/+", "").replaceAll("/+$", "");
        if (normalized.isBlank()) {
            return "default";
        }
        return normalized;
    }

    private String normalizeSubDir(String subDir) {
        if (subDir == null || subDir.isBlank()) {
            return "";
        }
        String normalized = subDir.replace("\\", "/").trim();
        normalized = normalized.replaceAll("/+", "/");
        normalized = normalized.replaceAll("^/+", "").replaceAll("/+$", "");
        return normalized;
    }

    private String extractSuffix(String originalFilename) {
        if (originalFilename == null) {
            return "";
        }
        int index = originalFilename.lastIndexOf('.');
        return index >= 0 ? originalFilename.substring(index) : "";
    }
}
