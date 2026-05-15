import React, { useState, useEffect } from 'react';
import { getAdminCertificateList, effectCertificate } from '../../../api/certificate';

const CERT_STATUS_MAP = {
  0: { label: '公示中', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'visibility' },
  1: { label: '已生效', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'verified' },
};

export default function CertificateManagement() {
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
      const res = await getAdminCertificateList(params);
      const records = res?.records || [];
      setList(records.map(c => ({
        id: c.id,
        certNo: c.certNo || '',
        courseName: c.courseName || c.course || '-',
        userName: c.userName || '-',
        issueDate: c.issueDate || c.createdAt?.split(' ')[0] || '-',
        status: c.status ?? 0
      })));
      setPagination(prev => ({ ...prev, total: res?.total || 0 }));
    } catch (e) {
      console.error('获取证书列表失败:', e);
      showToast('获取证书列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEffect = async (id) => {
    if (!window.confirm('确认将该证书从「公示中」改为「已生效」？\n生效后学员可在「我的证书」中查看并申请邮寄。')) return;
    setActionId(id);
    try {
      await effectCertificate(id);
      showToast('证书已生效', 'success');
      fetchData();
    } catch (e) {
      console.error('生效操作失败:', e);
      showToast('生效失败：' + (e?.msg || e?.message || '系统错误'), 'error');
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

      <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-8 rounded-2xl shadow-md text-white flex items-center gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0 border border-white/20">
          <span className="material-symbols-outlined text-3xl">workspace_premium</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold">证书管理</h2>
          <p className="text-violet-100 mt-1 text-sm">管理所有学员的电子证书，公示期结束后手动生效，学员即可查看并申请邮寄</p>
        </div>
        <div className="ml-auto relative z-10 flex gap-3">
          <div className="flex flex-col items-center bg-white/10 px-5 py-3 rounded-xl border border-white/20 backdrop-blur-sm">
            <span className="text-2xl font-black text-amber-300">{list.filter(c => c.status === 0).length}</span>
            <span className="text-[10px] font-medium">公示中</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 px-5 py-3 rounded-xl border border-white/20 backdrop-blur-sm">
            <span className="text-2xl font-black text-emerald-300">{list.filter(c => c.status === 1).length}</span>
            <span className="text-[10px] font-medium">已生效</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-600">状态筛选：</span>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPagination(prev => ({ ...prev, current: 1 })); }} className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-violet-400 bg-white">
              <option value="">全部</option>
              <option value="0">公示中</option>
              <option value="1">已生效</option>
            </select>
          </div>
          <button onClick={fetchData} disabled={loading} className="text-xs font-bold text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] animate-spin" style={{ animationPlayState: loading ? 'running' : 'paused' }}>refresh</span> 刷新
          </button>
        </div>

        {loading && list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <span className="material-symbols-outlined text-4xl animate-spin text-violet-500 mb-4">sync</span>
            <p>正在加载...</p>
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-40">workspace_premium</span>
            <p className="font-medium">暂无证书记录</p>
            <p className="text-xs mt-1">当学员课程综合分达到通过线后，系统会自动生成证书</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">获证学员</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">证书编号</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">关联课程</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">颁发日期</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {list.map((item) => {
                    const st = CERT_STATUS_MAP[item.status] || CERT_STATUS_MAP[0];
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.status === 0 ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{item.userName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">{item.certNo || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.courseName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.issueDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.cls}`}>
                            <span className="material-symbols-outlined text-[12px]">{st.icon}</span> {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {item.status === 0 ? (
                            <button onClick={() => handleEffect(item.id)} disabled={actionId === item.id} className="text-xs font-bold px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-all active:scale-[0.97] shadow-sm disabled:opacity-60 flex items-center gap-1 mx-auto">
                              {actionId === item.id ? <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span> 处理中</> : <><span className="material-symbols-outlined text-[14px]">check_circle</span> 生效</>}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
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
