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
      event_types: {
        Row: {
          category: Database["public"]["Enums"]["event_category"]
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          points: number
          requires_description: boolean
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["event_category"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          points: number
          requires_description?: boolean
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          points?: number
          requires_description?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          approved_at: string | null
          attachment_url: string | null
          created_at: string
          created_by: string
          description: string | null
          event_date: string
          event_time: string | null
          event_type_id: string
          id: string
          line: string | null
          line_id: string | null
          operator_id: string
          rejection_note: string | null
          shift: string | null
          shift_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["event_status"]
          unit_id: string | null
          updated_at: string
          validated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          event_date: string
          event_time?: string | null
          event_type_id: string
          id?: string
          line?: string | null
          line_id?: string | null
          operator_id: string
          rejection_note?: string | null
          shift?: string | null
          shift_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          unit_id?: string | null
          updated_at?: string
          validated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          event_type_id?: string
          id?: string
          line?: string | null
          line_id?: string | null
          operator_id?: string
          rejection_note?: string | null
          shift?: string | null
          shift_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          unit_id?: string | null
          updated_at?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          unit_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          unit_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          actual_value: number | null
          created_at: string | null
          description: string | null
          id: string
          manager_comment: string | null
          owner_profile_id: string
          period_end: string
          period_start: string
          score_0_100: number | null
          status: string | null
          target_type: string | null
          target_value: number | null
          title: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_comment?: string | null
          owner_profile_id: string
          period_end: string
          period_start: string
          score_0_100?: number | null
          status?: string | null
          target_type?: string | null
          target_value?: number | null
          title: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          manager_comment?: string | null
          owner_profile_id?: string
          period_end?: string
          period_start?: string
          score_0_100?: number | null
          status?: string | null
          target_type?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_positions: {
        Row: {
          assigned_at: string
          id: string
          operator_id: string
          position_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          operator_id: string
          position_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          operator_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_positions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          matricule: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          matricule: string
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          matricule?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          manager_profile_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          manager_profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          manager_profile_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      supervisor_operator_map: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          operator_id: string
          start_date: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          operator_id: string
          start_date?: string
          supervisor_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          operator_id?: string
          start_date?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_operator_map_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_operator_map_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_year_ranking:
        | {
            Args: { p_year: number }
            Returns: {
              approved_events: number
              full_name: string
              matricule: string
              note20: number
              operator_id: string
              positions_count: number
              raw_points: number
              score100: number
              unit: string
              work_days: number
            }[]
          }
        | {
            Args: { p_unit_id?: string; p_year: number }
            Returns: {
              approved_events: number
              full_name: string
              matricule: string
              note20: number
              operator_id: string
              positions_count: number
              raw_points: number
              score100: number
              unit: string
              work_days: number
            }[]
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin_site"
        | "manager_unite"
        | "superviseur"
        | "readonly"
      event_category:
        | "gmp"
        | "hse"
        | "comportement"
        | "flexibilite"
        | "assiduite"
        | "bonus"
        | "polyvalence"
        | "productivite"
      event_status: "pending" | "approved" | "rejected"
      user_role: "supervisor" | "manager"
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
    Enums: {
      app_role: [
        "super_admin",
        "admin_site",
        "manager_unite",
        "superviseur",
        "readonly",
      ],
      event_category: [
        "gmp",
        "hse",
        "comportement",
        "flexibilite",
        "assiduite",
        "bonus",
        "polyvalence",
        "productivite",
      ],
      event_status: ["pending", "approved", "rejected"],
      user_role: ["supervisor", "manager"],
    },
  },
} as const
