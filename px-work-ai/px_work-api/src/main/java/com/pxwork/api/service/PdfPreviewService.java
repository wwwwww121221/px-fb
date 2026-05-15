package com.pxwork.api.service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.pxwork.common.service.MinioService;

@Service
public class PdfPreviewService {

    @Autowired
    private MinioService minioService;

    public PreviewFile getPdfPreview(String fileUrl, String preferredName) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new IllegalArgumentException("fileUrl 不能为空");
        }

        String objectName = minioService.parseObjectNameFromUrl(fileUrl);
        String ext = getExtensionFromObjectName(objectName);
        if ("pdf".equals(ext)) {
            String pdfName = ensurePdfName(preferredName, objectName, "pdf");
            return new PreviewFile(minioService.getObjectByUrl(fileUrl), pdfName);
        }

        if (!isOfficeExt(ext)) {
            throw new IllegalArgumentException("当前文件类型不支持转 PDF 预览: " + ext);
        }

        String pdfObjectName = "preview/pdf/" + sha256Hex(objectName) + ".pdf";
        if (!minioService.objectExists(pdfObjectName)) {
            convertAndUpload(fileUrl, ext, pdfObjectName);
        }

        String pdfName = ensurePdfName(preferredName, objectName, "pdf");
        return new PreviewFile(minioService.getObject(pdfObjectName), pdfName);
    }

    private void convertAndUpload(String fileUrl, String ext, String pdfObjectName) {
        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("office2pdf-");
            Path input = tempDir.resolve("source." + ext);
            try (InputStream in = minioService.getObjectByUrl(fileUrl)) {
                Files.copy(in, input, StandardCopyOption.REPLACE_EXISTING);
            }

            ProcessBuilder pb = new ProcessBuilder(
                    "soffice",
                    "--headless",
                    "--nologo",
                    "--nolockcheck",
                    "--norestore",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tempDir.toString(),
                    input.toString());
            pb.redirectErrorStream(true);
            Process p = pb.start();
            boolean finished = p.waitFor(120, TimeUnit.SECONDS);
            if (!finished) {
                p.destroyForcibly();
                throw new RuntimeException("转 PDF 超时");
            }
            int exit = p.exitValue();
            byte[] out = readUpTo(p.getInputStream(), 32 * 1024);
            if (exit != 0) {
                String msg = new String(out, StandardCharsets.UTF_8);
                throw new RuntimeException("转 PDF 失败: " + msg);
            }

            Path output = tempDir.resolve("source.pdf");
            if (!Files.exists(output)) {
                output = Files.list(tempDir)
                        .filter(f -> f.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".pdf"))
                        .findFirst()
                        .orElseThrow(() -> new RuntimeException("转 PDF 失败: 未生成输出文件"));
            }

            long size = Files.size(output);
            try (InputStream pdfIn = Files.newInputStream(output)) {
                minioService.putObject(pdfObjectName, pdfIn, size, "application/pdf");
            }
        } catch (Exception e) {
            throw new RuntimeException(e.getMessage(), e);
        } finally {
            if (tempDir != null) {
                try {
                    Files.walk(tempDir)
                            .sorted((a, b) -> b.getNameCount() - a.getNameCount())
                            .forEach(p -> {
                                try {
                                    Files.deleteIfExists(p);
                                } catch (Exception ignored) {
                                }
                            });
                } catch (Exception ignored) {
                }
            }
        }
    }

    private static String getExtensionFromObjectName(String objectName) {
        if (objectName == null) return "";
        String name = objectName;
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "";
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean isOfficeExt(String ext) {
        return "doc".equals(ext) || "docx".equals(ext)
                || "ppt".equals(ext) || "pptx".equals(ext)
                || "xls".equals(ext) || "xlsx".equals(ext);
    }

    private static String ensurePdfName(String preferredName, String objectName, String targetExt) {
        String base = (preferredName == null || preferredName.isBlank()) ? "" : preferredName.trim();
        if (base.isBlank()) {
            String name = objectName;
            int slash = name.lastIndexOf('/');
            if (slash >= 0) name = name.substring(slash + 1);
            base = name;
        }
        int q = base.indexOf('?');
        if (q >= 0) base = base.substring(0, q);
        int h = base.indexOf('#');
        if (h >= 0) base = base.substring(0, h);
        int dot = base.lastIndexOf('.');
        if (dot > 0) {
            base = base.substring(0, dot);
        }
        return base + "." + targetExt;
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] dig = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(dig);
        } catch (Exception e) {
            throw new RuntimeException("计算 SHA-256 失败", e);
        }
    }

    private static byte[] readUpTo(InputStream in, int maxBytes) {
        if (in == null) return new byte[0];
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int total = 0;
            int n;
            while ((n = in.read(buf)) >= 0) {
                if (n == 0) continue;
                int canWrite = Math.min(n, maxBytes - total);
                if (canWrite > 0) {
                    out.write(buf, 0, canWrite);
                    total += canWrite;
                }
                if (total >= maxBytes) break;
            }
            return out.toByteArray();
        } catch (Exception e) {
            return new byte[0];
        }
    }

    public record PreviewFile(InputStream stream, String filename) {
    }
}

