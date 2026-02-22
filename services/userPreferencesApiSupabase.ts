/**
 * Supabase API service for user preferences
 */
import type { MatchingOptions, PrintOptions } from '~/types';
import type { Database, UserPreferencesRow } from '~/types/database.types';

export interface UserPreferences {
  matchingOptions: MatchingOptions;
  printOptions: PrintOptions;
}

export class UserPreferencesApiSupabase {
  private supabase = useSupabaseClient<Database>();

  /**
   * Get user's preferences (both matching and print options)
   */
  async getUserPreferences(): Promise<UserPreferences> {
    const { data, error } = await this.supabase.from('user_preferences').select('*').single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, return defaults and create them
        const defaultPreferences: UserPreferences = {
          matchingOptions: {
            numberOfCourts: 3,
            numberOfRounds: 7,
            balanceSkillLevels: true,
            respectPartnerPreferences: true,
            maxSkillDifference: 2.0,
            distributeRestEqually: true,
            opponentDiversityPriority: 'balanced',
            courtDiversityPriority: 'balanced'
          },
          printOptions: {
            eventTitle: '',
            eventSubtitle: '',
            eventDate: '',
            location: '',
            organizer: '',
            orientation: 'landscape',
            compactLayout: false,
            colorMode: true,
            showRatings: false
          }
        };

        // Create default preferences for this user
        await this.saveUserPreferences(defaultPreferences);
        return defaultPreferences;
      }
      throw error;
    }

    return this.mapRowToUserPreferences(data);
  }

  /**
   * Save user's preferences (both matching and print options)
   */
  async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    const rowData = this.mapUserPreferencesToRow(preferences);

    // @ts-expect-error: Supabase generic type inference limitation in VS Code
    const { error } = await this.supabase.from('user_preferences').upsert(rowData, {
      onConflict: 'user_id'
    });

    if (error) {
      throw error;
    }
  }

  /**
   * Reset user preferences to defaults
   */
  async resetUserPreferences(): Promise<UserPreferences> {
    const defaultPreferences: UserPreferences = {
      matchingOptions: {
        numberOfCourts: 3,
        numberOfRounds: 7,
        balanceSkillLevels: true,
        respectPartnerPreferences: true,
        maxSkillDifference: 2.0,
        distributeRestEqually: true,
        opponentDiversityPriority: 'balanced',
        courtDiversityPriority: 'balanced'
      },
      printOptions: {
        eventTitle: '',
        eventSubtitle: '',
        eventDate: '',
        location: '',
        organizer: '',
        orientation: 'landscape',
        compactLayout: false,
        colorMode: true,
        showRatings: true
      }
    };

    await this.saveUserPreferences(defaultPreferences);
    return defaultPreferences;
  }

  /**
   * Map database row to UserPreferences interface
   */
  private mapRowToUserPreferences(row: UserPreferencesRow): UserPreferences {
    return {
      matchingOptions: {
        numberOfCourts: row.number_of_courts,
        numberOfRounds: row.number_of_rounds,
        balanceSkillLevels: row.balance_skill_levels,
        respectPartnerPreferences: row.respect_partner_preferences,
        maxSkillDifference: row.max_skill_difference,
        distributeRestEqually: row.distribute_rest_equally,
        opponentDiversityPriority: 'balanced',
        courtDiversityPriority: 'balanced'
      },
      printOptions: {
        eventTitle: row.print_event_title,
        eventSubtitle: row.print_event_subtitle,
        eventDate: row.print_event_date,
        location: row.print_location,
        organizer: row.print_organizer,
        orientation: row.print_orientation,
        compactLayout: row.print_compact_layout,
        colorMode: row.print_color_mode,
        showRatings: row.print_show_ratings
      }
    };
  }

  /**
   * Map UserPreferences interface to database row format
   */
  private mapUserPreferencesToRow(preferences: UserPreferences): Partial<UserPreferencesRow> {
    const user = useSupabaseUser();

    return {
      user_id: user.value?.id,
      number_of_courts: preferences.matchingOptions.numberOfCourts,
      number_of_rounds: preferences.matchingOptions.numberOfRounds,
      balance_skill_levels: preferences.matchingOptions.balanceSkillLevels,
      respect_partner_preferences: preferences.matchingOptions.respectPartnerPreferences,
      max_skill_difference: preferences.matchingOptions.maxSkillDifference,
      distribute_rest_equally: preferences.matchingOptions.distributeRestEqually,
      print_event_title: preferences.printOptions.eventTitle,
      print_event_subtitle: preferences.printOptions.eventSubtitle,
      print_event_date: preferences.printOptions.eventDate,
      print_location: preferences.printOptions.location,
      print_organizer: preferences.printOptions.organizer,
      print_orientation: preferences.printOptions.orientation,
      print_compact_layout: preferences.printOptions.compactLayout,
      print_color_mode: preferences.printOptions.colorMode,
      print_show_ratings: preferences.printOptions.showRatings
    };
  }
}
