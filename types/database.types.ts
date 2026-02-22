/**
 * Database types for Supabase integration
 */

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          skill_level: number;
          partner_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          skill_level: number;
          partner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          skill_level?: number;
          partner_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          number_of_courts: number;
          number_of_rounds: number;
          balance_skill_levels: boolean;
          respect_partner_preferences: boolean;
          max_skill_difference: number;
          distribute_rest_equally: boolean;
          // Print options
          print_event_title: string;
          print_event_subtitle: string;
          print_event_date: string;
          print_location: string;
          print_organizer: string;
          print_orientation: 'portrait' | 'landscape';
          print_compact_layout: boolean;
          print_color_mode: boolean;
          print_show_ratings: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          number_of_courts?: number;
          number_of_rounds?: number;
          balance_skill_levels?: boolean;
          respect_partner_preferences?: boolean;
          max_skill_difference?: number;
          distribute_rest_equally?: boolean;
          // Print options
          print_event_title?: string;
          print_event_subtitle?: string;
          print_event_date?: string;
          print_location?: string;
          print_organizer?: string;
          print_orientation?: 'portrait' | 'landscape';
          print_compact_layout?: boolean;
          print_color_mode?: boolean;
          print_show_ratings?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          number_of_courts?: number;
          number_of_rounds?: number;
          balance_skill_levels?: boolean;
          respect_partner_preferences?: boolean;
          max_skill_difference?: number;
          distribute_rest_equally?: boolean;
          // Print options
          print_event_title?: string;
          print_event_subtitle?: string;
          print_event_date?: string;
          print_location?: string;
          print_organizer?: string;
          print_orientation?: 'portrait' | 'landscape';
          print_compact_layout?: boolean;
          print_color_mode?: boolean;
          print_show_ratings?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type PlayerRow = Database['public']['Tables']['players']['Row'];
export type PlayerInsert = Database['public']['Tables']['players']['Insert'];
export type PlayerUpdate = Database['public']['Tables']['players']['Update'];

export type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert'];
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];
