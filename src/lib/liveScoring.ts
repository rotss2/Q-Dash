// Live Quiz Battle Scoring System
// Points = 1000 base + speed bonus

export interface CalculatePointsParams {
  isCorrect: boolean;
  responseTimeMs: number;
  timerSeconds: number;
}

export interface CalculatePointsResult {
  basePoints: number;
  speedBonus: number;
  totalPoints: number;
}

/**
 * Calculate points for a live quiz answer
 * Base: 1000 points for correct answer
 * Speed bonus: up to 500 additional points based on speed
 * Wrong/no answer: 0 points
 */
export function calculateLivePoints({
  isCorrect,
  responseTimeMs,
  timerSeconds,
}: CalculatePointsParams): CalculatePointsResult {
  if (!isCorrect) {
    return {
      basePoints: 0,
      speedBonus: 0,
      totalPoints: 0,
    };
  }

  // Base points for correct answer
  const basePoints = 1000;

  // Calculate speed bonus (max 500 points)
  // Faster answers get more bonus
  const timerMs = timerSeconds * 1000;
  const timeRemainingRatio = Math.max(0, (timerMs - responseTimeMs) / timerMs);
  const speedBonus = Math.round(timeRemainingRatio * 500);

  return {
    basePoints,
    speedBonus,
    totalPoints: basePoints + speedBonus,
  };
}

/**
 * Calculate rank based on score
 * Returns 1-based rank (1 = highest score)
 */
export function calculateRank(
  participantId: string,
  scores: { participantId: string; score: number }[]
): number {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const index = sorted.findIndex(s => s.participantId === participantId);
  return index === -1 ? sorted.length : index + 1;
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}s`;
}

/**
 * Get color for timer based on remaining time percentage
 */
export function getTimerColor(remainingSeconds: number, totalSeconds: number): string {
  const ratio = remainingSeconds / totalSeconds;
  if (ratio > 0.6) return 'text-green-500';
  if (ratio > 0.3) return 'text-amber-500';
  return 'text-red-500';
}

/**
 * Generate a random 6-character room code
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
