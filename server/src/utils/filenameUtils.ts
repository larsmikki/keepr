export interface MetadataSuggestion {
  title?: string;
  documentDate?: string;
}

export function suggestMetadataFromFilename(filename: string): MetadataSuggestion {
  const suggestions: MetadataSuggestion = {};

  const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const filenameLower = filenameWithoutExt.toLowerCase();

  const dateRegex = /\d{4}[-_]\d{2}[-_]\d{2}|\d{2}[-_]\d{2}[-_]\d{4}|\d{4}\d{2}\d{2}/;
  const dateMatch = filenameLower.match(dateRegex);
  if (dateMatch) {
    let dateStr = dateMatch[0].replace(/[-_]/g, '-');
    if (dateStr.length === 8) {
      dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    } else if (dateStr.length === 10 && dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts[0].length === 2) {
        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    suggestions.documentDate = dateStr;
  }

  let title = filenameWithoutExt;
  title = title.replace(/\d{4}[-_]\d{2}[-_]\d{2}/g, '');
  title = title.replace(/\d{2}[-_]\d{2}[-_]\d{4}/g, '');
  title = title.replace(/\d{8}/g, '');
  title = title.trim().replace(/\s+/g, ' ');
  if (title) {
    suggestions.title = title;
  }

  return suggestions;
}
