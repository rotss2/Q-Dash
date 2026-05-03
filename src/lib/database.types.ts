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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
