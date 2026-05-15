package com.pxwork.course.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.course.entity.CourseHour;
import com.pxwork.course.entity.LiveRoom;
import com.pxwork.course.mapper.LiveRoomMapper;
import com.pxwork.course.service.CourseHourService;
import com.pxwork.course.service.LiveRoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class LiveRoomServiceImpl extends ServiceImpl<LiveRoomMapper, LiveRoom> implements LiveRoomService {

    private static final Pattern ROOM_HOUR_PATTERN = Pattern.compile("room_hour_(\\d+)");

    @Autowired
    private CourseHourService courseHourService;

    @Override
    public LiveRoom getOrCreateRoom(Long hourId, String hourName) {
        // 1. 先去数据库查，这个课时是不是已经有房间了？
        LiveRoom room = this.getOne(new LambdaQueryWrapper<LiveRoom>()
                .eq(LiveRoom::getHourId, hourId));

        // 2. 如果有，直接把房间信息返回
        if (room != null) {
            return room;
        }

        // 3. 如果没有，说明是第一次点进这个直播课时，咱们现场给它建一个房间！
        room = new LiveRoom();
        room.setHourId(hourId);
        room.setRoomName(hourName + " 的直播间");
        // 🔴 核心：生成全局唯一的房间号，用 "room_hour_" + 课时ID，绝对不会重复！
        room.setRoomNo("room_hour_" + hourId); 
        room.setStatus(0); // 0代表未开始
        
        // 保存到数据库
        this.save(room);

        return room;
    }

    @Override
    public boolean updateRoomStatus(String roomNo, Integer status) {
        if (roomNo == null || roomNo.trim().isEmpty()) {
            return false;
        }
        if (status == null || (status != 1 && status != 2)) {
            return false;
        }

        LambdaUpdateWrapper<LiveRoom> updateWrapper = new LambdaUpdateWrapper<LiveRoom>()
                .eq(LiveRoom::getRoomNo, roomNo)
                .set(LiveRoom::getStatus, status);

        LocalDateTime now = LocalDateTime.now();
        if (status == 1) {
            updateWrapper.set(LiveRoom::getStartTime, now);
        } else {
            updateWrapper.set(LiveRoom::getEndTime, now);
        }

        return this.update(updateWrapper);
    }

    @Override
    public boolean handleRecordCallback(Map<String, Object> callbackData) {
        if (callbackData == null || callbackData.isEmpty()) {
            return false;
        }

        String roomNo = findStringByKeys(callbackData, "roomId", "RoomId", "room_id", "RoomID");
        String videoUrl = findStringByKeys(callbackData, "videoUrl", "VideoUrl", "video_url", "FileUrl", "fileUrl", "url", "Url");

        if (videoUrl == null || videoUrl.trim().isEmpty()) {
            return false;
        }

        if (roomNo == null || roomNo.trim().isEmpty()) {
            roomNo = findRoomNoFromAnyText(callbackData);
        }
        if (roomNo == null || roomNo.trim().isEmpty()) {
            return false;
        }

        Matcher matcher = ROOM_HOUR_PATTERN.matcher(roomNo);
        if (!matcher.find()) {
            return false;
        }
        Long hourId = Long.valueOf(matcher.group(1));

        CourseHour hour = new CourseHour();
        hour.setId(hourId);
        hour.setPlaybackUrl(videoUrl);
        return courseHourService.updateById(hour);
    }

    private String findRoomNoFromAnyText(Object data) {
        if (data == null) {
            return null;
        }
        if (data instanceof String str) {
            Matcher matcher = ROOM_HOUR_PATTERN.matcher(str);
            if (matcher.find()) {
                return matcher.group();
            }
            return null;
        }
        if (data instanceof Map<?, ?> map) {
            for (Object value : map.values()) {
                String found = findRoomNoFromAnyText(value);
                if (found != null) {
                    return found;
                }
            }
            return null;
        }
        if (data instanceof List<?> list) {
            for (Object item : list) {
                String found = findRoomNoFromAnyText(item);
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private String findStringByKeys(Object data, String... keys) {
        if (!(data instanceof Map<?, ?> map)) {
            return null;
        }

        for (String key : keys) {
            Object value = map.get(key);
            if (value instanceof String str && !str.trim().isEmpty()) {
                return str;
            }
            if (value != null && !(value instanceof Map<?, ?>) && !(value instanceof List<?>)) {
                String text = String.valueOf(value);
                if (!text.trim().isEmpty()) {
                    return text;
                }
            }
        }

        for (Object value : map.values()) {
            if (value instanceof Map<?, ?> || value instanceof List<?>) {
                String found = findStringByKeys(value, keys);
                if (found != null && !found.trim().isEmpty()) {
                    return found;
                }
            }
        }
        return null;
    }
}
