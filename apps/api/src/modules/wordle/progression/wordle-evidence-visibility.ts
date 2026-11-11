export function visibleWordleEvidence<T extends { date: string }>(
  evidence: T | null | undefined,
  ownerId: string,
  viewerId: string,
  today: string,
): T | null {
  return evidence && (ownerId === viewerId || evidence.date < today)
    ? evidence
    : null;
}
