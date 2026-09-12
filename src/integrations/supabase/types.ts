export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_deletion_jobs: {
        Row: {
          completed_at: string | null
          requested_at: string
          status: string
          storage_paths: string[]
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          requested_at?: string
          status?: string
          storage_paths?: string[]
          user_id: string
        }
        Update: {
          completed_at?: string | null
          requested_at?: string
          status?: string
          storage_paths?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity: {
        Row: {
          actor_id: string | null
          created_at: string
          group_id: string
          id: string
          kind: string
          payload: Json
          place_id: string | null
          visit_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          kind: string
          payload?: Json
          place_id?: string | null
          visit_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          kind?: string
          payload?: Json
          place_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          group_id: string
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_hidden_place_suggestions: {
        Row: {
          address: string
          area: string | null
          category: string | null
          city: string
          group_id: string
          hidden_at: string
          hidden_by: string | null
          lat: number | null
          lng: number | null
          name: string
          provider: string
          provider_place_id: string
          website: string | null
        }
        Insert: {
          address?: string
          area?: string | null
          category?: string | null
          city?: string
          group_id: string
          hidden_at?: string
          hidden_by?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          provider: string
          provider_place_id: string
          website?: string | null
        }
        Update: {
          address?: string
          area?: string | null
          category?: string | null
          city?: string
          group_id?: string
          hidden_at?: string
          hidden_by?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          provider?: string
          provider_place_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_hidden_place_suggestions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_hidden_place_suggestions_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_next_place: {
        Row: {
          group_id: string
          place_id: string
          selected_at: string
          selected_by: string
        }
        Insert: {
          group_id: string
          place_id: string
          selected_at?: string
          selected_by: string
        }
        Update: {
          group_id?: string
          place_id?: string
          selected_at?: string
          selected_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_next_place_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_next_place_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_next_place_selected_by_fkey"
            columns: ["selected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_place_practical_info_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          group_id: string
          id: string
          opening_hours_override: Json | null
          place_id: string
          source_note: string | null
          source_url: string | null
          website_override: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          group_id: string
          id?: string
          opening_hours_override?: Json | null
          place_id: string
          source_note?: string | null
          source_url?: string | null
          website_override?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          group_id?: string
          id?: string
          opening_hours_override?: Json | null
          place_id?: string
          source_note?: string | null
          source_url?: string | null
          website_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_place_practical_info_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_place_practical_info_history_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      group_places: {
        Row: {
          added_by: string
          archived_at: string | null
          archived_by: string | null
          category_override: string | null
          collection_status: string
          created_at: string
          cuisines_override: string[] | null
          group_id: string
          notes: string | null
          occasions: string[]
          opening_hours_cross_group_proposal_at: string | null
          opening_hours_override: Json | null
          origin: string
          place_id: string
          practical_info_source_note: string | null
          practical_info_source_url: string | null
          practical_info_updated_at: string | null
          practical_info_updated_by: string | null
          source_group_id: string | null
          updated_at: string
          website_cross_group_proposal_at: string | null
          website_override: string | null
        }
        Insert: {
          added_by: string
          archived_at?: string | null
          archived_by?: string | null
          category_override?: string | null
          collection_status?: string
          created_at?: string
          cuisines_override?: string[] | null
          group_id: string
          notes?: string | null
          occasions?: string[]
          opening_hours_cross_group_proposal_at?: string | null
          opening_hours_override?: Json | null
          origin?: string
          place_id: string
          practical_info_source_note?: string | null
          practical_info_source_url?: string | null
          practical_info_updated_at?: string | null
          practical_info_updated_by?: string | null
          source_group_id?: string | null
          updated_at?: string
          website_cross_group_proposal_at?: string | null
          website_override?: string | null
        }
        Update: {
          added_by?: string
          archived_at?: string | null
          archived_by?: string | null
          category_override?: string | null
          collection_status?: string
          created_at?: string
          cuisines_override?: string[] | null
          group_id?: string
          notes?: string | null
          occasions?: string[]
          opening_hours_cross_group_proposal_at?: string | null
          opening_hours_override?: Json | null
          origin?: string
          place_id?: string
          practical_info_source_note?: string | null
          practical_info_source_url?: string | null
          practical_info_updated_at?: string | null
          practical_info_updated_by?: string | null
          source_group_id?: string | null
          updated_at?: string
          website_cross_group_proposal_at?: string | null
          website_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_places_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_places_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_places_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_search_areas: {
        Row: {
          created_at: string
          group_id: string
          id: string
          label: string
          lat: number
          lng: number
          provider: string
          provider_place_id: string
          result_type: string | null
          search_mode: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          label: string
          lat: number
          lng: number
          provider: string
          provider_place_id: string
          result_type?: string | null
          search_mode?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
          provider?: string
          provider_place_id?: string
          result_type?: string | null
          search_mode?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_search_areas_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          default_search_radius_km: number
          emoji: string | null
          home_lat: number | null
          home_lng: number | null
          home_location_label: string | null
          home_location_place_id: string | null
          home_location_provider: string | null
          id: string
          lifecycle_status: string
          name: string
          shared_visits_count_for_progression: boolean
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          default_search_radius_km?: number
          emoji?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_location_label?: string | null
          home_location_place_id?: string | null
          home_location_provider?: string | null
          id?: string
          lifecycle_status?: string
          name: string
          shared_visits_count_for_progression?: boolean
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          default_search_radius_km?: number
          emoji?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_location_label?: string | null
          home_location_place_id?: string | null
          home_location_provider?: string | null
          id?: string
          lifecycle_status?: string
          name?: string
          shared_visits_count_for_progression?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string
          invited_email: string | null
          is_multi_use: boolean
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at: string
          group_id: string
          id?: string
          invited_by: string
          invited_email?: string | null
          is_multi_use?: boolean
          revoked_at?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string
          invited_email?: string | null
          is_multi_use?: boolean
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          group_id: string
          joined_at: string
          left_at: string | null
          rejoined_at: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          left_at?: string | null
          rejoined_at?: string | null
          role: string
          status?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          left_at?: string | null
          rejoined_at?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      next_stop_date_proposals: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          group_id: string
          id: string
          place_id: string
          proposed_date: string
          proposed_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          group_id: string
          id?: string
          place_id: string
          proposed_date: string
          proposed_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          group_id?: string
          id?: string
          place_id?: string
          proposed_date?: string
          proposed_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_stop_date_proposals_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_date_proposals_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_date_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_date_proposals_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_date_proposals_group_place_fk"
            columns: ["group_id", "place_id"]
            isOneToOne: false
            referencedRelation: "group_places"
            referencedColumns: ["group_id", "place_id"]
          },
        ]
      }
      next_stop_date_responses: {
        Row: {
          created_at: string
          member_id: string
          proposal_id: string
          response: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          member_id: string
          proposal_id: string
          response: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          member_id?: string
          proposal_id?: string
          response?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_stop_date_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_date_responses_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "next_stop_date_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      next_stop_place_proposals: {
        Row: {
          created_at: string
          group_id: string
          id: string
          place_id: string
          proposed_by: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          place_id: string
          proposed_by?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          place_id?: string
          proposed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "next_stop_place_proposals_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_place_proposals_group_place_fk"
            columns: ["group_id", "place_id"]
            isOneToOne: true
            referencedRelation: "group_places"
            referencedColumns: ["group_id", "place_id"]
          },
          {
            foreignKeyName: "next_stop_place_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      next_stop_place_supports: {
        Row: {
          member_id: string
          proposal_id: string
          updated_at: string
        }
        Insert: {
          member_id: string
          proposal_id: string
          updated_at?: string
        }
        Update: {
          member_id?: string
          proposal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "next_stop_place_supports_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_place_supports_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "next_stop_place_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      next_stop_plans: {
        Row: {
          created_at: string
          group_id: string
          planned_date: string | null
          planned_time: string | null
          revision: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          group_id: string
          planned_date?: string | null
          planned_time?: string | null
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string
          planned_date?: string | null
          planned_time?: string | null
          revision?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "next_stop_plans_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_stop_plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          body: string
          created_at: string
          dedupe_key: string
          group_id: string | null
          id: string
          last_error: string | null
          notification_type: string
          sent_at: string | null
          status: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          dedupe_key: string
          group_id?: string | null
          id?: string
          last_error?: string | null
          notification_type: string
          sent_at?: string | null
          status?: string
          title: string
          url?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          dedupe_key?: string
          group_id?: string | null
          id?: string
          last_error?: string | null
          notification_type?: string
          sent_at?: string | null
          status?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          notification_type: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          notification_type: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          notification_type?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      place_data_report_osm_submission_attempts: {
        Row: {
          attempt_number: number
          attempted_at: string
          group_id: string
          id: string
          public_reference: string
          report_id: string
          submitted_by: string | null
        }
        Insert: {
          attempt_number: number
          attempted_at?: string
          group_id: string
          id?: string
          public_reference: string
          report_id: string
          submitted_by?: string | null
        }
        Update: {
          attempt_number?: number
          attempted_at?: string
          group_id?: string
          id?: string
          public_reference?: string
          report_id?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_data_report_osm_submission_attempts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_report_osm_submission_attempts_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "place_data_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_report_osm_submission_attempts_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_data_reports: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          group_id: string
          id: string
          osm_note_closed_at: string | null
          osm_note_created_at: string | null
          osm_note_id: number | null
          osm_note_last_checked_at: string | null
          osm_note_status: string | null
          osm_note_url: string | null
          osm_public_reference: string | null
          osm_public_text: string | null
          osm_submission_attempts: number
          osm_submission_error_code: string | null
          osm_submission_started_at: string | null
          osm_submission_state: string
          osm_submitted_by: string | null
          place_id: string | null
          reported_address: string
          reported_city: string
          reported_lat: number | null
          reported_lng: number | null
          reported_name: string
          reported_sources: Json
          reported_website: string | null
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_provider: string | null
          target_provider_place_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          group_id: string
          id?: string
          osm_note_closed_at?: string | null
          osm_note_created_at?: string | null
          osm_note_id?: number | null
          osm_note_last_checked_at?: string | null
          osm_note_status?: string | null
          osm_note_url?: string | null
          osm_public_reference?: string | null
          osm_public_text?: string | null
          osm_submission_attempts?: number
          osm_submission_error_code?: string | null
          osm_submission_started_at?: string | null
          osm_submission_state?: string
          osm_submitted_by?: string | null
          place_id?: string | null
          reported_address?: string
          reported_city?: string
          reported_lat?: number | null
          reported_lng?: number | null
          reported_name: string
          reported_sources?: Json
          reported_website?: string | null
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_provider?: string | null
          target_provider_place_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string
          id?: string
          osm_note_closed_at?: string | null
          osm_note_created_at?: string | null
          osm_note_id?: number | null
          osm_note_last_checked_at?: string | null
          osm_note_status?: string | null
          osm_note_url?: string | null
          osm_public_reference?: string | null
          osm_public_text?: string | null
          osm_submission_attempts?: number
          osm_submission_error_code?: string | null
          osm_submission_started_at?: string | null
          osm_submission_state?: string
          osm_submitted_by?: string | null
          place_id?: string | null
          reported_address?: string
          reported_city?: string
          reported_lat?: number | null
          reported_lng?: number | null
          reported_name?: string
          reported_sources?: Json
          reported_website?: string | null
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_provider?: string | null
          target_provider_place_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_data_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_reports_osm_submitted_by_fkey"
            columns: ["osm_submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_reports_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_data_signal_confirmations: {
        Row: {
          created_at: string
          group_id: string
          id: string
          place_id: string | null
          signal_kind: string
          target_provider: string | null
          target_provider_place_id: string | null
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          place_id?: string | null
          signal_kind?: string
          target_provider?: string | null
          target_provider_place_id?: string | null
          updated_at?: string
          user_id: string
          verdict: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          place_id?: string | null
          signal_kind?: string
          target_provider?: string | null
          target_provider_place_id?: string | null
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_data_signal_confirmations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_signal_confirmations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_data_signal_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_external_info_snapshots: {
        Row: {
          address: string | null
          area: string | null
          city: string | null
          fetched_at: string
          fingerprint: string
          lat: number | null
          lng: number | null
          opening_hours: Json | null
          osm_id: string | null
          osm_type: string | null
          place_id: string
          provider: string
          provider_place_id: string
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          city?: string | null
          fetched_at: string
          fingerprint: string
          lat?: number | null
          lng?: number | null
          opening_hours?: Json | null
          osm_id?: string | null
          osm_type?: string | null
          place_id: string
          provider: string
          provider_place_id: string
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          city?: string | null
          fetched_at?: string
          fingerprint?: string
          lat?: number | null
          lng?: number | null
          opening_hours?: Json | null
          osm_id?: string | null
          osm_type?: string | null
          place_id?: string
          provider?: string
          provider_place_id?: string
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_external_info_snapshots_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_improvement_candidate_events: {
        Row: {
          action: string
          actor_id: string | null
          candidate_id: string
          created_at: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "place_improvement_candidate_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_improvement_candidate_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "place_improvement_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      place_improvement_candidates: {
        Row: {
          created_at: string
          created_by: string | null
          dismissal_reason: string | null
          group_id: string
          id: string
          place_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dismissal_reason?: string | null
          group_id: string
          id?: string
          place_id: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dismissal_reason?: string | null
          group_id?: string
          id?: string
          place_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_improvement_candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_improvement_candidates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_improvement_candidates_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_maintainers: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_maintainers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_maintenance_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          place_id: string | null
          work_item_id: string
          work_item_kind: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          place_id?: string | null
          work_item_id: string
          work_item_kind: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          place_id?: string | null
          work_item_id?: string
          work_item_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_maintenance_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_maintenance_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_sources: {
        Row: {
          fetched_at: string
          first_seen_at: string
          id: string
          last_seen_at: string
          place_id: string
          provider: string
          provider_place_id: string
          raw: Json
          status: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          fetched_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          place_id: string
          provider: string
          provider_place_id: string
          raw?: Json
          status?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          fetched_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          place_id?: string
          provider?: string
          provider_place_id?: string
          raw?: Json
          status?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_sources_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          added_by: string
          address: string
          area: string | null
          category: string
          city: string
          created_at: string
          cuisines: string[]
          id: string
          lat: number | null
          lng: number | null
          name: string
          photo_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          added_by: string
          address?: string
          area?: string | null
          category: string
          city?: string
          created_at?: string
          cuisines?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          photo_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          added_by?: string
          address?: string
          area?: string | null
          category?: string
          city?: string
          created_at?: string
          cuisines?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          photo_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_emoji: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_emoji?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_emoji?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          last_error: string | null
          last_used_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          last_error?: string | null
          last_used_at?: string | null
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          last_error?: string | null
          last_used_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      review_group_reactions: {
        Row: {
          created_at: string
          group_id: string
          reaction: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          reaction: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          reaction?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_group_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_group_reactions_visibility_fk"
            columns: ["review_id", "group_id"]
            isOneToOne: false
            referencedRelation: "review_group_visibility"
            referencedColumns: ["review_id", "group_id"]
          },
        ]
      }
      review_group_visibility: {
        Row: {
          comment_visible: boolean
          group_id: string
          rating_visible: boolean
          review_id: string
          updated_at: string
        }
        Insert: {
          comment_visible?: boolean
          group_id: string
          rating_visible?: boolean
          review_id: string
          updated_at?: string
        }
        Update: {
          comment_visible?: boolean
          group_id?: string
          rating_visible?: boolean
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_group_visibility_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_group_visibility_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          atmosphere: number | null
          comment: string | null
          created_at: string
          id: string
          overall: number | null
          review_model: string | null
          service: number | null
          taste: number | null
          updated_at: string
          user_id: string
          value: number | null
          visit_id: string
        }
        Insert: {
          atmosphere?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          overall?: number | null
          review_model?: string | null
          service?: number | null
          taste?: number | null
          updated_at?: string
          user_id: string
          value?: number | null
          visit_id: string
        }
        Update: {
          atmosphere?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          overall?: number | null
          review_model?: string | null
          service?: number | null
          taste?: number | null
          updated_at?: string
          user_id?: string
          value?: number | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_group_links: {
        Row: {
          group_id: string
          link_type: string
          linked_at: string
          linked_by: string
          source_group_id: string | null
          visit_id: string
        }
        Insert: {
          group_id: string
          link_type: string
          linked_at?: string
          linked_by: string
          source_group_id?: string | null
          visit_id: string
        }
        Update: {
          group_id?: string
          link_type?: string
          linked_at?: string
          linked_by?: string
          source_group_id?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_group_links_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_group_links_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_guest_member_proposals: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          proposal_kind: string
          proposed_by: string | null
          responded_at: string | null
          status: string
          target_group_id: string
          target_user_id: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          proposal_kind?: string
          proposed_by?: string | null
          responded_at?: string | null
          status?: string
          target_group_id: string
          target_user_id: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          proposal_kind?: string
          proposed_by?: string | null
          responded_at?: string | null
          status?: string
          target_group_id?: string
          target_user_id?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_guest_member_proposals_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "visit_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_guest_member_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_guest_member_proposals_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_guest_member_proposals_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_guest_member_proposals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_guests: {
        Row: {
          created_at: string
          display_name: string
          id: string
          sort_order: number
          visit_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          sort_order: number
          visit_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          sort_order?: number
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_guests_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_media: {
        Row: {
          byte_size: number
          created_at: string
          group_id: string
          height: number
          id: string
          mime_type: string
          storage_path: string
          updated_at: string
          uploaded_by: string
          visit_id: string
          width: number
        }
        Insert: {
          byte_size: number
          created_at?: string
          group_id: string
          height: number
          id?: string
          mime_type: string
          storage_path: string
          updated_at?: string
          uploaded_by: string
          visit_id: string
          width: number
        }
        Update: {
          byte_size?: number
          created_at?: string
          group_id?: string
          height?: number
          id?: string
          mime_type?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
          visit_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "visit_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_media_visit_group_fk"
            columns: ["visit_id", "group_id"]
            isOneToOne: true
            referencedRelation: "visit_group_links"
            referencedColumns: ["visit_id", "group_id"]
          },
        ]
      }
      visit_participants: {
        Row: {
          user_id: string
          visit_id: string
        }
        Insert: {
          user_id: string
          visit_id: string
        }
        Update: {
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_participants_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_participation_self_corrections: {
        Row: {
          status: string
          updated_at: string
          user_id: string
          visit_id: string
        }
        Insert: {
          status: string
          updated_at?: string
          user_id: string
          visit_id: string
        }
        Update: {
          status?: string
          updated_at?: string
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_participation_self_corrections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_participation_self_corrections_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_takeaway: boolean
          meal_type: string
          place_id: string
          updated_at: string
          visited_on: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_takeaway?: boolean
          meal_type: string
          place_id: string
          updated_at?: string
          visited_on: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_takeaway?: boolean
          meal_type?: string
          place_id?: string
          updated_at?: string
          visited_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _token_hash: { Args: { _token: string }; Returns: string }
      accept_group_invitation: { Args: { _token: string }; Returns: Json }
      apply_cross_group_practical_info_suggestion_v1: {
        Args: {
          _field: string
          _fingerprint: string
          _group_id: string
          _place_id: string
        }
        Returns: undefined
      }
      apply_place_external_location_v1: {
        Args: {
          _actor_id: string
          _address: string
          _area: string
          _city: string
          _fetched_at: string
          _group_id: string
          _lat: number
          _lng: number
          _osm_id: string
          _osm_type: string
          _place_id: string
          _provider_place_id: string
        }
        Returns: Json
      }
      archive_group: { Args: { _group_id: string }; Returns: undefined }
      archive_group_place: {
        Args: { _group_id: string; _place_id: string }
        Returns: undefined
      }
      can_delete_original_visit: {
        Args: { _group_id: string; _user_id: string; _visit_id: string }
        Returns: boolean
      }
      can_delete_own_visit_photo: {
        Args: { _group_id: string; _visit_id: string }
        Returns: boolean
      }
      can_delete_visit_photo: {
        Args: { _group_id: string; _user_id: string; _visit_id: string }
        Returns: boolean
      }
      can_manage_own_visit_photo: {
        Args: { _group_id: string; _visit_id: string }
        Returns: boolean
      }
      can_manage_visit_photo: {
        Args: { _group_id: string; _user_id: string; _visit_id: string }
        Returns: boolean
      }
      can_see_place: { Args: { _place_id: string }; Returns: boolean }
      complete_account_deletion: {
        Args: { _user_id: string }
        Returns: undefined
      }
      complete_place_data_report_osm_submission_v1: {
        Args: {
          _note_closed_at: string
          _note_created_at: string
          _note_id: number
          _note_status: string
          _public_reference: string
          _public_text: string
          _report_id: string
        }
        Returns: undefined
      }
      confirm_place_data_signal_v1: {
        Args: {
          _group_id: string
          _place_id: string
          _provider: string
          _provider_place_id: string
          _verdict: string
        }
        Returns: undefined
      }
      create_group_invitation: {
        Args: {
          _expires_in_days?: number
          _group_id: string
          _invited_email?: string
        }
        Returns: Json
      }
      create_group_with_owner: {
        Args: {
          _emoji?: string
          _home_label?: string
          _home_lat?: number
          _home_lng?: number
          _home_place_id?: string
          _home_provider?: string
          _name: string
        }
        Returns: string
      }
      create_group_with_owner_v2: {
        Args: {
          _default_radius_km?: number
          _emoji?: string
          _name: string
          _search_areas?: Json
        }
        Returns: string
      }
      create_manual_place_fallback_v1: {
        Args: {
          _address?: string
          _area?: string
          _category: string
          _city?: string
          _cuisines?: string[]
          _declined_place_ids?: string[]
          _group_id: string
          _lat?: number
          _lng?: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _photo_url?: string
        }
        Returns: Json
      }
      create_or_link_provider_place: {
        Args: {
          _address?: string
          _area?: string
          _category: string
          _city?: string
          _cuisines?: string[]
          _group_id: string
          _lat?: number
          _lng?: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _photo_url?: string
          _provider: string
          _provider_place_id: string
          _raw?: Json
        }
        Returns: string
      }
      create_or_link_provider_place_v4b: {
        Args: {
          _address?: string
          _area?: string
          _category: string
          _city?: string
          _cuisines?: string[]
          _group_id: string
          _lat?: number
          _lng?: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _photo_url?: string
          _provider: string
          _provider_place_id: string
          _raw?: Json
        }
        Returns: string
      }
      create_or_link_provider_place_v5f: {
        Args: {
          _address?: string
          _area?: string
          _category: string
          _city?: string
          _cuisines?: string[]
          _group_id: string
          _lat?: number
          _lng?: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _photo_url?: string
          _provider: string
          _provider_place_id: string
          _raw?: Json
        }
        Returns: string
      }
      create_or_link_provider_places_batch_v1: {
        Args: { _group_id: string; _items: Json }
        Returns: Json
      }
      create_place: {
        Args: {
          _address?: string
          _area?: string
          _category: string
          _city?: string
          _cuisines?: string[]
          _group_id: string
          _lat?: number
          _lng?: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _photo_url?: string
        }
        Returns: string
      }
      create_place_data_report_from_suggestion_v1: {
        Args: {
          _address: string
          _category: string
          _city: string
          _description: string
          _group_id: string
          _lat: number
          _lng: number
          _name: string
          _provider: string
          _provider_place_id: string
          _website: string
        }
        Returns: Json
      }
      create_place_data_report_v1: {
        Args: {
          _category: string
          _description: string
          _group_id: string
          _place_id: string
        }
        Returns: Json
      }
      create_place_v4b: {
        Args: {
          _address?: string
          _area?: string
          _category: string
          _city?: string
          _cuisines?: string[]
          _group_id: string
          _lat?: number
          _lng?: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _photo_url?: string
        }
        Returns: string
      }
      create_visit_with_review: {
        Args: {
          _comment?: string
          _group_id: string
          _meal_type: string
          _overall: number
          _participant_ids: string[]
          _place_id: string
          _service?: number
          _taste?: number
          _value?: number
          _visited_on: string
        }
        Returns: string
      }
      create_visit_with_review_v2: {
        Args: {
          _comment?: string
          _group_id: string
          _guest_names?: string[]
          _meal_type: string
          _overall: number
          _participant_ids: string[]
          _place_id: string
          _service?: number
          _taste?: number
          _value?: number
          _visited_on: string
        }
        Returns: string
      }
      create_visit_with_review_v3: {
        Args: {
          _comment?: string
          _group_id: string
          _guest_names?: string[]
          _meal_type: string
          _overall?: number
          _participant_ids: string[]
          _place_id: string
          _service?: number
          _taste?: number
          _value?: number
          _visited_on: string
        }
        Returns: string
      }
      create_visit_with_review_v4: {
        Args: {
          _comment?: string
          _group_id: string
          _guest_names?: string[]
          _is_takeaway?: boolean
          _meal_type: string
          _overall?: number
          _participant_ids: string[]
          _place_id: string
          _service?: number
          _taste?: number
          _value?: number
          _visited_on: string
        }
        Returns: string
      }
      create_visit_with_review_v5: {
        Args: {
          _atmosphere?: number
          _comment?: string
          _group_id: string
          _guest_names?: string[]
          _is_takeaway?: boolean
          _meal_type: string
          _participant_ids: string[]
          _place_id: string
          _review_occasions?: string[]
          _service?: number
          _taste?: number
          _value?: number
          _visited_on: string
        }
        Returns: string
      }
      cross_group_practical_info_candidate_v1: {
        Args: { _field: string; _group_id: string; _place_id: string }
        Returns: Json
      }
      delete_original_visit: {
        Args: { _group_id: string; _visit_id: string }
        Returns: undefined
      }
      delete_visit_photo: {
        Args: { _group_id: string; _visit_id: string }
        Returns: string
      }
      derive_review_overall_v1: {
        Args: {
          _atmosphere?: number
          _review_model: string
          _service: number
          _taste: number
          _value: number
        }
        Returns: number
      }
      dismiss_place_improvement_candidate_v1: {
        Args: { _candidate_id: string; _reason: string }
        Returns: string
      }
      dismiss_place_maintenance_work_item_v1: {
        Args: { _kind: string; _reason: string; _work_item_id: string }
        Returns: string
      }
      fail_place_data_report_osm_submission_v1: {
        Args: {
          _error_code: string
          _public_reference: string
          _report_id: string
        }
        Returns: undefined
      }
      find_registration_visit_duplicate_v1: {
        Args: {
          _group_id: string
          _meal_type: string
          _place_id: string
          _visited_on: string
        }
        Returns: Json
      }
      find_registration_visit_duplicate_v2: {
        Args: {
          _group_id: string
          _is_takeaway?: boolean
          _meal_type: string
          _place_id: string
          _visited_on: string
        }
        Returns: Json
      }
      find_reusable_manual_place_candidates_v1: {
        Args: {
          _address: string
          _category?: string
          _city: string
          _group_id: string
          _lat: number
          _lng: number
          _name: string
        }
        Returns: Json
      }
      find_share_visit_duplicate_v1: {
        Args: { _target_group_id: string; _visit_id: string }
        Returns: Json
      }
      find_share_visit_duplicate_v2: {
        Args: { _target_group_id: string; _visit_id: string }
        Returns: Json
      }
      get_account_deletion_requirements: { Args: never; Returns: Json }
      get_cross_group_practical_info_suggestions_v1: {
        Args: { _group_id: string; _place_id: string }
        Returns: Json
      }
      get_group_app_state: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v4b: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5c: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5d: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5e: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5f: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5g: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5h: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5h_boundary_base: {
        Args: { _group_id: string }
        Returns: Json
      }
      get_group_app_state_v5i: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5i_participation_base: {
        Args: { _group_id: string }
        Returns: Json
      }
      get_group_app_state_v5j: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5k: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5k_guest_identity_base: {
        Args: { _group_id: string }
        Returns: Json
      }
      get_group_app_state_v5l: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5m: { Args: { _group_id: string }; Returns: Json }
      get_group_place_practical_info_v1: {
        Args: { _group_id: string; _place_id: string }
        Returns: Json
      }
      get_invitation_preview: { Args: { _token: string }; Returns: Json }
      get_notification_settings: { Args: never; Returns: Json }
      get_own_visit_guest_proposal_v1: {
        Args: { _group_id: string; _visit_id: string }
        Returns: Json
      }
      get_place_data_report_osm_refresh_v1: {
        Args: { _group_id: string; _report_id: string }
        Returns: Json
      }
      get_place_data_signals_v1: {
        Args: { _group_id: string; _targets: Json }
        Returns: Json
      }
      get_place_external_info_context_v1: {
        Args: { _group_id: string; _place_id: string }
        Returns: Json
      }
      get_place_external_info_context_v2: {
        Args: { _group_id: string; _place_id: string }
        Returns: Json
      }
      get_place_external_info_context_v3: {
        Args: { _group_id: string; _place_id: string }
        Returns: Json
      }
      get_place_improvement_candidate_for_maintenance_v1: {
        Args: { _candidate_id: string }
        Returns: Json
      }
      get_place_maintenance_access_v1: { Args: never; Returns: boolean }
      get_visit_review_reactions_v1: {
        Args: { _group_id: string; _visit_id: string }
        Returns: Json
      }
      group_is_active: { Args: { _group_id: string }; Returns: boolean }
      has_group_role: {
        Args: { _group_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_membership: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      health_probe_v1: { Args: never; Returns: boolean }
      hide_group_place_suggestion: {
        Args: {
          _address?: string
          _city?: string
          _group_id: string
          _name: string
          _provider: string
          _provider_place_id: string
        }
        Returns: undefined
      }
      hide_group_place_suggestion_v2: {
        Args: {
          _address: string
          _area: string
          _category: string
          _city: string
          _group_id: string
          _lat: number
          _lng: number
          _name: string
          _provider: string
          _provider_place_id: string
          _website: string
        }
        Returns: undefined
      }
      leave_group: { Args: { _group_id: string }; Returns: undefined }
      link_provider_source_for_maintenance_v1: {
        Args: {
          _address: string
          _candidate_id: string
          _city: string
          _lat: number
          _lng: number
          _name: string
          _provider: string
          _provider_place_id: string
          _raw?: Json
        }
        Returns: string
      }
      link_provider_source_for_maintenance_work_item_v1: {
        Args: {
          _address: string
          _city: string
          _kind: string
          _lat: number
          _lng: number
          _name: string
          _provider: string
          _provider_place_id: string
          _raw?: Json
          _work_item_id: string
        }
        Returns: string
      }
      link_provider_source_to_existing_place_v1: {
        Args: {
          _address: string
          _city: string
          _group_id: string
          _lat: number
          _lng: number
          _name: string
          _place_id: string
          _provider: string
          _provider_place_id: string
          _raw?: Json
        }
        Returns: string
      }
      link_reusable_manual_place_v1: {
        Args: {
          _address: string
          _city: string
          _group_id: string
          _lat: number
          _lng: number
          _name: string
          _notes?: string
          _occasions?: string[]
          _place_id: string
        }
        Returns: Json
      }
      list_group_hidden_place_suggestions: {
        Args: { _group_id: string }
        Returns: {
          address: string
          city: string
          hidden_at: string
          name: string
          provider: string
          provider_place_id: string
        }[]
      }
      list_group_hidden_place_suggestions_v2: {
        Args: { _group_id: string }
        Returns: Json
      }
      list_group_invitations: {
        Args: { _group_id: string }
        Returns: {
          accepted_at: string
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          invited_by_name: string
          invited_email: string
          revoked_at: string
          role: string
          state: string
        }[]
      }
      list_group_place_data_reports_v1: {
        Args: { _group_id: string }
        Returns: Json
      }
      list_group_place_data_reports_v2: {
        Args: { _group_id: string }
        Returns: Json
      }
      list_group_place_data_reports_v3: {
        Args: { _group_id: string }
        Returns: Json
      }
      list_group_place_practical_info_history_v1: {
        Args: { _group_id: string; _limit?: number; _place_id: string }
        Returns: Json
      }
      list_own_open_place_suggestion_report_keys_v1: {
        Args: { _group_id: string }
        Returns: Json
      }
      list_own_visits_for_place_on_add: {
        Args: { _place_id: string; _target_group_id: string }
        Returns: Json
      }
      list_place_improvement_candidates_for_maintenance_v1: {
        Args: { _limit?: number; _offset?: number; _status?: string }
        Returns: Json
      }
      list_place_maintenance_work_items_v1: {
        Args: {
          _kind?: string
          _limit?: number
          _offset?: number
          _status?: string
        }
        Returns: Json
      }
      list_place_share_targets_v4b: {
        Args: { _place_id: string }
        Returns: Json
      }
      list_user_groups_v4b: { Args: never; Returns: Json }
      list_visit_guest_member_targets_v1: {
        Args: { _source_group_id: string; _visit_id: string }
        Returns: Json
      }
      list_visit_share_targets: { Args: { _visit_id: string }; Returns: Json }
      list_visit_share_targets_v4b: {
        Args: { _visit_id: string }
        Returns: Json
      }
      mark_place_improvement_candidate_needs_osm_v1: {
        Args: { _candidate_id: string }
        Returns: string
      }
      mark_place_maintenance_work_item_needs_osm_v1: {
        Args: { _kind: string; _work_item_id: string }
        Returns: string
      }
      next_stop_v2_assert_revision: {
        Args: { _expected_revision: number; _group_id: string }
        Returns: undefined
      }
      next_stop_v2_ensure_plan: {
        Args: { _group_id: string; _uid: string }
        Returns: undefined
      }
      next_stop_v2_lock: { Args: { _group_id: string }; Returns: undefined }
      next_stop_v2_sync_legacy_date: {
        Args: {
          _group_id: string
          _place_id: string
          _planned_date: string
          _planned_time: string
          _uid: string
        }
        Returns: undefined
      }
      normalize_food_tags: { Args: { _values: string[] }; Returns: string[] }
      normalize_place_match_text_v1: {
        Args: { _value: string }
        Returns: string
      }
      normalize_place_website: { Args: { _value: string }; Returns: string }
      notification_type_enabled: {
        Args: { _type: string; _user_id: string }
        Returns: boolean
      }
      prepare_own_account_deletion: {
        Args: { _confirm_solo_group_deletion?: boolean; _successors?: Json }
        Returns: Json
      }
      prepare_place_data_report_osm_submission_v1: {
        Args: { _group_id: string; _public_text: string; _report_id: string }
        Returns: Json
      }
      propose_next_stop_date: {
        Args: {
          _group_id: string
          _proposed_date: string
          _proposed_time?: string
        }
        Returns: string
      }
      propose_next_stop_place_v2: {
        Args: { _group_id: string; _place_id: string }
        Returns: string
      }
      propose_visit_guest_member_v1: {
        Args: {
          _guest_id: string
          _source_group_id: string
          _target_group_id: string
          _target_user_id: string
          _visit_id: string
        }
        Returns: string
      }
      queue_notification: {
        Args: {
          _body: string
          _dedupe_key: string
          _group_id: string
          _title: string
          _type: string
          _url: string
          _user_id: string
        }
        Returns: undefined
      }
      reactivate_group: { Args: { _group_id: string }; Returns: undefined }
      register_push_subscription: {
        Args: {
          _auth: string
          _device_label?: string
          _endpoint: string
          _p256dh: string
        }
        Returns: string
      }
      remove_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: undefined
      }
      remove_push_subscription: { Args: { _id: string }; Returns: undefined }
      remove_shared_visit_from_group: {
        Args: { _group_id: string; _visit_id: string }
        Returns: undefined
      }
      replace_group_search_settings: {
        Args: { _areas: Json; _default_radius_km: number; _group_id: string }
        Returns: undefined
      }
      resolve_new_review_model_v1: {
        Args: {
          _group_id: string
          _is_takeaway: boolean
          _place_id: string
          _review_occasions?: string[]
        }
        Returns: string
      }
      resolve_place_maintenance_work_item_v1: {
        Args: { _kind: string; _work_item_id: string }
        Returns: string
      }
      respond_next_stop_date: {
        Args: { _group_id: string; _proposal_id: string; _response: string }
        Returns: undefined
      }
      respond_visit_guest_proposal_v1: {
        Args: { _group_id: string; _proposal_id: string; _response: string }
        Returns: undefined
      }
      restore_group_place: {
        Args: { _group_id: string; _place_id: string }
        Returns: undefined
      }
      restore_group_place_suggestion: {
        Args: {
          _group_id: string
          _provider: string
          _provider_place_id: string
        }
        Returns: undefined
      }
      review_place_data_report_v1: {
        Args: {
          _group_id: string
          _report_id: string
          _resolution_note?: string
          _status: string
        }
        Returns: undefined
      }
      revoke_group_invitation: {
        Args: { _invitation_id: string }
        Returns: undefined
      }
      safe_cross_group_website_v1: {
        Args: { _value: string }
        Returns: boolean
      }
      save_own_review_for_visit_v1: {
        Args: {
          _comment?: string
          _group_id: string
          _overall: number
          _service?: number
          _taste?: number
          _value?: number
          _visit_id: string
        }
        Returns: string
      }
      save_own_review_for_visit_v2: {
        Args: {
          _atmosphere?: number
          _comment?: string
          _group_id: string
          _review_occasions?: string[]
          _service?: number
          _taste?: number
          _value?: number
          _visit_id: string
        }
        Returns: string
      }
      save_place_external_info_snapshot_v1: {
        Args: {
          _fetched_at: string
          _group_id: string
          _opening_hours: Json
          _place_id: string
          _provider_place_id: string
          _timezone: string
          _website: string
        }
        Returns: undefined
      }
      save_place_external_info_snapshot_v2: {
        Args: {
          _address: string
          _area: string
          _city: string
          _fetched_at: string
          _group_id: string
          _lat: number
          _lng: number
          _opening_hours: Json
          _osm_id: string
          _osm_type: string
          _place_id: string
          _provider_place_id: string
          _timezone: string
          _website: string
        }
        Returns: undefined
      }
      search_area_label_is_broad: { Args: { _label: string }; Returns: boolean }
      select_next_stop_place_v2: {
        Args: {
          _expected_revision?: number
          _group_id: string
          _proposal_id: string
        }
        Returns: undefined
      }
      set_member_role: {
        Args: { _group_id: string; _role: string; _user_id: string }
        Returns: undefined
      }
      set_next_place: {
        Args: { _group_id: string; _place_id: string }
        Returns: undefined
      }
      set_next_stop_date_status: {
        Args: { _group_id: string; _proposal_id: string; _status: string }
        Returns: undefined
      }
      set_next_stop_day_response_v2: {
        Args: { _group_id: string; _response?: string }
        Returns: undefined
      }
      set_next_stop_place_support_v2: {
        Args: { _group_id: string; _proposal_id: string; _supported: boolean }
        Returns: undefined
      }
      set_next_stop_schedule_v2: {
        Args: {
          _expected_revision?: number
          _group_id: string
          _planned_date: string
          _planned_time?: string
        }
        Returns: undefined
      }
      set_notification_preference: {
        Args: { _enabled: boolean; _type: string }
        Returns: undefined
      }
      set_own_review_reaction_v1: {
        Args: {
          _group_id: string
          _reaction?: string
          _review_id: string
          _visit_id: string
        }
        Returns: undefined
      }
      set_own_visit_participation_v1: {
        Args: { _group_id: string; _participating: boolean; _visit_id: string }
        Returns: undefined
      }
      set_review_group_visibility: {
        Args: {
          _comment_visible: boolean
          _group_id: string
          _rating_visible: boolean
          _review_id: string
        }
        Returns: undefined
      }
      share_visit_to_group: {
        Args: {
          _share_own_comment?: boolean
          _target_group_id: string
          _visit_id: string
        }
        Returns: string
      }
      share_visit_to_group_v2: {
        Args: {
          _allow_strong_duplicate?: boolean
          _share_own_comment?: boolean
          _target_group_id: string
          _visit_id: string
        }
        Returns: string
      }
      share_visit_to_group_v3: {
        Args: {
          _allow_strong_duplicate?: boolean
          _share_own_comment?: boolean
          _target_group_id: string
          _visit_id: string
        }
        Returns: string
      }
      shares_group: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      toggle_favorite: {
        Args: { _group_id: string; _place_id: string }
        Returns: boolean
      }
      transfer_group_ownership: {
        Args: { _group_id: string; _new_owner_id: string }
        Returns: undefined
      }
      update_group_place_metadata: {
        Args: {
          _category_override?: string
          _cuisines_override?: string[]
          _group_id: string
          _notes?: string
          _occasions?: string[]
          _place_id: string
        }
        Returns: undefined
      }
      update_group_place_practical_info_v1: {
        Args: {
          _group_id: string
          _opening_hours_override?: Json
          _place_id: string
          _source_note?: string
          _source_url?: string
          _website_override?: string
        }
        Returns: undefined
      }
      update_group_settings: {
        Args: {
          _clear_home?: boolean
          _emoji?: string
          _group_id: string
          _home_label?: string
          _home_lat?: number
          _home_lng?: number
          _home_place_id?: string
          _home_provider?: string
          _name: string
          _shared_visits_count_for_progression?: boolean
        }
        Returns: undefined
      }
      update_next_stop_date_proposal: {
        Args: {
          _group_id: string
          _proposal_id: string
          _proposed_date: string
          _proposed_time?: string
        }
        Returns: undefined
      }
      update_own_review: {
        Args: {
          _comment?: string
          _group_id: string
          _overall: number
          _review_id: string
          _service?: number
          _taste?: number
          _value?: number
        }
        Returns: undefined
      }
      update_own_review_v2: {
        Args: {
          _atmosphere?: number
          _comment?: string
          _group_id: string
          _overall?: number
          _review_id: string
          _service?: number
          _taste?: number
          _value?: number
        }
        Returns: undefined
      }
      update_place_data_report_osm_status_v1: {
        Args: {
          _note_closed_at: string
          _note_id: number
          _note_status: string
          _public_reference: string
          _report_id: string
        }
        Returns: undefined
      }
      update_profile: {
        Args: { _avatar_emoji?: string; _display_name: string }
        Returns: undefined
      }
      upsert_visit_photo: {
        Args: {
          _byte_size: number
          _group_id: string
          _height: number
          _mime_type: string
          _storage_path: string
          _visit_id: string
          _width: number
        }
        Returns: string
      }
      valid_opening_hours_schedule_v1: {
        Args: { _value: Json }
        Returns: boolean
      }
      visit_photo_path_group: { Args: { _name: string }; Returns: string }
      visit_photo_path_visit: { Args: { _name: string }; Returns: string }
      withdraw_next_stop_place_v2: {
        Args: { _group_id: string; _proposal_id: string }
        Returns: undefined
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
    Enums: {},
  },
} as const

