import React, { useState, useEffect, useRef } from 'react';
import { getMyCertificates, getPublicCertificates, applyPaperCertificate, getMyCertificateRequests } from '../../../api/certificate';
import useAuthStore from '../../../store/useAuthStore';
import html2canvas from 'html2canvas';

const REQUEST_STATUS_MAP = {
  0: { label: '待审核', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'pending' },
  1: { label: '审核通过', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
  2: { label: '已驳回', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'cancel' },
  3: { label: '已邮寄', cls: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'local_shipping' },
};

export default function Certificates() {
  const { userInfo } = useAuthStore();
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [myCertList, setMyCertList] = useState([]);
  const [publicCertList, setPublicCertList] = useState([]);
  const [requestList, setRequestList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState(null);

  // ========== 显示提示信息 ==========
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ========== 获取我的证书列表 ==========
  const fetchMyCerts = async () => {
    try {
      const res = await getMyCertificates();
      let data = [];
      if (Array.isArray(res)) data = res;
      else if (Array.isArray(res?.data)) data = res.data;
      else if (Array.isArray(res?.records)) data = res.records;
      setMyCertList(data.map((cert) => ({
        id: cert.id,
        certNo: cert.certNo || '',
        courseName: cert.courseName || cert.course || '未知课程',
        issueDate: cert.issueDate || '-',
        status: cert.status ?? 1
      })));
    } catch (error) {
      console.error('获取我的证书失败:', error);
      showToast('获取证书列表失败，请稍后重试', 'error');
    }
  };

  // ========== 获取证书公示名单 ==========
  const fetchPublicCerts = async () => {
    try {
      const res = await getPublicCertificates();
      let data = [];
      if (Array.isArray(res)) data = res;
      else if (Array.isArray(res?.data)) data = res.data;
      else if (Array.isArray(res?.records)) data = res.records;
      setPublicCertList(data.map((cert) => ({
        id: cert.id,
        certNo: cert.certNo || '',
        userName: cert.userName || '匿名学员',
        courseName: cert.courseName || cert.course || '未知课程',
        issueDate: cert.issueDate || '-'
      })));
    } catch (error) {
      console.error('获取公示名单失败:', error);
      showToast('获取公示名单失败，请稍后重试', 'error');
    }
  };

  // ========== 获取我的纸质证书申请记录 ==========
  const fetchMyRequests = async () => {
    try {
      const res = await getMyCertificateRequests();
      let data = [];
      if (Array.isArray(res)) data = res;
      else if (Array.isArray(res?.data)) data = res.data;
      else if (Array.isArray(res?.records)) data = res.records;
      setRequestList(data.map((req) => ({
        id: req.id,
        certNo: req.certNo || '',
        courseName: req.courseName || req.course || '未知课程',
        receiverName: req.receiverName || '',
        phone: req.phone || '',
        address: req.address || '',
        status: req.status ?? 0,
        statusText: req.statusText || REQUEST_STATUS_MAP[req.status]?.label || '未知',
        createTime: req.createTime || req.createdAt || '-'
      })));
    } catch (error) {
      console.error('获取申请记录失败:', error);
      showToast('获取申请记录失败，请稍后重试', 'error');
    }
  };

  // ========== 根据 Tab 加载数据 ==========
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'my') {
          await fetchMyCerts();
        } else if (activeTab === 'public') {
          await fetchPublicCerts();
        } else if (activeTab === 'requests') {
          await fetchMyRequests();
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  // ========== 姓名脱敏处理 ==========
  const maskName = (name) => {
    if (!name) return '未知';
    const len = name.length;
    if (len === 1) return name;
    if (len === 2) return name[0] + '*';
    if (len === 3) return name[0] + '*' + name[2];
    return name[0] + '**' + name[len - 1];
  };

  // ========== 提交纸质证书申请 ==========
  const handleApplySubmit = async (values) => {
    if (!selectedCert?.id) {
      showToast('证书信息异常', 'error');
      return;
    }

    setApplying(true);
    try {
      await applyPaperCertificate(selectedCert.id, values);
      showToast('申请成功！平台将尽快为您制作并邮寄纸质证书。', 'success');
      setApplyModalOpen(false);
      setSelectedCert(null);
    } catch (error) {
      console.error('申请失败:', error);
      showToast('申请失败：' + (error?.msg || error?.message || '系统繁忙，请稍后重试'), 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleDownload = async () => {
    if (!certRef.current) return;
    setDownloading(true);
    try {
      const el = certRef.current;
      const rect = el.getBoundingClientRect();
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        windowWidth: rect.width,
        windowHeight: rect.height,
        scrollX: 0,
        scrollY: 0
      });
      const link = document.createElement('a');
      link.download = `证书-${previewCert.certNo || previewCert.courseName || 'certificate'}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('证书已下载到本地', 'success');
    } catch (err) {
      console.error('下载证书失败:', err);
      showToast('下载失败，请稍后重试', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Toast 提示组件 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[1000] px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-emerald-500' : 
          toast.type === 'error' ? 'bg-red-500' : 
          'bg-blue-500'
        }`}>
          {toast.message}
        </div>
      )}
      
      {/* 头部说明区 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-2xl shadow-md text-white flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-300 text-4xl">workspace_premium</span>
            证书认证中心
          </h2>
          <p className="text-blue-100 mt-2 max-w-xl">
            在这里查看您获得的专属能力凭证，或浏览全平台的优秀学员证书公示名单，见证每一份成长与荣誉。
          </p>
        </div>
        <div className="relative z-10 flex gap-4">
          <div className="flex flex-col items-center bg-white/10 px-6 py-4 rounded-xl border border-white/20 backdrop-blur-sm">
            <span className="text-3xl font-black text-amber-300">{myCertList.length}</span>
            <span className="text-xs font-medium mt-1">我的证书</span>
          </div>
          <div className="flex flex-col items-center bg-white/10 px-6 py-4 rounded-xl border border-white/20 backdrop-blur-sm">
            <span className="text-3xl font-black text-blue-200">{publicCertList.length}</span>
            <span className="text-xs font-medium mt-1">全网颁发</span>
          </div>
        </div>
      </div>

      {/* Tab 选项卡 */}
      <div className="flex border-b border-slate-200 gap-2">
        <button onClick={() => setActiveTab('my')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'my' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>我的证书</button>
        <button onClick={() => setActiveTab('public')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-1 ${activeTab === 'public' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          <span className="material-symbols-outlined text-[18px]">public</span>证书公示名单
        </button>
        <button onClick={() => setActiveTab('requests')} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 flex items-center gap-1 ${activeTab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>申请记录
        </button>
      </div>

      {/* 数据展示区 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-4xl animate-spin text-blue-500 mb-4">sync</span>
          <p>正在努力加载证书数据...</p>
        </div>
      ) : activeTab === 'my' ? (
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-2">
          {myCertList.length === 0 ? (
             <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-100">
               <span className="material-symbols-outlined text-6xl mb-4 opacity-50">workspace_premium</span>
               <p>您目前尚未获得任何证书，继续努力学习吧！</p>
             </div>
          ) : myCertList.map(cert => (
            <div key={cert.id} className="bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] border border-slate-100 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group flex flex-col">
              
              <div className="h-32 bg-slate-50 border-b border-slate-100 relative p-4 flex flex-col items-center justify-center overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#1e3a8a 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                <div className="absolute left-0 top-0 w-2 h-full bg-amber-400"></div>
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-2 z-10 border border-amber-200 shadow-sm">
                  <span className="material-symbols-outlined text-amber-600 text-2xl">verified</span>
                </div>
                <div className="text-[10px] tracking-widest text-slate-400 uppercase z-10">CERTIFICATE OF ACHIEVEMENT</div>
              </div>

              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-slate-800 leading-tight">{cert.courseName}</h3>
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-bold shrink-0 border border-emerald-200">
                    <span className="material-symbols-outlined text-[12px] align-middle">verified</span> 已生效
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-slate-500 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">证书编号</span>
                    <span className="font-mono text-slate-700 text-xs">{cert.certNo || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">颁发日期</span>
                    <span className="text-slate-700">{cert.issueDate}</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-50 flex gap-2 shrink-0">
                <button 
                  onClick={() => setPreviewCert(cert)} 
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 border border-blue-200 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span> 预览
                </button>
                <button 
                  onClick={() => setPreviewCert(cert)} 
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 border border-emerald-200 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span> 下载
                </button>
                <button 
                  onClick={() => {
                    setSelectedCert(cert);
                    setApplyModalOpen(true);
                  }} 
                  className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 border border-amber-200 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">local_shipping</span> 纸质版
                </button>
              </div>

            </div>
          ))}
        </div>
        
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {publicCertList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">format_list_bulleted</span>
              <p>暂无证书公示记录</p>
              <p className="text-xs mt-1">公示中的证书将在此处展示（近3天颁发）</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">颁发日期</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">证书编号</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">关联课程</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">获证学员</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {publicCertList.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">{cert.issueDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">{cert.certNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">{cert.courseName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(cert.userName || '?').charAt(0)}
                        </div>
                        {maskName(cert.userName)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
                          <span className="material-symbols-outlined text-[12px]">visibility</span> 公示中
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {publicCertList.length > 0 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
              <span>共 {publicCertList.length} 条公示记录（近3天颁发）</span>
              <span>证书经管理员生效后可在「我的证书」中查看</span>
            </div>
          )}
        </div>
      )}

      {/* ============================== */}
      {/* 申请记录 Tab */}
      {/* ============================== */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="material-symbols-outlined text-4xl animate-spin text-blue-500 mb-4">sync</span>
              <p>正在加载申请记录...</p>
            </div>
          ) : requestList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-40">receipt_long</span>
              <p className="font-medium">暂无申请记录</p>
              <p className="text-xs mt-1">在「我的证书」中点击「纸质版」按钮即可申请邮寄</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requestList.map((req) => {
                const st = REQUEST_STATUS_MAP[req.status] || REQUEST_STATUS_MAP[0];
                return (
                  <div key={req.id} className="px-6 py-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-slate-800 truncate">{req.courseName}</h4>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${st.cls}`}>
                            <span className="material-symbols-outlined text-[12px]">{st.icon}</span> {req.statusText || st.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-xs text-slate-500 mt-2">
                          <div><span className="text-slate-400">证书编号：</span><span className="font-mono text-slate-700">{req.certNo || '-'}</span></div>
                          <div><span className="text-slate-400">收件人：</span><span className="text-slate-700">{req.receiverName}</span></div>
                          <div><span className="text-slate-400">联系电话：</span><span className="text-slate-700">{req.phone}</span></div>
                          <div><span className="text-slate-400">申请时间：</span><span>{req.createTime}</span></div>
                        </div>
                        {req.address && (
                          <p className="text-xs text-slate-500 mt-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                            <span className="text-slate-400">📍 收件地址：</span>{req.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && requestList.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
              共 {requestList.length} 条申请记录
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 纸质证书邮寄申请弹窗 */}
      {/* ============================================================== */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                </div>
                申请纸质版证书
              </h3>
              <button onClick={() => { setApplyModalOpen(false); setSelectedCert(null); }} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleApplySubmit({
                receiverName: formData.get('receiverName'),
                phone: formData.get('phone'),
                address: formData.get('address')
              });
            }} className="p-6 space-y-5">
              
              <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-lg border border-amber-200 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">info</span>
                <p>提交申请后，管理员将为您制作并打印纸质版证书。由于物流配送原因，请务必填写真实有效的收件信息。</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">收件人姓名 <span className="text-red-500">*</span></label>
                <input 
                  name="receiverName"
                  required
                  autoFocus
                  type="text" 
                  placeholder="例如：张三"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">联系电话 <span className="text-red-500">*</span></label>
                <input 
                  name="phone"
                  required
                  type="tel" 
                  placeholder="例如：13812345678"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">详细邮寄地址 <span className="text-red-500">*</span></label>
                <textarea 
                  name="address"
                  required
                  rows="3" 
                  placeholder="请具体到省市区、街道、小区门牌号"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => { setApplyModalOpen(false); setSelectedCert(null); }} 
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  disabled={applying} 
                  className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 transition-all active:scale-[0.98] flex items-center gap-2 shadow-md shadow-blue-600/20"
                >
                  {applying ? <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> 提交中</> : '确认申请'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {previewCert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm px-4 py-8" onClick={(e) => e.target === e.currentTarget && setPreviewCert(null)}>
          <div className="relative w-full max-w-[720px] animate-in zoom-in-95 duration-300">
            <button onClick={() => setPreviewCert(null)} className="absolute -top-3 -right-3 z-10 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors border border-slate-200">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="relative bg-gradient-to-br from-amber-50 via-white to-orange-50 rounded-lg shadow-2xl overflow-hidden" style={{ aspectRatio: '1.4 / 1' }} ref={certRef}>
              <div className="absolute inset-3 md:inset-5 border-2 border-amber-600/30 rounded-md"></div>
              <div className="absolute inset-[14px] md:inset-[18px] border border-amber-400/20 rounded-sm"></div>

              <div className="absolute top-0 left-0 w-16 h-16 md:w-20 md:h-20">
                <div className="absolute top-2 left-2 w-10 h-10 md:w-12 md:h-12 border-t-2 border-l-2 border-amber-600/60 rounded-tl-lg"></div>
                <div className="absolute top-4 left-4 w-6 h-6 md:w-8 md:h-8 border-t border-l border-amber-400/30 rounded-tl-md"></div>
              </div>
              <div className="absolute top-0 right-0 w-16 h-16 md:w-20 md:h-20">
                <div className="absolute top-2 right-2 w-10 h-10 md:w-12 md:h-12 border-t-2 border-r-2 border-amber-600/60 rounded-tr-lg"></div>
                <div className="absolute top-4 right-4 w-6 h-6 md:w-8 md:h-8 border-t border-r border-amber-400/30 rounded-tr-md"></div>
              </div>
              <div className="absolute bottom-0 left-0 w-16 h-16 md:w-20 md:h-20">
                <div className="absolute bottom-2 left-2 w-10 h-10 md:w-12 md:h-12 border-b-2 border-l-2 border-amber-600/60 rounded-bl-lg"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 md:w-8 md:h-8 border-b border-l border-amber-400/30 rounded-bl-md"></div>
              </div>
              <div className="absolute bottom-0 right-0 w-16 h-16 md:w-20 md:h-20">
                <div className="absolute bottom-2 right-2 w-10 h-10 md:w-12 md:h-12 border-b-2 border-r-2 border-amber-600/60 rounded-br-lg"></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 md:w-8 md:h-8 border-b border-r border-amber-400/30 rounded-br-md"></div>
              </div>

              <div className="relative z-10 h-full flex flex-col items-center justify-between px-8 md:px-16 py-6 md:py-8">
                <div className="text-center flex-shrink-0">
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <div className="h-[2px] w-12 md:w-20 bg-gradient-to-r from-transparent to-amber-500/60"></div>
                    <span className="material-symbols-outlined text-amber-600 text-2xl md:text-3xl">workspace_premium</span>
                    <div className="h-[2px] w-12 md:w-20 bg-gradient-to-l from-transparent to-amber-500/60"></div>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black tracking-[0.25em] text-amber-800 uppercase">Certificate</h2>
                  <p className="text-[10px] md:text-xs tracking-[0.3em] text-amber-600/80 uppercase mt-0.5 font-medium">of Achievement</p>
                  <p className="text-[10px] text-slate-400 mt-1 tracking-wide">课程结业证书</p>
                </div>

                <div className="flex-1 flex items-center justify-center w-full my-2 md:my-4 px-2">
                  <div className="text-center max-w-full">
                    <p className="text-xs md:text-sm text-slate-500 mb-2 font-medium tracking-wide">兹证明</p>
                    <p className="text-base md:text-xl font-bold text-slate-800 border-b-2 border-amber-400/40 inline-block px-6 md:px-10 py-1 min-w-[160px] md:min-w-[220px]">
                      {userInfo?.name || '学员'}
                    </p>
                    <p className="mt-3 md:mt-4 text-lg md:text-2xl font-extrabold text-amber-900 leading-snug tracking-wide px-4 break-words" style={{ fontFamily: "'SimSun', 'STSong', serif" }}>
                      {previewCert.courseName || '—'}
                    </p>
                    <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium">培训课程考核成绩合格，特发此证。</p>
                  </div>
                </div>

                <div className="w-full flex-shrink-0 flex items-end justify-between gap-4 md:gap-8 pt-3 md:pt-4 border-t border-dashed border-amber-300/30">
                  <div className="text-left min-w-[120px] md:min-w-[160px]">
                    <p className="text-[10px] text-slate-400 mb-1">证书编号</p>
                    <p className="text-xs md:text-sm font-mono font-bold text-slate-700 tracking-wider">{previewCert.certNo || '—'}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-amber-500/40 flex items-center justify-center bg-amber-50/50">
                      <span className="material-symbols-outlined text-amber-600 text-xl md:text-2xl">verified</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">官方认证</p>
                  </div>
                  <div className="text-right min-w-[120px] md:min-w-[160px]">
                    <p className="text-[10px] text-slate-400 mb-1">颁发日期</p>
                    <p className="text-xs md:text-sm font-bold text-slate-700">{previewCert.issueDate || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")", backgroundSize: '60px 60px' }}></div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={handleDownload} disabled={downloading} className="px-8 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-all active:scale-[0.98] shadow-md flex items-center gap-2">
                {downloading ? (
                  <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> 生成中...</>
                ) : (
                  <><span className="material-symbols-outlined text-[16px]">download</span> 下载证书</>
                )}
              </button>
              <button onClick={() => setPreviewCert(null)} className="px-8 py-2.5 text-sm font-bold text-white bg-slate-600 hover:bg-slate-700 rounded-xl transition-all active:scale-[0.98] shadow-md">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
