export const DOCUMENT_TYPES = [
  'Receipt',
  'Invoice',
  'Bill',
  'Statement',
  'Policy',
  'Contract',
  'Certificate',
  'ID',
  'License',
  'Registration',
  'Manual',
  'Letter',
  'Notice',
  'Form',
  'Record',
  'Report',
  'Booking',
  'Pay Slip',
  'Other',
] as const;

export type DocumentType = typeof DOCUMENT_TYPES[number];
