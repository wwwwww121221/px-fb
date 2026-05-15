// src/pages/Admin/LiveRoom/AdminLiveRoom.jsx
// 讲师端直播间组件
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TRTC from 'trtc-js-sdk';
import { getAdminLiveTicket, updateLiveStatus } from '../../../api/live';

export default function AdminLiveRoom() {
  const { hourId } = useParams();
  const navigate = useNavigate();
  
  // ========== 状态管理 ==========
  const [isLive, setIsLive] = useState(false); // 直播状态
  const [isLoading, setIsLoading] = useState(true); // 初始化加载状态
  const [error, setError] = useState(null); // 错误信息
  const [isEnding, setIsEnding] = useState(false); // 结束直播中

  // ========== TRTC 实例引用 ==========
  const localStreamRef = useRef(null); // 本地流
  const clientRef = useRef(null); // TRTC 客户端
  const joinedRef = useRef(false); // 防止重复进房的标记
  const publishedRef = useRef(false); // 防止重复推流的标记
  const containerRef = useRef(null); // 视频容器 DOM 引用
  const streamStartedRef = useRef(false); // 防止重复启动

  // ========== 组件挂载时：初始化 TRTC 并开始直播 ==========
  useEffect(() => {
    let isMounted = true;

    const initLive = async () => {
      // 防止重复启动
      if (streamStartedRef.current) return;
      streamStartedRef.current = true;

      try {
        setIsLoading(true);
        setError(null);

        // 防御性检查：确保 hourId 有效
        if (!hourId || hourId === 'undefined' || hourId === 'null') {
          throw new Error('课时ID无效，请从课程页面进入直播');
        }

        // Step 1: 获取直播门票（sdkAppId, userId, userSig, roomId）
        const ticket = await getAdminLiveTicket(hourId);
        if (!isMounted) return;

        // 无敌防御性解析门票数据
        const sdkAppId = ticket?.sdkAppId || ticket?.appId;
        const userId = String(ticket?.userId || ticket?.userID || '');
        const userSig = ticket?.userSig || ticket?.userSig || '';
        // roomId 可能是数字或字符串（如 "room_hour_17"）
        const roomId = ticket?.roomId || ticket?.roomID || 0;

        if (!sdkAppId || !userId || !userSig || !roomId) {
          throw new Error('直播门票数据不完整，请检查后端配置');
        }

        // TRTC 需要数字类型的 roomId
        let trtcRoomId = roomId;
        if (typeof roomId === 'string' && !/^\d+$/.test(roomId)) {
          // 尝试提取数字部分，例如 "room_hour_17" -> 17
          const match = roomId.match(/\d+/);
          if (match) {
            trtcRoomId = Number(match[0]);
          }
        }

        console.log('📹 原始 roomId:', roomId);
        console.log('📹 TRTC roomId:', trtcRoomId);

        // Step 2: 实例化 TRTC Client（rtc 模式用于直播）
        const client = TRTC.createClient({
          mode: 'rtc',
          sdkAppId: Number(sdkAppId),
          userId: userId,
          userSig: userSig,
        });
        clientRef.current = client;

        // Step 3: 加入房间
        await client.join({ roomId: trtcRoomId });
        if (!isMounted) return;
        joinedRef.current = true;

        // Step 4: 创建本地音视频流
        const localStream = TRTC.createStream({
          userId: userId,
          audio: true,
          video: true,
        });
        localStreamRef.current = localStream;

        // Step 5: 初始化本地流
        console.log('📹 开始初始化 localStream...');
        await localStream.initialize();
        if (!isMounted) return;

        console.log('📹 localStream 初始化完成');
        console.log('📹 hasVideo:', localStream.hasVideo());
        console.log('📹 hasAudio:', localStream.hasAudio());
        console.log('📹 containerRef.current:', containerRef.current);

        // Step 6: 播放到容器
        if (containerRef.current) {
          console.log('📹 准备播放到容器');
          localStream.play(containerRef.current);
          console.log('📹 play() 调用成功');
        } else {
          console.error('❌ 容器不存在!');
          throw new Error('视频容器未就绪');
        }

        // Step 7: 发布本地流到房间
        await client.publish(localStream);
        if (!isMounted) return;
        publishedRef.current = true;

        // Step 8: 推流成功，尝试更新直播状态为"直播中"(status=1)
        try {
          console.log('📹 准备更新直播状态, roomId:', roomId, ', status: 1');
          await updateLiveStatus(roomId, 1);
          console.log('✅ 直播状态更新成功');
        } catch (statusErr) {
          console.warn('⚠️ 更新直播状态失败，但直播已成功开始:', statusErr.message);
        }
        if (!isMounted) return;

        setIsLive(true);
        setIsLoading(false);

      } catch (err) {
        console.error('❌ 直播初始化失败:', err);
        if (isMounted) {
          setError(err.message || '直播初始化失败');
          setIsLoading(false);
        }
      }
    };

    // 使用 requestAnimationFrame 等待 DOM 渲染完成
    const waitForContainer = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (containerRef.current) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        // 最多等待 60 帧（约1秒），超时后也继续执行
        let frameCount = 0;
        const checkWithTimeout = () => {
          if (containerRef.current || frameCount > 60) {
            resolve();
          } else {
            frameCount++;
            requestAnimationFrame(checkWithTimeout);
          }
        };
        requestAnimationFrame(checkWithTimeout);
      });
    };

    const timer = setTimeout(async () => {
      await waitForContainer();
      initLive();
    }, 50);

    // ========== 组件卸载时：清理所有 TRTC 资源 ==========
    return () => {
      clearTimeout(timer);
      isMounted = false;
      cleanupTRTC();
    };
  }, [hourId]);

  // ========== 清理 TRTC 的核心方法 ==========
  const cleanupTRTC = async () => {
    try {
      // 如果已发布，先取消发布
      if (publishedRef.current && clientRef.current && localStreamRef.current) {
        try {
          await clientRef.current.unpublish(localStreamRef.current);
        } catch (e) {
          console.warn('取消发布失败:', e);
        }
        publishedRef.current = false;
      }

      // 关闭本地流
      if (localStreamRef.current) {
        localStreamRef.current.close();
        localStreamRef.current = null;
      }

      // 离开房间
      if (joinedRef.current && clientRef.current) {
        try {
          await clientRef.current.leave();
        } catch (e) {
          console.warn('离开房间失败:', e);
        }
        joinedRef.current = false;
      }

      // 销毁客户端
      if (clientRef.current) {
        clientRef.current = null;
      }
    } catch (err) {
      console.error('清理 TRTC 资源时出错:', err);
    }
  };

  // ========== 结束直播 ==========
  const handleEndLive = async () => {
    if (isEnding) return;

    try {
      setIsEnding(true);

      // 获取当前的 roomId（从状态或重新获取）
      const ticket = await getAdminLiveTicket(hourId).catch(() => null);
      const originalRoomId = ticket?.roomId || 0; // 保留原始字符串用于更新数据库

      // TRTC 需要数字类型的 roomId
      let trtcRoomId = originalRoomId;
      if (typeof originalRoomId === 'string' && !/^\d+$/.test(originalRoomId)) {
        const match = originalRoomId.match(/\d+/);
        if (match) {
          trtcRoomId = Number(match[0]);
        }
      }

      // 执行清理
      await cleanupTRTC();

      // 更新直播状态为"已结束"(status=2)，使用原始 roomId
      if (originalRoomId) {
        console.log('📹 准备更新直播状态为结束, roomId:', originalRoomId);
        await updateLiveStatus(originalRoomId, 2).catch(err => console.warn('更新直播状态失败:', err));
      }

      setIsLive(false);
      
      // 返回上一页
      navigate(-1);
    } catch (err) {
      console.error('❌ 结束直播失败:', err);
      setError('结束直播失败');
      setIsEnding(false);
    }
  };

  // ========== 渲染逻辑 ==========
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="h-14 bg-slate-800 text-slate-300 flex items-center justify-between px-6 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <>
              <span className="material-symbols-outlined text-2xl animate-spin text-blue-500">sync</span>
              <span className="text-blue-400 font-bold text-lg">● 正在初始化直播...</span>
            </>
          ) : error ? (
            <>
              <span className="material-symbols-outlined text-2xl text-red-500">error</span>
              <span className="text-red-400 font-bold text-lg">● 初始化失败</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-red-500 text-2xl animate-pulse">fiber_manual_record</span>
              <span className="text-red-400 font-bold text-lg">● 直播中</span>
            </>
          )}
        </div>
        {!isLoading && !error && (
          <button
            onClick={handleEndLive}
            disabled={isEnding}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isEnding
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isEnding ? '正在下课...' : '下课 / 结束直播'}
          </button>
        )}
      </div>

      {/* 视频预览区域 */}
      <div className="flex-1 flex items-center justify-center bg-black p-4">
        {error ? (
          <div className="flex flex-col items-center text-white">
            <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
            <p className="text-lg text-red-400 mb-6">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              返回
            </button>
          </div>
        ) : (
          <div
            ref={containerRef}
            id="admin-local-stream"
            className="w-full h-full bg-slate-800 rounded-lg overflow-hidden shadow-2xl"
            style={{ aspectRatio: '16/9', minHeight: '400px' }}
          />
        )}
      </div>
    </div>
  );
}
