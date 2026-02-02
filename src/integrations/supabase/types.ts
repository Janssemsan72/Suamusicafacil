export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          changes: Json | null
          created_at: string | null
          id: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string | null
          id?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      checkout_events: {
        Row: {
          created_at: string | null
          error: string | null
          event_type: string
          id: string
          order_id: string | null
          payload: Json | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["order_id"]
          },
        ]
      }
      download_logs: {
        Row: {
          created_at: string | null
          customer_email: string
          download_method: string | null
          downloaded_at: string
          id: string
          ip_address: string | null
          song_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          download_method?: string | null
          downloaded_at?: string
          id?: string
          ip_address?: string | null
          song_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          download_method?: string | null
          downloaded_at?: string
          id?: string
          ip_address?: string | null
          song_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_logs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_logs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["song_id"]
          },
        ]
      }
      email_logs: {
        Row: {
          bounce_reason: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          email_type: string
          id: string
          metadata: Json | null
          opened_at: string | null
          order_id: string | null
          recipient_email: string
          resend_email_id: string | null
          sent_at: string
          song_id: string | null
          status: string
          template_used: string | null
        }
        Insert: {
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_type: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          order_id?: string | null
          recipient_email: string
          resend_email_id?: string | null
          sent_at?: string
          song_id?: string | null
          status?: string
          template_used?: string | null
        }
        Update: {
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          email_type?: string
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          order_id?: string | null
          recipient_email?: string
          resend_email_id?: string | null
          sent_at?: string
          song_id?: string | null
          status?: string
          template_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "email_logs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["song_id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string | null
          from_email: string | null
          from_name: string | null
          html_content: string
          id: string
          reply_to: string | null
          subject: string
          template_type: string
          updated_at: string | null
          updated_by: string | null
          variables: Json
        }
        Insert: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          html_content: string
          id?: string
          reply_to?: string | null
          subject: string
          template_type: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json
        }
        Update: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          html_content?: string
          id?: string
          reply_to?: string | null
          subject?: string
          template_type?: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json
        }
        Relationships: []
      }
      email_templates_i18n: {
        Row: {
          created_at: string | null
          from_email: string | null
          from_name: string | null
          html_content: string
          id: string
          language: string
          subject: string
          template_type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          html_content: string
          id?: string
          language: string
          subject: string
          template_type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          from_email?: string | null
          from_name?: string | null
          html_content?: string
          id?: string
          language?: string
          subject?: string
          template_type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      example_tracks: {
        Row: {
          artist: string
          audio_path: string
          cover_path: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          language: string
          title: string
          updated_at: string | null
        }
        Insert: {
          artist: string
          audio_path: string
          cover_path?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          language: string
          title: string
          updated_at?: string | null
        }
        Update: {
          artist?: string
          audio_path?: string
          cover_path?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          language?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          locale: string | null
          question: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          locale?: string | null
          question: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          locale?: string | null
          question?: string
        }
        Relationships: []
      }
      home_example_track: {
        Row: {
          artist: string | null
          audio_path: string | null
          cover_path: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          title: string
        }
        Insert: {
          artist?: string | null
          audio_path?: string | null
          cover_path?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title: string
        }
        Update: {
          artist?: string | null
          audio_path?: string | null
          cover_path?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
        }
        Relationships: []
      }
      home_media: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          poster_path: string | null
          updated_at: string | null
          video_path: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          poster_path?: string | null
          updated_at?: string | null
          video_path?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          poster_path?: string | null
          updated_at?: string | null
          video_path?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          gpt_lyrics: Json | null
          gpt_prompt: string | null
          id: string
          order_id: string
          quiz_id: string
          status: Database["public"]["Enums"]["job_status"]
          suno_audio_url: string | null
          suno_task_id: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          gpt_lyrics?: Json | null
          gpt_prompt?: string | null
          id?: string
          order_id: string
          quiz_id: string
          status?: Database["public"]["Enums"]["job_status"]
          suno_audio_url?: string | null
          suno_task_id?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          gpt_lyrics?: Json | null
          gpt_prompt?: string | null
          id?: string
          order_id?: string
          quiz_id?: string
          status?: Database["public"]["Enums"]["job_status"]
          suno_audio_url?: string | null
          suno_task_id?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "jobs_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      lyrics_approvals: {
        Row: {
          approval_token: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          expires_at: string
          id: string
          job_id: string
          lyrics: Json
          lyrics_preview: string | null
          order_id: string
          quiz_id: string
          regeneration_count: number | null
          regeneration_feedback: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          approval_token?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          job_id: string
          lyrics: Json
          lyrics_preview?: string | null
          order_id: string
          quiz_id: string
          regeneration_count?: number | null
          regeneration_feedback?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          approval_token?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          job_id?: string
          lyrics?: Json
          lyrics_preview?: string | null
          order_id?: string
          quiz_id?: string
          regeneration_count?: number | null
          regeneration_feedback?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lyrics_approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lyrics_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lyrics_approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "lyrics_approvals_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number
          hotmart_payment_status: string | null
          hotmart_transaction_id: string | null
          created_at: string | null
          customer_email: string | null
          id: string
          magic_token: string | null
          paid_at: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan: Database["public"]["Enums"]["plan_type"]
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          quiz_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          transaction_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          hotmart_payment_status?: string | null
          hotmart_transaction_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          id?: string
          magic_token?: string | null
          paid_at?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan?: Database["public"]["Enums"]["plan_type"]
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          quiz_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          hotmart_payment_status?: string | null
          hotmart_transaction_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          id?: string
          magic_token?: string | null
          paid_at?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          plan?: Database["public"]["Enums"]["plan_type"]
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          quiz_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          created_at: string | null
          currency: string
          features: Json | null
          id: string
          is_active: boolean | null
          plan_name: string
          price_cents: number
          region: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          plan_name: string
          price_cents: number
          region: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          plan_name?: string
          price_cents?: number
          region?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email_notifications: boolean | null
          id: string
          preferred_language: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email_notifications?: boolean | null
          id: string
          preferred_language?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email_notifications?: boolean | null
          id?: string
          preferred_language?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_analytics: {
        Row: {
          created_at: string | null
          currency: string | null
          detected_country: string | null
          id: string
          ip_address_hash: string | null
          locked_region: string | null
          order_id: string | null
          price_cents: number | null
          selected_language: string | null
          suspicious_activity: boolean | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          detected_country?: string | null
          id?: string
          ip_address_hash?: string | null
          locked_region?: string | null
          order_id?: string | null
          price_cents?: number | null
          selected_language?: string | null
          suspicious_activity?: boolean | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          detected_country?: string | null
          id?: string
          ip_address_hash?: string | null
          locked_region?: string | null
          order_id?: string | null
          price_cents?: number | null
          selected_language?: string | null
          suspicious_activity?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_analytics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_analytics_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["order_id"]
          },
        ]
      }
      quizzes: {
        Row: {
          about_who: string
          answers: Json | null
          created_at: string | null
          customer_email: string
          desired_tone: string | null
          id: string
          key_moments: string | null
          language: string
          memories: string | null
          message: string | null
          music_prompt: string | null
          occasion: string | null
          qualities: string | null
          relationship: string | null
          style: string
          transaction_id: string | null
          user_id: string | null
          vocal_gender: string | null
        }
        Insert: {
          about_who: string
          answers?: Json | null
          created_at?: string | null
          customer_email: string
          desired_tone?: string | null
          id?: string
          key_moments?: string | null
          language: string
          memories?: string | null
          message?: string | null
          music_prompt?: string | null
          occasion?: string | null
          qualities?: string | null
          relationship?: string | null
          style: string
          transaction_id?: string | null
          user_id?: string | null
          vocal_gender?: string | null
        }
        Update: {
          about_who?: string
          answers?: Json | null
          created_at?: string | null
          customer_email?: string
          desired_tone?: string | null
          id?: string
          key_moments?: string | null
          language?: string
          memories?: string | null
          message?: string | null
          music_prompt?: string | null
          occasion?: string | null
          qualities?: string | null
          relationship?: string | null
          style?: string
          transaction_id?: string | null
          user_id?: string | null
          vocal_gender?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number | null
          created_at: string | null
          id: string
          identifier: string
          window_start: string | null
        }
        Insert: {
          action: string
          count?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          window_start?: string | null
        }
        Update: {
          action?: string
          count?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          window_start?: string | null
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          content: Json
          id: string
          is_active: boolean | null
          section_key: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content: Json
          id?: string
          is_active?: boolean | null
          section_key: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          is_active?: boolean | null
          section_key?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          audio_url: string | null
          cover_url: string | null
          created_at: string | null
          duration_sec: number | null
          emotion: string | null
          id: string
          language: string
          lyrics: string | null
          order_id: string
          quiz_id: string
          release_at: string
          released_at: string | null
          status: Database["public"]["Enums"]["song_status"]
          style: string | null
          suno_clip_id: string | null
          suno_task_id: string | null
          vocals_url: string | null
          instrumental_url: string | null
          stems_separated_at: string | null
          title: string
          transaction_id: string | null
          updated_at: string | null
          user_id: string | null
          variant_number: number | null
        }
        Insert: {
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          duration_sec?: number | null
          emotion?: string | null
          id?: string
          language: string
          lyrics?: string | null
          order_id: string
          quiz_id: string
          release_at: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["song_status"]
          style?: string | null
          suno_clip_id?: string | null
          suno_task_id?: string | null
          vocals_url?: string | null
          instrumental_url?: string | null
          stems_separated_at?: string | null
          title: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          variant_number?: number | null
        }
        Update: {
          audio_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          duration_sec?: number | null
          emotion?: string | null
          id?: string
          language?: string
          lyrics?: string | null
          order_id?: string
          quiz_id?: string
          release_at?: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["song_status"]
          style?: string | null
          suno_clip_id?: string | null
          suno_task_id?: string | null
          vocals_url?: string | null
          instrumental_url?: string | null
          stems_separated_at?: string | null
          title?: string
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          variant_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders_with_songs"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "songs_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_generations: {
        Row: {
          id: string
          generation_task_id: string
          audio_id: string
          audio_url: string | null
          song_id: string | null
          job_id: string | null
          order_id: string | null
          status: Database["public"]["Enums"]["audio_generation_status"]
          created_at: string | null
          updated_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          generation_task_id: string
          audio_id: string
          audio_url?: string | null
          song_id?: string | null
          job_id?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["audio_generation_status"]
          created_at?: string | null
          updated_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          generation_task_id?: string
          audio_id?: string
          audio_url?: string | null
          song_id?: string | null
          job_id?: string | null
          order_id?: string | null
          status?: Database["public"]["Enums"]["audio_generation_status"]
          created_at?: string | null
          updated_at?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_generations_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_generations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_generations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stem_separations: {
        Row: {
          id: string
          separation_task_id: string | null
          generation_task_id: string | null
          audio_id: string
          song_id: string | null
          type: string
          instrumental_url: string | null
          vocal_url: string | null
          origin_url: string | null
          instrumental_size_bytes: number | null
          vocal_size_bytes: number | null
          instrumental_mime_type: string | null
          vocal_mime_type: string | null
          status: Database["public"]["Enums"]["stem_separation_status"]
          error_message: string | null
          created_at: string | null
          updated_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          separation_task_id?: string | null
          generation_task_id?: string | null
          audio_id: string
          song_id?: string | null
          type?: string
          instrumental_url?: string | null
          vocal_url?: string | null
          origin_url?: string | null
          instrumental_size_bytes?: number | null
          vocal_size_bytes?: number | null
          instrumental_mime_type?: string | null
          vocal_mime_type?: string | null
          status?: Database["public"]["Enums"]["stem_separation_status"]
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          separation_task_id?: string | null
          generation_task_id?: string | null
          audio_id?: string
          song_id?: string | null
          type?: string
          instrumental_url?: string | null
          vocal_url?: string | null
          origin_url?: string | null
          instrumental_size_bytes?: number | null
          vocal_size_bytes?: number | null
          instrumental_mime_type?: string | null
          vocal_mime_type?: string | null
          status?: Database["public"]["Enums"]["stem_separation_status"]
          error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stem_separations_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          content: string
          content_en: string | null
          content_es: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          locale: string | null
          name: string
          name_en: string | null
          name_es: string | null
          rating: number | null
          role: string | null
          role_en: string | null
          role_es: string | null
        }
        Insert: {
          avatar_url?: string | null
          content: string
          content_en?: string | null
          content_es?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          locale?: string | null
          name: string
          name_en?: string | null
          name_es?: string | null
          rating?: number | null
          role?: string | null
          role_en?: string | null
          role_es?: string | null
        }
        Update: {
          avatar_url?: string | null
          content?: string
          content_en?: string | null
          content_es?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          locale?: string | null
          name?: string
          name_en?: string | null
          name_es?: string | null
          rating?: number | null
          role?: string | null
          role_en?: string | null
          role_es?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          detected_country: string
          detected_region: string
          expires_at: string | null
          id: string
          ip_address_hash: string | null
          locked_at: string | null
          session_token: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          detected_country: string
          detected_region: string
          expires_at?: string | null
          id?: string
          ip_address_hash?: string | null
          locked_at?: string | null
          session_token: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          detected_country?: string
          detected_region?: string
          expires_at?: string | null
          id?: string
          ip_address_hash?: string | null
          locked_at?: string | null
          session_token?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_orders_with_songs: {
        Row: {
          order_id: string | null
          order_status: Database["public"]["Enums"]["order_status"] | null
          release_at: string | null
          song_id: string | null
          song_status: Database["public"]["Enums"]["song_status"] | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: {
          _action: string
          _identifier: string
          _max_count: number
          _window_minutes: number
        }
        Returns: boolean
      }
      cleanup_old_checkout_events: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      audio_generation_status: "pending" | "processing" | "completed" | "failed"
      job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "generating_audio"
        | "audio_processing"
        | "retry_pending"
      order_status: "pending" | "paid" | "failed" | "refunded"
      payment_provider: "hotmart"
      plan_type: "standard" | "express"
      role_t: "user" | "admin"
      song_status: "pending" | "ready" | "released" | "approved"
      stem_separation_status: "pending" | "processing" | "completed" | "failed"
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
      job_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "generating_audio",
        "audio_processing",
        "retry_pending",
      ],
      order_status: ["pending", "paid", "failed", "refunded"],
      payment_provider: ["hotmart"],
      plan_type: ["standard", "express"],
      role_t: ["user", "admin"],
      song_status: ["pending", "ready", "released", "approved"],
    },
  },
} as const
