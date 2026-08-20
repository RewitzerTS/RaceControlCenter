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
      achievement_definitions: {
        Row: {
          code: string
          created_at: string
          description_key: string
          is_active: boolean
          is_core: boolean
          metric: string
          reward_vc: number
          rule_version: number
          sort_order: number
          threshold: number
          title_key: string
        }
        Insert: {
          code: string
          created_at?: string
          description_key: string
          is_active?: boolean
          is_core?: boolean
          metric: string
          reward_vc?: number
          rule_version?: number
          sort_order: number
          threshold: number
          title_key: string
        }
        Update: {
          code?: string
          created_at?: string
          description_key?: string
          is_active?: boolean
          is_core?: boolean
          metric?: string
          reward_vc?: number
          rule_version?: number
          sort_order?: number
          threshold?: number
          title_key?: string
        }
        Relationships: []
      }
      career_result_facts: {
        Row: {
          awarded_points: number
          classification_status: string
          created_at: string
          driver_id: string
          driver_identity_id: string
          finish_position: number | null
          grid_position: number | null
          id: string
          is_fastest_lap: boolean
          is_pole: boolean
          league_id: string
          participation_status: string
          race_date: string | null
          race_id: string
          reconciled_by_event_id: string
          result_version_id: string
          result_version_row_id: string
          season_id: string
          updated_at: string
        }
        Insert: {
          awarded_points?: number
          classification_status: string
          created_at?: string
          driver_id: string
          driver_identity_id: string
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          is_fastest_lap?: boolean
          is_pole?: boolean
          league_id: string
          participation_status: string
          race_date?: string | null
          race_id: string
          reconciled_by_event_id: string
          result_version_id: string
          result_version_row_id: string
          season_id: string
          updated_at?: string
        }
        Update: {
          awarded_points?: number
          classification_status?: string
          created_at?: string
          driver_id?: string
          driver_identity_id?: string
          finish_position?: number | null
          grid_position?: number | null
          id?: string
          is_fastest_lap?: boolean
          is_pole?: boolean
          league_id?: string
          participation_status?: string
          race_date?: string | null
          race_id?: string
          reconciled_by_event_id?: string
          result_version_id?: string
          result_version_row_id?: string
          season_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_result_facts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_reconciled_by_event_id_fkey"
            columns: ["reconciled_by_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_result_version_row_id_fkey"
            columns: ["result_version_row_id"]
            isOneToOne: true
            referencedRelation: "result_version_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_result_facts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_definitions: {
        Row: {
          active_from: string
          active_until: string | null
          code: string
          created_at: string
          description_key: string
          is_active: boolean
          metric: string
          reward_vc: number
          rule_version: number
          sort_order: number
          target_value: number
          title_key: string
          updated_at: string
        }
        Insert: {
          active_from: string
          active_until?: string | null
          code: string
          created_at?: string
          description_key: string
          is_active?: boolean
          metric: string
          reward_vc?: number
          rule_version?: number
          sort_order: number
          target_value: number
          title_key: string
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          code?: string
          created_at?: string
          description_key?: string
          is_active?: boolean
          metric?: string
          reward_vc?: number
          rule_version?: number
          sort_order?: number
          target_value?: number
          title_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      challenge_races: {
        Row: {
          challenge_code: string
          entered_at: string
          entered_by_event_id: string
          league_id: string
          race_id: string
        }
        Insert: {
          challenge_code: string
          entered_at: string
          entered_by_event_id: string
          league_id: string
          race_id: string
        }
        Update: {
          challenge_code?: string
          entered_at?: string
          entered_by_event_id?: string
          league_id?: string
          race_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_races_challenge_code_fkey"
            columns: ["challenge_code"]
            isOneToOne: false
            referencedRelation: "challenge_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "challenge_races_entered_by_event_id_fkey"
            columns: ["entered_by_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_races_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_races_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_result_facts: {
        Row: {
          challenge_code: string
          contribution: number
          driver_identity_id: string
          league_id: string
          race_id: string
          reconciled_by_event_id: string
          source_result_version_id: string
          updated_at: string
        }
        Insert: {
          challenge_code: string
          contribution: number
          driver_identity_id: string
          league_id: string
          race_id: string
          reconciled_by_event_id: string
          source_result_version_id: string
          updated_at?: string
        }
        Update: {
          challenge_code?: string
          contribution?: number
          driver_identity_id?: string
          league_id?: string
          race_id?: string
          reconciled_by_event_id?: string
          source_result_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_result_facts_challenge_code_fkey"
            columns: ["challenge_code"]
            isOneToOne: false
            referencedRelation: "challenge_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "challenge_result_facts_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_result_facts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_result_facts_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_result_facts_reconciled_by_event_id_fkey"
            columns: ["reconciled_by_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_result_facts_source_result_version_id_fkey"
            columns: ["source_result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetic_definitions: {
        Row: {
          category: string
          code: string
          created_at: string
          description_key: string
          is_active: boolean
          metadata: Json
          price_vc: number
          sort_order: number
          title_key: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description_key: string
          is_active?: boolean
          metadata?: Json
          price_vc: number
          sort_order: number
          title_key: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description_key?: string
          is_active?: boolean
          metadata?: Json
          price_vc?: number
          sort_order?: number
          title_key?: string
        }
        Relationships: []
      }
      cosmetic_purchases: {
        Row: {
          completed_at: string | null
          cosmetic_code: string
          created_at: string
          driver_identity_id: string
          id: string
          idempotency_key: string
          ledger_entry_id: string | null
          price_vc_snapshot: number
          status: string
        }
        Insert: {
          completed_at?: string | null
          cosmetic_code: string
          created_at?: string
          driver_identity_id: string
          id?: string
          idempotency_key: string
          ledger_entry_id?: string | null
          price_vc_snapshot: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          cosmetic_code?: string
          created_at?: string
          driver_identity_id?: string
          id?: string
          idempotency_key?: string
          ledger_entry_id?: string | null
          price_vc_snapshot?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cosmetic_purchases_cosmetic_code_fkey"
            columns: ["cosmetic_code"]
            isOneToOne: false
            referencedRelation: "cosmetic_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "cosmetic_purchases_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cosmetic_purchases_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          amount: number
          driver_identity_id: string
          entry_type: string
          id: string
          idempotency_key: string
          league_id: string | null
          metadata: Json
          occurred_at: string
          reason_code: string
          recorded_at: string
          source_event_id: string | null
          source_scope: string
        }
        Insert: {
          amount: number
          driver_identity_id: string
          entry_type: string
          id?: string
          idempotency_key: string
          league_id?: string | null
          metadata?: Json
          occurred_at: string
          reason_code: string
          recorded_at?: string
          source_event_id?: string | null
          source_scope: string
        }
        Update: {
          amount?: number
          driver_identity_id?: string
          entry_type?: string
          id?: string
          idempotency_key?: string
          league_id?: string | null
          metadata?: Json
          occurred_at?: string
          reason_code?: string
          recorded_at?: string
          source_event_id?: string | null
          source_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
        ]
      }
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
      driver_achievement_events: {
        Row: {
          achievement_code: string
          credit_eligible: boolean
          driver_identity_id: string
          event_type: string
          id: string
          idempotency_key: string
          observed_value: number
          occurred_at: string
          recorded_at: string
          reward_vc_snapshot: number
          rule_version: number
          source_event_id: string
          source_result_version_id: string | null
          threshold_snapshot: number
        }
        Insert: {
          achievement_code: string
          credit_eligible?: boolean
          driver_identity_id: string
          event_type: string
          id?: string
          idempotency_key: string
          observed_value: number
          occurred_at: string
          recorded_at?: string
          reward_vc_snapshot?: number
          rule_version: number
          source_event_id: string
          source_result_version_id?: string | null
          threshold_snapshot: number
        }
        Update: {
          achievement_code?: string
          credit_eligible?: boolean
          driver_identity_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          observed_value?: number
          occurred_at?: string
          recorded_at?: string
          reward_vc_snapshot?: number
          rule_version?: number
          source_event_id?: string
          source_result_version_id?: string | null
          threshold_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_achievement_events_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "driver_achievement_events_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_achievement_events_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_achievement_events_source_result_version_id_fkey"
            columns: ["source_result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_achievements: {
        Row: {
          achievement_code: string
          current_value: number
          driver_identity_id: string
          first_unlocked_at: string | null
          last_event_id: string
          revoked_at: string | null
          status: string
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          achievement_code: string
          current_value?: number
          driver_identity_id: string
          first_unlocked_at?: string | null
          last_event_id: string
          revoked_at?: string | null
          status: string
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          achievement_code?: string
          current_value?: number
          driver_identity_id?: string
          first_unlocked_at?: string | null
          last_event_id?: string
          revoked_at?: string | null
          status?: string
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievement_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "driver_achievements_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_achievements_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "driver_achievement_events"
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
      driver_career_stats: {
        Row: {
          average_finish: number | null
          best_finish: number | null
          classified_finishes: number
          dnfs: number
          dns: number
          driver_identity_id: string
          dsqs: number
          fastest_laps: number
          last_race_date: string | null
          leagues_competed: number
          podiums: number
          poles: number
          seasons_competed: number
          starts: number
          total_points: number
          updated_at: string
          wins: number
        }
        Insert: {
          average_finish?: number | null
          best_finish?: number | null
          classified_finishes?: number
          dnfs?: number
          dns?: number
          driver_identity_id: string
          dsqs?: number
          fastest_laps?: number
          last_race_date?: string | null
          leagues_competed?: number
          podiums?: number
          poles?: number
          seasons_competed?: number
          starts?: number
          total_points?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          average_finish?: number | null
          best_finish?: number | null
          classified_finishes?: number
          dnfs?: number
          dns?: number
          driver_identity_id?: string
          dsqs?: number
          fastest_laps?: number
          last_race_date?: string | null
          leagues_competed?: number
          podiums?: number
          poles?: number
          seasons_competed?: number
          starts?: number
          total_points?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_career_stats_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: true
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_challenge_events: {
        Row: {
          challenge_code: string
          driver_identity_id: string
          event_type: string
          id: string
          idempotency_key: string
          occurred_at: string
          progress_snapshot: number
          recorded_at: string
          reward_eligible: boolean
          reward_vc_snapshot: number
          rule_version: number
          source_event_id: string
          source_result_version_id: string | null
          target_snapshot: number
        }
        Insert: {
          challenge_code: string
          driver_identity_id: string
          event_type: string
          id?: string
          idempotency_key: string
          occurred_at: string
          progress_snapshot: number
          recorded_at?: string
          reward_eligible?: boolean
          reward_vc_snapshot?: number
          rule_version: number
          source_event_id: string
          source_result_version_id?: string | null
          target_snapshot: number
        }
        Update: {
          challenge_code?: string
          driver_identity_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          occurred_at?: string
          progress_snapshot?: number
          recorded_at?: string
          reward_eligible?: boolean
          reward_vc_snapshot?: number
          rule_version?: number
          source_event_id?: string
          source_result_version_id?: string | null
          target_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_challenge_events_challenge_code_fkey"
            columns: ["challenge_code"]
            isOneToOne: false
            referencedRelation: "challenge_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "driver_challenge_events_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_challenge_events_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_challenge_events_source_result_version_id_fkey"
            columns: ["source_result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_challenges: {
        Row: {
          challenge_code: string
          completed_at: string | null
          driver_identity_id: string
          last_event_id: string | null
          progress: number
          reward_eligible: boolean
          status: string
          updated_at: string
        }
        Insert: {
          challenge_code: string
          completed_at?: string | null
          driver_identity_id: string
          last_event_id?: string | null
          progress?: number
          reward_eligible?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          challenge_code?: string
          completed_at?: string | null
          driver_identity_id?: string
          last_event_id?: string | null
          progress?: number
          reward_eligible?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_challenges_challenge_code_fkey"
            columns: ["challenge_code"]
            isOneToOne: false
            referencedRelation: "challenge_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "driver_challenges_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_challenges_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "driver_challenge_events"
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
      driver_cosmetics: {
        Row: {
          acquired_at: string
          acquisition_type: string
          cosmetic_code: string
          driver_identity_id: string
          purchase_id: string | null
        }
        Insert: {
          acquired_at?: string
          acquisition_type: string
          cosmetic_code: string
          driver_identity_id: string
          purchase_id?: string | null
        }
        Update: {
          acquired_at?: string
          acquisition_type?: string
          cosmetic_code?: string
          driver_identity_id?: string
          purchase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_cosmetics_cosmetic_code_fkey"
            columns: ["cosmetic_code"]
            isOneToOne: false
            referencedRelation: "cosmetic_definitions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "driver_cosmetics_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_cosmetics_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "cosmetic_purchases"
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
      driver_progression: {
        Row: {
          driver_identity_id: string
          last_ledger_entry_id: string | null
          level: number
          lifetime_xp: number
          rank: string
          updated_at: string
          xp_into_level: number
          xp_to_next_level: number
        }
        Insert: {
          driver_identity_id: string
          last_ledger_entry_id?: string | null
          level?: number
          lifetime_xp?: number
          rank?: string
          updated_at?: string
          xp_into_level?: number
          xp_to_next_level?: number
        }
        Update: {
          driver_identity_id?: string
          last_ledger_entry_id?: string | null
          level?: number
          lifetime_xp?: number
          rank?: string
          updated_at?: string
          xp_into_level?: number
          xp_to_next_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_progression_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: true
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_progression_last_ledger_entry_id_fkey"
            columns: ["last_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "xp_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallets: {
        Row: {
          balance: number
          driver_identity_id: string
          last_ledger_entry_id: string | null
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
        }
        Insert: {
          balance?: number
          driver_identity_id: string
          last_ledger_entry_id?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          driver_identity_id?: string
          last_ledger_entry_id?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallets_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: true
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallets_last_ledger_entry_id_fkey"
            columns: ["last_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "credit_ledger"
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
          classification_status: string
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
          classification_status?: string
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
          classification_status?: string
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
          classification_status: string
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
          classification_status?: string
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
          classification_status?: string
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
      xp_ledger: {
        Row: {
          amount: number
          driver_identity_id: string
          entry_type: string
          id: string
          idempotency_key: string
          league_id: string | null
          metadata: Json
          occurred_at: string
          processing_id: string
          race_id: string | null
          reason_code: string
          recorded_at: string
          result_version_id: string | null
          rule_version: number
          source_event_id: string
        }
        Insert: {
          amount: number
          driver_identity_id: string
          entry_type: string
          id?: string
          idempotency_key: string
          league_id?: string | null
          metadata?: Json
          occurred_at: string
          processing_id: string
          race_id?: string | null
          reason_code: string
          recorded_at?: string
          result_version_id?: string | null
          rule_version?: number
          source_event_id: string
        }
        Update: {
          amount?: number
          driver_identity_id?: string
          entry_type?: string
          id?: string
          idempotency_key?: string
          league_id?: string | null
          metadata?: Json
          occurred_at?: string
          processing_id?: string
          race_id?: string | null
          reason_code?: string
          recorded_at?: string
          result_version_id?: string | null
          rule_version?: number
          source_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_driver_identity_id_fkey"
            columns: ["driver_identity_id"]
            isOneToOne: false
            referencedRelation: "driver_identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_result_version_id_fkey"
            columns: ["result_version_id"]
            isOneToOne: false
            referencedRelation: "result_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "domain_events"
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
      purchase_cosmetic: {
        Args: { p_cosmetic_code: string; p_idempotency_key: string }
        Returns: {
          amount_spent: number
          balance_after: number
          purchase_id: string
          purchase_status: string
          purchased_cosmetic_code: string
        }[]
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
