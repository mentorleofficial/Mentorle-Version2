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
  public: {
    Tables: {
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
          edubridge_enabled: boolean
          edubridge_webhook_url: string
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
          edubridge_enabled?: boolean
          edubridge_webhook_url?: string
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
          edubridge_enabled?: boolean
          edubridge_webhook_url?: string
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
      event_participants: {
        Row: {
          completion_status: string | null
          event_id: string
          id: string
          progress_data: Json | null
          registered_at: string
          user_id: string
        }
        Insert: {
          completion_status?: string | null
          event_id: string
          id?: string
          progress_data?: Json | null
          registered_at?: string
          user_id: string
        }
        Update: {
          completion_status?: string | null
          event_id?: string
          id?: string
          progress_data?: Json | null
          registered_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events_programs: {
        Row: {
          banner_image_url: string | null
          college_name: string
          created_at: string
          created_by: string
          description: string
          end_date: string
          event_type: string
          id: string
          learning_outcomes: string | null
          location: string
          max_participants: number | null
          meeting_link: string | null
          participant_count: number
          prerequisites: string | null
          registration_deadline: string | null
          registration_link: string | null
          sessions: Json | null
          speaker_github: string | null
          speaker_image: string | null
          speaker_linkedin: string | null
          speaker_name: string | null
          start_date: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          college_name?: string
          created_at?: string
          created_by: string
          description: string
          end_date: string
          event_type: string
          id?: string
          learning_outcomes?: string | null
          location?: string
          max_participants?: number | null
          meeting_link?: string | null
          participant_count?: number
          prerequisites?: string | null
          registration_deadline?: string | null
          registration_link?: string | null
          sessions?: Json | null
          speaker_github?: string | null
          speaker_image?: string | null
          speaker_linkedin?: string | null
          speaker_name?: string | null
          start_date: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          college_name?: string
          created_at?: string
          created_by?: string
          description?: string
          end_date?: string
          event_type?: string
          id?: string
          learning_outcomes?: string | null
          location?: string
          max_participants?: number | null
          meeting_link?: string | null
          participant_count?: number
          prerequisites?: string | null
          registration_deadline?: string | null
          registration_link?: string | null
          sessions?: Json | null
          speaker_github?: string | null
          speaker_image?: string | null
          speaker_linkedin?: string | null
          speaker_name?: string | null
          start_date?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
        Relationships: [
          {
            foreignKeyName: "mentee_favorites_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentee_favorites_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "mentor_availability_mentor_id_fkey"
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
      mentorship_offerings: {
        Row: {
          category: string
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          mentor_id: string
          price: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          mentor_id: string
          price?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          mentor_id?: string
          price?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_offerings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      outbound_events: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string
          payload: Json
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_event_status"]
          target_url: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string
          payload?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_event_status"]
          target_url?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string
          payload?: Json
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_event_status"]
          target_url?: string
          updated_at?: string
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
          email: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
    }
    Enums: {
      app_role: "admin" | "mentor" | "mentee"
      application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
      badge_tier: "bronze" | "silver" | "gold"
      dsr_kind: "export" | "correction" | "deletion" | "withdrawal"
      dsr_status: "pending" | "in_review" | "completed" | "rejected"
      feedback_audience: "mentor" | "mentee" | "admin_private"
      general_feedback_category:
        | "feedback"
        | "concern"
        | "suggestion"
        | "review"
      outbound_event_status: "pending" | "sent" | "failed"
      session_status: "booked" | "completed" | "cancelled" | "no_show"
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
      app_role: ["admin", "mentor", "mentee"],
      application_status: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
      ],
      badge_tier: ["bronze", "silver", "gold"],
      dsr_kind: ["export", "correction", "deletion", "withdrawal"],
      dsr_status: ["pending", "in_review", "completed", "rejected"],
      feedback_audience: ["mentor", "mentee", "admin_private"],
      general_feedback_category: [
        "feedback",
        "concern",
        "suggestion",
        "review",
      ],
      outbound_event_status: ["pending", "sent", "failed"],
      session_status: ["booked", "completed", "cancelled", "no_show"],
    },
  },
} as const
