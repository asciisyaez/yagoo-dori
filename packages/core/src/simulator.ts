import { dataIndex, researchBundle } from "./data";
import type { LeaderOutfit, MemberCard } from "./schemas";

export type PlayMode = "manual" | "auto";

export type ChartContext = {
  id: string;
  archetype: "balanced" | "burst" | "combo" | "technical";
  primaryType: MemberCard["type"];
  weight: number;
  noteDensity: number;
};

export type UtilityBreakdown = {
  basePower: number;
  chartAffinity: number;
  skillValue: number;
  synergyValue: number;
  leaderValue: number;
  total: number;
};

function interpolatePower(card: MemberCard, investment: number) {
  const clamped = Math.max(0, Math.min(1, investment));
  const points = [...card.progression].sort((a, b) => a.investment - b.investment);
  const exact = points.find((point) => point.investment === clamped);
  if (exact) return exact.power;
  const upperIndex = points.findIndex((point) => point.investment > clamped);
  if (upperIndex <= 0) return points[0]!.power;
  if (upperIndex === -1) return points.at(-1)!.power;
  const lower = points[upperIndex - 1]!;
  const upper = points[upperIndex]!;
  const ratio = (clamped - lower.investment) / (upper.investment - lower.investment);
  return lower.power + (upper.power - lower.power) * ratio;
}

function skillContribution(
  card: MemberCard,
  team: MemberCard[],
  powers: Map<string, number>,
  basePower: number,
  mode: PlayMode,
  chart: ChartContext,
) {
  return card.skillIds.reduce((total, skillId) => {
    const skill = dataIndex.skills.get(skillId);
    if (!skill) return total;

    const executionFactor = mode === "auto" && ["combo-threshold", "note-window"].includes(skill.trigger) ? 0.72 : 1;
    const durationFactor = skill.durationSeconds === 0 ? 1 : Math.min(1, skill.durationSeconds / 10);
    const densityFactor = skill.trigger === "combo-threshold" ? chart.noteDensity : 1;
    const activation = skill.activationProbability * executionFactor * durationFactor * densityFactor;
    const sameType = team.filter((member) => member.type === card.type);

    if (skill.trigger === "same-type-count" && sameType.length < 3) return total;
    if (skill.category === "team-boost") return total + basePower * skill.effectValue * activation;
    if (skill.category === "type-boost") {
      const targetPower = sameType.reduce((sum, member) => sum + (powers.get(member.id) ?? 0), 0);
      return total + targetPower * skill.effectValue * activation;
    }
    return total + (powers.get(card.id) ?? 0) * skill.effectValue * activation;
  }, 0);
}

function pairSynergy(team: MemberCard[], powers: Map<string, number>) {
  let value = 0;
  for (let left = 0; left < team.length; left += 1) {
    for (let right = left + 1; right < team.length; right += 1) {
      const a = team[left]!;
      const b = team[right]!;
      const shared = a.synergyTags.filter((tag) => b.synergyTags.includes(tag));
      const pairPower = Math.min(powers.get(a.id) ?? 0, powers.get(b.id) ?? 0);
      value += pairPower * shared.length * 0.015;
    }
  }
  return value;
}

export function simulateTeam(
  team: MemberCard[],
  leader: LeaderOutfit,
  chart: ChartContext,
  investment: number,
  mode: PlayMode,
): UtilityBreakdown {
  if (team.length === 0) {
    return { basePower: 0, chartAffinity: 0, skillValue: 0, synergyValue: 0, leaderValue: 0, total: 0 };
  }

  const powers = new Map(team.map((card) => [card.id, interpolatePower(card, investment)]));
  const basePower = team.reduce((sum, card) => sum + powers.get(card.id)!, 0);
  const chartAffinity = team.reduce(
    (sum, card) => sum + (card.type === chart.primaryType ? powers.get(card.id)! * 0.08 : 0),
    0,
  );
  const skillValue = team.reduce(
    (sum, card) => sum + skillContribution(card, team, powers, basePower, mode, chart),
    0,
  );
  const synergyValue = pairSynergy(team, powers);
  const preLeader = basePower + chartAffinity + skillValue + synergyValue;
  const preferredPower = team
    .filter((card) => leader.preferredTypes.includes(card.type))
    .reduce((sum, card) => sum + powers.get(card.id)!, 0);
  const leaderTagMatches = team.reduce(
    (sum, card) => sum + card.synergyTags.filter((tag) => leader.synergyTags.includes(tag)).length,
    0,
  );
  const leaderValue =
    preLeader * (leader.teamPowerMultiplier - 1) +
    preferredPower * 0.03 +
    preLeader * Math.min(0.06, leaderTagMatches * 0.004);

  return {
    basePower,
    chartAffinity,
    skillValue,
    synergyValue,
    leaderValue,
    total: preLeader + leaderValue,
  };
}

function factorial(value: number): number {
  if (value <= 1) return 1;
  return value * factorial(value - 1);
}

export function exactShapleyContributions(
  team: MemberCard[],
  leader: LeaderOutfit,
  chart: ChartContext,
  investment: number,
  mode: PlayMode,
) {
  const size = team.length;
  const denominator = factorial(size);
  const result = new Map<string, number>();

  for (let cardIndex = 0; cardIndex < size; cardIndex += 1) {
    let contribution = 0;
    const others = team.filter((_, index) => index !== cardIndex);
    const card = team[cardIndex]!;
    for (let mask = 0; mask < 2 ** others.length; mask += 1) {
      const coalition = others.filter((_, index) => (mask & (1 << index)) !== 0);
      const coalitionValue = simulateTeam(coalition, leader, chart, investment, mode).total;
      const withCardValue = simulateTeam([...coalition, card], leader, chart, investment, mode).total;
      const subsetSize = coalition.length;
      const weight = (factorial(subsetSize) * factorial(size - subsetSize - 1)) / denominator;
      contribution += weight * (withCardValue - coalitionValue);
    }
    result.set(card.id, contribution);
  }

  return result;
}

export const representativeCharts: ChartContext[] = [
  { id: "season-balanced", archetype: "balanced", primaryType: "smile", weight: 0.35, noteDensity: 1 },
  { id: "season-burst", archetype: "burst", primaryType: "vocal", weight: 0.35, noteDensity: 0.95 },
  { id: "current-combo", archetype: "combo", primaryType: "dance", weight: 0.3, noteDensity: 1.08 },
];

export const defaultLeader = researchBundle.leaders[0]!;

