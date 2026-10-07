const MINUTE = 60_000;

/** Medication is never reminded long after the fact: a late dose prompt could read as advice to double up. */
export const MEDICATION_GRACE_MS = 60 * MINUTE;
/** Everything else may arrive up to a day late; past that Upcoming still shows it as overdue, without a push. */
export const DEFAULT_GRACE_MS = 24 * 60 * MINUTE;

export function lateDecision(preset: string, scheduledAt: Date, now: Date): 'SEND' | 'EXPIRE' {
  const grace = preset === 'MEDICATION' ? MEDICATION_GRACE_MS : DEFAULT_GRACE_MS;
  return now.getTime() - scheduledAt.getTime() > grace ? 'EXPIRE' : 'SEND';
}
