export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'user'
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'user'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'user'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      surveys: {
        Row: {
          id: string
          title: string
          description: string | null
          status: 'open' | 'closed'
          admin_id: string
          total_responses: number
          theme_color: string | null
          logo_url: string | null
          default_language: string | null
          supported_languages: string[] | null
          open_date: string | null
          close_date: string | null
          created_at: string
          mode: 'survey' | 'quiz' | 'exam' | null
          time_limit_minutes: number | null
          passing_score: number | null
          max_attempts: number | null
          show_score_immediately: boolean | null
          show_correct_answers: boolean | null
          show_explanations: boolean | null
          shuffle_questions: boolean | null
          shuffle_options: boolean | null
          allow_review_after_submit: boolean | null
          release_results_mode: string | null
          require_fullscreen: boolean | null
          disable_copy_paste: boolean | null
          disable_tab_switching: boolean | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'open' | 'closed'
          admin_id: string
          total_responses?: number
          theme_color?: string | null
          logo_url?: string | null
          default_language?: string | null
          supported_languages?: string[] | null
          open_date?: string | null
          close_date?: string | null
          created_at?: string
          mode?: 'survey' | 'quiz' | 'exam' | null
          time_limit_minutes?: number | null
          passing_score?: number | null
          max_attempts?: number | null
          show_score_immediately?: boolean | null
          show_correct_answers?: boolean | null
          show_explanations?: boolean | null
          shuffle_questions?: boolean | null
          shuffle_options?: boolean | null
          allow_review_after_submit?: boolean | null
          release_results_mode?: string | null
          require_fullscreen?: boolean | null
          disable_copy_paste?: boolean | null
          disable_tab_switching?: boolean | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'open' | 'closed'
          admin_id?: string
          total_responses?: number
          theme_color?: string | null
          logo_url?: string | null
          default_language?: string | null
          supported_languages?: string[] | null
          open_date?: string | null
          close_date?: string | null
          created_at?: string
          mode?: 'survey' | 'quiz' | 'exam' | null
          time_limit_minutes?: number | null
          passing_score?: number | null
          max_attempts?: number | null
          show_score_immediately?: boolean | null
          show_correct_answers?: boolean | null
          show_explanations?: boolean | null
          shuffle_questions?: boolean | null
          shuffle_options?: boolean | null
          allow_review_after_submit?: boolean | null
          release_results_mode?: string | null
          require_fullscreen?: boolean | null
          disable_copy_paste?: boolean | null
          disable_tab_switching?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      questions: {
        Row: {
          id: string
          survey_id: string
          block_type: 'question' | 'heading' | 'instruction' | 'page_break'
          type: 'text' | 'choice' | 'likert'
          question_text: string
          options: string[] | null
          section_id: string | null
          show_when_question_id: string | null
          show_when_answer_value: string | null
          order_index: number
          required: boolean
          is_active: boolean
          version: number
          question_group_id: string | null
          points: number | null
          correct_answer: string | null
          correct_answers: Json | null
          explanation: string | null
          grading_type: string | null
          display_variant: string | null
        }
        Insert: {
          id?: string
          survey_id: string
          block_type?: 'question' | 'heading' | 'instruction' | 'page_break'
          type: 'text' | 'choice' | 'likert'
          question_text: string
          options?: string[] | null
          section_id?: string | null
          show_when_question_id?: string | null
          show_when_answer_value?: string | null
          order_index?: number
          required?: boolean
          is_active?: boolean
          version?: number
          question_group_id?: string | null
          points?: number | null
          correct_answer?: string | null
          correct_answers?: Json | null
          explanation?: string | null
          grading_type?: string | null
          display_variant?: string | null
        }
        Update: {
          id?: string
          survey_id?: string
          block_type?: 'question' | 'heading' | 'instruction' | 'page_break'
          type?: 'text' | 'choice' | 'likert'
          question_text?: string
          options?: string[] | null
          section_id?: string | null
          show_when_question_id?: string | null
          show_when_answer_value?: string | null
          order_index?: number
          required?: boolean
          is_active?: boolean
          version?: number
          question_group_id?: string | null
          points?: number | null
          correct_answer?: string | null
          correct_answers?: Json | null
          explanation?: string | null
          grading_type?: string | null
          display_variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      responses: {
        Row: {
          id: string
          survey_id: string
          user_id: string
          question_id: string
          answer: string
          submitted_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          user_id: string
          question_id: string
          answer: string
          submitted_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          user_id?: string
          question_id?: string
          answer?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      survey_sessions: {
        Row: {
          id: string
          survey_id: string
          user_id: string
          email: string | null
          fingerprint: string | null
          ip_address: string | null
          user_agent: string | null
          completed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          user_id: string
          email?: string | null
          fingerprint?: string | null
          ip_address?: string | null
          user_agent?: string | null
          completed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          user_id?: string
          email?: string | null
          fingerprint?: string | null
          ip_address?: string | null
          user_agent?: string | null
          completed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      question_sections: {
        Row: {
          id: string
          survey_id: string
          title: string
          description: string | null
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          title: string
          description?: string | null
          order_index?: number
          created_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          title?: string
          description?: string | null
          order_index?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_sections_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      survey_live_sessions: {
        Row: {
          id: string
          survey_id: string
          user_id: string
          email: string | null
          status: 'active' | 'completed' | 'abandoned' | 'blocked'
          total_questions: number
          answered_questions: number
          progress_percentage: number
          started_at: string
          last_activity_at: string
          submitted_at: string | null
          abandoned_at: string | null
          time_spent_seconds: number
          fingerprint: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          user_id: string
          email?: string | null
          status?: 'active' | 'completed' | 'abandoned' | 'blocked'
          total_questions?: number
          answered_questions?: number
          progress_percentage?: number
          started_at?: string
          last_activity_at?: string
          submitted_at?: string | null
          abandoned_at?: string | null
          time_spent_seconds?: number
          fingerprint?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          user_id?: string
          email?: string | null
          status?: 'active' | 'completed' | 'abandoned' | 'blocked'
          total_questions?: number
          answered_questions?: number
          progress_percentage?: number
          started_at?: string
          last_activity_at?: string
          submitted_at?: string | null
          abandoned_at?: string | null
          time_spent_seconds?: number
          fingerprint?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_live_sessions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          actor_role: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      badges: {
        Row: {
          color: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          requirement_type: string
          requirement_value: number
        }
        Insert: {
          color?: string
          created_at?: string
          description: string
          icon?: string
          id?: string
          name: string
          requirement_type: string
          requirement_value?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          requirement_type?: string
          requirement_value?: number
        }
        Relationships: []
      }
      live_answers: {
        Row: {
          answer_text: string | null
          id: string
          is_correct: boolean
          participant_id: string
          points: number
          question_id: string
          response_time_ms: number
          room_id: string
          selected_option_id: string | null
          submitted_at: string
        }
        Insert: {
          answer_text?: string | null
          id?: string
          is_correct?: boolean
          participant_id: string
          points?: number
          question_id: string
          response_time_ms?: number
          room_id: string
          selected_option_id?: string | null
          submitted_at?: string
        }
        Update: {
          answer_text?: string | null
          id?: string
          is_correct?: boolean
          participant_id?: string
          points?: number
          question_id?: string
          response_time_ms?: number
          room_id?: string
          selected_option_id?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "live_room_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          }
        ]
      }
      live_room_participants: {
        Row: {
          display_name: string
          id: string
          is_active: boolean | null
          joined_at: string
          rank: number | null
          room_id: string
          score: number
          user_id: string | null
        }
        Insert: {
          display_name: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          rank?: number | null
          room_id: string
          score?: number
          user_id?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          rank?: number | null
          room_id?: string
          score?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      live_rooms: {
        Row: {
          created_at: string
          current_question_index: number
          ended_at: string | null
          host_id: string
          id: string
          quiz_id: string
          room_code: string
          started_at: string | null
          status: string
          timer_seconds: number
        }
        Insert: {
          created_at?: string
          current_question_index?: number
          ended_at?: string | null
          host_id: string
          id?: string
          quiz_id: string
          room_code: string
          started_at?: string | null
          status?: string
          timer_seconds?: number
        }
        Update: {
          created_at?: string
          current_question_index?: number
          ended_at?: string | null
          host_id?: string
          id?: string
          quiz_id?: string
          room_code?: string
          started_at?: string | null
          status?: string
          timer_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rooms_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
      question_bank: {
        Row: {
          correct_answer: string | null
          correct_answers: Json | null
          created_at: string
          created_by: string
          difficulty: string
          explanation: string | null
          id: string
          mode_compatibility: string[] | null
          options: Json
          points: number
          question_text: string
          question_type: string
          topic: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          correct_answer?: string | null
          correct_answers?: Json | null
          created_at?: string
          created_by: string
          difficulty?: string
          explanation?: string | null
          id?: string
          mode_compatibility?: string[] | null
          options?: Json
          points?: number
          question_text: string
          question_type: string
          topic?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          correct_answer?: string | null
          correct_answers?: Json | null
          created_at?: string
          created_by?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          mode_compatibility?: string[] | null
          options?: Json
          points?: number
          question_text?: string
          question_type?: string
          topic?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      student_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          student_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          student_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      quiz_exam_results: {
        Row: {
          completed_at: string | null
          id: string
          percentage: number | null
          passed: boolean | null
          responses: unknown
          score: number
          submitted_at: string | null
          survey_id: string
          total_points: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          percentage?: number | null
          passed?: boolean | null
          responses?: unknown
          score: number
          submitted_at?: string | null
          survey_id: string
          total_points: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          percentage?: number | null
          passed?: boolean | null
          responses?: unknown
          score?: number
          submitted_at?: string | null
          survey_id?: string
          total_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_exam_results_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_xp_to_student: {
        Args: {
          p_student_id: string
          p_xp_amount: number
          p_reason?: string
        }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      generate_room_code: {
        Args: {}
        Returns: string
      }
      get_live_leaderboard: {
        Args: {
          p_room_id: string
        }
        Returns: {
          avg_response_time_ms: number
          correct_answers: number
          display_name: string
          participant_id: string
          rank: number
          score: number
          total_answers: number
        }[]
      }
      join_live_room: {
        Args: {
          p_room_code: string
          p_user_id?: string
          p_display_name: string
        }
        Returns: {
          error_message: string
          participant_id: string
          room_id: string
          success: boolean
        }[]
      }
      log_activity: {
        Args: {
          p_action: string
          p_actor_id?: string
          p_actor_name: string
          p_actor_role: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Record<string, unknown>
        }
        Returns: string
      }
      has_user_completed_survey: {
        Args: {
          p_survey_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      record_survey_completion: {
        Args: {
          p_survey_id: string
          p_user_id: string
          p_fingerprint?: string
          p_ip_address?: string
          p_user_agent?: string
          p_email?: string
          p_gender?: string
          p_age?: number
        }
        Returns: {
          success: boolean
          error_message: string
        }[]
      }
      submit_survey_response: {
        Args: {
          p_survey_id: string
          p_user_id: string
          p_fingerprint?: string
          p_ip_address?: string
          p_user_agent?: string
          p_email?: string
          p_gender?: string
          p_age?: number
          p_answers: Json
        }
        Returns: {
          success: boolean
          error_message: string
          submission_id: string
        }[]
      }
      increment_survey_response_count: {
        Args: {
          p_survey_id: string
        }
        Returns: void
      }
      upsert_live_session: {
        Args: {
          p_survey_id: string
          p_user_id: string
          p_email?: string | null
          p_total_questions?: number
          p_fingerprint?: string | null
          p_user_agent?: string | null
        }
        Returns: string
      }
      update_live_session_progress: {
        Args: {
          p_survey_id: string
          p_user_id: string
          p_answered_questions: number
          p_progress_percentage: number
        }
        Returns: boolean
      }
      complete_live_session: {
        Args: {
          p_survey_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      mark_abandoned_sessions: {
        Args: {}
        Returns: number
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
