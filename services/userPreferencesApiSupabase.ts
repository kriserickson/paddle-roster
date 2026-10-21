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
  public async getUserPreferences(): Promise<UserPreferences> {
    const { data, error } = await this.supabase.from('user_preferences').select('*').single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, return defaults and create them
        const defaultPreferences: UserPreferences = {
          matchingOptions: {
            balanceSkillLevels: true,
            courtDiversityPriority: 'balanced',
            distributeRestEqually: true,
            maxSkillDifference: 2.0,
            numberOfCourts: 3,
            numberOfRounds: 7,
            opponentDiversityPriority: 'balanced',
            respectPartnerPreferences: true
          },
          printOptions: {
            colorMode: true,
            compactLayout: false,
            eventDate: '',
            eventSubtitle: '',
            eventTitle: '',
            location: '',
            organizer: '',
            orientation: 'landscape',
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
  public async saveUserPreferences(preferences: UserPreferences): Promise<void> {
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
  public async resetUserPreferences(): Promise<UserPreferences> {
    const defaultPreferences: UserPreferences = {
      matchingOptions: {
        balanceSkillLevels: true,
        courtDiversityPriority: 'balanced',
        distributeRestEqually: true,
        maxSkillDifference: 2.0,
        numberOfCourts: 3,
        numberOfRounds: 7,
        opponentDiversityPriority: 'balanced',
        respectPartnerPreferences: true
      },
      printOptions: {
        colorMode: true,
        compactLayout: false,
        eventDate: '',
        eventSubtitle: '',
        eventTitle: '',
        location: '',
        organizer: '',
        orientation: 'landscape',
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
        balanceSkillLevels: row.balance_skill_levels,
        courtDiversityPriority: 'balanced',
        distributeRestEqually: row.distribute_rest_equally,
        maxSkillDifference: row.max_skill_difference,
        numberOfCourts: row.number_of_courts,
        numberOfRounds: row.number_of_rounds,
        opponentDiversityPriority: 'balanced',
        respectPartnerPreferences: row.respect_partner_preferences
      },
      printOptions: {
        colorMode: row.print_color_mode,
        compactLayout: row.print_compact_layout,
        eventDate: row.print_event_date,
        eventSubtitle: row.print_event_subtitle,
        // Event names belong to the current roster, rather than saved preferences.
        eventTitle: '',
        location: row.print_location,
        organizer: row.print_organizer,
        orientation: row.print_orientation,
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
      balance_skill_levels: preferences.matchingOptions.balanceSkillLevels,
      distribute_rest_equally: preferences.matchingOptions.distributeRestEqually,
      max_skill_difference: preferences.matchingOptions.maxSkillDifference,
      number_of_courts: preferences.matchingOptions.numberOfCourts,
      number_of_rounds: preferences.matchingOptions.numberOfRounds,
      print_color_mode: preferences.printOptions.colorMode,
      print_compact_layout: preferences.printOptions.compactLayout,
      print_event_date: preferences.printOptions.eventDate,
      print_event_subtitle: preferences.printOptions.eventSubtitle,
      print_event_title: '',
      print_location: preferences.printOptions.location,
      print_organizer: preferences.printOptions.organizer,
      print_orientation: preferences.printOptions.orientation,
      print_show_ratings: preferences.printOptions.showRatings,
      respect_partner_preferences: preferences.matchingOptions.respectPartnerPreferences,
      user_id: user.value?.id
    };
  }
}
