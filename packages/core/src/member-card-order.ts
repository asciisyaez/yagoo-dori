export type PublicMemberCardOrder = Readonly<{
  generationOrder: number;
  talentId: string;
  rarity: 4 | 5;
  title: string;
  id: string;
}>;

export function comparePublicMemberCards(left: PublicMemberCardOrder, right: PublicMemberCardOrder): number {
  return left.generationOrder - right.generationOrder
    || left.talentId.localeCompare(right.talentId)
    || right.rarity - left.rarity
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id);
}
