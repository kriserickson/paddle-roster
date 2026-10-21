import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readonly, ref } from 'vue';
import { usePrintStore } from '~/stores/usePrintStore';

const COURT_COUNT = 2;
const ROUND_COUNT = 3;
const SKILL_DIFFERENCE = 2;

describe('roster-specific Event Name', () => {
  let upsert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    const row = {
      balance_skill_levels: true,
      distribute_rest_equally: true,
      max_skill_difference: SKILL_DIFFERENCE,
      number_of_courts: COURT_COUNT,
      number_of_rounds: ROUND_COUNT,
      print_color_mode: true,
      print_compact_layout: false,
      print_event_date: '',
      print_event_subtitle: '',
      print_event_title: 'An old saved event',
      print_location: 'Club courts',
      print_organizer: 'Club organizer',
      print_orientation: 'portrait',
      print_show_ratings: true,
      respect_partner_preferences: true
    };
    upsert = vi.fn().mockResolvedValue({ error: null });
    vi.stubGlobal('ref', ref);
    vi.stubGlobal('readonly', readonly);
    vi.stubGlobal('useSupabaseClient', () => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: row, error: null }) }),
        upsert
      })
    }));
    vi.stubGlobal('useSupabaseUser', () => ref({ id: 'test-user' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores an old saved name but retains the current roster name when loading other print preferences', async () => {
    const store = usePrintStore();
    await store.loadUserPrintPreferences();

    expect(store.printOptions.eventTitle).toBe('');
    expect(store.printOptions.location).toBe('Club courts');
    expect(store.printOptions.orientation).toBe('portrait');

    store.updatePrintOptions({ eventTitle: 'This roster only' });
    await store.loadUserPrintPreferences();
    expect(store.printOptions.eventTitle).toBe('This roster only');
  });

  it('saves other print preferences with a blank event name and keeps the current name in memory', async () => {
    const store = usePrintStore();
    store.updatePrintOptions({ eventTitle: 'This roster only', location: 'New courts', orientation: 'portrait' });
    await store.saveUserPrintPreferences();

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        print_event_title: '',
        print_location: 'New courts',
        print_orientation: 'portrait'
      }),
      { onConflict: 'user_id' }
    );
    expect(store.printOptions.eventTitle).toBe('This roster only');
  });
});
