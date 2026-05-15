package com.pxwork.api.controller.callback;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pxwork.common.utils.Result;
import com.pxwork.course.service.LiveRoomService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "6.0 回调-TRTC")
@RestController
@RequestMapping("/api/callback/trtc")
public class TrtcCallbackController {

    @Autowired
    private LiveRoomService liveRoomService;

    @Operation(summary = "腾讯云录制回调")
    @PostMapping("/record")
    public Result<String> recordCallback(@RequestBody Map<String, Object> callbackData) {
        boolean handled = liveRoomService.handleRecordCallback(callbackData);
        if (!handled) {
            return Result.fail("回调处理失败：缺少 roomId 或 videoUrl，或未匹配到课时");
        }
        return Result.success("回调处理成功");
    }
}
