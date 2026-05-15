package com.pxwork.api.controller.backend;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pxwork.common.utils.Result;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.entity.LiveRoom;
import com.pxwork.course.service.CourseHourService;
import com.pxwork.course.service.LiveRoomService;
import com.tencentyun.TLSSigAPIv2;

import cn.dev33.satoken.stp.StpUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "2.6 后台-直播管理")
@RestController
@RequestMapping("/backend/live")
public class BackendLiveController {

    @Value("${trtc.appid}")
    private long sdkAppId;

    @Value("${trtc.secret-key}")
    private String secretKey;

    @Value("${trtc.expire-time:86400}")
    private long expireTime;

    @Autowired
    private LiveRoomService liveRoomService;

    @Autowired
    private CourseHourService courseHourService;

    @Operation(summary = "讲师进入直播间")
    @GetMapping("/enter/{hourId}")
    public Result<Map<String, Object>> enterLiveRoom(@PathVariable Long hourId) {
        CourseHour hour = courseHourService.getById(hourId);
        if (hour == null) {
            return Result.fail("课时不存在");
        }

        LiveRoom room = liveRoomService.getOrCreateRoom(hourId, hour.getName());

        String trtcUserId = "teacher_" + StpUtil.getLoginIdAsLong();
        TLSSigAPIv2 api = new TLSSigAPIv2(sdkAppId, secretKey);
        String userSig = api.genUserSig(trtcUserId, expireTime);

        Map<String, Object> result = new HashMap<>();
        result.put("sdkAppId", sdkAppId);
        result.put("userId", trtcUserId);
        result.put("userSig", userSig);
        result.put("roomId", room.getRoomNo());
        return Result.success(result);
    }

    @Operation(summary = "更新直播间状态")
    @PutMapping("/status")
    public Result<String> updateStatus(@RequestParam String roomId, @RequestParam Integer status) {
        if (status == null || (status != 1 && status != 2)) {
            return Result.fail("状态参数不合法，仅支持 1-直播中 或 2-已结束");
        }

        boolean updated = liveRoomService.updateRoomStatus(roomId, status);
        if (!updated) {
            return Result.fail("直播间不存在或状态未变更");
        }
        return Result.success("状态更新成功");
    }
}
