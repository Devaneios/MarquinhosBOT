export type AlbumMilestone = {
  patternIds: string[];
  completedAt: number;
  revisedAt: number | null;
  status: 'completed' | 'revised';
};

export function reconcileAlbumMilestone(
  existing: AlbumMilestone | null,
  catalogIds: readonly string[],
  contributed: ReadonlySet<string>,
  now: number,
): AlbumMilestone | null {
  if (!existing) {
    if (!catalogIds.length || !catalogIds.every((id) => contributed.has(id)))
      return null;
    return {
      patternIds: [...catalogIds],
      completedAt: now,
      revisedAt: null,
      status: 'completed',
    };
  }
  const complete = existing.patternIds.every((id) => contributed.has(id));
  const status = complete ? 'completed' : 'revised';
  return status === existing.status
    ? existing
    : { ...existing, status, revisedAt: now };
}
