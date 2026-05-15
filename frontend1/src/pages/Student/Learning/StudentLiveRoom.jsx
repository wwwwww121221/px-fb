// src/pages/Student/Learning/StudentLiveRoom.jsx
// 学员端直播观看与回放组件
import React, { useState, useEffect, useRef } from 'react';
import TRTC from 'trtc-js-sdk';
import { getStudentLiveTicket } from '../../../api/live';

export default function StudentLiveRoom({ hourData }) {
  // ========== 状态管理 ==========
  const [renderMode, setRenderMode] = useState('loading'); // loading | playback | notStart | ended | live | error | waiting
  const [errorMsg, setErrorMsg] = useState('');
  const [liveEnded, setLiveEnded] = useState(false); // 直播是否已结束
  const [waitingForStream, setWaitingForStream] = useState(true); // 是否等待讲师推流

  // ========== TRTC 实例引用 ==========
  const remoteStreamRef = useRef(null); // 远端流
  const clientRef = useRef(null); // TRTC 客户端
  const joinedRef = useRef(false); // 防止重复进房的标记
  const containerRef = useRef(null); // 视频容器 DOM 引用
  const streamStartedRef = useRef(false); // 防止重复启动

  // ========== 等待 DOM 渲染完成 ==========
  useEffect(() => {
    const checkContainer = () => {
      if (containerRef.current) {
        console.log('✅ 学生端：容器已就绪');
      }
    };
    checkContainer();
    if (!containerRef.current) {
      const timer = setTimeout(checkContainer, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // ========== 根据外层传入的 hourData 决定渲染模式 ==========
  useEffect(() => {
    // 无敌防御性解析 hourData
    if (!hourData || typeof hourData !== 'object') {
      setRenderMode('error');
      setErrorMsg('课时数据异常');
      return;
    }

    const playbackUrl = hourData.playbackUrl || hourData.videoUrl || '';
    const status = Number(hourData.status ?? hourData.liveStatus ?? 0);

    // 场景 A：有回放地址，渲染 HTML5 video
    if (playbackUrl) {
      setRenderMode('playback');
      return;
    }

    // 场景 B：直播类型且无回放地址，直接尝试连接观看
    // 只要课时类型是直播（type === 2），就尝试连接 TRTC
    if (hourData.type === 2) {
      // 只有明确标记为"已结束"时才显示结束提示
      if (status === 2) {
        setRenderMode('ended');
      } else {
        // 其他情况（未开始、直播中、status为空）都尝试连接
        setRenderMode('live');
      }
      return;
    }

    // 场景 C：非直播类型，根据 status 渲染
    if (status === 1) {
      setRenderMode('live');
    } else if (status === 0) {
      setRenderMode('notStart');
    } else if (status === 2) {
      setRenderMode('ended');
    } else {
      setRenderMode('error');
      setErrorMsg('课时状态未知');
    }
  }, [hourData]);

  // ========== 直播模式：初始化 TRTC 观看 ==========
  useEffect(() => {
    if (renderMode !== 'live') return;
    if (streamStartedRef.current) return;
    streamStartedRef.current = true;

    let isMounted = true;
    const hourId = hourData?.id;

    const initLive = async () => {
      // 等待容器渲染
      let waitCount = 0;
      while (!containerRef.current && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 50));
        waitCount++;
      }

      if (!containerRef.current) {
        console.error('❌ 学生端：容器渲染超时');
      } else {
        console.log('✅ 学生端：容器就绪');
      }

      try {
        // Step 1: 获取学员直播门票
        console.log('📡 学生端：开始获取直播门票, hourId:', hourId);
        const ticket = await getStudentLiveTicket(hourId);
        if (!isMounted) return;

        console.log('📡 学生端：获取到的门票数据:', ticket);
        console.log('📡 学生端：ticket 类型:', typeof ticket);
        console.log('📡 学生端：ticket keys:', ticket ? Object.keys(ticket) : 'null');

        // 无敌防御性解析门票数据
        const sdkAppId = ticket?.sdkAppId || ticket?.appId;
        const userId = String(ticket?.userId || ticket?.userID || '');
        const userSig = ticket?.userSig || ticket?.userSig || '';
        const roomId = ticket?.roomId || ticket?.roomID || 0;

        console.log('📡 学生端：解析后的数据:', {
          sdkAppId,
          userId,
          userSig: userSig ? '****' : '空',
          roomId
        });

        if (!sdkAppId || !userId || !userSig || !roomId) {
          console.error('❌ 学生端：门票数据不完整');
          throw new Error('直播门票数据不完整，请检查后端配置');
        }

        // 如果 roomId 是字符串但包含非数字字符，需要提取或转换
        let finalRoomId = roomId;
        if (typeof roomId === 'string' && !/^\d+$/.test(roomId)) {
          const match = roomId.match(/\d+/);
          if (match) {
            finalRoomId = Number(match[0]);
            console.log('📡 学生端：从字符串中提取 roomId:', finalRoomId);
          }
        }

        // Step 2: 实例化 TRTC Client（rtc 模式）
        const client = TRTC.createClient({
          mode: 'rtc',
          sdkAppId: Number(sdkAppId),
          userId: userId,
          userSig: userSig,
        });
        clientRef.current = client;

        // Step 3: 监听远端用户开始推流
        client.on('stream-added', (event) => {
          const remoteStream = event.stream;
          console.log('📡 检测到远端用户推流:', remoteStream.getUserId());
          console.log('📡 远端流类型:', remoteStream.getType());
          
          // 订阅远端流
          client.subscribe(remoteStream).then(() => {
            console.log('✅ 远端流订阅成功');
          }).catch((err) => {
            console.error('❌ 订阅远端流失败:', err);
          });
        });

        // Step 4: 监听远端流已订阅事件，播放视频
        client.on('stream-subscribed', (event) => {
          const remoteStream = event.stream;
          console.log('✅ 远端流订阅成功，开始播放:', remoteStream.getUserId());
          remoteStreamRef.current = remoteStream;
          setWaitingForStream(false); // 已经开始播放，不需要等待

          // 防止重复播放
          if (remoteStream.hasBeenPlayed) {
            console.log('📡 流已经播放过，跳过');
            return;
          }

          // 等待容器渲染完成后再播放（最多等待30帧，约0.5秒）
          let waitFrames = 0;
          const playToContainer = () => {
            if (waitFrames > 30) {
              console.error('❌ 容器等待超时');
              return;
            }
            
            if (containerRef.current) {
              console.log('📡 准备播放到容器');
              remoteStream.play(containerRef.current);
              remoteStream.hasBeenPlayed = true;
            } else {
              waitFrames++;
              console.log(`📡 容器未就绪，等待第${waitFrames}帧...`);
              requestAnimationFrame(playToContainer);
            }
          };
          playToContainer();
        });

        // Step 5: 监听远端用户停止推流
        client.on('stream-removed', (event) => {
          const remoteStream = event.stream;
          console.log('📴 远端用户停止推流:', remoteStream.getUserId());
          
          // 停止播放并关闭流
          remoteStream.stop();
          remoteStream.close();
          remoteStreamRef.current = null;
          
          // 直播已结束
          setLiveEnded(true);
          console.log('📴 直播已结束');
        });

        // Step 6: 加入房间
        console.log('📡 学生端：准备加入房间, finalRoomId:', finalRoomId);
        await client.join({ roomId: finalRoomId });
        if (!isMounted) return;
        joinedRef.current = true;

        console.log('📡 学生端：成功加入房间, userId:', userId);

        // Step 7: 主动检查房间内已有的远端流
        const checkExistingStreams = () => {
          try {
            // 在 TRTC SDK v4 中使用 getRemoteStreams() 获取远端流列表
            const remoteStreams = client.getRemoteStreams ? client.getRemoteStreams() : [];
            console.log('📡 学生端：远端流数量:', remoteStreams.length);
            
            if (remoteStreams.length > 0) {
              console.log('📡 学生端：已有的远端流:', remoteStreams);
              remoteStreams.forEach(remoteStream => {
                console.log('📡 学生端：订阅远端流:', remoteStream.getUserId());
                // 自动订阅
                client.subscribe(remoteStream).catch(err => {
                  console.error('❌ 订阅远端流失败:', err);
                });
              });
            } else {
              console.log('📡 学生端：暂无远端流');
            }
          } catch (err) {
            console.error('❌ 检查远端流失败:', err);
          }
        };

        // 加入房间后立即检查，然后每2秒检查一次
        setTimeout(checkExistingStreams, 1000);
        const intervalId = setInterval(checkExistingStreams, 2000);

        // 5秒后停止检查
        setTimeout(() => clearInterval(intervalId), 10000);

      } catch (err) {
        console.error('❌ 学员端直播初始化失败:', err);
        if (isMounted) {
          setErrorMsg(err.message || '直播连接失败');
          setRenderMode('error');
        }
      }
    };

    initLive();

    // ========== 组件卸载时：清理所有 TRTC 资源 ==========
    return () => {
      isMounted = false;
      cleanupStudentTRTC();
    };
  }, [renderMode, hourData]);

  // ========== 清理学员端 TRTC 的核心方法 ==========
  const cleanupStudentTRTC = async () => {
    try {
      // 关闭远端流
      if (remoteStreamRef.current) {
        remoteStreamRef.current.stop();
        remoteStreamRef.current.close();
        remoteStreamRef.current = null;
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
      console.error('清理学员端 TRTC 资源时出错:', err);
    }
  };

  // ========== 渲染模式 A: 回放 ==========
  if (renderMode === 'playback') {
    const playbackUrl = hourData.playbackUrl || hourData.videoUrl;
    return (
      <div className="flex flex-col h-full w-full bg-black">
        <video
          src={playbackUrl}
          controls
          controlsList="nodownload"
          autoPlay
          className="w-full h-full object-contain"
        >
          您的浏览器不支持播放该视频。
        </video>
      </div>
    );
  }

  // ========== 渲染模式 B: 直播未开始 ==========
  if (renderMode === 'notStart') {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">schedule</span>
        <h2 className="text-xl font-bold text-slate-300 mb-2">直播未开始</h2>
        <p className="text-slate-500">敬请期待，讲师即将开始直播</p>
      </div>
    );
  }

  // ========== 渲染模式 C: 直播已结束 ==========
  if (renderMode === 'ended') {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">hourglass_bottom</span>
        <h2 className="text-xl font-bold text-slate-300 mb-2">直播已结束</h2>
        <p className="text-slate-500">回放视频正在生成中，请稍后再来...</p>
      </div>
    );
  }

  // ========== 渲染模式 D: 直播中（TRTC） ==========
  if (renderMode === 'live') {
    return (
      <div className="flex flex-col h-full w-full bg-black">
        {/* 顶部状态栏 */}
        <div className="h-10 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center shrink-0">
          {liveEnded ? (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="material-symbols-outlined text-sm">stop_circle</span>
              <span className="text-xs font-bold">● 直播已结束</span>
            </div>
          ) : waitingForStream ? (
            <div className="flex items-center gap-2 text-blue-400">
              <span className="material-symbols-outlined text-sm animate-spin">sync</span>
              <span className="text-xs font-bold">● 等待讲师开播...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400">
              <span className="material-symbols-outlined text-sm animate-pulse">fiber_manual_record</span>
              <span className="text-xs font-bold">● 直播中</span>
            </div>
          )}
        </div>

        {/* 视频容器 */}
        <div className="flex-1 flex items-center justify-center p-4">
          {liveEnded ? (
            <div className="flex flex-col items-center justify-center w-full h-full bg-slate-800 rounded-lg">
              <span className="material-symbols-outlined text-6xl text-slate-500 mb-4">videocam_off</span>
              <p className="text-slate-400 text-lg font-medium">直播已结束</p>
              <p className="text-slate-500 text-sm mt-2">讲师已下课，感谢观看</p>
            </div>
          ) : waitingForStream ? (
            <div className="flex flex-col items-center justify-center w-full h-full bg-slate-800 rounded-lg">
              <span className="material-symbols-outlined text-6xl text-blue-400 mb-4 animate-pulse">live_tv</span>
              <p className="text-blue-400 text-lg font-medium">等待讲师开始直播</p>
              <p className="text-slate-500 text-sm mt-2">请稍候，讲师即将开播...</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              id="student-remote-stream"
              className="w-full h-full bg-slate-800 rounded-lg overflow-hidden"
              style={{ aspectRatio: '16/9' }}
            />
          )}
        </div>
      </div>
    );
  }

  // ========== 渲染模式 E: 加载中 ==========
  if (renderMode === 'loading') {
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-slate-900 text-white">
        <span className="material-symbols-outlined text-4xl animate-spin text-blue-500 mb-4">sync</span>
        <span className="text-slate-400">正在加载...</span>
      </div>
    );
  }

  // ========== 渲染模式 F: 错误 ==========
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-slate-900 text-white">
      <span className="material-symbols-outlined text-5xl text-red-500 mb-4">error</span>
      <p className="text-red-400">{errorMsg || '加载失败'}</p>
    </div>
  );
}
