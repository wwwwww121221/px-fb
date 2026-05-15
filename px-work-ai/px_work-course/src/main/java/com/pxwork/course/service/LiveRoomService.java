package com.pxwork.course.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pxwork.course.entity.LiveRoom;

/**
 * 直播间 Service 接口
 */
public interface LiveRoomService extends IService<LiveRoom> {
    
    /**
     * 根据课时ID获取直播间，如果不存在则自动创建一个
     */
    LiveRoom getOrCreateRoom(Long hourId, String hourName);

    /**
     * 更新直播间状态
     *
     * @param roomNo 直播间号（如 room_hour_1001）
     * @param status 目标状态：1-直播中，2-已结束
     * @return 是否更新成功
     */
    boolean updateRoomStatus(String roomNo, Integer status);

    /**
     * 处理腾讯云录制回调，自动更新课时回放地址
     *
     * @param callbackData 回调原始 JSON 数据
     * @return 是否处理成功
     */
    boolean handleRecordCallback(java.util.Map<String, Object> callbackData);
}
