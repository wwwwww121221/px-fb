package com.pxwork.api.controller.preview;

import java.io.InputStream;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pxwork.api.service.PdfPreviewService;
import com.pxwork.api.service.PdfPreviewService.PreviewFile;

@RestController
@RequestMapping("/preview")
public class PreviewController {

    @Autowired
    private PdfPreviewService pdfPreviewService;

    @GetMapping(value = "/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<InputStreamResource> pdf(
            @RequestParam("fileUrl") String fileUrl,
            @RequestParam(value = "name", required = false) String name,
            @RequestParam(value = "disposition", required = false, defaultValue = "inline") String disposition) {
        PreviewFile preview = pdfPreviewService.getPdfPreview(fileUrl, name);
        InputStream stream = preview.stream();
        InputStreamResource body = new InputStreamResource(stream);

        ContentDisposition cd = "attachment".equalsIgnoreCase(disposition)
                ? ContentDisposition.attachment().filename(preview.filename()).build()
                : ContentDisposition.inline().filename(preview.filename()).build();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(cd);
        headers.setCacheControl("public, max-age=31536000");

        return ResponseEntity.ok().headers(headers).body(body);
    }
}

