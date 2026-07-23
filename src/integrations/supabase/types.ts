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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_data: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          created_at: string
          criteria: Json
          description: string
          icon_url: string
          id: string
          is_active: boolean
          name: string
          tier: Database["public"]["Enums"]["badge_tier"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          criteria?: Json
          description?: string
          icon_url?: string
          id?: string
          is_active?: boolean
          name: string
          tier: Database["public"]["Enums"]["badge_tier"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon_url?: string
          id?: string
          is_active?: boolean
          name?: string
          tier?: Database["public"]["Enums"]["badge_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      branding: {
        Row: {
          accent_color: string
          app_name: string
          body_font: string
          heading_font: string
          id: string
          leaderboard_enabled: boolean
          leaderboard_refresh_hours: number
          login_bg_url: string | null
          logo_url: string | null
          mentor_community_url: string
          primary_color: string
          rejection_cooldown_days: number
          secondary_color: string
          sidebar_background: string
          sidebar_foreground: string
          sidebar_primary: string
          site_url: string
          supabase_api_url: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          app_name?: string
          body_font?: string
          heading_font?: string
          id?: string
          leaderboard_enabled?: boolean
          leaderboard_refresh_hours?: number
          login_bg_url?: string | null
          logo_url?: string | null
          mentor_community_url?: string
          primary_color?: string
          rejection_cooldown_days?: number
          secondary_color?: string
          sidebar_background?: string
          sidebar_foreground?: string
          sidebar_primary?: string
          site_url?: string
          supabase_api_url?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          app_name?: string
          body_font?: string
          heading_font?: string
          id?: string
          leaderboard_enabled?: boolean
          leaderboard_refresh_hours?: number
          login_bg_url?: string | null
          logo_url?: string | null
          mentor_community_url?: string
          primary_color?: string
          rejection_cooldown_days?: number
          secondary_color?: string
          sidebar_background?: string
          sidebar_foreground?: string
          sidebar_primary?: string
          site_url?: string
          supabase_api_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_settings: {
        Row: {
          audit_logs_retention_days: number
          created_at: string
          id: string
          inactive_user_retention_days: number
          last_sweep_at: string | null
          sessions_retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audit_logs_retention_days?: number
          created_at?: string
          id?: string
          inactive_user_retention_days?: number
          last_sweep_at?: string | null
          sessions_retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audit_logs_retention_days?: number
          created_at?: string
          id?: string
          inactive_user_retention_days?: number
          last_sweep_at?: string | null
          sessions_retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          admin_notes: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: Database["public"]["Enums"]["dsr_kind"]
          message: string
          status: Database["public"]["Enums"]["dsr_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["dsr_kind"]
          message?: string
          status?: Database["public"]["Enums"]["dsr_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["dsr_kind"]
          message?: string
          status?: Database["public"]["Enums"]["dsr_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_organizers: {
        Row: {
          event_id: string
          organizer_id: string
          role: string | null
        }
        Insert: {
          event_id: string
          organizer_id: string
          role?: string | null
        }
        Update: {
          event_id?: string
          organizer_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_organizers_event_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_organizers_mentor_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "mentor_data"
            referencedColumns: ["user_id"]
          },
        ]
      }
      event_participants: {
        Row: {
          attendance_status: string | null
          completion_status: string | null
          event_id: string | null
          feedback: string | null
          feedback_date: string | null
          id: string
          progress_data: Json | null
          rating: number | null
          registered_at: string | null
          user_id: string | null
        }
        Insert: {
          attendance_status?: string | null
          completion_status?: string | null
          event_id?: string | null
          feedback?: string | null
          feedback_date?: string | null
          id?: string
          progress_data?: Json | null
          rating?: number | null
          registered_at?: string | null
          user_id?: string | null
        }
        Update: {
          attendance_status?: string | null
          completion_status?: string | null
          event_id?: string | null
          feedback?: string | null
          feedback_date?: string | null
          id?: string
          progress_data?: Json | null
          rating?: number | null
          registered_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          ends_at: string | null
          event_type: string
          featured_image: string | null
          id: string
          location: string | null
          metadata: Json | null
          online_url: string | null
          plus_eligible: boolean
          plus_price: number
          primary_organizer_id: string | null
          registration_close_at: string | null
          registration_open_at: string | null
          short_description: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          tags: string[] | null
          timezone: string
          title: string
          updated_at: string | null
          venue: Json | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_type: string
          featured_image?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          online_url?: string | null
          plus_eligible?: boolean
          plus_price?: number
          primary_organizer_id?: string | null
          registration_close_at?: string | null
          registration_open_at?: string | null
          short_description?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          tags?: string[] | null
          timezone?: string
          title: string
          updated_at?: string | null
          venue?: Json | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          featured_image?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          online_url?: string | null
          plus_eligible?: boolean
          plus_price?: number
          primary_organizer_id?: string | null
          registration_close_at?: string | null
          registration_open_at?: string | null
          short_description?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          tags?: string[] | null
          timezone?: string
          title?: string
          updated_at?: string | null
          venue?: Json | null
        }
        Relationships: []
      }
      events_programs: {
        Row: {
          banner_image_url: string | null
          college_id: string | null
          college_name: string
          created_at: string | null
          created_by: string | null
          current_participants: number | null
          description: string
          end_date: string
          event_type: string
          id: string
          institution_id: string | null
          is_featured: boolean | null
          learning_outcomes: string | null
          location: string | null
          map: string | null
          max_participants: number | null
          meeting_link: string | null
          participant_count: number
          plus_eligible: boolean
          prerequisites: string | null
          price: number
          registration_deadline: string | null
          registration_link: string | null
          sessions: Json | null
          speaker_github: string | null
          speaker_image: string | null
          speaker_linkedin: string | null
          speaker_name: string | null
          start_date: string
          start_time: string
          status: string | null
          syllabus: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          banner_image_url?: string | null
          college_id?: string | null
          college_name: string
          created_at?: string | null
          created_by?: string | null
          current_participants?: number | null
          description: string
          end_date: string
          event_type: string
          id?: string
          institution_id?: string | null
          is_featured?: boolean | null
          learning_outcomes?: string | null
          location?: string | null
          map?: string | null
          max_participants?: number | null
          meeting_link?: string | null
          participant_count?: number
          plus_eligible?: boolean
          prerequisites?: string | null
          price?: number
          registration_deadline?: string | null
          registration_link?: string | null
          sessions?: Json | null
          speaker_github?: string | null
          speaker_image?: string | null
          speaker_linkedin?: string | null
          speaker_name?: string | null
          start_date: string
          start_time: string
          status?: string | null
          syllabus?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          banner_image_url?: string | null
          college_id?: string | null
          college_name?: string
          created_at?: string | null
          created_by?: string | null
          current_participants?: number | null
          description?: string
          end_date?: string
          event_type?: string
          id?: string
          institution_id?: string | null
          is_featured?: boolean | null
          learning_outcomes?: string | null
          location?: string | null
          map?: string | null
          max_participants?: number | null
          meeting_link?: string | null
          participant_count?: number
          plus_eligible?: boolean
          prerequisites?: string | null
          price?: number
          registration_deadline?: string | null
          registration_link?: string | null
          sessions?: Json | null
          speaker_github?: string | null
          speaker_image?: string | null
          speaker_linkedin?: string | null
          speaker_name?: string | null
          start_date?: string
          start_time?: string
          status?: string | null
          syllabus?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          audience: Database["public"]["Enums"]["feedback_audience"]
          comment: string | null
          created_at: string
          id: string
          rating: number
          responded_at: string | null
          response: string | null
          session_id: string
          submitted_by: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["feedback_audience"]
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          responded_at?: string | null
          response?: string | null
          session_id: string
          submitted_by: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["feedback_audience"]
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          responded_at?: string | null
          response?: string | null
          session_id?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          anonymous: boolean
          approved: boolean
          comment: string | null
          created_at: string
          flagged: boolean
          id: string
          metadata: Json | null
          rating: number | null
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["feedback_target_type"]
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          anonymous?: boolean
          approved?: boolean
          comment?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          metadata?: Json | null
          rating?: number | null
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          target_id: string
          target_type: Database["public"]["Enums"]["feedback_target_type"]
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          anonymous?: boolean
          approved?: boolean
          comment?: string | null
          created_at?: string
          flagged?: boolean
          id?: string
          metadata?: Json | null
          rating?: number | null
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["feedback_target_type"]
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      general_feedback: {
        Row: {
          category: Database["public"]["Enums"]["general_feedback_category"]
          created_at: string
          id: string
          message: string
          resolved: boolean
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["general_feedback_category"]
          created_at?: string
          id?: string
          message: string
          resolved?: boolean
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["general_feedback_category"]
          created_at?: string
          id?: string
          message?: string
          resolved?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          domain: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      jwt_config: {
        Row: {
          algorithm: string
          allowed_clock_skew_seconds: number | null
          audience: string
          auto_provision: boolean | null
          claim_email: string | null
          claim_full_name: string | null
          claim_role: string | null
          claim_user_id: string | null
          default_role: Database["public"]["Enums"]["app_role"] | null
          enabled: boolean
          id: string
          issuer: string
          jwks_url: string | null
          login_redirect_url: string | null
          logout_redirect_url: string | null
          public_key: string
          token_param_name: string | null
          updated_at: string
        }
        Insert: {
          algorithm?: string
          allowed_clock_skew_seconds?: number | null
          audience?: string
          auto_provision?: boolean | null
          claim_email?: string | null
          claim_full_name?: string | null
          claim_role?: string | null
          claim_user_id?: string | null
          default_role?: Database["public"]["Enums"]["app_role"] | null
          enabled?: boolean
          id?: string
          issuer?: string
          jwks_url?: string | null
          login_redirect_url?: string | null
          logout_redirect_url?: string | null
          public_key?: string
          token_param_name?: string | null
          updated_at?: string
        }
        Update: {
          algorithm?: string
          allowed_clock_skew_seconds?: number | null
          audience?: string
          auto_provision?: boolean | null
          claim_email?: string | null
          claim_full_name?: string | null
          claim_role?: string | null
          claim_user_id?: string | null
          default_role?: Database["public"]["Enums"]["app_role"] | null
          enabled?: boolean
          id?: string
          issuer?: string
          jwks_url?: string | null
          login_redirect_url?: string | null
          logout_redirect_url?: string | null
          public_key?: string
          token_param_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          auto_renew: boolean
          cancel_at_period_end: boolean
          cashfree_subscription_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mandate_max_amount: number | null
          plan_id: string | null
          quota_anchor_day: number | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          cancel_at_period_end?: boolean
          cashfree_subscription_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mandate_max_amount?: number | null
          plan_id?: string | null
          quota_anchor_day?: number | null
          started_at?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          cancel_at_period_end?: boolean
          cashfree_subscription_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mandate_max_amount?: number | null
          plan_id?: string | null
          quota_anchor_day?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentee_data: {
        Row: {
          bio: string | null
          created_at: string | null
          current_status: string | null
          education: Json | null
          education_level: string | null
          email: string | null
          github_url: string | null
          goals: string | null
          instagram_url: string | null
          institution_id: string | null
          interests: string[] | null
          languages: string[] | null
          linkedin_url: string | null
          location: string | null
          name: string | null
          phone: string | null
          portfolio_url: string | null
          preferences: Json | null
          preferred_industries: string[] | null
          profile_url: string | null
          resume_url: string | null
          skills: string[] | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          work_background: Json | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          current_status?: string | null
          education?: Json | null
          education_level?: string | null
          email?: string | null
          github_url?: string | null
          goals?: string | null
          instagram_url?: string | null
          institution_id?: string | null
          interests?: string[] | null
          languages?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferences?: Json | null
          preferred_industries?: string[] | null
          profile_url?: string | null
          resume_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          work_background?: Json | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          current_status?: string | null
          education?: Json | null
          education_level?: string | null
          email?: string | null
          github_url?: string | null
          goals?: string | null
          instagram_url?: string | null
          institution_id?: string | null
          interests?: string[] | null
          languages?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferences?: Json | null
          preferred_industries?: string[] | null
          profile_url?: string | null
          resume_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          work_background?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mentee_data_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      mentee_favorites: {
        Row: {
          created_at: string | null
          id: string
          mentee_id: string
          mentor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentee_id: string
          mentor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentee_id?: string
          mentor_id?: string
        }
        Relationships: []
      }
      mentee_profiles: {
        Row: {
          academic_details: string
          bio: string
          created_at: string
          current_status: string | null
          education_details: Json | null
          education_level: string | null
          github_url: string
          goals: string | null
          headline: string
          id: string
          instagram_url: string | null
          interests: string[] | null
          languages: string[] | null
          linkedin_url: string
          location: string | null
          onboarded_at: string | null
          organization_unit: string | null
          phone: string | null
          portfolio_url: string
          preferred_industries: string[] | null
          preferred_mentor_areas: string[]
          preferred_mentor_qualities: string[] | null
          preferred_session_types: string[] | null
          preferred_time_windows: string[] | null
          resume_url: string | null
          skills: string[] | null
          timezone: string | null
          updated_at: string
          user_id: string
          work_experience: Json | null
        }
        Insert: {
          academic_details?: string
          bio?: string
          created_at?: string
          current_status?: string | null
          education_details?: Json | null
          education_level?: string | null
          github_url?: string
          goals?: string | null
          headline?: string
          id?: string
          instagram_url?: string | null
          interests?: string[] | null
          languages?: string[] | null
          linkedin_url?: string
          location?: string | null
          onboarded_at?: string | null
          organization_unit?: string | null
          phone?: string | null
          portfolio_url?: string
          preferred_industries?: string[] | null
          preferred_mentor_areas?: string[]
          preferred_mentor_qualities?: string[] | null
          preferred_session_types?: string[] | null
          preferred_time_windows?: string[] | null
          resume_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          work_experience?: Json | null
        }
        Update: {
          academic_details?: string
          bio?: string
          created_at?: string
          current_status?: string | null
          education_details?: Json | null
          education_level?: string | null
          github_url?: string
          goals?: string | null
          headline?: string
          id?: string
          instagram_url?: string | null
          interests?: string[] | null
          languages?: string[] | null
          linkedin_url?: string
          location?: string | null
          onboarded_at?: string | null
          organization_unit?: string | null
          phone?: string | null
          portfolio_url?: string
          preferred_industries?: string[] | null
          preferred_mentor_areas?: string[]
          preferred_mentor_qualities?: string[] | null
          preferred_session_types?: string[] | null
          preferred_time_windows?: string[] | null
          resume_url?: string | null
          skills?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          work_experience?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mentee_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_applications: {
        Row: {
          admin_notes: string | null
          bio: string
          changes_feedback: string | null
          created_at: string
          current_organization: string | null
          current_role: string | null
          email: string
          expertise: string[]
          full_name: string
          id: string
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          professional_status: string | null
          rejection_reason: string | null
          resume_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          years_experience: number
        }
        Insert: {
          admin_notes?: string | null
          bio: string
          changes_feedback?: string | null
          created_at?: string
          current_organization?: string | null
          current_role?: string | null
          email: string
          expertise?: string[]
          full_name: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          professional_status?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          years_experience?: number
        }
        Update: {
          admin_notes?: string | null
          bio?: string
          changes_feedback?: string | null
          created_at?: string
          current_organization?: string | null
          current_role?: string | null
          email?: string
          expertise?: string[]
          full_name?: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          professional_status?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          years_experience?: number
        }
        Relationships: []
      }
      mentor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_recurring: boolean
          mentor_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_recurring?: boolean
          mentor_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_recurring?: boolean
          mentor_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_availability_mentor_id_fkey1"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_availability_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_unavailable: boolean
          mentor_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_unavailable?: boolean
          mentor_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_unavailable?: boolean
          mentor_id?: string
          start_time?: string | null
        }
        Relationships: []
      }
      mentor_badges: {
        Row: {
          awarded_at: string
          awarded_reason: string
          badge_id: string
          id: string
          mentor_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_reason?: string
          badge_id: string
          id?: string
          mentor_id: string
        }
        Update: {
          awarded_at?: string
          awarded_reason?: string
          badge_id?: string
          id?: string
          mentor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_data: {
        Row: {
          badge: string | null
          bio: string | null
          created_at: string | null
          current_role: string | null
          email: string
          experience_years: number | null
          expertise_area: string[] | null
          github_url: string | null
          Industry: string | null
          institution_id: string | null
          languages_spoken: string[] | null
          linkedin_url: string | null
          location: string | null
          name: string | null
          past_experience: Json | null
          phone: string | null
          portfolio_url: string | null
          profile_url: string | null
          reviews: Json | null
          role: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          youtube: string | null
        }
        Insert: {
          badge?: string | null
          bio?: string | null
          created_at?: string | null
          current_role?: string | null
          email: string
          experience_years?: number | null
          expertise_area?: string[] | null
          github_url?: string | null
          Industry?: string | null
          institution_id?: string | null
          languages_spoken?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          past_experience?: Json | null
          phone?: string | null
          portfolio_url?: string | null
          profile_url?: string | null
          reviews?: Json | null
          role?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          youtube?: string | null
        }
        Update: {
          badge?: string | null
          bio?: string | null
          created_at?: string | null
          current_role?: string | null
          email?: string
          experience_years?: number | null
          expertise_area?: string[] | null
          github_url?: string | null
          Industry?: string | null
          institution_id?: string | null
          languages_spoken?: string[] | null
          linkedin_url?: string | null
          location?: string | null
          name?: string | null
          past_experience?: Json | null
          phone?: string | null
          portfolio_url?: string | null
          profile_url?: string | null
          reviews?: Json | null
          role?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_data_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_earnings: {
        Row: {
          created_at: string
          currency: string
          fee_amount: number
          gross_amount: number
          id: string
          mentor_id: string | null
          net_amount: number
          reference_id: string | null
          source: string
          status: string
          withdrawal_request_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          fee_amount?: number
          gross_amount: number
          id?: string
          mentor_id?: string | null
          net_amount: number
          reference_id?: string | null
          source: string
          status?: string
          withdrawal_request_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          mentor_id?: string | null
          net_amount?: number
          reference_id?: string | null
          source?: string
          status?: string
          withdrawal_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_earnings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_earnings_withdrawal_request_id_fkey"
            columns: ["withdrawal_request_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_leaderboard_stats: {
        Row: {
          avg_rating_30d: number
          completed_sessions_30d: number
          computed_at: string
          mentee_count_30d: number
          mentor_id: string
          score: number
        }
        Insert: {
          avg_rating_30d?: number
          completed_sessions_30d?: number
          computed_at?: string
          mentee_count_30d?: number
          mentor_id: string
          score?: number
        }
        Update: {
          avg_rating_30d?: number
          completed_sessions_30d?: number
          computed_at?: string
          mentee_count_30d?: number
          mentor_id?: string
          score?: number
        }
        Relationships: []
      }
      mentor_mentee_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          mentee_id: string
          mentor_id: string
          notes: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id: string
          mentor_id: string
          notes?: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id?: string
          mentor_id?: string
          notes?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_mentee_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_payout_accounts: {
        Row: {
          created_at: string
          details: Json
          id: string
          mentor_id: string
          method: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details: Json
          id?: string
          mentor_id: string
          method: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          mentor_id?: string
          method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_payout_accounts_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_payouts: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          mentor_id: string
          notes: string | null
          processed_at: string | null
          reference_id: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          mentor_id: string
          notes?: string | null
          processed_at?: string | null
          reference_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          mentor_id?: string
          notes?: string | null
          processed_at?: string | null
          reference_id?: string | null
          status?: string
        }
        Relationships: []
      }
      mentor_profiles: {
        Row: {
          allow_mentee_attachments: boolean
          approval_acknowledged_at: string | null
          bio: string | null
          buffer_time_minutes: number
          created_at: string
          current_organization: string | null
          current_role: string | null
          experiences: Json
          expertise: string[] | null
          headline: string | null
          id: string
          is_active: boolean
          linkedin_url: string | null
          minimum_notice_hours: number
          phone: string | null
          portfolio_url: string | null
          professional_status: string | null
          qualifications: Json
          resume_url: string | null
          slug: string | null
          timezone: string
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          allow_mentee_attachments?: boolean
          approval_acknowledged_at?: string | null
          bio?: string | null
          buffer_time_minutes?: number
          created_at?: string
          current_organization?: string | null
          current_role?: string | null
          experiences?: Json
          expertise?: string[] | null
          headline?: string | null
          id?: string
          is_active?: boolean
          linkedin_url?: string | null
          minimum_notice_hours?: number
          phone?: string | null
          portfolio_url?: string | null
          professional_status?: string | null
          qualifications?: Json
          resume_url?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          allow_mentee_attachments?: boolean
          approval_acknowledged_at?: string | null
          bio?: string | null
          buffer_time_minutes?: number
          created_at?: string
          current_organization?: string | null
          current_role?: string | null
          experiences?: Json
          expertise?: string[] | null
          headline?: string | null
          id?: string
          is_active?: boolean
          linkedin_url?: string | null
          minimum_notice_hours?: number
          phone?: string | null
          portfolio_url?: string | null
          professional_status?: string | null
          qualifications?: Json
          resume_url?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_bookings: {
        Row: {
          amount: number
          cancellation_reason: string | null
          cancelled_by: string | null
          created_at: string | null
          currency: string
          duration_minutes: number
          id: string
          meeting_link: string | null
          meeting_notes: string | null
          mentee_feedback: string | null
          mentee_id: string
          mentee_rating: number | null
          mentor_id: string
          mentor_notes: string | null
          offering_id: string
          payment_id: string | null
          payment_status: string | null
          scheduled_at: string
          status: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string
          duration_minutes: number
          id?: string
          meeting_link?: string | null
          meeting_notes?: string | null
          mentee_feedback?: string | null
          mentee_id: string
          mentee_rating?: number | null
          mentor_id: string
          mentor_notes?: string | null
          offering_id: string
          payment_id?: string | null
          payment_status?: string | null
          scheduled_at: string
          status?: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string
          duration_minutes?: number
          id?: string
          meeting_link?: string | null
          meeting_notes?: string | null
          mentee_feedback?: string | null
          mentee_id?: string
          mentee_rating?: number | null
          mentor_id?: string
          mentor_notes?: string | null
          offering_id?: string
          payment_id?: string | null
          payment_status?: string | null
          scheduled_at?: string
          status?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_bookings_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "mentorship_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_offerings: {
        Row: {
          advance_booking_days: number | null
          average_rating: number | null
          buffer_after_minutes: number | null
          buffer_before_minutes: number | null
          cancellation_policy: string | null
          category: string
          created_at: string | null
          currency: string
          custom_availability: Json | null
          description: string | null
          duration_minutes: number
          featured: boolean | null
          id: string
          max_bookings_per_day: number | null
          mentor_id: string
          min_notice_hours: number | null
          plus_eligible: boolean
          preparation_notes: string | null
          price: number
          status: string
          title: string
          total_bookings: number | null
          total_completed: number | null
          updated_at: string | null
          use_profile_availability: boolean
        }
        Insert: {
          advance_booking_days?: number | null
          average_rating?: number | null
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          cancellation_policy?: string | null
          category?: string
          created_at?: string | null
          currency?: string
          custom_availability?: Json | null
          description?: string | null
          duration_minutes?: number
          featured?: boolean | null
          id?: string
          max_bookings_per_day?: number | null
          mentor_id: string
          min_notice_hours?: number | null
          plus_eligible?: boolean
          preparation_notes?: string | null
          price?: number
          status?: string
          title: string
          total_bookings?: number | null
          total_completed?: number | null
          updated_at?: string | null
          use_profile_availability?: boolean
        }
        Update: {
          advance_booking_days?: number | null
          average_rating?: number | null
          buffer_after_minutes?: number | null
          buffer_before_minutes?: number | null
          cancellation_policy?: string | null
          category?: string
          created_at?: string | null
          currency?: string
          custom_availability?: Json | null
          description?: string | null
          duration_minutes?: number
          featured?: boolean | null
          id?: string
          max_bookings_per_day?: number | null
          mentor_id?: string
          min_notice_hours?: number | null
          plus_eligible?: boolean
          preparation_notes?: string | null
          price?: number
          status?: string
          title?: string
          total_bookings?: number | null
          total_completed?: number | null
          updated_at?: string | null
          use_profile_availability?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      old_feedback: {
        Row: {
          comment: string | null
          created_at: string | null
          feedback_type: string
          id: string
          mentor_response: string | null
          mentor_response_at: string | null
          rating: number
          reference_id: string
          responded_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          feedback_type: string
          id?: string
          mentor_response?: string | null
          mentor_response_at?: string | null
          rating: number
          reference_id: string
          responded_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          feedback_type?: string
          id?: string
          mentor_response?: string | null
          mentor_response_at?: string | null
          rating?: number
          reference_id?: string
          responded_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      old_mentor_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          mentor_id: string
          start_time: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          mentor_id: string
          start_time: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          mentor_id?: string
          start_time?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      old_user_roles: {
        Row: {
          name: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          name?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          name?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          commission_percent: number
          currency: string
          id: string
          plus_discount_percent: number
          plus_payout_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_percent?: number
          currency?: string
          id?: string
          plus_discount_percent?: number
          plus_payout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_percent?: number
          currency?: string
          id?: string
          plus_discount_percent?: number
          plus_payout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cashfree_order_id: string | null
          cashfree_payment_session_id: string | null
          created_at: string
          currency: string
          id: string
          kind: string
          payload: Json | null
          reference_id: string | null
          session_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cashfree_order_id?: string | null
          cashfree_payment_session_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind: string
          payload?: Json | null
          reference_id?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cashfree_order_id?: string | null
          cashfree_payment_session_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          kind?: string
          payload?: Json | null
          reference_id?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_session_usage: {
        Row: {
          accrued_amount: number
          created_at: string
          id: string
          kind: string
          list_price: number
          membership_id: string
          mentor_id: string | null
          quota_period_end: string
          quota_period_start: string
          reference_id: string
          user_id: string
        }
        Insert: {
          accrued_amount: number
          created_at?: string
          id?: string
          kind: string
          list_price: number
          membership_id: string
          mentor_id?: string | null
          quota_period_end: string
          quota_period_start: string
          reference_id: string
          user_id: string
        }
        Update: {
          accrued_amount?: number
          created_at?: string
          id?: string
          kind?: string
          list_price?: number
          membership_id?: string
          mentor_id?: string | null
          quota_period_end?: string
          quota_period_start?: string
          reference_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_session_usage_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_session_usage_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_session_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          edited: boolean
          id: string
          moderated: boolean
          parent_id: string | null
          post_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited?: boolean
          id?: string
          moderated?: boolean
          parent_id?: string | null
          post_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited?: boolean
          id?: string
          moderated?: boolean
          parent_id?: string | null
          post_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          post_id: string
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          post_id: string
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          post_id?: string
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          content_json: Json | null
          cover_url: string | null
          created_at: string
          featured: boolean
          id: string
          published_at: string | null
          reading_time_minutes: number | null
          search_vector: unknown
          slug: string
          status: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          content_json?: Json | null
          cover_url?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          published_at?: string | null
          reading_time_minutes?: number | null
          search_vector?: unknown
          slug: string
          status?: string
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          content_json?: Json | null
          cover_url?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          published_at?: string | null
          reading_time_minutes?: number | null
          search_vector?: unknown
          slug?: string
          status?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      privacy_policy: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_current: boolean
          summary: string
          updated_at: string
          url: string
          version: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_current?: boolean
          summary?: string
          updated_at?: string
          url?: string
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_current?: boolean
          summary?: string
          updated_at?: string
          url?: string
          version?: string
        }
        Relationships: []
      }
      program_mentees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          mentee_id: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_mentees_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_mentors: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          mentor_id: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentor_id: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentor_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_mentors_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_tags: {
        Row: {
          created_at: string
          id: string
          label: string
          program_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          program_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_tags_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          capacity: number | null
          color: string
          created_at: string
          created_by: string | null
          description: string
          ends_on: string | null
          id: string
          name: string
          slug: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on?: string | null
          id?: string
          name: string
          slug: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on?: string | null
          id?: string
          name?: string
          slug?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      session_action_items: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          mentee_attachments: Json
          mentee_id: string
          mentor_attachments: Json
          mentor_id: string
          session_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string
          due_date?: string | null
          id?: string
          mentee_attachments?: Json
          mentee_id: string
          mentor_attachments?: Json
          mentor_id: string
          session_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          mentee_attachments?: Json
          mentee_id?: string
          mentor_attachments?: Json
          mentor_id?: string
          session_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_action_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          cancellation_reason: string
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          duration_minutes: number
          id: string
          meeting_url: string
          mentee_id: string
          mentee_notes: string
          mentor_id: string
          notes: string | null
          offering_id: string | null
          program_id: string | null
          reminder_sent_at: string | null
          rescheduled_from_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          topic: string
        }
        Insert: {
          cancellation_reason?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string
          mentee_id: string
          mentee_notes?: string
          mentor_id: string
          notes?: string | null
          offering_id?: string | null
          program_id?: string | null
          reminder_sent_at?: string | null
          rescheduled_from_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          topic?: string
        }
        Update: {
          cancellation_reason?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string
          mentee_id?: string
          mentee_notes?: string
          mentor_id?: string
          notes?: string | null
          offering_id?: string | null
          program_id?: string | null
          reminder_sent_at?: string | null
          rescheduled_from_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "mentorship_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_holds: {
        Row: {
          created_at: string
          duration_minutes: number
          expires_at: string
          id: string
          mentee_id: string
          mentor_id: string
          payment_id: string | null
          scheduled_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          expires_at: string
          id?: string
          mentee_id: string
          mentor_id: string
          payment_id?: string | null
          scheduled_at: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          expires_at?: string
          id?: string
          mentee_id?: string
          mentor_id?: string
          payment_id?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_holds_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          benefits: Json
          cashfree_plan_id: string | null
          created_at: string
          currency: string
          id: string
          interval: string
          is_active: boolean
          max_amount: number | null
          monthly_quota: number
          name: string
          price: number
          slug: string
          updated_at: string
        }
        Insert: {
          benefits?: Json
          cashfree_plan_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          interval: string
          is_active?: boolean
          max_amount?: number | null
          monthly_quota?: number
          name: string
          price?: number
          slug: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          cashfree_plan_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          interval?: string
          is_active?: boolean
          max_amount?: number | null
          monthly_quota?: number
          name?: string
          price?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          ip_address: string
          policy_version: string
          user_agent: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string
          policy_version: string
          user_agent?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string
          policy_version?: string
          user_agent?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount: number | null
          auto_renewal: boolean | null
          created_at: string | null
          currency: string | null
          domain: string
          expires_at: string | null
          id: string
          payment_details: string | null
          payment_method: string | null
          payment_status: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          auto_renewal?: boolean | null
          created_at?: string | null
          currency?: string | null
          domain: string
          expires_at?: string | null
          id?: string
          payment_details?: string | null
          payment_method?: string | null
          payment_status?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          auto_renewal?: boolean | null
          created_at?: string | null
          currency?: string | null
          domain?: string
          expires_at?: string | null
          id?: string
          payment_details?: string | null
          payment_method?: string | null
          payment_status?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          email: string
          external_id: string | null
          full_name: string
          id: string
          is_disabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          email: string
          external_id?: string | null
          full_name?: string
          id: string
          is_disabled?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          email?: string
          external_id?: string | null
          full_name?: string
          id?: string
          is_disabled?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          id: string
          mentor_id: string | null
          payment_reference: string | null
          payout_account_snapshot: Json | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          id?: string
          mentor_id?: string | null
          payment_reference?: string | null
          payout_account_snapshot?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          id?: string
          mentor_id?: string | null
          payment_reference?: string | null
          payout_account_snapshot?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_mentee_book_mentor: {
        Args: { _mentee: string; _mentor: string }
        Returns: boolean
      }
      check_email_exists: { Args: { email_to_check: string }; Returns: boolean }
      consume_plus_session: {
        Args: {
          _kind: string
          _list_price: number
          _mentor_id: string
          _reference_id: string
          _user_id: string
        }
        Returns: string
      }
      generate_mentor_slug: {
        Args: { _full_name: string; _user_id: string }
        Returns: string
      }
      get_booked_times: {
        Args: { _mentor_id: string }
        Returns: {
          duration_minutes: number
          id: string
          scheduled_at: string
        }[]
      }
      get_mentee_profile_for_mentor: {
        Args: { _mentee_id: string }
        Returns: {
          academic_details: string
          avatar_url: string
          bio: string
          current_status: string
          education_details: Json
          education_level: string
          email: string
          full_name: string
          github_url: string
          goals: string
          headline: string
          id: string
          instagram_url: string
          interests: string[]
          languages: string[]
          linkedin_url: string
          location: string
          organization_unit: string
          phone: string
          portfolio_url: string
          preferred_industries: string[]
          preferred_mentor_areas: string[]
          preferred_mentor_qualities: string[]
          preferred_session_types: string[]
          preferred_time_windows: string[]
          resume_url: string
          skills: string[]
          timezone: string
          work_experience: Json
        }[]
      }
      get_mentor_booking_info: {
        Args: { _mentor_id: string }
        Returns: {
          avatar_url: string
          bio: string
          buffer_time_minutes: number
          current_organization: string
          current_role: string
          email: string
          expertise: string[]
          full_name: string
          headline: string
          id: string
          is_active: boolean
          linkedin_url: string
          minimum_notice_hours: number
          timezone: string
          years_experience: number
        }[]
      }
      get_program_member_counts: {
        Args: { program_ids: string[] }
        Returns: {
          mentee_count: number
          mentor_count: number
          program_id: string
        }[]
      }
      get_public_mentor: {
        Args: { _slug_or_id: string }
        Returns: {
          avatar_url: string
          bio: string
          current_organization: string
          current_role: string
          experiences: Json
          expertise: string[]
          full_name: string
          headline: string
          linkedin_url: string
          portfolio_url: string
          qualifications: Json
          slug: string
          user_id: string
          years_experience: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_view_count: {
        Args: { p_ip_address?: string; p_post_id: string; p_viewer_id?: string }
        Returns: undefined
      }
      is_feedback_subject: {
        Args: { _feedback_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_member: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_mentor: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      list_active_plans: {
        Args: never
        Returns: {
          benefits: Json
          cashfree_plan_id: string | null
          created_at: string
          currency: string
          id: string
          interval: string
          is_active: boolean
          max_amount: number | null
          monthly_quota: number
          name: string
          price: number
          slug: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "subscription_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_public_mentors: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          current_role: string
          expertise: string[]
          full_name: string
          headline: string
          slug: string
          user_id: string
          years_experience: number
        }[]
      }
      list_public_offerings: {
        Args: never
        Returns: {
          category: string
          description: string
          duration_minutes: number
          id: string
          mentor_avatar_url: string
          mentor_current_role: string
          mentor_full_name: string
          mentor_id: string
          price: number
          status: string
          title: string
        }[]
      }
      plus_quota_status: {
        Args: never
        Returns: {
          discount_percent: number
          has_membership: boolean
          quota_remaining: number
          quota_total: number
          quota_used: number
        }[]
      }
      plus_quota_window_start: {
        Args: { _anchor_day: number; _today: string }
        Returns: string
      }
      process_withdrawal: {
        Args: {
          _action: string
          _note?: string
          _reference?: string
          _request_id: string
        }
        Returns: undefined
      }
      request_withdrawal: { Args: never; Returns: string }
      reserve_slot: {
        Args: {
          _duration: number
          _mentee_id: string
          _mentor_id: string
          _payment_id: string
          _scheduled_at: string
          _ttl_minutes: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "mentor" | "mentee"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
      article_status: "draft" | "pending" | "published" | "archived"
      badge_tier: "bronze" | "silver" | "gold"
      dsr_kind: "export" | "correction" | "deletion" | "withdrawal"
      dsr_status: "pending" | "in_review" | "completed" | "rejected"
      event_status:
        | "draft"
        | "published"
        | "cancelled"
        | "completed"
        | "postponed"
      feedback_audience: "mentor" | "mentee" | "admin_private"
      feedback_target_type:
        | "mentor"
        | "mentee"
        | "event"
        | "workshop"
        | "hackathon"
        | "article"
        | "team"
        | "institute"
        | "other"
      general_feedback_category:
        | "feedback"
        | "concern"
        | "suggestion"
        | "review"
      outbound_event_status: "pending" | "sent" | "failed"
      payment_status:
        | "pending"
        | "initiated"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled"
      payout_status: "pending" | "paid" | "failed" | "cancelled"
      refund_status: "pending" | "succeeded" | "failed" | "cancelled"
      registration_status:
        | "registered"
        | "confirmed"
        | "cancelled"
        | "checked_in"
        | "no_show"
        | "waitlisted"
        | "refunded"
      session_status: "booked" | "completed" | "cancelled" | "no_show"
      ticket_type: "free" | "paid" | "donation"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "mentor", "mentee"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
      ],
      article_status: ["draft", "pending", "published", "archived"],
      badge_tier: ["bronze", "silver", "gold"],
      dsr_kind: ["export", "correction", "deletion", "withdrawal"],
      dsr_status: ["pending", "in_review", "completed", "rejected"],
      event_status: [
        "draft",
        "published",
        "cancelled",
        "completed",
        "postponed",
      ],
      feedback_audience: ["mentor", "mentee", "admin_private"],
      feedback_target_type: [
        "mentor",
        "mentee",
        "event",
        "workshop",
        "hackathon",
        "article",
        "team",
        "institute",
        "other",
      ],
      general_feedback_category: [
        "feedback",
        "concern",
        "suggestion",
        "review",
      ],
      outbound_event_status: ["pending", "sent", "failed"],
      payment_status: [
        "pending",
        "initiated",
        "succeeded",
        "failed",
        "refunded",
        "cancelled",
      ],
      payout_status: ["pending", "paid", "failed", "cancelled"],
      refund_status: ["pending", "succeeded", "failed", "cancelled"],
      registration_status: [
        "registered",
        "confirmed",
        "cancelled",
        "checked_in",
        "no_show",
        "waitlisted",
        "refunded",
      ],
      session_status: ["booked", "completed", "cancelled", "no_show"],
      ticket_type: ["free", "paid", "donation"],
    },
  },
} as const
