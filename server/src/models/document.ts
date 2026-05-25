import { z } from 'zod';

export const DocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  documentType: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  documentDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type DocumentInput = z.infer<typeof DocumentSchema>;
