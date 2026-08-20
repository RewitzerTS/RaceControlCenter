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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      domain_events: {
        Row: {
          actor_user_id: string | null
          aggregate_id: string
          aggregate_type: string
          event_type: string
          id: string
          idempotency_key: string
          league_id: string
          occurred_at: string
          payload: Json
          recorded_at: string
          result_version_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          aggregate_id: string
          aggregate_type: string
          event_type: string
          id?: string
          idempotency_key: string
          league_id: string
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          result_version_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          aggregate_id?: string
          aggregate_type?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          league_id?: string
          occurred_at?: string
          payload?: Json
          recorded_at?: string
          result_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domain_events_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_aliases: {
        Row: {
          alias: string
          alias_type: string
          created_at: string
          driver_id: string | null
          driver_identity_id: string | null
          id: string
          normalized_alias: string | null
        }
        Insert: {
          alias: string
          alias_type: string
          created_at?: string
          driver_id?: string | null
          driver_identity_id?: string | null
          id?: string
          normalized_alias?: string | null
        }
        Update: {
          alias?: string
          alias_type?: string
          created_at?: string
          driver_id?: string | null
          driver_identity_id?: string | null
          id?: string
          normalized_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_aliases_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_aliases_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_claims: {
        Row: {
          claimant_user_id: string
          driver_id: string
          expires_at: string | null
          id: string
          proof_token_hash: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          verification_method: string
        }
        Insert: {
          claimant_user_id: string
          driver_id: string
          expires_at?: string | null
          id?: string
          proof_token_hash?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          verification_method: string
        }
        Update: {
          claimant_user_id?: string
          driver_id?: string
          expires_at?: string | null
          id?: string
          proof_token_hash?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          verification_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_claims_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_identities: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_identity_links: {
        Row: {
          claim_id: string
          driver_id: string
          driver_identity_id: string
          id: string
          linked_at: string
        }
        Insert: {
          claim_id: string
          driver_id: string
          driver_identity_id: string
          id?: string
          linked_at?: string
        }
        Update: {
          claim_id?: string
          driver_id?: string
          driver_identity_id?: string
          id?: string
          linked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_identity_links_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "driver_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_identity_links_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_identity_links_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          ai_driver_reference: string | null
          avatar_url: string | null
          car_name: string | null
          created_at: string
          display_name: string
          gamertag: string | null
          id: string
          is_active: boolean
          league_id: string
          league_team: string | null
          nationality: string | null
          nationality_code: string | null
          notes: string | null
          number: number | null
          real_name: string | null
          updated_at: string
        }
        Insert: {
          ai_driver_reference?: string | null
          avatar_url?: string | null
          car_name?: string | null
          created_at?: string
          display_name: string
          gamertag?: string | null
          id?: string
          is_active?: boolean
          league_id: string
          league_team?: string | null
          nationality?: string | null
          nationality_code?: string | null
          notes?: string | null
          number?: number | null
          real_name?: string | null
          updated_at?: string
        }
        Update: {
          ai_driver_reference?: string | null
          avatar_url?: string | null
          car_name?: string | null
          created_at?: string
          display_name?: string
          gamertag?: string | null
          id?: string
          is_active?: boolean
          league_id?: string
          league_team?: string | null
          nationality?: string | null
          nationality_code?: string | null
          notes?: string | null
          number?: number | null
          real_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          created_at: string
          league_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          league_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          league_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_public: boolean
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_owners: {
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
        Relationships: []
      }
      race_results: {
        Row: {
          ai_driver_reference_snapshot: string | null
          awarded_points: number
          base_points: number
          car_name_snapshot: string | null
          created_at: string
          driver_id: string
          fastest_lap_ms: number | null
          fastest_lap_time: string | null
          fastest_lap_time_ms: number | null
          finish_position: number | null
          grid_position: number | null
          id: string
          notes: string | null
          participation_status: string
          penalty_time_delta_ms: number
          pit_stops: number
          points: number
          points_car_name: string | null
          points_owner_driver_id: string | null
          points_team_name: string | null
          race_id: string
          race_time: string | null
          race_time_ms: number | null
          result_version_id: string
          source_assignment_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          ai_driver_reference_snapshot?: string | null
          awarded_points?: number
          base_points?: number
          car_name_snapshot?: string | null
          created_at?: string
          driver_id: string
          fastest_lap_ms?: number | null
          fastest_lap_time?: string | null
          fastest_lap_time_ms?: number | null
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          notes?: string | null
          participation_status?: string
          penalty_time_delta_ms?: number
          pit_stops?: number
          points?: number
          points_car_name?: string | null
          points_owner_driver_id?: string | null
          points_team_name?: string | null
          race_id: string
          race_time?: string | null
          race_time_ms?: number | null
          result_version_id: string
          source_assignment_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_driver_reference_snapshot?: string | null
          awarded_points?: number
          base_points?: number
          car_name_snapshot?: string | null
          created_at?: string
          driver_id?: string
          fastest_lap_ms?: number | null
          fastest_lap_time?: string | null
          fastest_lap_time_ms?: number | null
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          notes?: string | null
          participation_status?: string
          penalty_time_delta_ms?: number
          pit_stops?: number
          points?: number
          points_car_name?: string | null
          points_owner_driver_id?: string | null
          points_team_name?: string | null
          race_id?: string
          race_time?: string | null
          race_time_ms?: number | null
          result_version_id?: string
          source_assignment_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_results_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_points_owner_driver_id_fkey"
            columns: ["points_owner_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_results_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          circuit_name: string | null
          country_code: string | null
          created_at: string
          current_result_version_id: string | null
          grand_prix_name: string
          has_sprint: boolean
          id: string
          next_result_version_number: number
          notes: string | null
          race_date: string | null
          race_order: number | null
          race_start_at: string | null
          race_time: string | null
          round_number: number
          season_id: string
          status: string
          track_image: string | null
          updated_at: string
          weather: string | null
          weekend_start_date: string | null
        }
        Insert: {
          circuit_name?: string | null
          country_code?: string | null
          created_at?: string
          current_result_version_id?: string | null
          grand_prix_name: string
          has_sprint?: boolean
          id?: string
          next_result_version_number?: number
          notes?: string | null
          race_date?: string | null
          race_order?: number | null
          race_start_at?: string | null
          race_time?: string | null
          round_number: number
          season_id: string
          status?: string
          track_image?: string | null
          updated_at?: string
          weather?: string | null
          weekend_start_date?: string | null
        }
        Update: {
          circuit_name?: string | null
          country_code?: string | null
          created_at?: string
          current_result_version_id?: string | null
          grand_prix_name?: string
          has_sprint?: boolean
          id?: string
          next_result_version_number?: number
          notes?: string | null
          race_date?: string | null
          race_order?: number | null
          race_start_at?: string | null
          race_time?: string | null
          round_number?: number
          season_id?: string
          status?: string
          track_image?: string | null
          updated_at?: string
          weather?: string | null
          weekend_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "races_current_result_version_id_fkey"
            columns: ["current_result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "races_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      result_version_rows: {
        Row: {
          ai_driver_reference_snapshot: string | null
          awarded_points: number
          base_points: number
          car_name_snapshot: string | null
          created_at: string
          driver_id: string
          fastest_lap_ms: number | null
          fastest_lap_time: string | null
          fastest_lap_time_ms: number | null
          finish_position: number | null
          grid_position: number | null
          id: string
          notes: string | null
          participation_status: string
          penalty_time_delta_ms: number
          pit_stops: number
          points: number
          points_car_name: string | null
          points_owner_driver_id: string | null
          points_team_name: string | null
          race_time: string | null
          race_time_ms: number | null
          result_version_id: string
          row_order: number
          source_assignment_id: string | null
          team_id: string | null
        }
        Insert: {
          ai_driver_reference_snapshot?: string | null
          awarded_points?: number
          base_points?: number
          car_name_snapshot?: string | null
          created_at?: string
          driver_id: string
          fastest_lap_ms?: number | null
          fastest_lap_time?: string | null
          fastest_lap_time_ms?: number | null
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          notes?: string | null
          participation_status?: string
          penalty_time_delta_ms?: number
          pit_stops?: number
          points?: number
          points_car_name?: string | null
          points_owner_driver_id?: string | null
          points_team_name?: string | null
          race_time?: string | null
          race_time_ms?: number | null
          result_version_id: string
          row_order: number
          source_assignment_id?: string | null
          team_id?: string | null
        }
        Update: {
          ai_driver_reference_snapshot?: string | null
          awarded_points?: number
          base_points?: number
          car_name_snapshot?: string | null
          created_at?: string
          driver_id?: string
          fastest_lap_ms?: number | null
          fastest_lap_time?: string | null
          fastest_lap_time_ms?: number | null
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          notes?: string | null
          participation_status?: string
          penalty_time_delta_ms?: number
          pit_stops?: number
          points?: number
          points_car_name?: string | null
          points_owner_driver_id?: string | null
          points_team_name?: string | null
          race_time?: string | null
          race_time_ms?: number | null
          result_version_id?: string
          row_order?: number
          source_assignment_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_version_rows_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_version_rows_points_owner_driver_id_fkey"
            columns: ["points_owner_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_version_rows_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      result_versions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          change_reason: string
          created_at: string
          created_by: string | null
          id: string
          previous_version_id: string | null
          race_id: string
          source_import_id: string | null
          status: string
          superseded_at: string | null
          validated_at: string | null
          validated_by: string | null
          version_number: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          change_reason: string
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          race_id: string
          source_import_id?: string | null
          status?: string
          superseded_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version_number: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          change_reason?: string
          created_at?: string
          created_by?: string | null
          id?: string
          previous_version_id?: string | null
          race_id?: string
          source_import_id?: string | null
          status?: string
          superseded_at?: string | null
          validated_at?: string | null
          validated_by?: string | null
          version_number?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "result_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_versions_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          championship_code: string | null
          created_at: string
          description: string | null
          end_date: string | null
          game_key: string
          game_label: string
          id: string
          is_active: boolean
          league_id: string
          name: string
          slug: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          championship_code?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          game_key?: string
          game_label?: string
          id?: string
          is_active?: boolean
          league_id: string
          name: string
          slug: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          championship_code?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          game_key?: string
          game_label?: string
          id?: string
          is_active?: boolean
          league_id?: string
          name?: string
          slug?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_app_role: { Args: never; Returns: string }
      is_platform_owner: { Args: never; Returns: boolean }
      matches_requested_league: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      requested_league_slug: { Args: never; Returns: string }
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
