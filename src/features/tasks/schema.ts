import { z } from "zod";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const taskInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tags: z.array(z.string().min(1).max(50)).max(10),
  dueDate: z.string().regex(ISO_DATE_RE).optional(),
  dueAt: z.string().datetime().optional(),
  estimatedMinutes: z.number().int().positive().max(14400).optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
});

export const requestInputSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(10).max(5000),
  requesterName: z.string().min(1).max(100),
  urgency: z.enum(["low", "medium", "high", "urgent"]),
  desiredDeadline: z.string().regex(ISO_DATE_RE).optional(),
  slug: z.string().min(1), // workspace slug from URL
});

export type TaskInputSchema = z.infer<typeof taskInputSchema>;
export type RequestInputSchema = z.infer<typeof requestInputSchema>;
