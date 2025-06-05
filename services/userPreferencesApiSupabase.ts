/**
 * Supabase API service for user preferences
 */
import type { MatchingOptions } from '~/types';
import type { Database, UserPreferencesRow } from '~/types/database';

export class UserPreferencesApiSupabase {
  private supabase = useSupabaseClient<Database>();

  /**
   * Get user's matching options preferences
   */
  async getUserPreferences(): Promise<MatchingOptions> {
    const { data, error } = await this.supabase.from('user_preferences').select('*').single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found, return defaults and create them
        const defaultOptions: MatchingOptions = {
          numberOfCourts: 3,
          numberOfRounds: 7,
          balanceSkillLevels: true,
          respectPartnerPreferences: true,
          maxSkillDifference: 2.0,
          distributeRestEqually: true
        };

        // Create default preferences for this user
        await this.saveUserPreferences(defaultOptions);
        return defaultOptions;
      }
      throw error;
    }

    return this.mapRowToMatchingOptions(data);
  }

  /**
   * Save user's matching options preferences
   */
  async saveUserPreferences(options: MatchingOptions): Promise<void> {
    const rowData = this.mapMatchingOptionsToRow(options);

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
  async resetUserPreferences(): Promise<MatchingOptions> {
    const defaultOptions: MatchingOptions = {
      numberOfCourts: 3,
      numberOfRounds: 7,
      balanceSkillLevels: true,
      respectPartnerPreferences: true,
      maxSkillDifference: 2.0,
      distributeRestEqually: true
    };

    await this.saveUserPreferences(defaultOptions);
    return defaultOptions;
  }

  /**
   * Map database row to MatchingOptions interface
   */
  private mapRowToMatchingOptions(row: UserPreferencesRow): MatchingOptions {
    return {
      numberOfCourts: row.number_of_courts,
      numberOfRounds: row.number_of_rounds,
      balanceSkillLevels: row.balance_skill_levels,
      respectPartnerPreferences: row.respect_partner_preferences,
      maxSkillDifference: row.max_skill_difference,
      distributeRestEqually: row.distribute_rest_equally
    };
  }

  /**
   * Map MatchingOptions interface to database row format
   */
  private mapMatchingOptionsToRow(options: MatchingOptions): Partial<UserPreferencesRow> {
    const user = useSupabaseUser();

    return {
      user_id: user.value?.id,
      number_of_courts: options.numberOfCourts,
      number_of_rounds: options.numberOfRounds,
      balance_skill_levels: options.balanceSkillLevels,
      respect_partner_preferences: options.respectPartnerPreferences,
      max_skill_difference: options.maxSkillDifference,
      distribute_rest_equally: options.distributeRestEqually
    };
  }
}
