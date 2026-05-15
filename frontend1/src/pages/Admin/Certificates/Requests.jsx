import React, { useState, useEffect } from 'react';
import { getCertificateRequestList, approveCertificateRequest, rejectCertificateRequest, shippedCertificateRequest } from '../../../api/certificate';

const STATUS_MAP = {
  0: { label: '待审核', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'pending' },
  1: { label: '审核通过', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
  2: { label: '已驳回', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'cancel' },
  3: { label: '已邮寄', cls: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'local_shipping' },
};

export default function CertificateRequests() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, size: 10, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  const showToast = (msg, type = 'info') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchData();
  }, [pagination.current, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { current: pagination.current, size: pagination.size };
      if (statusFilter !== '') params.status = statusFilter;
      const res = await getCertificateRequestList(params);
      const records = res?.records || [];
      setList(records.map(r => ({
        id: r.id,
        certNo: r.certNo || '',
        courseName: r.courseName || r.course || '-',
        userName: r.userName || r.receiverName || '未知',
        receiverName: r.receiverName || '',
        phone: r.phone || '',
        address: r.address || '',
        status: r.status ?? 0,
        statusText: r.statusText || STATUS_MAP[r.status]?.label || '未知',
        createTime: r.createTime || r.createdAt || '-'
      })));
      setPagination(prev => ({ ...prev, total: res?.total || 0 }));
    } catch (e) {
      console.error('获取申请列表失败:', e);
      showToast('获取申请列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, actionFn, actionLabel) => {
    setActionId(id);
    try {
      await actionFn(id);
      showToast(`${actionLabel}成功`, 'success');
      fetchData();
    } catch (e) {
      console.error(`${actionLabel}失败:`, e);
      showToast(`${actionLabel}失败：${e?.msg || e?.message || '系统错误'}`, 'error');
    } finally {
      setActionId(null);
    }
  };

  const maxPage = Math.max(1, Math.ceil(pagination.total / pagination.size));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[1000] px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="bg-gradient-to-r from-amber-600 to-orange-700 p-8 rounded-2xl shadow-md text-white flex items-center gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0 border border-white/20">
          <span className="material-symbols-outlined text-3xl">fact_check</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold">证书邮寄申请管理</h2>
          <p className="text-amber-100 mt-1 text-sm">审核学员的纸质证书邮寄申请，通过后可标记已发货</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-600">状态筛选：</span>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPagination(prev => ({ ...prev, current: 1 })); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-amber-400 bg-white">
              <option value="">全部</option>
              <option value="0">待审核</option>
              <option value="1">审核通过</option>
              <option value="2">已驳回</option>
              <option value="3">已邮寄</option>
            </select>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-xs font-bold text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] animate-spin" style={{ animationPlayState: loading ? 'running' : 'paused' }}>refresh</span> 刷新
          </button>
        </div>

        {loading && list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-4xl animate-spin text-amber-500 mb-4">sync</span>
            <p>正在加载...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-40">inbox</span>
            <p className="font-medium">暂无申请记录</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">学员</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">证书编号</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">关联课程</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">收件信息</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {list.map((item) => {
                    const st = STATUS_MAP[item.status] || STATUS_MAP[0];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{item.userName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">{item.certNo || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.courseName}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 min-w-[220px]">
                          <div className="space-y-0.5">
                            <p><span className="text-slate-400">收件人：</span>{item.receiverName || '-'}</p>
                            <p><span className="text-slate-400">电话：</span>{item.phone || '-'}</p>
                            {item.address && <p className="truncate" title={item.address}><span className="text-slate-400">地址：</span>{item.address}</p>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.cls}`}>
                            <span className="material-symbols-outlined text-[12px]">{st.icon}</span> {item.statusText}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.status === 0 && (
                              <>
                                <button onClick={() => handleAction(item.id, approveCertificateRequest, '通过')} disabled={actionId === item.id} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50">
                                  {actionId === item.id ? '...' : '通过'}
                                </button>
                                <button onClick={() => handleAction(item.id, rejectCertificateRequest, '驳回')} disabled={actionId === item.id} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50">
                                  {actionId === item.id ? '...' : '驳回'}
                                </button>
                              </>
                            )}
                            {item.status === 1 && (
                              <button onClick={() => handleAction(item.id, shippedCertificateRequest, '标记已寄')} disabled={actionId === item.id} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200 transition-colors disabled:opacity-50 flex items-center gap-1">
                                {actionId === item.id ? <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span> ..</> : <><span className="material-symbols-outlined text-[14px]">local_shipping</span> 已寄</>}
                              </button>
                            )}
                            {(item.status === 2 || item.status === 3) && (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination.total > pagination.size && (
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs text-slate-500">共 {pagination.total} 条</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPagination(p => ({ ...p, current: p.current - 1 }))} disabled={pagination.current <= 1} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-colors">上一页</button>
                  <span className="text-xs text-slate-500 px-2">{pagination.current} / {maxPage}</span>
                  <button onClick={() => setPagination(p => ({ ...p, current: p.current + 1 }))} disabled={pagination.current >= maxPage} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 transition-colors">下一页</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
