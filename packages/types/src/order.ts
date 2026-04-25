import { z } from 'zod';

// ERD §3.4와 0001_init.sql 기준으로 기본값만 있는 컬럼도 DB nullable이면 그대로 nullable 처리한다.
export const OrderStatusSchema = z.enum([
  'received',
  'happy_call_pending',
  'happy_call_done',
  'scheduled',
  'assigned',
  'en_route',
  'on_site',
  'in_progress',
  'no_drill_completed',
  'drill_converted_completed',
  'awaiting_payment',
  'payment_sent',
  'paid',
  'postponed',
  'on_hold',
  'cancel_requested',
  'cancel_confirmed_coupang_transfer',
  'closed',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderOptionSchema = z.enum(['A_stand', 'B_drill', 'C_no_drill']);
export type OrderOption = z.infer<typeof OrderOptionSchema>;

const HappyCallResultSchema = z.enum(['high', 'medium', 'low', 'unavailable']);
const WallTypeSchema = z.enum(['concrete', 'drywall_cavity', 'drywall_solid', 'unknown']);
const ConversionAgreedMethodSchema = z.enum(['verbal', 'sms', 'phone']);

export const OrderSchema = z.object({
  id: z.string().uuid(),
  coupang_order_id: z.string(),
  order_received_at: z.coerce.date(),
  customer_id: z.string().uuid(),
  tv_brand: z.string().nullable(),
  tv_model: z.string().nullable(),
  tv_size_inch: z.number().int().nullable(),
  tv_serial: z.string().nullable(),
  option_selected: OrderOptionSchema,
  price_option_a: z.number().nullable(),
  price_option_b: z.number(),
  price_option_c: z.number(),
  price_paid_by_customer_to_coupang: z.number(),
  currency: z.string().nullable(),
  requested_install_date: z.coerce.date().nullable(),
  requested_install_date_2: z.coerce.date().nullable(),
  scheduled_installation_at: z.coerce.date().nullable(),
  scheduled_tz: z.string().nullable(),
  status: OrderStatusSchema,
  status_changed_at: z.coerce.date().nullable(),
  assigned_technician_id: z.string().uuid().nullable(),
  assigned_at: z.coerce.date().nullable(),
  happy_call_result: HappyCallResultSchema.nullable(),
  wall_type: WallTypeSchema.nullable(),
  special_notes: z.string().nullable(),
  conversion_from_no_drill: z.boolean().nullable(),
  conversion_difference_amount: z.number().nullable(),
  conversion_agreed_method: ConversionAgreedMethodSchema.nullable(),
  conversion_agreed_at: z.coerce.date().nullable(),
  coupang_paid_at: z.coerce.date().nullable(),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
  retention_until: z.coerce.date().nullable(),
});
export type Order = z.infer<typeof OrderSchema>;
