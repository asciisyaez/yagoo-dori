import { simulateTeam, type ChartContext, type PlayMode } from "./simulator";
import type { LeaderOutfit, MemberCard } from "./schemas";

type OptimizeInput = {
  cards: MemberCard[];
  leader: LeaderOutfit;
  chart: ChartContext;
  investment: number;
  mode: PlayMode;
  anchorCardId?: string;
};

export type OptimizedTeam = {
  cards: MemberCard[];
  score: number;
};

export function combinations<T>(values: T[], choose: number): T[][] {
  if (choose === 0) return [[]];
  if (values.length < choose) return [];
  const results: T[][] = [];

  const visit = (start: number, selected: T[]) => {
    if (selected.length === choose) {
      results.push([...selected]);
      return;
    }
    for (let index = start; index <= values.length - (choose - selected.length); index += 1) {
      selected.push(values[index]!);
      visit(index + 1, selected);
      selected.pop();
    }
  };

  visit(0, []);
  return results;
}

export function optimizeTeam(input: OptimizeInput): OptimizedTeam {
  const legalTeams = combinations(input.cards, 5).filter(
    (team) => !input.anchorCardId || team.some((card) => card.id === input.anchorCardId),
  );
  if (legalTeams.length === 0) {
    throw new Error("No legal five-Member formation matches the requested constraints");
  }

  const scored = legalTeams.map((cards) => ({
    cards,
    score: simulateTeam(cards, input.leader, input.chart, input.investment, input.mode).total,
  }));

  return scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.cards.map((card) => card.id).sort().join("|").localeCompare(right.cards.map((card) => card.id).sort().join("|"));
  })[0]!;
}

