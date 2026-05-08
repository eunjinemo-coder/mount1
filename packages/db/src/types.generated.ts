export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          display_name: string
          email: string
          failed_login_count: number
          id: string
          ip_whitelist: Json
          locked_until: string | null
          role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          display_name: string
          email: string
          failed_login_count?: number
          id?: string
          ip_whitelist?: Json
          locked_until?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          display_name?: string
          email?: string
          failed_login_count?: number
          id?: string
          ip_whitelist?: Json
          locked_until?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after_value: Json | null
          before_value: Json | null
          id: string
          ip_address: unknown
          occurred_at: string
          subject_id: string
          subject_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          after_value?: Json | null
          before_value?: Json | null
          id?: string
          ip_address?: unknown
          occurred_at?: string
          subject_id: string
          subject_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after_value?: Json | null
          before_value?: Json | null
          id?: string
          ip_address?: unknown
          occurred_at?: string
          subject_id?: string
          subject_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          admin_alerted_at: string | null
          call_duration_seconds: number | null
          call_outcome: string | null
          called_at: string | null
          created_at: string | null
          id: string
          order_id: string
          reminder_sent_at: string | null
          technician_id: string
          type: string
          warning_sent_at: string | null
        }
        Insert: {
          admin_alerted_at?: string | null
          call_duration_seconds?: number | null
          call_outcome?: string | null
          called_at?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          reminder_sent_at?: string | null
          technician_id: string
          type: string
          warning_sent_at?: string | null
        }
        Update: {
          admin_alerted_at?: string | null
          call_duration_seconds?: number | null
          call_outcome?: string | null
          called_at?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          reminder_sent_at?: string | null
          technician_id?: string
          type?: string
          warning_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "call_logs_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_reports: {
        Row: {
          category_primary: string
          coupang_transfer_at: string | null
          coupang_transfer_status: string | null
          created_at: string | null
          id: string
          order_id: string
          photo_ids: string[]
          signature_image_url: string
          situation_note: string
          sub_reasons: string[] | null
          technician_id: string
        }
        Insert: {
          category_primary: string
          coupang_transfer_at?: string | null
          coupang_transfer_status?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          photo_ids?: string[]
          signature_image_url: string
          situation_note: string
          sub_reasons?: string[] | null
          technician_id: string
        }
        Update: {
          category_primary?: string
          coupang_transfer_at?: string | null
          coupang_transfer_status?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          photo_ids?: string[]
          signature_image_url?: string
          situation_note?: string
          sub_reasons?: string[] | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_reports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "cancellation_reports_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      coupang_order_staging: {
        Row: {
          created_at: string | null
          id: string
          mapped_data: Json | null
          promoted_at: string | null
          promoted_order_id: string | null
          raw_data: Json
          source: string
          source_meta: Json
          validation_errors: Json | null
          validation_status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mapped_data?: Json | null
          promoted_at?: string | null
          promoted_order_id?: string | null
          raw_data: Json
          source: string
          source_meta?: Json
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mapped_data?: Json | null
          promoted_at?: string | null
          promoted_order_id?: string | null
          raw_data?: Json
          source?: string
          source_meta?: Json
          validation_errors?: Json | null
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupang_order_staging_promoted_order_id_fkey"
            columns: ["promoted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupang_order_staging_promoted_order_id_fkey"
            columns: ["promoted_order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupang_order_staging_promoted_order_id_fkey"
            columns: ["promoted_order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
        ]
      }
      customers: {
        Row: {
          address_detail_encrypted: string | null
          address_lat: number | null
          address_lng: number | null
          address_region_sido: string | null
          address_region_sigungu: string | null
          address_road_encrypted: string | null
          coupang_customer_id: string | null
          created_at: string | null
          id: string
          name_encrypted: string
          phone_encrypted: string
          phone_tail4: string
          pii_retained_until: string | null
          updated_at: string | null
        }
        Insert: {
          address_detail_encrypted?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_region_sido?: string | null
          address_region_sigungu?: string | null
          address_road_encrypted?: string | null
          coupang_customer_id?: string | null
          created_at?: string | null
          id?: string
          name_encrypted: string
          phone_encrypted: string
          phone_tail4: string
          pii_retained_until?: string | null
          updated_at?: string | null
        }
        Update: {
          address_detail_encrypted?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_region_sido?: string | null
          address_region_sigungu?: string | null
          address_road_encrypted?: string | null
          coupang_customer_id?: string | null
          created_at?: string | null
          id?: string
          name_encrypted?: string
          phone_encrypted?: string
          phone_tail4?: string
          pii_retained_until?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dispatches: {
        Row: {
          assigned: boolean | null
          assigned_at: string | null
          assigned_by_admin_user_id: string | null
          created_at: string | null
          id: string
          order_id: string
          override_reason: string | null
          rank: number | null
          recommendation_run_id: string | null
          score: number | null
          score_breakdown: Json | null
          technician_id: string
        }
        Insert: {
          assigned?: boolean | null
          assigned_at?: string | null
          assigned_by_admin_user_id?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          override_reason?: string | null
          rank?: number | null
          recommendation_run_id?: string | null
          score?: number | null
          score_breakdown?: Json | null
          technician_id: string
        }
        Update: {
          assigned?: boolean | null
          assigned_at?: string | null
          assigned_by_admin_user_id?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          override_reason?: string | null
          rank?: number | null
          recommendation_run_id?: string | null
          score?: number | null
          score_breakdown?: Json | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_assigned_by_admin_user_id_fkey"
            columns: ["assigned_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "dispatches_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      happy_calls: {
        Row: {
          additional_options: string[] | null
          admin_user_id: string
          auto_verdict: string | null
          called_at: string | null
          created_at: string | null
          elevator_size: string | null
          free_note: string | null
          id: string
          interference_note: string | null
          order_id: string
          outlet_condition_note: string | null
          outlet_position: string | null
          parking_available: boolean | null
          preferred_time_1: string | null
          preferred_time_2: string | null
          tv_box_unopened: boolean | null
          verdict_reasoning: string | null
          wall_type: string | null
        }
        Insert: {
          additional_options?: string[] | null
          admin_user_id: string
          auto_verdict?: string | null
          called_at?: string | null
          created_at?: string | null
          elevator_size?: string | null
          free_note?: string | null
          id?: string
          interference_note?: string | null
          order_id: string
          outlet_condition_note?: string | null
          outlet_position?: string | null
          parking_available?: boolean | null
          preferred_time_1?: string | null
          preferred_time_2?: string | null
          tv_box_unopened?: boolean | null
          verdict_reasoning?: string | null
          wall_type?: string | null
        }
        Update: {
          additional_options?: string[] | null
          admin_user_id?: string
          auto_verdict?: string | null
          called_at?: string | null
          created_at?: string | null
          elevator_size?: string | null
          free_note?: string | null
          id?: string
          interference_note?: string | null
          order_id?: string
          outlet_condition_note?: string | null
          outlet_position?: string | null
          parking_available?: boolean | null
          preferred_time_1?: string | null
          preferred_time_2?: string | null
          tv_box_unopened?: boolean | null
          verdict_reasoning?: string | null
          wall_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "happy_calls_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "happy_calls_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "happy_calls_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "happy_calls_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
        ]
      }
      installations: {
        Row: {
          actual_outcome: string | null
          arrived_at: string | null
          arrived_lat: number | null
          arrived_lng: number | null
          completed_at: string | null
          completed_lat: number | null
          completed_lng: number | null
          created_at: string | null
          departed_at: string | null
          id: string
          on_site_notes: string | null
          order_id: string
          predicted_outcome: string | null
          result_type: string | null
          route_sequence: number | null
          started_at: string | null
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          actual_outcome?: string | null
          arrived_at?: string | null
          arrived_lat?: number | null
          arrived_lng?: number | null
          completed_at?: string | null
          completed_lat?: number | null
          completed_lng?: number | null
          created_at?: string | null
          departed_at?: string | null
          id?: string
          on_site_notes?: string | null
          order_id: string
          predicted_outcome?: string | null
          result_type?: string | null
          route_sequence?: number | null
          started_at?: string | null
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          actual_outcome?: string | null
          arrived_at?: string | null
          arrived_lat?: number | null
          arrived_lng?: number | null
          completed_at?: string | null
          completed_lat?: number | null
          completed_lng?: number | null
          created_at?: string | null
          departed_at?: string | null
          id?: string
          on_site_notes?: string | null
          order_id?: string
          predicted_outcome?: string | null
          result_type?: string | null
          route_sequence?: number | null
          started_at?: string | null
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "installations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          auto_triggered_action: string | null
          category: string
          created_at: string | null
          id: string
          note: string | null
          order_id: string
          photo_ids: string[] | null
          reported_at: string | null
          sub_reasons: string[] | null
          technician_id: string
        }
        Insert: {
          auto_triggered_action?: string | null
          category: string
          created_at?: string | null
          id?: string
          note?: string | null
          order_id: string
          photo_ids?: string[] | null
          reported_at?: string | null
          sub_reasons?: string[] | null
          technician_id: string
        }
        Update: {
          auto_triggered_action?: string | null
          category?: string
          created_at?: string | null
          id?: string
          note?: string | null
          order_id?: string
          photo_ids?: string[] | null
          reported_at?: string | null
          sub_reasons?: string[] | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "issues_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          order_id: string | null
          payload: Json
          provider: string | null
          provider_message_id: string | null
          recipient_id: string | null
          recipient_phone: string | null
          recipient_type: string
          sent_at: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          order_id?: string | null
          payload: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string | null
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_at: string | null
          assigned_technician_id: string | null
          conversion_agreed_at: string | null
          conversion_agreed_method: string | null
          conversion_difference_amount: number | null
          conversion_from_no_drill: boolean | null
          coupang_order_id: string
          coupang_paid_at: string | null
          created_at: string | null
          currency: string | null
          customer_id: string
          happy_call_result: string | null
          id: string
          option_selected: string
          order_received_at: string
          price_option_a: number | null
          price_option_b: number
          price_option_c: number
          price_paid_by_customer_to_coupang: number
          requested_install_date: string | null
          requested_install_date_2: string | null
          retention_until: string | null
          scheduled_installation_at: string | null
          scheduled_tz: string | null
          special_notes: string | null
          status: string
          status_changed_at: string | null
          tv_brand: string | null
          tv_model: string | null
          tv_serial: string | null
          tv_size_inch: number | null
          updated_at: string | null
          wall_type: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_technician_id?: string | null
          conversion_agreed_at?: string | null
          conversion_agreed_method?: string | null
          conversion_difference_amount?: number | null
          conversion_from_no_drill?: boolean | null
          coupang_order_id: string
          coupang_paid_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id: string
          happy_call_result?: string | null
          id?: string
          option_selected: string
          order_received_at: string
          price_option_a?: number | null
          price_option_b: number
          price_option_c: number
          price_paid_by_customer_to_coupang: number
          requested_install_date?: string | null
          requested_install_date_2?: string | null
          retention_until?: string | null
          scheduled_installation_at?: string | null
          scheduled_tz?: string | null
          special_notes?: string | null
          status?: string
          status_changed_at?: string | null
          tv_brand?: string | null
          tv_model?: string | null
          tv_serial?: string | null
          tv_size_inch?: number | null
          updated_at?: string | null
          wall_type?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_technician_id?: string | null
          conversion_agreed_at?: string | null
          conversion_agreed_method?: string | null
          conversion_difference_amount?: number | null
          conversion_from_no_drill?: boolean | null
          coupang_order_id?: string
          coupang_paid_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          happy_call_result?: string | null
          id?: string
          option_selected?: string
          order_received_at?: string
          price_option_a?: number | null
          price_option_b?: number
          price_option_c?: number
          price_paid_by_customer_to_coupang?: number
          requested_install_date?: string | null
          requested_install_date_2?: string | null
          retention_until?: string | null
          scheduled_installation_at?: string | null
          scheduled_tz?: string | null
          special_notes?: string | null
          status?: string
          status_changed_at?: string | null
          tv_brand?: string | null
          tv_model?: string | null
          tv_serial?: string | null
          tv_size_inch?: number | null
          updated_at?: string | null
          wall_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_for_technician"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string
          id: string
          idempotency_key: string
          order_id: string
          pg_link_token: string
          pg_provider: string
          purpose: string
          reissue_count: number | null
          reissue_of_link_id: string | null
          sent_at: string | null
          sent_via: string[]
          sheet_row_number: number | null
          short_url: string | null
          status: string | null
          synced_to_sheet_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          expires_at: string
          id?: string
          idempotency_key: string
          order_id: string
          pg_link_token: string
          pg_provider: string
          purpose: string
          reissue_count?: number | null
          reissue_of_link_id?: string | null
          sent_at?: string | null
          sent_via?: string[]
          sheet_row_number?: number | null
          short_url?: string | null
          status?: string | null
          synced_to_sheet_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          pg_link_token?: string
          pg_provider?: string
          purpose?: string
          reissue_count?: number | null
          reissue_of_link_id?: string | null
          sent_at?: string | null
          sent_via?: string[]
          sheet_row_number?: number | null
          short_url?: string | null
          status?: string | null
          synced_to_sheet_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payment_links_reissue_of_link_id_fkey"
            columns: ["reissue_of_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          method: string | null
          order_id: string
          paid_at: string
          payment_link_id: string | null
          pg_approval_no: string | null
          pg_provider: string
          pg_tid: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          webhook_idempotency_key: string
          webhook_raw: Json | null
          webhook_received_at: string | null
          webhook_verified: boolean | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          method?: string | null
          order_id: string
          paid_at: string
          payment_link_id?: string | null
          pg_approval_no?: string | null
          pg_provider: string
          pg_tid?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          webhook_idempotency_key: string
          webhook_raw?: Json | null
          webhook_received_at?: string | null
          webhook_verified?: boolean | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          method?: string | null
          order_id?: string
          paid_at?: string
          payment_link_id?: string | null
          pg_approval_no?: string | null
          pg_provider?: string
          pg_tid?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          webhook_idempotency_key?: string
          webhook_raw?: Json | null
          webhook_received_at?: string | null
          webhook_verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "payments_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          access_count: number | null
          height: number | null
          id: string
          installation_id: string | null
          last_accessed_at: string | null
          mime_type: string | null
          order_id: string
          r2_key: string | null
          sha256: string | null
          size_bytes: number | null
          slot: string
          storage_tier: string
          supabase_path: string | null
          taken_at: string | null
          taken_lat: number | null
          taken_lng: number | null
          technician_id: string
          thumbnail_supabase_path: string | null
          tier_changed_at: string | null
          uploaded_at: string | null
          width: number | null
        }
        Insert: {
          access_count?: number | null
          height?: number | null
          id?: string
          installation_id?: string | null
          last_accessed_at?: string | null
          mime_type?: string | null
          order_id: string
          r2_key?: string | null
          sha256?: string | null
          size_bytes?: number | null
          slot: string
          storage_tier?: string
          supabase_path?: string | null
          taken_at?: string | null
          taken_lat?: number | null
          taken_lng?: number | null
          technician_id: string
          thumbnail_supabase_path?: string | null
          tier_changed_at?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Update: {
          access_count?: number | null
          height?: number | null
          id?: string
          installation_id?: string | null
          last_accessed_at?: string | null
          mime_type?: string | null
          order_id?: string
          r2_key?: string | null
          sha256?: string | null
          size_bytes?: number | null
          slot?: string
          storage_tier?: string
          supabase_path?: string | null
          taken_at?: string | null
          taken_lat?: number | null
          taken_lng?: number | null
          technician_id?: string
          thumbnail_supabase_path?: string | null
          tier_changed_at?: string | null
          uploaded_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "installations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_technician_today"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "photos_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_availabilities: {
        Row: {
          created_at: string | null
          default_weekend_enabled: boolean | null
          default_workday_end: string | null
          default_workday_start: string | null
          id: string
          special_available: boolean | null
          special_date: string | null
          special_note: string | null
          technician_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          default_weekend_enabled?: boolean | null
          default_workday_end?: string | null
          default_workday_start?: string | null
          id?: string
          special_available?: boolean | null
          special_date?: string | null
          special_note?: string | null
          technician_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          default_weekend_enabled?: boolean | null
          default_workday_end?: string | null
          default_workday_start?: string | null
          id?: string
          special_available?: boolean | null
          special_date?: string | null
          special_note?: string | null
          technician_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_availabilities_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_recurring_offdays: {
        Row: {
          active: boolean
          created_at: string | null
          day_of_week: number
          id: string
          note: string | null
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          day_of_week: number
          id?: string
          note?: string | null
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          day_of_week?: number
          id?: string
          note?: string | null
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_recurring_offdays_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_service_areas: {
        Row: {
          active: boolean
          created_at: string | null
          id: string
          priority: number
          region_sido: string
          region_sigungu: string
          technician_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          id?: string
          priority?: number
          region_sido: string
          region_sigungu: string
          technician_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          id?: string
          priority?: number
          region_sido?: string
          region_sigungu?: string
          technician_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_service_areas_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_vacations: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
          technician_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          technician_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_vacations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_vacations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          auth_user_id: string | null
          birth_date: string | null
          created_at: string | null
          daily_max_jobs: number | null
          device_fingerprint_primary: string | null
          device_fingerprints_all: string[] | null
          display_name: string
          email: string | null
          failed_login_count: number | null
          grade: string | null
          home_base_region: string | null
          id: string
          last_known_lat: number | null
          last_known_lng: number | null
          last_location_updated_at: string | null
          last_pw_changed_at: string | null
          locked_until: string | null
          login_id: string
          phone: string
          preferred_regions: string[] | null
          status: string | null
          updated_at: string | null
          vehicle_number: string | null
          weekend_enabled: boolean | null
        }
        Insert: {
          auth_user_id?: string | null
          birth_date?: string | null
          created_at?: string | null
          daily_max_jobs?: number | null
          device_fingerprint_primary?: string | null
          device_fingerprints_all?: string[] | null
          display_name: string
          email?: string | null
          failed_login_count?: number | null
          grade?: string | null
          home_base_region?: string | null
          id?: string
          last_known_lat?: number | null
          last_known_lng?: number | null
          last_location_updated_at?: string | null
          last_pw_changed_at?: string | null
          locked_until?: string | null
          login_id: string
          phone: string
          preferred_regions?: string[] | null
          status?: string | null
          updated_at?: string | null
          vehicle_number?: string | null
          weekend_enabled?: boolean | null
        }
        Update: {
          auth_user_id?: string | null
          birth_date?: string | null
          created_at?: string | null
          daily_max_jobs?: number | null
          device_fingerprint_primary?: string | null
          device_fingerprints_all?: string[] | null
          display_name?: string
          email?: string | null
          failed_login_count?: number | null
          grade?: string | null
          home_base_region?: string | null
          id?: string
          last_known_lat?: number | null
          last_known_lng?: number | null
          last_location_updated_at?: string | null
          last_pw_changed_at?: string | null
          locked_until?: string | null
          login_id?: string
          phone?: string
          preferred_regions?: string[] | null
          status?: string | null
          updated_at?: string | null
          vehicle_number?: string | null
          weekend_enabled?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      v_customer_for_technician: {
        Row: {
          address_lat: number | null
          address_lng: number | null
          address_region_sido: string | null
          address_region_sigungu: string | null
          id: string | null
          phone_tail4: string | null
        }
        Insert: {
          address_lat?: number | null
          address_lng?: number | null
          address_region_sido?: string | null
          address_region_sigungu?: string | null
          id?: string | null
          phone_tail4?: string | null
        }
        Update: {
          address_lat?: number | null
          address_lng?: number | null
          address_region_sido?: string | null
          address_region_sigungu?: string | null
          id?: string | null
          phone_tail4?: string | null
        }
        Relationships: []
      }
      v_orders_dashboard: {
        Row: {
          address_region_sigungu: string | null
          conversion_difference_amount: number | null
          coupang_order_id: string | null
          id: string | null
          last_payment_status: string | null
          option_selected: string | null
          phone_tail4: string | null
          post_photos: number | null
          potential_conversion_diff: number | null
          pre_photos: number | null
          scheduled_installation_at: string | null
          status: string | null
          technician_grade: string | null
          technician_name: string | null
          tv_display: string | null
        }
        Relationships: []
      }
      v_technician_today: {
        Row: {
          assigned_technician_id: string | null
          order_id: string | null
          phone_tail4: string | null
          photo_count: number | null
          pre_call_done: boolean | null
          region: string | null
          scheduled_installation_at: string | null
          status: string | null
          tv: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_role: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      encrypt_pii: { Args: { p_plaintext: string }; Returns: string }
      has_admin_role: { Args: { roles: string[] }; Returns: boolean }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      pii_key: { Args: never; Returns: string }
      rpc_admin_dispatch: {
        Args: {
          p_order_id: string
          p_override_reason?: string
          p_technician_id: string
        }
        Returns: Json
      }
      rpc_admin_recommend_technicians: {
        Args: { p_limit?: number; p_order_id: string }
        Returns: {
          display_name: string
          distance_km: number
          grade: string
          preferred_match: boolean
          score: number
          score_breakdown: Json
          technician_id: string
          today_load: number
          weekly_load: number
        }[]
      }
      rpc_technician_arrive: {
        Args: { p_lat?: number; p_lng?: number; p_order_id: string }
        Returns: Json
      }
      rpc_technician_complete: {
        Args: {
          p_conversion_agreed_method?: string
          p_order_id: string
          p_variant: string
        }
        Returns: Json
      }
      rpc_technician_depart: { Args: { p_order_id: string }; Returns: Json }
      rpc_technician_get_customer_phone: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_technician_log_call: {
        Args: {
          p_duration_seconds?: number
          p_order_id: string
          p_outcome?: string
          p_type?: string
        }
        Returns: Json
      }
      rpc_technician_start_installation: {
        Args: { p_order_id: string }
        Returns: Json
      }
      technician_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
