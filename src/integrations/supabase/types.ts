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
          origin: string
          place_id: string
          source_group_id: string | null
          updated_at: string
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
          origin?: string
          place_id: string
          source_group_id?: string | null
          updated_at?: string
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
          origin?: string
          place_id?: string
          source_group_id?: string | null
          updated_at?: string
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
      groups: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
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
      place_sources: {
        Row: {
          fetched_at: string
          id: string
          place_id: string
          provider: string
          provider_place_id: string
          raw: Json
        }
        Insert: {
          fetched_at?: string
          id?: string
          place_id: string
          provider: string
          provider_place_id: string
          raw?: Json
        }
        Update: {
          fetched_at?: string
          id?: string
          place_id?: string
          provider?: string
          provider_place_id?: string
          raw?: Json
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
          comment: string | null
          created_at: string
          id: string
          overall: number
          service: number | null
          taste: number | null
          updated_at: string
          user_id: string
          value: number | null
          visit_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          overall: number
          service?: number | null
          taste?: number | null
          updated_at?: string
          user_id: string
          value?: number | null
          visit_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          overall?: number
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
      visits: {
        Row: {
          created_at: string
          created_by: string
          id: string
          meal_type: string
          place_id: string
          updated_at: string
          visited_on: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          meal_type: string
          place_id: string
          updated_at?: string
          visited_on: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
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
      archive_group: { Args: { _group_id: string }; Returns: undefined }
      archive_group_place: {
        Args: { _group_id: string; _place_id: string }
        Returns: undefined
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
      delete_visit_photo: {
        Args: { _group_id: string; _visit_id: string }
        Returns: string
      }
      get_account_deletion_requirements: { Args: never; Returns: Json }
      get_group_app_state: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v4b: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5c: { Args: { _group_id: string }; Returns: Json }
      get_group_app_state_v5d: { Args: { _group_id: string }; Returns: Json }
      get_invitation_preview: { Args: { _token: string }; Returns: Json }
      group_is_active: { Args: { _group_id: string }; Returns: boolean }
      has_group_role: {
        Args: { _group_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_membership: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      leave_group: { Args: { _group_id: string }; Returns: undefined }
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
      list_user_groups_v4b: { Args: never; Returns: Json }
      list_visit_share_targets: { Args: { _visit_id: string }; Returns: Json }
      list_visit_share_targets_v4b: {
        Args: { _visit_id: string }
        Returns: Json
      }
      prepare_own_account_deletion: {
        Args: { _confirm_solo_group_deletion?: boolean; _successors?: Json }
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
      reactivate_group: { Args: { _group_id: string }; Returns: undefined }
      remove_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: undefined
      }
      remove_shared_visit_from_group: {
        Args: { _group_id: string; _visit_id: string }
        Returns: undefined
      }
      respond_next_stop_date: {
        Args: { _group_id: string; _proposal_id: string; _response: string }
        Returns: undefined
      }
      restore_group_place: {
        Args: { _group_id: string; _place_id: string }
        Returns: undefined
      }
      revoke_group_invitation: {
        Args: { _invitation_id: string }
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
      visit_photo_path_group: { Args: { _name: string }; Returns: string }
      visit_photo_path_visit: { Args: { _name: string }; Returns: string }
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
