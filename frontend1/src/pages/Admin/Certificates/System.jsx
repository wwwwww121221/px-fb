import React, { useState } from 'react';
import CertificateManagement from './index';
import CertificateRequests from './Requests';

const TABS = [
  { key: 'management', label: '证书管理', icon: 'workspace_premium', desc: '管理电子证书，公示期结束后手动生效' },
  { key: 'requests', label: '证书审核', icon: 'fact_check', desc: '审核学员的纸质证书邮寄申请' }
];

export default function CertificateSystem() {
  const [activeTab, setActiveTab] = useState('management');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-8 rounded-2xl shadow-md text-white flex items-center gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
        <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center shrink-0 border border-white/20">
          <span className="material-symbols-outlined text-3xl">workspace_premium</span>
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold">证书系统</h2>
          <p className="text-violet-100 mt-1 text-sm">电子证书管理与邮寄申请审核一站式处理</p>
        </div>

        <div className="ml-auto relative z-10 flex gap-3">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border font-bold text-sm transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-indigo-700 shadow-lg scale-[1.02] border-transparent'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 border-white/20'
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${activeTab === tab.key ? '' : 'opacity-70'}`}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'management' ? <CertificateManagement /> : <CertificateRequests />}
    </div>
  );
}
