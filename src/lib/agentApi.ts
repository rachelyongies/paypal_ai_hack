// Request parsing for the agent-facing REST API.
import { z } from 'zod';
import { CATEGORIES } from './types';

export const PayBody = z.object({
  merchant: z.object({ name: z.string().min(1).max(80), domain: z.string().min(3).max(120) }),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        sku: z.string().max(64).optional(),
        category: z.enum(CATEGORIES),
        unit_price: z.number().positive().max(100000),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(25),
  amount: z.number().positive().optional(),
  task: z.string().min(3).max(600),
  note: z.string().max(600).optional(),
  page_excerpt: z.string().max(4000).optional(),
});
