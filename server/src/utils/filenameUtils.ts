const documentTypeKeywords: Record<string, string> = {
  receipt: 'Receipt',
  invoice: 'Invoice',
  bill: 'Bill',
  statement: 'Statement',
  contract: 'Contract',
  policy: 'Policy',
  certificate: 'Certificate',
  passport: 'ID',
  identity: 'ID',
  license: 'License',
  licence: 'License',
  manual: 'Manual',
  report: 'Report',
  booking: 'Booking',
  registration: 'Registration',
  payslip: 'Pay Slip',
  pay_slip: 'Pay Slip',
  salary: 'Pay Slip',
  notice: 'Notice',
  record: 'Record',
  form: 'Form',
};

export interface MetadataSuggestion {
  title?: string;
  category?: string;
  documentType?: string;
  documentDate?: string;
  amount?: number;
  currency?: string;
}

export function suggestMetadataFromFilename(filename: string): MetadataSuggestion {
  const suggestions: MetadataSuggestion = {};

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const filenameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const filenameLower = filenameWithoutExt.toLowerCase();

  for (const [keyword, docType] of Object.entries(documentTypeKeywords)) {
    if (filenameLower.includes(keyword)) {
      suggestions.documentType = docType;
      break;
    }
  }

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

  const amountRegex = /(?:[$€£¥₹]\s*\d+(?:\.\d{2})?|\d+(?:\.\d{2})?\s*[€£¥₹$])/;
  const amountMatch = filenameLower.match(amountRegex);
  if (amountMatch) {
    const amountStr = amountMatch[0].replace(/[^\d.]/g, '');
    if (amountStr) {
      suggestions.amount = parseFloat(amountStr);
      suggestions.currency = amountMatch[0].match(/[€£¥₹$]/)?.[0] || 'USD';
    }
  }

  let title = filenameWithoutExt;
  title = title.replace(/\d{4}[-_]\d{2}[-_]\d{2}/g, '');
  title = title.replace(/\d{2}[-_]\d{2}[-_]\d{4}/g, '');
  title = title.replace(/\d{8}/g, '');
  for (const keyword of Object.keys(documentTypeKeywords)) {
    title = title.replace(new RegExp(keyword, 'gi'), '');
  }
  title = title.trim().replace(/\s+/g, ' ');
  if (title) {
    suggestions.title = title;
  }

  return suggestions;
}
