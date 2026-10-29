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
          id: string
          join_code: string
          started_at: string | null
          status: Database["public"]["Enums"]["quiz_status"]
          title: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["quiz_status"]
          title?: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
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
      submit_answer: {
        Args: {
          _participant_id: string
          _question_id: string
          _response: string
          _time_ms: number
        }
        Returns: boolean
      }
    }
    Enums: {
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
      question_type: ["multiple_choice", "true_false", "short_answer"],
      quiz_status: ["draft", "lobby", "live", "ended"],
    },
  },
} as const
