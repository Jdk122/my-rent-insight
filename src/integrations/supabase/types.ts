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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          address: string | null
          bedrooms: number | null
          cache_hit: boolean | null
          city: string | null
          comp_median_rent: number | null
          comps_count: number | null
          comps_position: string | null
          created_at: string
          current_rent: number | null
          fair_counter_offer: string | null
          fairness_score: number | null
          hud_fmr_value: number | null
          id: string
          increase_pct: number | null
          letter_generated: boolean | null
          market_trend_pct: number | null
          markup_multiplier: number | null
          proposed_rent: number | null
          sale_data_found: boolean | null
          state: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          bedrooms?: number | null
          cache_hit?: boolean | null
          city?: string | null
          comp_median_rent?: number | null
          comps_count?: number | null
          comps_position?: string | null
          created_at?: string
          current_rent?: number | null
          fair_counter_offer?: string | null
          fairness_score?: number | null
          hud_fmr_value?: number | null
          id?: string
          increase_pct?: number | null
          letter_generated?: boolean | null
          market_trend_pct?: number | null
          markup_multiplier?: number | null
          proposed_rent?: number | null
          sale_data_found?: boolean | null
          state?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          bedrooms?: number | null
          cache_hit?: boolean | null
          city?: string | null
          comp_median_rent?: number | null
          comps_count?: number | null
          comps_position?: string | null
          created_at?: string
          current_rent?: number | null
          fair_counter_offer?: string | null
          fairness_score?: number | null
          hud_fmr_value?: number | null
          id?: string
          increase_pct?: number | null
          letter_generated?: boolean | null
          market_trend_pct?: number | null
          markup_multiplier?: number | null
          proposed_rent?: number | null
          sale_data_found?: boolean | null
          state?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string | null
        }
        Relationships: []
      }
      dhcr_buildings: {
        Row: {
          bldg_no: string
          bldg_no2: string | null
          block: string | null
          borough: string
          city: string | null
          county: string | null
          id: string
          lot: string | null
          status1: string | null
          status2: string | null
          status3: string | null
          street: string
          street_suffix: string | null
          street_suffix2: string | null
          street2: string | null
          zip: string
        }
        Insert: {
          bldg_no: string
          bldg_no2?: string | null
          block?: string | null
          borough: string
          city?: string | null
          county?: string | null
          id?: string
          lot?: string | null
          status1?: string | null
          status2?: string | null
          status3?: string | null
          street: string
          street_suffix?: string | null
          street_suffix2?: string | null
          street2?: string | null
          zip: string
        }
        Update: {
          bldg_no?: string
          bldg_no2?: string | null
          block?: string | null
          borough?: string
          city?: string | null
          county?: string | null
          id?: string
          lot?: string | null
          status1?: string | null
          status2?: string | null
          status3?: string | null
          street?: string
          street_suffix?: string | null
          street_suffix2?: string | null
          street2?: string | null
          zip?: string
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          address: string | null
          analysis_id: string | null
          comp_median_rent: number | null
          created_at: string
          current_rent: number | null
          email: string
          event_type: string
          fairness_score: number | null
          hud_fmr_value: number | null
          id: string
          increase_pct: number | null
          proposed_rent: number | null
          verdict: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          analysis_id?: string | null
          comp_median_rent?: number | null
          created_at?: string
          current_rent?: number | null
          email: string
          event_type: string
          fairness_score?: number | null
          hud_fmr_value?: number | null
          id?: string
          increase_pct?: number | null
          proposed_rent?: number | null
          verdict?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          analysis_id?: string | null
          comp_median_rent?: number | null
          created_at?: string
          current_rent?: number | null
          email?: string
          event_type?: string
          fairness_score?: number | null
          hud_fmr_value?: number | null
          id?: string
          increase_pct?: number | null
          proposed_rent?: number | null
          verdict?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          analysis_id: string | null
          bedrooms: number | null
          capture_source: string | null
          city: string | null
          comp_median_rent: number | null
          comps_position: string | null
          created_at: string
          current_rent: number | null
          email: string
          fair_counter_offer: string | null
          fairness_score: number | null
          followup_sent_at: string | null
          hud_fmr_value: number | null
          id: string
          increase_pct: number | null
          lease_expiration_month: number | null
          lease_expiration_year: number | null
          letter_generated: boolean | null
          letter_generated_at: string | null
          market_trend_pct: number | null
          outcome: string | null
          partner_opt_in: boolean | null
          proposed_rent: number | null
          reminder_sent_at: string | null
          state: string | null
          unsubscribed: boolean | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          verdict: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          analysis_id?: string | null
          bedrooms?: number | null
          capture_source?: string | null
          city?: string | null
          comp_median_rent?: number | null
          comps_position?: string | null
          created_at?: string
          current_rent?: number | null
          email: string
          fair_counter_offer?: string | null
          fairness_score?: number | null
          followup_sent_at?: string | null
          hud_fmr_value?: number | null
          id?: string
          increase_pct?: number | null
          lease_expiration_month?: number | null
          lease_expiration_year?: number | null
          letter_generated?: boolean | null
          letter_generated_at?: string | null
          market_trend_pct?: number | null
          outcome?: string | null
          partner_opt_in?: boolean | null
          proposed_rent?: number | null
          reminder_sent_at?: string | null
          state?: string | null
          unsubscribed?: boolean | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          verdict?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          analysis_id?: string | null
          bedrooms?: number | null
          capture_source?: string | null
          city?: string | null
          comp_median_rent?: number | null
          comps_position?: string | null
          created_at?: string
          current_rent?: number | null
          email?: string
          fair_counter_offer?: string | null
          fairness_score?: number | null
          followup_sent_at?: string | null
          hud_fmr_value?: number | null
          id?: string
          increase_pct?: number | null
          lease_expiration_month?: number | null
          lease_expiration_year?: number | null
          letter_generated?: boolean | null
          letter_generated_at?: string | null
          market_trend_pct?: number | null
          outcome?: string | null
          partner_opt_in?: boolean | null
          proposed_rent?: number | null
          reminder_sent_at?: string | null
          state?: string | null
          unsubscribed?: boolean | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          verdict?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      property_cache: {
        Row: {
          address_normalized: string
          created_at: string | null
          data: Json
          id: string
        }
        Insert: {
          address_normalized: string
          created_at?: string | null
          data: Json
          id?: string
        }
        Update: {
          address_normalized?: string
          created_at?: string | null
          data?: Json
          id?: string
        }
        Relationships: []
      }
      rentcast_cache: {
        Row: {
          endpoint: string
          fetched_at: string
          id: string
          lookup_key: string
          response_data: Json
        }
        Insert: {
          endpoint: string
          fetched_at?: string
          id?: string
          lookup_key: string
          response_data: Json
        }
        Update: {
          endpoint?: string
          fetched_at?: string
          id?: string
          lookup_key?: string
          response_data?: Json
        }
        Relationships: []
      }
      shared_reports: {
        Row: {
          address: string | null
          analysis_id: string | null
          bedrooms: number
          created_at: string
          current_rent: number
          id: string
          increase_type: string
          lead_email: string | null
          proposed_increase: number
          report_data: Json
          short_id: string
          zip_code: string
        }
        Insert: {
          address?: string | null
          analysis_id?: string | null
          bedrooms: number
          created_at?: string
          current_rent: number
          id?: string
          increase_type?: string
          lead_email?: string | null
          proposed_increase: number
          report_data: Json
          short_id: string
          zip_code: string
        }
        Update: {
          address?: string | null
          analysis_id?: string | null
          bedrooms?: number
          created_at?: string
          current_rent?: number
          id?: string
          increase_type?: string
          lead_email?: string | null
          proposed_increase?: number
          report_data?: Json
          short_id?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_reports_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_analyses_count: { Args: never; Returns: number }
      update_lead_outcome: {
        Args: { p_lead_id: string; p_outcome: string }
        Returns: undefined
      }
      upsert_lead:
        | {
            Args: {
              p_address?: string
              p_analysis_id?: string
              p_bedrooms?: number
              p_capture_source?: string
              p_city?: string
              p_comps_position?: string
              p_current_rent?: number
              p_email: string
              p_fair_counter_offer?: string
              p_increase_pct?: number
              p_lease_expiration_month?: number
              p_lease_expiration_year?: number
              p_letter_generated?: boolean
              p_market_trend_pct?: number
              p_partner_opt_in?: boolean
              p_proposed_rent?: number
              p_state?: string
              p_utm_campaign?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_verdict?: string
              p_zip?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_address?: string
              p_analysis_id?: string
              p_bedrooms?: number
              p_capture_source?: string
              p_city?: string
              p_comp_median_rent?: number
              p_comps_position?: string
              p_current_rent?: number
              p_email: string
              p_fair_counter_offer?: string
              p_fairness_score?: number
              p_hud_fmr_value?: number
              p_increase_pct?: number
              p_lease_expiration_month?: number
              p_lease_expiration_year?: number
              p_letter_generated?: boolean
              p_market_trend_pct?: number
              p_partner_opt_in?: boolean
              p_proposed_rent?: number
              p_state?: string
              p_utm_campaign?: string
              p_utm_medium?: string
              p_utm_source?: string
              p_verdict?: string
              p_zip?: string
            }
            Returns: undefined
          }
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
