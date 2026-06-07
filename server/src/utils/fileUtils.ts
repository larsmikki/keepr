
export const parseTags = (raw: string | null | undefined): string[] => {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const generateSafeFilename = (doc: {
  title?: string;
  documentDate?: string;
}, originalExt: string): string => {
  const date = doc.documentDate || new Date().toISOString().split('T')[0];
  const title = (doc.title || 'document').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  return `${date}_${title}${originalExt}`;
};
