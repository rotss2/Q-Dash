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
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: 'open' | 'closed'
          admin_id: string
          total_responses?: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: 'open' | 'closed'
          admin_id?: string
          total_responses?: number
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
          type: 'text' | 'choice' | 'likert'
          question_text: string
          options: string[] | null
          order_index: number
          required: boolean
        }
        Insert: {
          id?: string
          survey_id: string
          type: 'text' | 'choice' | 'likert'
          question_text: string
          options?: string[] | null
          order_index?: number
          required?: boolean
        }
        Update: {
          id?: string
          survey_id?: string
          type?: 'text' | 'choice' | 'likert'
          question_text?: string
          options?: string[] | null
          order_index?: number
          required?: boolean
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
        }
        Returns: {
          success: boolean
          error_message: string
        }[]
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
