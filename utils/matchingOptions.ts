import type { MatchingOptions } from '~/types';

/**
 * Convert Vue/Pinia matching options into a plain snapshot.
 *
 * Vue may wrap both the options object and its array in reactive proxies, which
 * cannot be passed directly to the browser's structuredClone implementation.
 */
export function copyMatchingOptions(options: MatchingOptions): MatchingOptions {
  return Object.assign({}, options, {
    firstRoundSitters: options.firstRoundSitters ? [...options.firstRoundSitters] : undefined
  });
}
