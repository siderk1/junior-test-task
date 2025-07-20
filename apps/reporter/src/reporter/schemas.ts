import { z } from 'zod';

export const EventsReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['facebook', 'tiktok']).optional(),
  funnelStage: z.enum(['top', 'bottom']).optional(),
  eventType: z.string().optional()
});
export type EventsReportQuery = z.infer<typeof EventsReportQuerySchema>;

export const RevenueReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['facebook', 'tiktok']).optional(),
  campaignId: z.string().optional()
});
export type RevenueReportQuery = z.infer<typeof RevenueReportQuerySchema>;

export const DemographicsReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.enum(['facebook', 'tiktok']).optional()
});
export type DemographicsReportQuery = z.infer<
  typeof DemographicsReportQuerySchema
>;
