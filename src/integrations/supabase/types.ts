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
      answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          participant_id: string
          question_id: string
          response: string
          time_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id: string
          question_id: string
          response?: string
          time_ms?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          participant_id?: string
          question_id?: string
          response?: string
          time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_members: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          last_seen_at: string | null
          left_at: string | null
          name: string
          phone: string
          present_seconds: number
          status: Database["public"]["Enums"]["class_member_status"]
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          last_seen_at?: string | null
          left_at?: string | null
          name: string
          phone?: string
          present_seconds?: number
          status?: Database["public"]["Enums"]["class_member_status"]
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          last_seen_at?: string | null
          left_at?: string | null
          name?: string
          phone?: string
          present_seconds?: number
          status?: Database["public"]["Enums"]["class_member_status"]
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_quizzes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["class_quiz_mode"]
          pushed_at: string | null
          quiz_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["class_quiz_mode"]
          pushed_at?: string | null
          quiz_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["class_quiz_mode"]
          pushed_at?: string | null
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_quizzes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_quizzes_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_resources: {
        Row: {
          body: string
          class_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["class_resource_kind"]
          order_index: number
          title: string
          url: string | null
          visible: boolean
        }
        Insert: {
          body?: string
          class_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["class_resource_kind"]
          order_index?: number
          title?: string
          url?: string | null
          visible?: boolean
        }
        Update: {
          body?: string
          class_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["class_resource_kind"]
          order_index?: number
          title?: string
          url?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "class_resources_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_roster: {
        Row: {
          class_id: string
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_roster_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          admit_mode: string
          attendance_threshold: number
          created_at: string
          description: string
          id: string
          id_label: string
          join_code: string
          live_empty_since: string | null
          live_room_name: string | null
          live_room_url: string | null
          live_started_at: string | null
          presenting_page: number
          presenting_resource_id: string | null
          session_ended_at: string | null
          session_started_at: string | null
          subject: string
          title: string
          tutor_id: string
        }
        Insert: {
          admit_mode?: string
          attendance_threshold?: number
          created_at?: string
          description?: string
          id?: string
          id_label?: string
          join_code: string
          live_empty_since?: string | null
          live_room_name?: string | null
          live_room_url?: string | null
          live_started_at?: string | null
          presenting_page?: number
          presenting_resource_id?: string | null
          session_ended_at?: string | null
          session_started_at?: string | null
          subject?: string
          title?: string
          tutor_id: string
        }
        Update: {
          admit_mode?: string
          attendance_threshold?: number
          created_at?: string
          description?: string
          id?: string
          id_label?: string
          join_code?: string
          live_empty_since?: string | null
          live_room_name?: string | null
          live_room_url?: string | null
          live_started_at?: string | null
          presenting_page?: number
          presenting_resource_id?: string | null
          session_ended_at?: string | null
          session_started_at?: string | null
          subject?: string
          title?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_presenting_resource_id_fkey"
            columns: ["presenting_resource_id"]
            isOneToOne: false
            referencedRelation: "class_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_url: string | null
          created_at: string
          currency: string
          id: string
          is_published: boolean
          price_cents: number
          slug: string
          summary: string
          title: string
          tutor_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_published?: boolean
          price_cents?: number
          slug: string
          summary?: string
          title?: string
          tutor_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_published?: boolean
          price_cents?: number
          slug?: string
          summary?: string
          title?: string
          tutor_id?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body: string
          course_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["lesson_kind"]
          order_index: number
          title: string
          video_url: string | null
        }
        Insert: {
          body?: string
          course_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          order_index?: number
          title?: string
          video_url?: string | null
        }
        Update: {
          body?: string
          course_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["lesson_kind"]
          order_index?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          finished_at: string | null
          id: string
          joined_at: string
          name: string
          phone: string
          quiz_id: string
          score: number
          total_time_ms: number
        }
        Insert: {
          finished_at?: string | null
          id?: string
          joined_at?: string
          name: string
          phone: string
          quiz_id: string
          score?: number
          total_time_ms?: number
        }
        Update: {
          finished_at?: string | null
          id?: string
          joined_at?: string
          name?: string
          phone?: string
          quiz_id?: string
          score?: number
          total_time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "participants_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          plan: string
          referral_code: string | null
          referred_by: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          plan?: string
          referral_code?: string | null
          referred_by?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          plan?: string
          referral_code?: string | null
          referred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          options: Json
          order_index: number
          prompt: string
          quiz_id: string
          time_limit: number
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          correct_answer?: string
          created_at?: string
          id?: string
          options?: Json
          order_index?: number
          prompt?: string
          quiz_id: string
          time_limit?: number
          type?: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          options?: Json
          order_index?: number
          prompt?: string
          quiz_id?: string
          time_limit?: number
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          closes_at: string | null
          created_at: string
          extend_seconds: number
          extend_signal: number
          id: string
          join_code: string
          opens_at: string | null
          paused: boolean
          question_deadline_at: string | null
          question_paused_at: string | null
          reveal_answers: boolean
          skip_signal: number
          started_at: string | null
          status: Database["public"]["Enums"]["quiz_status"]
          title: string
          tutor_id: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          extend_seconds?: number
          extend_signal?: number
          id?: string
          join_code: string
          opens_at?: string | null
          paused?: boolean
          question_deadline_at?: string | null
          question_paused_at?: string | null
          reveal_answers?: boolean
          skip_signal?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          title?: string
          tutor_id: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          extend_seconds?: number
          extend_signal?: number
          id?: string
          join_code?: string
          opens_at?: string | null
          paused?: boolean
          question_deadline_at?: string | null
          question_paused_at?: string | null
          reveal_answers?: boolean
          skip_signal?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          title?: string
          tutor_id?: string
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          event: string
          id: string
          meta: Json
          tutor_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          event: string
          id?: string
          meta?: Json
          tutor_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          event?: string
          id?: string
          meta?: Json
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_tutor_pro: {
        Args: { _amount_cents: number; _currency: string; _tutor_id: string }
        Returns: undefined
      }
      advance_quiz_timer: {
        Args: { _expected_index: number; _quiz_id: string }
        Returns: boolean
      }
      finish_participant: {
        Args: { _participant_id: string }
        Returns: undefined
      }
      get_answer_key: { Args: { _question_id: string }; Returns: string }
      get_class_by_code: {
        Args: { _code: string }
        Returns: {
          description: string
          id: string
          subject: string
          title: string
        }[]
      }
      get_class_join_settings: {
        Args: { _code: string }
        Returns: {
          id_label: string
        }[]
      }
      get_class_membership: {
        Args: { _member_id: string }
        Returns: {
          class_id: string
          name: string
          status: Database["public"]["Enums"]["class_member_status"]
        }[]
      }
      get_class_presentation: {
        Args: { _member_id: string }
        Returns: {
          page: number
          resource_id: string
          title: string
        }[]
      }
      get_class_quizzes: {
        Args: { _member_id: string }
        Returns: {
          closes_at: string
          join_code: string
          mode: Database["public"]["Enums"]["class_quiz_mode"]
          opens_at: string
          pushed_at: string
          quiz_id: string
          quiz_status: Database["public"]["Enums"]["quiz_status"]
          title: string
        }[]
      }
      get_class_resources: {
        Args: { _member_id: string }
        Returns: {
          body: string
          id: string
          kind: Database["public"]["Enums"]["class_resource_kind"]
          order_index: number
          title: string
          url: string
        }[]
      }
      get_quiz_board: {
        Args: { _quiz_id: string }
        Returns: {
          finished: boolean
          id: string
          name: string
          score: number
          total_time_ms: number
        }[]
      }
      get_quiz_questions: {
        Args: { _quiz_id: string }
        Returns: {
          id: string
          options: Json
          order_index: number
          prompt: string
          time_limit: number
          type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      join_quiz: {
        Args: { _name: string; _phone: string; _quiz_id: string }
        Returns: string
      }
      live_heartbeat: {
        Args: { _member_id: string; _present: boolean }
        Returns: undefined
      }
      my_referral_list: {
        Args: never
        Returns: {
          display_name: string
          earnings_cents: number
          joined_at: string
          plan: string
        }[]
      }
      my_referral_summary: {
        Args: never
        Returns: {
          earnings_paid_cents: number
          earnings_pending_cents: number
          pro_referred: number
          referral_code: string
          total_referred: number
        }[]
      }
      participant_alive: { Args: { _participant_id: string }; Returns: boolean }
      push_class_quiz: {
        Args: { _class_id: string; _quiz_id: string }
        Returns: undefined
      }
      question_progress: {
        Args: { _question_id: string; _quiz_id: string }
        Returns: {
          answered: number
          total: number
        }[]
      }
      question_stats: {
        Args: { _quiz_id: string }
        Returns: {
          accuracy: number
          answered: number
          avg_time_ms: number
          correct: number
          correct_answer: string
          order_index: number
          prompt: string
          question_id: string
        }[]
      }
      quiz_join_open: { Args: { _quiz_id: string }; Returns: boolean }
      request_class_join: {
        Args: { _class_id: string; _name: string; _phone: string }
        Returns: string
      }
      resolve_referral_code: {
        Args: { _code: string }
        Returns: {
          display_name: string
          id: string
          referral_code: string
        }[]
      }
      submit_answer: {
        Args: {
          _participant_id: string
          _question_id: string
          _response: string
          _time_ms: number
        }
        Returns: boolean
      }
      tutor_student_progress: {
        Args: never
        Returns: {
          avg_score: number
          avg_time_ms: number
          last_played: string
          name: string
          phone: string
          sessions: number
          total_score: number
        }[]
      }
    }
    Enums: {
      class_member_status: "pending" | "approved" | "rejected"
      class_quiz_mode: "pop" | "async"
      class_resource_kind: "link" | "note" | "video" | "document"
      enrollment_status: "free" | "pending" | "paid"
      lesson_kind: "video" | "text"
      question_type: "multiple_choice" | "true_false" | "short_answer"
      quiz_status: "draft" | "lobby" | "live" | "ended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      class_member_status: ["pending", "approved", "rejected"],
      class_quiz_mode: ["pop", "async"],
      class_resource_kind: ["link", "note", "video", "document"],
      enrollment_status: ["free", "pending", "paid"],
      lesson_kind: ["video", "text"],
      question_type: ["multiple_choice", "true_false", "short_answer"],
      quiz_status: ["draft", "lobby", "live", "ended"],
    },
  },
} as const
