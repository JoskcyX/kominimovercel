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
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
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
          created_at: string
          extend_seconds: number
          extend_signal: number
          id: string
          join_code: string
          paused: boolean
          reveal_answers: boolean
          skip_signal: number
          started_at: string | null
          status: Database["public"]["Enums"]["quiz_status"]
          title: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          extend_seconds?: number
          extend_signal?: number
          id?: string
          join_code: string
          paused?: boolean
          reveal_answers?: boolean
          skip_signal?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          title?: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          extend_seconds?: number
          extend_signal?: number
          id?: string
          join_code?: string
          paused?: boolean
          reveal_answers?: boolean
          skip_signal?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          title?: string
          tutor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      finish_participant: {
        Args: { _participant_id: string }
        Returns: undefined
      }
      get_answer_key: { Args: { _question_id: string }; Returns: string }
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
      participant_alive: { Args: { _participant_id: string }; Returns: boolean }
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
      enrollment_status: ["free", "pending", "paid"],
      lesson_kind: ["video", "text"],
      question_type: ["multiple_choice", "true_false", "short_answer"],
      quiz_status: ["draft", "lobby", "live", "ended"],
    },
  },
} as const
