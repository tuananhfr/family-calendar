type Candidate = { id: string; displayName: string };

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Finds the single profile whose name matches the requested name; ambiguous names return nothing. */
export function matchMember<T extends Candidate>(name: string, candidates: readonly T[]): T | undefined {
  const wanted = normalizeName(name);
  if (!wanted) return undefined;
  const matches = candidates.filter((c) => normalizeName(c.displayName) === wanted);
  return matches.length === 1 ? matches[0] : undefined;
}
