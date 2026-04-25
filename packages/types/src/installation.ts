import { z } from 'zod';

// route_sequence는 ERD rev 4에서 deprecated라 신규 쓰기 금지 상태여도 nullable 컬럼으로 유지한다.
export const InstallationResultSchema = z.enum([
  'no_drill_success',
  'drill_converted',
  'postponed',
  'cancelled',
]);
export type InstallationResult = z.infer<typeof InstallationResultSchema>;

export const InstallationSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  technician_id: z.string().uuid(),
  departed_at: z.coerce.date().nullable(),
  arrived_at: z.coerce.date().nullable(),
  started_at: z.coerce.date().nullable(),
  completed_at: z.coerce.date().nullable(),
  arrived_lat: z.number().nullable(),
  arrived_lng: z.number().nullable(),
  completed_lat: z.number().nullable(),
  completed_lng: z.number().nullable(),
  result_type: InstallationResultSchema.nullable(),
  on_site_notes: z.string().nullable(),
  predicted_outcome: z.string().nullable(),
  actual_outcome: z.string().nullable(),
  route_sequence: z.number().int().nullable(),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
});
export type Installation = z.infer<typeof InstallationSchema>;
