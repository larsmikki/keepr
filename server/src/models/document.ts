import { z } from 'zod';

export const DocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  documentDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  folder: z.string().optional(),
});

export type DocumentInput = z.infer<typeof DocumentSchema>;
