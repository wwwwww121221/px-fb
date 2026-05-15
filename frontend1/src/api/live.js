// src/api/live.js
// 直播相关 API 接口定义
import request from './request';

// ==========================================
// 讲师端 - 直播管理 API
// ==========================================

/**
 * 获取讲师直播门票
 * @param {string|number} hourId - 课时ID
 * @returns {Object} { sdkAppId, userId, userSig, roomId }
 */
export const getAdminLiveTicket = (hourId) => {
  return request.get(`/backend/live/enter/${hourId}`);
};

/**
 * 更新直播状态
 * @param {string|number} roomId - 房间ID
 * @param {number} status - 0:未开始, 1:直播中, 2:已结束
 */
export const updateLiveStatus = (roomId, status) => {
  return request.put('/backend/live/status', null, {
    params: { roomId: String(roomId), status }
  });
};

// ==========================================
// 学员端 - 直播观看 API
// ==========================================

/**
 * 获取学员直播门票
 * @param {string|number} hourId - 课时ID
 * @returns {Object} { sdkAppId, userId, userSig, roomId }
 */
export const getStudentLiveTicket = (hourId) => {
  return request.get(`/frontend/live/enter/${hourId}`);
};
