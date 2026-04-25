import { z } from 'zod';

// ERD §3.1과 0001_init.sql 기준으로 기사 기본값 컬럼도 NOT NULL이 없으면 nullable로 둔다.
export const TechnicianGradeSchema = z.enum(['bronze', 'silver', 'gold']);
export type TechnicianGrade = z.infer<typeof TechnicianGradeSchema>;

export const TechnicianStatusSchema = z.enum(['active', 'paused', 'terminated']);
export type TechnicianStatus = z.infer<typeof TechnicianStatusSchema>;

export const TechnicianSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid().nullable(),
  login_id: z.string(),
  display_name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  birth_date: z.coerce.date().nullable(),
  vehicle_number: z.string().nullable(),
  home_base_region: z.string().nullable(),
  preferred_regions: z.array(z.string()).nullable(),
  grade: TechnicianGradeSchema.nullable(),
  daily_max_jobs: z.number().int().nullable(),
  weekend_enabled: z.boolean().nullable(),
  status: TechnicianStatusSchema.nullable(),
  device_fingerprint_primary: z.string().nullable(),
  device_fingerprints_all: z.array(z.string()).nullable(),
  last_pw_changed_at: z.coerce.date().nullable(),
  failed_login_count: z.number().int().nullable(),
  locked_until: z.coerce.date().nullable(),
  last_known_lat: z.number().nullable(),
  last_known_lng: z.number().nullable(),
  last_location_updated_at: z.coerce.date().nullable(),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
});
export type Technician = z.infer<typeof TechnicianSchema>;
