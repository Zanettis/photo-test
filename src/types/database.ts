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
          plan: 'free' | 'basic' | 'complete'
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          plan?: 'free' | 'basic' | 'complete'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          plan?: 'free' | 'basic' | 'complete'
          created_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          host_id: string
          name: string
          slug: string
          event_date: string
          settings: Json
          shot_cap: number | null
          reveal_at: string | null
          closes_at: string | null
          reveal_notified_at: string | null
          closes_notified_at: string | null
          nps_notified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          host_id: string
          name: string
          slug: string
          event_date: string
          settings?: Json
          shot_cap?: number | null
          reveal_at?: string | null
          closes_at?: string | null
          reveal_notified_at?: string | null
          closes_notified_at?: string | null
          nps_notified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          host_id?: string
          name?: string
          slug?: string
          event_date?: string
          settings?: Json
          shot_cap?: number | null
          reveal_at?: string | null
          closes_at?: string | null
          reveal_notified_at?: string | null
          closes_notified_at?: string | null
          nps_notified_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          }
        ]
      }
      photos: {
        Row: {
          id: string
          event_id: string
          storage_path: string
          uploader_token: string
          uploader_ip: string | null
          tags: string[] | null
          embedding: number[] | null
          tagging_status: 'pending' | 'done' | 'failed'
          is_flagged: boolean
          file_size_bytes: number | null
          mime_type: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          event_id: string
          storage_path: string
          uploader_token: string
          uploader_ip?: string | null
          tags?: string[] | null
          embedding?: number[] | null
          tagging_status?: 'pending' | 'done' | 'failed'
          is_flagged?: boolean
          file_size_bytes?: number | null
          mime_type?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          storage_path?: string
          uploader_token?: string
          uploader_ip?: string | null
          tags?: string[] | null
          embedding?: number[] | null
          tagging_status?: 'pending' | 'done' | 'failed'
          is_flagged?: boolean
          file_size_bytes?: number | null
          mime_type?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      search_photos: {
        Args: {
          event_id_param: string
          query_embedding: number[]
          match_count?: number
        }
        Returns: {
          id: string
          storage_path: string
          tags: string[] | null
          tagging_status: string
          uploaded_at: string
          similarity: number
        }[]
      }
    }
    Enums: Record<string, never>
  }
}
