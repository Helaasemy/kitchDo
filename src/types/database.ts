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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      kdo_activity_events: {
        Row: {
          action: string
          context: Json
          entity_id: string
          entity_type: string
          id: string
          kitchen_id: string
          owner_user_id: string
          received_at: string
          reported_at: string
        }
        Insert: {
          action: string
          context?: Json
          entity_id: string
          entity_type: string
          id?: string
          kitchen_id: string
          owner_user_id: string
          received_at?: string
          reported_at: string
        }
        Update: {
          action?: string
          context?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          kitchen_id?: string
          owner_user_id?: string
          received_at?: string
          reported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_activity_events_kitchen_owner_fkey"
            columns: ["kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_kitchens"
            referencedColumns: ["id", "owner_user_id"]
          },
        ]
      }
      kdo_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kitchen_id: string
          name: string
          owner_user_id: string
          revision: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kitchen_id: string
          name: string
          owner_user_id: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kitchen_id?: string
          name?: string
          owner_user_id?: string
          revision?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_categories_kitchen_owner_fkey"
            columns: ["kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_kitchens"
            referencedColumns: ["id", "owner_user_id"]
          },
        ]
      }
      kdo_issues: {
        Row: {
          created_at: string
          description: string
          id: string
          kitchen_id: string
          owner_user_id: string
          reported_at: string
          resolution_note: string | null
          resolved_at: string | null
          revision: number
          run_id: string
          run_item_id: string | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kitchen_id: string
          owner_user_id: string
          reported_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          revision?: number
          run_id: string
          run_item_id?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kitchen_id?: string
          owner_user_id?: string
          reported_at?: string
          resolution_note?: string | null
          resolved_at?: string | null
          revision?: number
          run_id?: string
          run_item_id?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_issues_kitchen_owner_fkey"
            columns: ["kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_kitchens"
            referencedColumns: ["id", "owner_user_id"]
          },
          {
            foreignKeyName: "kdo_issues_run_fkey"
            columns: ["run_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_runs"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
          {
            foreignKeyName: "kdo_issues_run_item_fkey"
            columns: ["run_item_id", "run_id"]
            isOneToOne: false
            referencedRelation: "kdo_run_items"
            referencedColumns: ["id", "run_id"]
          },
        ]
      }
      kdo_kitchens: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          name: string
          owner_user_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          owner_user_id: string
          revision?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          owner_user_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
      kdo_mutation_receipts: {
        Row: {
          created_at: string
          id: string
          operation: string
          owner_user_id: string
          request_hash: string
          result: Json
        }
        Insert: {
          created_at?: string
          id: string
          operation: string
          owner_user_id: string
          request_hash: string
          result?: Json
        }
        Update: {
          created_at?: string
          id?: string
          operation?: string
          owner_user_id?: string
          request_hash?: string
          result?: Json
        }
        Relationships: []
      }
      kdo_profiles: {
        Row: {
          created_at: string
          display_name: string
          locale: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          locale?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          locale?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kdo_run_items: {
        Row: {
          created_at: string
          id: string
          instructions_snapshot: string | null
          kitchen_id: string
          note: string | null
          outcome: string
          owner_user_id: string
          received_at: string | null
          recorded_at: string | null
          recorded_by: string | null
          response_type_snapshot: string
          revision: number
          run_id: string
          section_order_snapshot: number | null
          section_title_snapshot: string | null
          sort_order: number
          source_item_id: string
          source_section_id: string | null
          title_snapshot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions_snapshot?: string | null
          kitchen_id: string
          note?: string | null
          outcome?: string
          owner_user_id: string
          received_at?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          response_type_snapshot?: string
          revision?: number
          run_id: string
          section_order_snapshot?: number | null
          section_title_snapshot?: string | null
          sort_order?: number
          source_item_id: string
          source_section_id?: string | null
          title_snapshot: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions_snapshot?: string | null
          kitchen_id?: string
          note?: string | null
          outcome?: string
          owner_user_id?: string
          received_at?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          response_type_snapshot?: string
          revision?: number
          run_id?: string
          section_order_snapshot?: number | null
          section_title_snapshot?: string | null
          sort_order?: number
          source_item_id?: string
          source_section_id?: string | null
          title_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_run_items_run_fkey"
            columns: ["run_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_runs"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
        ]
      }
      kdo_runs: {
        Row: {
          category_id_snapshot: string | null
          category_name_snapshot: string | null
          closed_at: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          kitchen_id: string
          local_date: string
          occurrence_key: string
          owner_user_id: string
          revision: number
          schedule_id: string | null
          scheduled_for: string
          source: string
          state: string
          template_id: string
          template_revision_id: string
          timezone_snapshot: string
          title_snapshot: string
          updated_at: string
        }
        Insert: {
          category_id_snapshot?: string | null
          category_name_snapshot?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          kitchen_id: string
          local_date: string
          occurrence_key: string
          owner_user_id: string
          revision?: number
          schedule_id?: string | null
          scheduled_for: string
          source: string
          state?: string
          template_id: string
          template_revision_id: string
          timezone_snapshot: string
          title_snapshot: string
          updated_at?: string
        }
        Update: {
          category_id_snapshot?: string | null
          category_name_snapshot?: string | null
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          kitchen_id?: string
          local_date?: string
          occurrence_key?: string
          owner_user_id?: string
          revision?: number
          schedule_id?: string | null
          scheduled_for?: string
          source?: string
          state?: string
          template_id?: string
          template_revision_id?: string
          timezone_snapshot?: string
          title_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_runs_kitchen_owner_fkey"
            columns: ["kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_kitchens"
            referencedColumns: ["id", "owner_user_id"]
          },
          {
            foreignKeyName: "kdo_runs_revision_fkey"
            columns: ["template_revision_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_template_revisions"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
          {
            foreignKeyName: "kdo_runs_schedule_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "kdo_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kdo_runs_template_fkey"
            columns: ["template_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_templates"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
        ]
      }
      kdo_schedules: {
        Row: {
          created_at: string
          due_after_minutes: number
          effective_from: string
          effective_until: string | null
          id: string
          kitchen_id: string
          local_start_time: string
          owner_user_id: string
          reminder_enabled: boolean
          reminder_lead_minutes: number
          series_id: string
          template_id: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          due_after_minutes: number
          effective_from: string
          effective_until?: string | null
          id?: string
          kitchen_id: string
          local_start_time: string
          owner_user_id: string
          reminder_enabled?: boolean
          reminder_lead_minutes?: number
          series_id: string
          template_id: string
          weekdays: number[]
        }
        Update: {
          created_at?: string
          due_after_minutes?: number
          effective_from?: string
          effective_until?: string | null
          id?: string
          kitchen_id?: string
          local_start_time?: string
          owner_user_id?: string
          reminder_enabled?: boolean
          reminder_lead_minutes?: number
          series_id?: string
          template_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "kdo_schedules_template_fkey"
            columns: ["template_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_templates"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
        ]
      }
      kdo_template_items: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          kitchen_id: string
          owner_user_id: string
          response_type: string
          section_id: string | null
          sort_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          kitchen_id: string
          owner_user_id: string
          response_type?: string
          section_id?: string | null
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          kitchen_id?: string
          owner_user_id?: string
          response_type?: string
          section_id?: string | null
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_template_items_section_fkey"
            columns: ["section_id", "template_id"]
            isOneToOne: false
            referencedRelation: "kdo_template_sections"
            referencedColumns: ["id", "template_id"]
          },
          {
            foreignKeyName: "kdo_template_items_template_fkey"
            columns: ["template_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_templates"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
        ]
      }
      kdo_template_revisions: {
        Row: {
          definition: Json
          id: string
          kitchen_id: string
          owner_user_id: string
          published_at: string
          template_id: string
          version: number
        }
        Insert: {
          definition: Json
          id?: string
          kitchen_id: string
          owner_user_id: string
          published_at?: string
          template_id: string
          version: number
        }
        Update: {
          definition?: Json
          id?: string
          kitchen_id?: string
          owner_user_id?: string
          published_at?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "kdo_template_revisions_template_fkey"
            columns: ["template_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_templates"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
        ]
      }
      kdo_template_sections: {
        Row: {
          created_at: string
          id: string
          kitchen_id: string
          owner_user_id: string
          sort_order: number
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kitchen_id: string
          owner_user_id: string
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kitchen_id?: string
          owner_user_id?: string
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_template_sections_template_fkey"
            columns: ["template_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_templates"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
        ]
      }
      kdo_templates: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          kitchen_id: string
          owner_user_id: string
          published_revision: number | null
          revision: number
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kitchen_id: string
          owner_user_id: string
          published_revision?: number | null
          revision?: number
          state?: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kitchen_id?: string
          owner_user_id?: string
          published_revision?: number | null
          revision?: number
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kdo_templates_category_fkey"
            columns: ["category_id", "kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_categories"
            referencedColumns: ["id", "kitchen_id", "owner_user_id"]
          },
          {
            foreignKeyName: "kdo_templates_kitchen_owner_fkey"
            columns: ["kitchen_id", "owner_user_id"]
            isOneToOne: false
            referencedRelation: "kdo_kitchens"
            referencedColumns: ["id", "owner_user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_item_outcome: {
        Args: {
          p_expected_revision: number
          p_mutation_id: string
          p_note?: string
          p_outcome: string
          p_recorded_at?: string
          p_run_item_id: string
        }
        Returns: Json
      }
      archive_category: {
        Args: {
          p_category_id: string
          p_expected_revision: number
          p_mutation_id: string
        }
        Returns: Json
      }
      archive_template: {
        Args: {
          p_expected_revision: number
          p_mutation_id: string
          p_template_id: string
        }
        Returns: Json
      }
      cancel_run: {
        Args: {
          p_expected_revision: number
          p_mutation_id: string
          p_run_id: string
        }
        Returns: Json
      }
      complete_onboarding: {
        Args: {
          p_display_name: string
          p_kitchen_id?: string
          p_kitchen_kind?: string
          p_kitchen_name: string
          p_locale?: string
        }
        Returns: Json
      }
      create_manual_run: {
        Args: {
          p_local_date: string
          p_mutation_id: string
          p_occurrence_key: string
          p_run_id: string
          p_scheduled_for?: string
          p_template_revision_id: string
          p_timezone: string
        }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: Json }
      duplicate_template: {
        Args: {
          p_mutation_id: string
          p_new_template_id?: string
          p_template_id: string
        }
        Returns: Json
      }
      ensure_scheduled_occurrences: {
        Args: {
          p_from_date: string
          p_kitchen_id: string
          p_timezone: string
          p_to_date: string
        }
        Returns: Json
      }
      kdo_append_activity: {
        Args: {
          p_action: string
          p_context: Json
          p_entity_id: string
          p_entity_type: string
          p_kitchen_id: string
          p_reported_at?: string
        }
        Returns: string
      }
      kdo_begin_mutation: {
        Args: { p_mutation_id: string; p_operation: string; p_payload: Json }
        Returns: Json
      }
      kdo_build_template_definition: {
        Args: {
          p_template: Database["public"]["Tables"]["kdo_templates"]["Row"]
        }
        Returns: Json
      }
      kdo_current_user_id: { Args: never; Returns: string }
      kdo_materialize_run_items: {
        Args: {
          p_definition: Json
          p_kitchen_id: string
          p_owner_user_id: string
          p_run_id: string
        }
        Returns: undefined
      }
      kdo_reconcile_run_progress: {
        Args: { p_run_id: string }
        Returns: {
          category_id_snapshot: string | null
          category_name_snapshot: string | null
          closed_at: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          kitchen_id: string
          local_date: string
          occurrence_key: string
          owner_user_id: string
          revision: number
          schedule_id: string | null
          scheduled_for: string
          source: string
          state: string
          template_id: string
          template_revision_id: string
          timezone_snapshot: string
          title_snapshot: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "kdo_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kdo_request_hash: { Args: { p_payload: Json }; Returns: string }
      kdo_require_user_id: { Args: never; Returns: string }
      kdo_store_mutation_receipt: {
        Args: {
          p_mutation_id: string
          p_operation: string
          p_request_hash: string
          p_result: Json
        }
        Returns: undefined
      }
      pause_schedule: {
        Args: {
          p_effective_until?: string
          p_mutation_id: string
          p_series_id: string
        }
        Returns: Json
      }
      publish_template: {
        Args: {
          p_expected_revision: number
          p_mutation_id: string
          p_template_id: string
        }
        Returns: Json
      }
      resolve_issue: {
        Args: {
          p_expected_revision: number
          p_issue_id: string
          p_mutation_id: string
          p_resolution_note?: string
        }
        Returns: Json
      }
      revise_schedule: {
        Args: {
          p_due_after_minutes: number
          p_effective_from: string
          p_local_start_time: string
          p_mutation_id: string
          p_new_schedule_id?: string
          p_reminder_enabled?: boolean
          p_reminder_lead_minutes?: number
          p_series_id: string
          p_template_id: string
          p_weekdays: number[]
        }
        Returns: Json
      }
      save_template_draft: {
        Args: {
          p_category_id?: string
          p_description?: string
          p_expected_revision: number
          p_items?: Json
          p_kitchen_id: string
          p_mutation_id: string
          p_sections?: Json
          p_template_id: string
          p_title: string
        }
        Returns: Json
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
