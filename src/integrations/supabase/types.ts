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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          created_at: string
          created_by: string
          emoji: string | null
          home_lat: number | null
          home_lng: number | null
          home_location_label: string | null
          id: string
          name: string
          shared_visits_count_for_progression: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          emoji?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_location_label?: string | null
          id?: string
          name: string
          shared_visits_count_for_progression?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          emoji?: string | null
          home_lat?: number | null
          home_lng?: number | null
          home_location_label?: string | null
          id?: string
          name?: string
          shared_visits_count_for_progression?: boolean
          updated_at?: string
        }
        Relationships: [
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
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_emoji?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_emoji?: string | null
          avatar_url?: string | null
          created_at?: string
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
          _name: string
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
      get_group_app_state: { Args: { _group_id: string }; Returns: Json }
      get_invitation_preview: { Args: { _token: string }; Returns: Json }
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
      remove_group_member: {
        Args: { _group_id: string; _user_id: string }
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
      update_group_settings:
        | {
            Args: {
              _emoji?: string
              _group_id: string
              _home_label?: string
              _name: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _emoji?: string
              _group_id: string
              _home_label?: string
              _name: string
              _shared_visits_count_for_progression?: boolean
            }
            Returns: undefined
          }
      update_profile: {
        Args: { _avatar_emoji?: string; _display_name: string }
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
