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
      budget_items: {
        Row: {
          actual_amount: number
          category: string
          created_at: string
          description: string
          id: string
          item_date: string | null
          phase_id: string
          planned_amount: number
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          item_date?: string | null
          phase_id: string
          planned_amount?: number
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          item_date?: string | null
          phase_id?: string
          planned_amount?: number
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "budget_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_phases: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          end_time: string
          external_id: string | null
          id: string
          location: string | null
          project_id: string | null
          source: string
          start_time: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          external_id?: string | null
          id?: string
          location?: string | null
          project_id?: string | null
          source?: string
          start_time: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          external_id?: string | null
          id?: string
          location?: string | null
          project_id?: string | null
          source?: string
          start_time?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          file_name: string | null
          id: string
          meetings_created: number
          source_type: Database["public"]["Enums"]["import_source"]
          status: Database["public"]["Enums"]["import_status"]
          tasks_created: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          meetings_created?: number
          source_type: Database["public"]["Enums"]["import_source"]
          status?: Database["public"]["Enums"]["import_status"]
          tasks_created?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          meetings_created?: number
          source_type?: Database["public"]["Enums"]["import_source"]
          status?: Database["public"]["Enums"]["import_status"]
          tasks_created?: number
          updated_at?: string
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          created_at: string
          email: string | null
          id: string
          meeting_id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          meeting_id: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          meeting_id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_tags: {
        Row: {
          meeting_id: string
          tag_id: string
        }
        Insert: {
          meeting_id: string
          tag_id: string
        }
        Update: {
          meeting_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_tags_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_topics: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          notes: Json
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          notes?: Json
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          notes?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_topics_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          fireflies_meeting_id: string | null
          general_summary: string | null
          id: string
          import_id: string | null
          project_id: string | null
          raw_transcript: string | null
          source: Database["public"]["Enums"]["import_source"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          fireflies_meeting_id?: string | null
          general_summary?: string | null
          id?: string
          import_id?: string | null
          project_id?: string | null
          raw_transcript?: string | null
          source?: Database["public"]["Enums"]["import_source"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          fireflies_meeting_id?: string | null
          general_summary?: string | null
          id?: string
          import_id?: string | null
          project_id?: string | null
          raw_transcript?: string | null
          source?: Database["public"]["Enums"]["import_source"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          file_path: string
          id: string
          name: string
          project_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          name: string
          project_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          name?: string
          project_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_log: {
        Row: {
          changed_by: string
          changed_by_name: string
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["task_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
        }
        Insert: {
          changed_by: string
          changed_by_name: string
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["task_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
        }
        Update: {
          changed_by?: string
          changed_by_name?: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_name: string
          assignee_user_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          meeting_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          timestamp_ref: string | null
          updated_at: string
        }
        Insert: {
          assignee_name: string
          assignee_user_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          meeting_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          timestamp_ref?: string | null
          updated_at?: string
        }
        Update: {
          assignee_name?: string
          assignee_user_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          timestamp_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_meeting_participant: {
        Args: { _meeting_id: string }
        Returns: boolean
      }
      is_project_member: { Args: { _project_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      import_source: "fireflies" | "file_upload"
      import_status: "pending" | "processing" | "completed" | "failed"
      project_member_role: "owner" | "member" | "viewer"
      project_status: "planning" | "active" | "completed" | "archived"
      task_priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      task_status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED"
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
      app_role: ["admin", "user"],
      import_source: ["fireflies", "file_upload"],
      import_status: ["pending", "processing", "completed", "failed"],
      project_member_role: ["owner", "member", "viewer"],
      project_status: ["planning", "active", "completed", "archived"],
      task_priority: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      task_status: ["OPEN", "IN_PROGRESS", "COMPLETED", "BLOCKED"],
    },
  },
} as const
