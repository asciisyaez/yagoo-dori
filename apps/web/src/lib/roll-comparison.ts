type ComparableTeam = {
  leader: { cardId: string };
  members: { cardId: string }[];
  score: { relativeUtility: { central: number } };
};

/** An optional acquisition must beat the incumbent and actually participate. */
export function selectAcquisitionTeam<T extends ComparableTeam>(baseline: T, candidate: T, cardId: string): T {
  const participates = candidate.leader.cardId === cardId || candidate.members.some((member) => member.cardId === cardId);
  return participates && candidate.score.relativeUtility.central > baseline.score.relativeUtility.central
    ? candidate
    : baseline;
}
