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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      conflict_rules: {
        Row: {
          created_at: string
          employee_id_a: string
          employee_id_b: string
          id: string
        }
        Insert: {
          created_at?: string
          employee_id_a: string
          employee_id_b: string
          id?: string
        }
        Update: {
          created_at?: string
          employee_id_a?: string
          employee_id_b?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflict_rules_employee_id_a_fkey"
            columns: ["employee_id_a"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflict_rules_employee_id_b_fkey"
            columns: ["employee_id_b"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_projects: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          order_index: number
          project_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          order_index?: number
          project_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          order_index?: number
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_projects_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          password_hash: string
          phone: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          password_hash: string
          phone: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          password_hash?: string
          phone?: string
        }
        Relationships: []
      }
      hours_adjustments: {
        Row: {
          created_at: string
          employee_id: string
          hours: number
          id: string
          month: number
          reason: string
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          hours: number
          id?: string
          month: number
          reason: string
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          hours?: number
          id?: string
          month?: number
          reason?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hours_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
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
      shift_conflict_rules: {
        Row: {
          rule_id: string
          shift_id: string
        }
        Insert: {
          rule_id: string
          shift_id: string
        }
        Update: {
          rule_id?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_conflict_rules_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "conflict_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_conflict_rules_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_signups: {
        Row: {
          created_at: string
          employee_id: string
          end_actual_ts: string | null
          id: string
          note: string | null
          note_updated_at: string | null
          shift_id: string
          start_actual_ts: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_actual_ts?: string | null
          id?: string
          note?: string | null
          note_updated_at?: string | null
          shift_id: string
          start_actual_ts?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_actual_ts?: string | null
          id?: string
          note?: string | null
          note_updated_at?: string | null
          shift_id?: string
          start_actual_ts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_signups_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_signups_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          max_people: number
          min_people: number
          shift_date: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          max_people?: number
          min_people?: number
          shift_date: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          max_people?: number
          min_people?: number
          shift_date?: string
          start_time?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_bootstrap_needed: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      bootstrap_first_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      employee_cancel_signup: {
        Args: { _employee_id: string; _secret: string; _shift_id: string }
        Returns: string
      }
      employee_complete_project: {
        Args: { _employee_id: string; _employee_project_id: string; _secret: string }
        Returns: string
      }
      employee_end_shift: {
        Args: { _employee_id: string; _secret: string; _shift_id: string }
        Returns: string
      }
      employee_find_candidates: {
        Args: { _first_name: string; _last_name: string; _secret: string }
        Returns: Json
      }
      employee_get_by_id: {
        Args: { _employee_id: string; _secret: string }
        Returns: Json
      }
      employee_register: {
        Args: {
          _first_name: string
          _last_name: string
          _password_hash: string
          _phone: string
          _secret: string
        }
        Returns: Json
      }
      employee_save_note: {
        Args: { _employee_id: string; _note: string; _secret: string; _shift_id: string }
        Returns: string
      }
      employee_select_my_projects: {
        Args: { _employee_id: string; _secret: string }
        Returns: Json
      }
      employee_select_my_shifts: {
        Args: { _employee_id: string; _secret: string }
        Returns: Json
      }
      employee_select_shift_conflict_rules: {
        Args: { _secret: string; _shift_ids: string[] }
        Returns: Json
      }
      employee_select_shifts_by_date: {
        Args: { _date: string; _secret: string }
        Returns: Json
      }
      employee_select_shifts_range: {
        Args: { _end: string; _secret: string; _start: string }
        Returns: Json
      }
      employee_select_signups_by_shift_ids: {
        Args: { _secret: string; _shift_ids: string[] }
        Returns: Json
      }
      employee_signup_for_shift: {
        Args: { _employee_id: string; _secret: string; _shift_id: string }
        Returns: string
      }
      employee_start_shift: {
        Args: { _employee_id: string; _secret: string; _shift_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      signup_for_shift: {
        Args: { _employee_id: string; _override?: boolean; _shift_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
