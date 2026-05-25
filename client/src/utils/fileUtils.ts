export const getFileIcon = (storedFilename?: string): string => {
  const ext = storedFilename?.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) return '🖼️';
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext || '')) return '📝';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext || '')) return '📊';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return '📦';
  if (['txt', 'md', 'markdown'].includes(ext || '')) return '📃';
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) return '🎵';
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext || '')) return '🎬';
  return '📁';
};

export const getFileTypeLabel = (storedFilename?: string): string => {
  const ext = storedFilename?.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) return 'Image';
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext || '')) return 'Document';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext || '')) return 'Spreadsheet';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'Archive';
  if (['txt', 'md', 'markdown'].includes(ext || '')) return 'Text';
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) return 'Audio';
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext || '')) return 'Video';
  return 'File';
};