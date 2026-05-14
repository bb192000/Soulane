type FeatureFlag = 'WAVE_UI' | 'HIGH_SYNC_RATE' | 'DOME_CHAT';

class FeatureFlagService {
  private flags: Record<FeatureFlag, boolean> = {
    WAVE_UI: false,        // Experimenting with 'Lane' vs 'Wave'
    HIGH_SYNC_RATE: true,  // Testing 250ms vs 500ms
    DOME_CHAT: false,      // Upcoming feature
  };

  /**
   * Simple A/B logic based on user ID hash
   */
  isEnabled(flag: FeatureFlag, userId: string): boolean {
    const isExperiment = this.flags[flag];
    if (!isExperiment) return false;

    // Deterministic split (50/50)
    const hash = this._hashString(userId);
    return hash % 2 === 0;
  }

  private _hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

export const featureFlags = new FeatureFlagService();
