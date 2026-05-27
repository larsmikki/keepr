
export const generateSafeFilename = (doc: {
  title?: string;
  documentDate?: string;
  documentType?: string;
}, originalExt: string): string => {
  const date = doc.documentDate || new Date().toISOString().split('T')[0];
  const title = (doc.title || 'document').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const type = (doc.documentType || 'doc').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  return `${date}_${title}_${type}${originalExt}`;
};
