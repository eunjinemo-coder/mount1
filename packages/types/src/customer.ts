import { z } from 'zod';

// bytea는 드라이버별 표현 차이를 줄이기 위해 Buffer 호환 Uint8Array로 추상화한다.
const EncryptedBytesSchema = z.instanceof(Uint8Array);

// ERD §3.2 기준으로 기사에게는 최소 식별 정보만 노출하는 축약 스키마를 함께 제공한다.
export const CustomerSchema = z.object({
  id: z.string().uuid(),
  name_encrypted: EncryptedBytesSchema,
  phone_encrypted: EncryptedBytesSchema,
  phone_tail4: z.string(),
  address_road_encrypted: EncryptedBytesSchema.nullable(),
  address_detail_encrypted: EncryptedBytesSchema.nullable(),
  address_region_sido: z.string().nullable(),
  address_region_sigungu: z.string().nullable(),
  address_lat: z.number().nullable(),
  address_lng: z.number().nullable(),
  coupang_customer_id: z.string().nullable(),
  pii_retained_until: z.coerce.date().nullable(),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerForTechnicianSchema = z.object({
  id: z.string().uuid(),
  phone_tail4: z.string(),
  address_region_sido: z.string().nullable(),
  address_region_sigungu: z.string().nullable(),
  address_lat: z.number().nullable(),
  address_lng: z.number().nullable(),
});
export type CustomerForTechnician = z.infer<typeof CustomerForTechnicianSchema>;
