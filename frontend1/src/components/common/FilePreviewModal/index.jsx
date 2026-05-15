import React, { useEffect, useMemo } from 'react';
import { buildPreviewTarget, triggerDownload } from '../../../utils/filePreview';

export default function FilePreviewModal({ isOpen, onClose, file }) {
  const previewTarget = useMemo(() => {
    if (!file?.url) return null;
    return buildPreviewTarget({
      name: file?.name,
      url: file?.url,
      mimeType: file?.mimeType || file?.type,
    });
  }, [file]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file?.url) return null;

  const handleDownload = () => triggerDownload({ name: file?.name, url: file?.url });
  const handleOpenNew = () => {
    const openUrl = previewTarget?.kind === 'iframe' && previewTarget?.url ? previewTarget.url : file.url;
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="bg-white w-[96vw] h-[92vh] max-w-[1400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 truncate" title={file?.name}>
              {file?.name || '文件预览'}
            </h3>
            {previewTarget?.note ? <div className="text-xs text-slate-500 mt-0.5">{previewTarget.note}</div> : null}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 bg-slate-100 overflow-hidden">
          {previewTarget?.kind === 'image' ? (
            <div className="w-full h-full overflow-auto p-4 flex items-center justify-center">
              <img src={previewTarget.url} alt={file?.name || 'image'} className="max-w-full h-auto rounded-lg shadow" />
            </div>
          ) : previewTarget?.kind === 'video' ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <video src={previewTarget.url} controls className="w-full h-full object-contain" />
            </div>
          ) : previewTarget?.kind === 'audio' ? (
            <div className="w-full h-full flex items-center justify-center p-6">
              <audio src={previewTarget.url} controls className="w-full" />
            </div>
          ) : previewTarget?.kind === 'iframe' ? (
            <iframe
              title={file?.name || 'preview'}
              src={previewTarget.url}
              className="w-full h-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <span className="material-symbols-outlined text-6xl mb-4 opacity-40">description</span>
              <div className="font-bold text-slate-700 mb-2">暂不支持网页预览</div>
              <div className="text-sm">{previewTarget?.note || '你可以选择下载，或在新窗口打开源文件。'}</div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleOpenNew}
            className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            新窗口打开
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            下载
          </button>
        </div>
      </div>
    </div>
  );
}
