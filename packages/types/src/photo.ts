import { z } from 'zod';

// ERD §3.6 기준으로 필수 촬영 슬롯과 스토리지 티어 제약을 그대로 enum으로 고정한다.
export const PhotoSlotSchema = z.enum([
  'pre_tv_screen',
  'pre_wall',
  'in_progress',
  'post_front',
  'post_left',
  'post_right',
  'extra',
  'issue_evidence',
]);
export type PhotoSlot = z.infer<typeof PhotoSlotSchema>;

export const PhotoTierSchema = z.enum(['hot', 'warm', 'cold']);
export type PhotoTier = z.infer<typeof PhotoTierSchema>;

export const PhotoSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  installation_id: z.string().uuid().nullable(),
  technician_id: z.string().uuid(),
  slot: PhotoSlotSchema,
  storage_tier: PhotoTierSchema,
  supabase_path: z.string().nullable(),
  r2_key: z.string().nullable(),
  thumbnail_supabase_path: z.string().nullable(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().int().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sha256: z.string().nullable(),
  taken_at: z.coerce.date().nullable(),
  taken_lat: z.number().nullable(),
  taken_lng: z.number().nullable(),
  uploaded_at: z.coerce.date().nullable(),
  tier_changed_at: z.coerce.date().nullable(),
  access_count: z.number().int().nullable(),
  last_accessed_at: z.coerce.date().nullable(),
});
export type Photo = z.infer<typeof PhotoSchema>;
