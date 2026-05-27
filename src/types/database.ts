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
      hosts: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          host_id: string
          name: string
          slug: string
          shot_cap: number | null
          reveal_at: string | null
          closes_at: string | null
          reveal_notified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          host_id: string
          name: string
          slug: string
          shot_cap?: number | null
          reveal_at?: string | null
          closes_at?: string | null
          reveal_notified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          host_id?: string
          name?: string
          slug?: string
          shot_cap?: number | null
          reveal_at?: string | null
          closes_at?: string | null
          reveal_notified_at?: string | null
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          event_id: string
          storage_path: string
          uploader_token: string
          uploader_ip: string | null
          tags: string[] | null
          embedding: string | null
          tagging_status: 'pending' | 'processing' | 'done' | 'failed'
          is_flagged: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          storage_path: string
          uploader_token: string
          uploader_ip?: string | null
          tags?: string[] | null
          embedding?: string | null
          tagging_status?: 'pending' | 'processing' | 'done' | 'failed'
          is_flagged?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          storage_path?: string
          uploader_token?: string
          uploader_ip?: string | null
          tags?: string[] | null
          embedding?: string | null
          tagging_status?: 'pending' | 'processing' | 'done' | 'failed'
          is_flagged?: boolean
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
