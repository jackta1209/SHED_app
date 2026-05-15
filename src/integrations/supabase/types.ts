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
      journal_entries: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          duration_minutes: number | null
          entry_type: string
          id: string
          instrument: string | null
          next_step: string | null
          session_elapsed_seconds: number | null
          session_id: string | null
          tempo: number | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          duration_minutes?: number | null
          entry_type?: string
          id?: string
          instrument?: string | null
          next_step?: string | null
          session_elapsed_seconds?: number | null
          session_id?: string | null
          tempo?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          duration_minutes?: number | null
          entry_type?: string
          id?: string
          instrument?: string | null
          next_step?: string | null
          session_elapsed_seconds?: number | null
          session_id?: string | null
          tempo?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_sessions: {
        Row: {
          active_session_state: Json | null
          completion_method: string | null
          created_at: string
          distraction_count: number
          elapsed_seconds: number | null
          end_time: string | null
          exit_attempt_count: number
          final_notes: string | null
          focus_rating: number | null
          focus_score: number | null
          id: string
          last_active_at: string | null
          next_step: string | null
          planned_duration_minutes: number
          practice_category: string | null
          practice_minutes: number | null
          pre_session_notes: string | null
          progress_rating: number | null
          session_goal: string | null
          start_time: string | null
          status: string
          updated_at: string
          user_id: string
          was_resumed: boolean
          what_improved: string | null
          what_practiced: string | null
          what_was_difficult: string | null
        }
        Insert: {
          active_session_state?: Json | null
          completion_method?: string | null
          created_at?: string
          distraction_count?: number
          elapsed_seconds?: number | null
          end_time?: string | null
          exit_attempt_count?: number
          final_notes?: string | null
          focus_rating?: number | null
          focus_score?: number | null
          id?: string
          last_active_at?: string | null
          next_step?: string | null
          planned_duration_minutes?: number
          practice_category?: string | null
          practice_minutes?: number | null
          pre_session_notes?: string | null
          progress_rating?: number | null
          session_goal?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id: string
          was_resumed?: boolean
          what_improved?: string | null
          what_practiced?: string | null
          what_was_difficult?: string | null
        }
        Update: {
          active_session_state?: Json | null
          completion_method?: string | null
          created_at?: string
          distraction_count?: number
          elapsed_seconds?: number | null
          end_time?: string | null
          exit_attempt_count?: number
          final_notes?: string | null
          focus_rating?: number | null
          focus_score?: number | null
          id?: string
          last_active_at?: string | null
          next_step?: string | null
          planned_duration_minutes?: number
          practice_category?: string | null
          practice_minutes?: number | null
          pre_session_notes?: string | null
          progress_rating?: number | null
          session_goal?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          was_resumed?: boolean
          what_improved?: string | null
          what_practiced?: string | null
          what_was_difficult?: string | null
        }
        Relationships: []
      }
      practice_tool_usage: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string
          session_id: string | null
          tool_name: string
          total_seconds: number
          updated_at: string
          usage_data: Json
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          session_id?: string | null
          tool_name: string
          total_seconds?: number
          updated_at?: string
          usage_data?: Json
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string
          session_id?: string | null
          tool_name?: string
          total_seconds?: number
          updated_at?: string
          usage_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          favorite_styles: string | null
          goals: string | null
          id: string
          instrument: string | null
          preferred_practice_duration: number | null
          secondary_instrument: string | null
          skill_level: string | null
          typical_practice_days: string[] | null
          updated_at: string
          user_id: string
          weaknesses: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          favorite_styles?: string | null
          goals?: string | null
          id?: string
          instrument?: string | null
          preferred_practice_duration?: number | null
          secondary_instrument?: string | null
          skill_level?: string | null
          typical_practice_days?: string[] | null
          updated_at?: string
          user_id: string
          weaknesses?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          favorite_styles?: string | null
          goals?: string | null
          id?: string
          instrument?: string | null
          preferred_practice_duration?: number | null
          secondary_instrument?: string | null
          skill_level?: string | null
          typical_practice_days?: string[] | null
          updated_at?: string
          user_id?: string
          weaknesses?: string | null
        }
        Relationships: []
      }
      repertoire_items: {
        Row: {
          category: string | null
          composer_or_artist: string | null
          created_at: string
          current_tempo: number | null
          id: string
          last_practiced_date: string | null
          notes: string | null
          status: string | null
          target_tempo: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          composer_or_artist?: string | null
          created_at?: string
          current_tempo?: number | null
          id?: string
          last_practiced_date?: string | null
          notes?: string | null
          status?: string | null
          target_tempo?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          composer_or_artist?: string | null
          created_at?: string
          current_tempo?: number | null
          id?: string
          last_practiced_date?: string | null
          notes?: string | null
          status?: string | null
          target_tempo?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_exit_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          id: string
          session_elapsed_seconds: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          attempt_type: string
          created_at?: string
          id?: string
          session_elapsed_seconds?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          attempt_type?: string
          created_at?: string
          id?: string
          session_elapsed_seconds?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exit_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          alert_type: string | null
          appearance_mode: string | null
          created_at: string
          default_instrument: string | null
          default_practice_duration: number | null
          id: string
          next_focus: string | null
          preferred_categories: string[] | null
          session_alerts_enabled: boolean | null
          updated_at: string
          user_id: string
          visual_theme: string | null
        }
        Insert: {
          alert_type?: string | null
          appearance_mode?: string | null
          created_at?: string
          default_instrument?: string | null
          default_practice_duration?: number | null
          id?: string
          next_focus?: string | null
          preferred_categories?: string[] | null
          session_alerts_enabled?: boolean | null
          updated_at?: string
          user_id: string
          visual_theme?: string | null
        }
        Update: {
          alert_type?: string | null
          appearance_mode?: string | null
          created_at?: string
          default_instrument?: string | null
          default_practice_duration?: number | null
          id?: string
          next_focus?: string | null
          preferred_categories?: string[] | null
          session_alerts_enabled?: boolean | null
          updated_at?: string
          user_id?: string
          visual_theme?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
