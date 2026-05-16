export function getFileExtension({ name, url }) {
  const safeName = typeof name === 'string' ? name : '';
  const safeUrl = typeof url === 'string' ? url : '';
  const fromName = safeName.split('.').pop();
  if (fromName && fromName !== safeName) return fromName.toLowerCase();
  try {
    const parsed = new URL(safeUrl);
    const pathname = parsed.pathname || '';
    const last = pathname.split('/').pop() || '';
    const fromPath = last.split('.').pop();
    if (fromPath && fromPath !== last) return fromPath.toLowerCase();
  } catch (e) {
    const pathname = safeUrl.split('?')[0].split('#')[0];
    const last = pathname.split('/').pop() || '';
    const fromPath = last.split('.').pop();
    if (fromPath && fromPath !== last) return fromPath.toLowerCase();
  }
  return '';
}

export function classifyFile({ name, url, mimeType }) {
  const ext = getFileExtension({ name, url });
  const type = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';

  const isPdf = type.includes('pdf') || ext === 'pdf';
  const isImage = type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  const isVideo = type.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
  const isAudio = type.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].includes(ext);
  const isText = type.startsWith('text/') || ['txt', 'md', 'log'].includes(ext);
  const isOffice = [
    'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'
  ].includes(ext) || type.includes('msword') || type.includes('officedocument') || type.includes('powerpoint') || type.includes('excel');

  return {
    ext,
    isPdf,
    isImage,
    isVideo,
    isAudio,
    isText,
    isOffice,
  };
}

export function buildOfficeViewerUrl(fileUrl, filename) {
  const encoded = encodeURIComponent(fileUrl);
  const namePart = filename ? `&name=${encodeURIComponent(filename)}` : '';
  return `/api/preview/pdf?fileUrl=${encoded}${namePart}&disposition=inline`;
}

export function buildPreviewTarget({ name, url, mimeType }) {
  const flags = classifyFile({ name, url, mimeType });
  if (flags.isPdf) return { kind: 'iframe', url };
  if (flags.isImage) return { kind: 'image', url };
  if (flags.isVideo) return { kind: 'video', url };
  if (flags.isAudio) return { kind: 'audio', url };
  if (flags.isOffice) {
    const provider = (import.meta.env?.VITE_OFFICE_PREVIEW || 'pdf').toLowerCase();
    if (provider === 'pdf') return { kind: 'iframe', url: buildOfficeViewerUrl(url, name), note: 'Office 文件已自动转为 PDF 预览' };
    if (provider === 'ms') {
      const encoded = encodeURIComponent(url);
      return { kind: 'iframe', url: `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}&ui=en-US&rs=en-US`, note: 'Office 预览依赖外部在线服务' };
    }
    return { kind: 'unsupported', url, note: '当前环境未配置 Office 在线预览' };
  }
  if (flags.isText) return { kind: 'iframe', url };
  return { kind: 'unsupported', url, note: '当前类型不支持网页预览' };
}

export function triggerDownload({ name, url }) {
  const link = document.createElement('a');
  link.href = url;
  if (name) link.download = name;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

