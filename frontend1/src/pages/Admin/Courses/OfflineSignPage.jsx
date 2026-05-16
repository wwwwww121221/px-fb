import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createOfflineSignSession,
  deleteOfflineSignSession,
  getCourseDetail,
  getOfflineSignEligibleDepartments,
  getOfflineSignRecords,
  getOfflineSignSessions,
  updateOfflineSignSession
} from '../../../api/course';

const initialForm = {
  id: null,
  title: '',
  description: '',
  signMethod: 1,
  needSignOut: false,
  signInStartAt: '',
  signInEndAt: '',
  signOutStartAt: '',
  signOutEndAt: '',
  passCode: '',
  locationName: '',
  latitude: '',
  longitude: '',
  radiusMeters: 300,
  departmentIds: []
};

const methodLabelMap = {
  1: '扫码签到',
  2: '定位签到',
  3: '口令签到'
};

const toInputValue = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const flattenDepartments = (nodes, level = 0) => {
  let rows = [];
  (nodes || []).forEach((node) => {
    rows.push({ ...node, level });
    if (node.children?.length) {
      rows = rows.concat(flattenDepartments(node.children, level + 1));
    }
  });
  return rows;
};

export default function OfflineSignManagement() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [departmentTree, setDepartmentTree] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordSummary, setRecordSummary] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);

  const flatDepartments = useMemo(() => flattenDepartments(departmentTree), [departmentTree]);

  useEffect(() => {
    if (!courseId) return;
    fetchBaseData();
  }, [courseId]);

  useEffect(() => {
    if (!selectedSessionId) {
      setRecords([]);
      setRecordSummary(null);
      return;
    }
    fetchRecords(selectedSessionId);
  }, [selectedSessionId]);

  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [courseRes, sessionRes, deptRes] = await Promise.all([
        getCourseDetail(courseId),
        getOfflineSignSessions(courseId),
        getOfflineSignEligibleDepartments(courseId)
      ]);
      setCourse(courseRes || null);
      const sessionList = sessionRes || [];
      setSessions(sessionList);
      setDepartmentTree(deptRes || []);
      if (sessionList.length > 0) {
        setSelectedSessionId((prev) => prev || sessionList[0].id);
      }
    } catch (error) {
      alert(error?.message || '获取线下签到数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (sessionId) => {
    setRecordLoading(true);
    try {
      const res = await getOfflineSignRecords(courseId, sessionId);
      setRecords(res?.records || []);
      setRecordSummary({
        eligibleCount: res?.eligibleCount || 0,
        signInCount: res?.signInCount || 0,
        signOutCount: res?.signOutCount || 0
      });
    } catch (error) {
      setRecords([]);
      setRecordSummary(null);
      alert(error?.message || '获取签到记录失败');
    } finally {
      setRecordLoading(false);
    }
  };

  const openCreate = () => {
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEdit = (session) => {
    setForm({
      id: session.id,
      title: session.title || '',
      description: session.description || '',
      signMethod: session.signMethod || 1,
      needSignOut: session.needSignOut === 1,
      signInStartAt: toInputValue(session.signInStartAt),
      signInEndAt: toInputValue(session.signInEndAt),
      signOutStartAt: toInputValue(session.signOutStartAt),
      signOutEndAt: toInputValue(session.signOutEndAt),
      passCode: '',
      locationName: session.locationName || '',
      latitude: session.latitude ?? '',
      longitude: session.longitude ?? '',
      radiusMeters: session.radiusMeters || 300,
      departmentIds: session.departmentIds || []
    });
    setModalOpen(true);
  };

  const toggleDepartment = (departmentId) => {
    const id = Number(departmentId);
    setForm((prev) => {
      const exists = prev.departmentIds.includes(id);
      return {
        ...prev,
        departmentIds: exists ? prev.departmentIds.filter((item) => item !== id) : [...prev.departmentIds, id]
      };
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('当前浏览器不支持定位');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude).toFixed(6),
          longitude: Number(pos.coords.longitude).toFixed(6)
        }));
      },
      () => alert('获取当前位置失败，请检查定位权限')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        signMethod: Number(form.signMethod),
        needSignOut: !!form.needSignOut,
        radiusMeters: Number(form.radiusMeters || 300),
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
        departmentIds: (form.departmentIds || []).map(Number)
      };
      if (payload.id) {
        await updateOfflineSignSession(courseId, payload);
        alert('签到场次更新成功');
      } else {
        await createOfflineSignSession(courseId, payload);
        alert('签到场次创建成功');
      }
      setModalOpen(false);
      await fetchBaseData();
    } catch (error) {
      alert(error?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (session) => {
    if (!window.confirm(`确定删除场次【${session.title}】吗？`)) return;
    try {
      await deleteOfflineSignSession(courseId, session.id);
      alert('删除成功');
      if (selectedSessionId === session.id) {
        setSelectedSessionId(null);
      }
      await fetchBaseData();
    } catch (error) {
      alert(error?.message || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/courses')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">线下签到管理</h2>
            <p className="text-sm text-slate-500 mt-1">
              课程：<span className="font-semibold text-blue-600">{course?.name || '加载中...'}</span>
            </p>
          </div>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          发布签到
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">签到场次</h3>
            <span className="text-xs text-slate-400">{sessions.length} 个</span>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="py-10 text-center text-slate-400">正在加载场次...</div>
            ) : sessions.length === 0 ? (
              <div className="py-10 text-center text-slate-400">还没有发布签到场次</div>
            ) : (
              sessions.map((session) => {
                const qrUrl = session.qrCode
                  ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(session.qrCode)}`
                  : null;
                return (
                  <div key={session.id} className={`border rounded-2xl p-4 transition-all ${selectedSessionId === session.id ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="cursor-pointer" onClick={() => setSelectedSessionId(session.id)}>
                        <div className="text-base font-bold text-slate-800">{session.title}</div>
                        <div className="text-xs text-slate-500 mt-1">{methodLabelMap[session.signMethod] || '未设置方式'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(session)} className="text-xs text-blue-600 hover:text-blue-700">编辑</button>
                        <button onClick={() => handleDelete(session)} className="text-xs text-red-500 hover:text-red-600">删除</button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-3 space-y-1">
                      <div>签到：{formatTime(session.signInStartAt)} - {formatTime(session.signInEndAt)}</div>
                      <div>签退：{session.needSignOut === 1 ? `${formatTime(session.signOutStartAt)} - ${formatTime(session.signOutEndAt)}` : '未启用'}</div>
                      <div>部门范围：{session.departmentIds?.length ? `已选 ${session.departmentIds.length} 个部门` : '全部已选课学员'}</div>
                    </div>
                    {session.signMethod === 1 && session.qrCode && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-xs font-medium text-slate-500 mb-2">教师端课程码</div>
                        <div className="flex flex-col items-center gap-2">
                          <img src={qrUrl} alt="签到二维码" className="w-36 h-36 border border-slate-100 rounded-lg" />
                          <div className="px-3 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-mono">{session.qrCode}</div>
                        </div>
                      </div>
                    )}
                    {session.signMethod === 3 && session.passCode && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        签到口令：<span className="font-mono font-bold">{session.passCode}</span>
                      </div>
                    )}
                    {session.signMethod === 2 && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        定位点：{session.locationName || '未命名地点'} / 半径 {session.radiusMeters || 300} 米
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">签到记录</h3>
              <p className="text-xs text-slate-500 mt-1">查看该场次应到学员的签到/签退完成情况</p>
            </div>
            {recordSummary && (
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-500">应到 {recordSummary.eligibleCount}</span>
                <span className="text-blue-600">已签到 {recordSummary.signInCount}</span>
                <span className="text-emerald-600">已签退 {recordSummary.signOutCount}</span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">学员</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">部门</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">签到时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">签退时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recordLoading ? (
                  <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">正在加载签到记录...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400">请选择场次或当前暂无签到记录</td></tr>
                ) : (
                  records.map((item) => (
                    <tr key={item.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.account || item.jobNo || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.departmentPath || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatTime(item.signInTime)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatTime(item.signOutTime)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.status === '已完成'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === '已签到待签退'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{form.id ? '编辑签到场次' : '发布签到场次'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[80vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">场次名称</label>
                  <input required value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：第1天上午签到" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">场次说明</label>
                  <textarea rows="3" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="可填写培训主题、会议室说明等" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">签到方式</label>
                  <select value={form.signMethod} onChange={(e) => setForm((prev) => ({ ...prev, signMethod: Number(e.target.value) }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={1}>1. 扫教师端线下课程码签到</option>
                    <option value={2}>2. 定位签到</option>
                    <option value={3}>3. 口令签到</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.needSignOut} onChange={(e) => setForm((prev) => ({ ...prev, needSignOut: e.target.checked }))} />
                  本场次包含签退
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">签到开始</label>
                    <input type="datetime-local" required value={form.signInStartAt} onChange={(e) => setForm((prev) => ({ ...prev, signInStartAt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">签到结束</label>
                    <input type="datetime-local" required value={form.signInEndAt} onChange={(e) => setForm((prev) => ({ ...prev, signInEndAt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                {form.needSignOut && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">签退开始</label>
                      <input type="datetime-local" required value={form.signOutStartAt} onChange={(e) => setForm((prev) => ({ ...prev, signOutStartAt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">签退结束</label>
                      <input type="datetime-local" required value={form.signOutEndAt} onChange={(e) => setForm((prev) => ({ ...prev, signOutEndAt: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                )}
                {form.signMethod === 2 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-emerald-700">定位签到设置</div>
                      <button type="button" onClick={handleUseCurrentLocation} className="text-xs px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">使用当前定位</button>
                    </div>
                    <input value={form.locationName} onChange={(e) => setForm((prev) => ({ ...prev, locationName: e.target.value }))} className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="地点名称，如：培训中心301" />
                    <div className="grid grid-cols-3 gap-3">
                      <input value={form.latitude} onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))} className="border border-emerald-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="纬度" />
                      <input value={form.longitude} onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))} className="border border-emerald-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="经度" />
                      <input value={form.radiusMeters} onChange={(e) => setForm((prev) => ({ ...prev, radiusMeters: e.target.value }))} className="border border-emerald-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="半径(米)" />
                    </div>
                  </div>
                )}
                {form.signMethod === 3 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">签到口令</label>
                    <input value={form.passCode} onChange={(e) => setForm((prev) => ({ ...prev, passCode: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="例如：JL2026" />
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">签到部门范围</label>
                    <p className="text-xs text-slate-400 mt-1">只对已选课学员所在部门开放；不勾选则默认全部已选课学员可签到</p>
                  </div>
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, departmentIds: [] }))} className="text-xs text-slate-500 hover:text-slate-700">清空选择</button>
                </div>
                <div className="border border-slate-200 rounded-xl max-h-[520px] overflow-y-auto p-3 space-y-1">
                  {flatDepartments.length === 0 ? (
                    <div className="text-sm text-slate-400 py-10 text-center">当前课程暂无可选部门</div>
                  ) : (
                    flatDepartments.map((dept) => (
                      <label key={dept.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700" style={{ paddingLeft: `${8 + dept.level * 20}px` }}>
                        <input type="checkbox" checked={form.departmentIds.includes(Number(dept.id))} onChange={() => toggleDepartment(dept.id)} />
                        <span>{dept.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">取消</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 shadow-sm transition-colors">
                  {submitting ? '保存中...' : '保存场次'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
