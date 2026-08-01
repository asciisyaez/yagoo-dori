import { z } from "zod";

export const TeamCalculatorBloomStageSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const TeamCalculatorOwnedCardSchema = z
  .object({
    cardId: z.string().min(1),
    bloomStage: TeamCalculatorBloomStageSchema,
  })
  .strict();

export const TeamCalculatorOshiRoleSchema = z.enum([
  "member",
  "leader",
  "member-and-leader",
]);

export const TeamCalculatorOshiSchema = z
  .object({
    talentId: z.string().min(1),
    role: TeamCalculatorOshiRoleSchema,
  })
  .strict();

export const TeamCalculatorRequestSchema = z
  .object({
    schemaVersion: z.literal(3),
    rosterCommit: z.string().regex(/^[a-f0-9]{40}$/),
    ownedCards: z.array(TeamCalculatorOwnedCardSchema).min(5),
    oshi: TeamCalculatorOshiSchema.optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const seenCardIds = new Set<string>();
    request.ownedCards.forEach((ownedCard, index) => {
      if (seenCardIds.has(ownedCard.cardId)) {
        context.addIssue({
          code: "custom",
          path: ["ownedCards", index, "cardId"],
          message: `Duplicate owned card: ${ownedCard.cardId}`,
        });
      }
      seenCardIds.add(ownedCard.cardId);
    });
  });

const UtilityIntervalSchema = z
  .object({
    lower: z.number().finite(),
    central: z.number().finite(),
    upper: z.number().finite(),
  })
  .strict()
  .superRefine((interval, context) => {
    if (interval.lower > interval.central || interval.central > interval.upper) {
      context.addIssue({ code: "custom", message: "Utility interval bounds must be ordered" });
    }
  });

const CalculatorCardSchema = z
  .object({
    cardId: z.string().min(1),
    slug: z.string().min(1),
    talentId: z.string().min(1),
    talentName: z.string().min(1),
    title: z.string().min(1),
    rarity: z.union([z.literal(4), z.literal(5)]),
    attribute: z.enum(["cute", "pure", "happy"]),
    artPath: z.string().startsWith("/game/cards/"),
    illustrationPath: z.string().startsWith("/game/illustrations/"),
  })
  .strict();

export const TeamCalculatorResultSchema = z
  .object({
    kind: z.literal("owned-roster-team-calculation"),
    schemaVersion: z.literal(3),
    methodologyVersion: z.literal("yd-owned-roster-calculator-3.0.0"),
    roster: z
      .object({
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        ownedCardCount: z.number().int().min(5),
        ownedTalentCount: z.number().int().min(5),
      })
      .strict(),
    oshi: z
      .object({
        talentId: z.string().min(1),
        talentName: z.string().min(1),
        role: TeamCalculatorOshiRoleSchema,
        roleLabel: z.enum([
          "Must include as Member",
          "Must use as Leader Outfit",
          "Must include as Member and use as Leader Outfit",
        ]),
        eligibleOwnedMemberCardIds: z.array(z.string().min(1)).min(1),
        eligibleOwnedLeaderCardIds: z.array(z.string().min(1)).min(1),
        resolution: z
          .object({
            member: z
              .object({
                status: z.enum(["fulfilled", "not-required"]),
                selectedCardId: z.string().min(1).nullable(),
              })
              .strict(),
            leader: z
              .object({
                status: z.enum(["fulfilled", "not-required"]),
                selectedCardId: z.string().min(1).nullable(),
              })
              .strict(),
            overallStatus: z.literal("fulfilled"),
          })
          .strict(),
      })
      .strict()
      .nullable(),
    corpus: z
      .object({
        benchmarkId: z.string().min(1),
        entriesSha256: z.string().regex(/^[a-f0-9]{64}$/),
        difficulty: z.literal("expert"),
        weighting: z.literal("equal-per-chart"),
        chartCount: z.literal(30),
        referenceChartCount: z.literal(21),
        currentChartCount: z.literal(9),
        referenceSharePermil: z.literal(700),
        currentSharePermil: z.literal(300),
        charts: z
          .array(
            z
              .object({
                chartKey: z.string().regex(/^m\d{4}:expert$/),
                segment: z.enum(["reference", "current"]),
              })
              .strict(),
          )
          .length(30),
      })
      .strict(),
    score: z
      .object({
        kind: z.literal("representative-corpus-average-relative-utility"),
        absoluteLiveScoreAvailable: z.literal(false),
        relativeUtility: UtilityIntervalSchema,
        referenceAverage: UtilityIntervalSchema,
        currentAverage: UtilityIntervalSchema,
      })
      .strict(),
    leader: CalculatorCardSchema.extend({
      outfitName: z.string().min(1),
      sourceCardBloomStage: TeamCalculatorBloomStageSchema,
    }).strict(),
    members: z
      .array(
        CalculatorCardSchema.extend({
          bloomStage: TeamCalculatorBloomStageSchema,
        }).strict(),
      )
      .length(5),
    synergies: z.array(
      z
        .object({
          source: z.enum(["leader", "passive"]),
          sourceCardId: z.string().min(1),
          effectGroupId: z.string().min(1),
          effectKind: z.enum([
            "performance-up",
            "technique-up",
            "sense-up",
            "all-parameters-up",
          ]),
          valuePermil: z.number().int().nonnegative(),
          recipientAlternatives: z.array(z.array(z.string().min(1)).min(1)).min(1),
          resolution: z.enum(["resolved", "multiple-possible-recipients"]),
          activeChartCount: z.number().int().min(1).max(30),
          corpusChartCount: z.literal(30),
          activationSharePermil: z.number().int().min(1).max(1_000),
        })
        .strict(),
    ),
    alternatives: z
      .array(
        z
          .object({
            replacesCardId: z.string().min(1),
            fixedLeaderCardId: z.string().min(1),
            comparisonBasis: z.literal(
              "fixed-selected-leader-and-canonical-order-across-representative-corpus",
            ),
            lossSignConvention: z.literal("positive-means-selected-team-is-better"),
            coverage: z
              .object({
                selectionMethod: z.enum([
                  "exhaustive-full-corpus",
                  "bounded-two-stage-screen",
                ]),
                eligibleCardCount: z.number().int().nonnegative(),
                coarseScreenedCardCount: z.number().int().nonnegative(),
                corpusProxyScreenedCardCount: z.number().int().nonnegative(),
                fullCorpusRerankedCardCount: z.number().int().nonnegative(),
                returnedCardCount: z.number().int().min(0).max(3),
              })
              .strict(),
            cards: z
              .array(
                CalculatorCardSchema.extend({
                  bloomStage: TeamCalculatorBloomStageSchema,
                  relativeUtility: UtilityIntervalSchema,
                  modeledUtilityLoss: UtilityIntervalSchema,
                }).strict(),
              )
              .max(3),
          })
          .strict(),
      )
      .length(5),
    formationOrder: z
      .object({
        kind: z.enum(["modeled-general", "timed-corpus"]),
        status: z.enum(["modeled-general", "timed-corpus", "indeterminate"]),
        label: z.enum(["Suggested general order", "Chart-timed corpus order"]),
        methodologyVersion: z.enum([
          "yd-formation-order-modeled-general-1.0.0",
          "yd-formation-order-timed-corpus-1.0.0",
        ]),
        cardIds: z.array(z.string().min(1)).length(5),
        exactTimelineAvailable: z.boolean(),
        changesModeledTimingUtility: z.boolean(),
        permutationsChecked: z.literal(120),
        corpusChartCount: z.literal(30),
        markerLayoutCount: z.number().int().positive(),
        timingScenarioCount: z.number().int().positive(),
        activeFirstCheck: z.literal("one-cooldown-after-live-start"),
        confidence: z
          .object({
            kind: z.enum(["modeled-general", "timed-corpus", "indeterminate"]),
            winSharePermil: z.number().finite().min(0).max(1_000),
            runnerUpGapPermil: z.number().finite().nonnegative(),
            maxRegretPermil: z.number().finite().nonnegative(),
            meanRegretPermil: z.number().finite().nonnegative(),
            statement: z.string().min(1),
          })
          .strict(),
        members: z
          .array(
            z
              .object({
                cardId: z.string().min(1),
                slot: z.number().int().min(1).max(5),
                bloomStage: TeamCalculatorBloomStageSchema,
                active: z
                  .object({
                    level: z.number().int().positive(),
                    cooldownMilliseconds: z.number().int().positive(),
                    durationMilliseconds: z.number().int().positive(),
                    activationProbabilityPermil: z.number().int().min(0).max(1_000),
                    persistentSupportPermilAcrossCorpus: z
                      .object({
                        minimum: z.number().finite().nonnegative(),
                        maximum: z.number().finite().nonnegative(),
                      })
                      .strict(),
                  })
                  .strict(),
                special: z
                  .object({
                    level: z.number().int().positive(),
                    durationMilliseconds: z.number().int().positive(),
                    scoreSupportPermilAtFullComboWithoutSongMatch: z.number().finite().nonnegative(),
                    activationRateUpPermilAtFullComboWithoutSongMatch: z.number().finite().nonnegative(),
                    comboGateThresholds: z.array(z.number().int().nonnegative()),
                  })
                  .strict(),
              })
              .strict(),
          )
          .length(5),
      })
      .strict(),
    search: z
      .object({
        resultClaim: z.enum([
          "certified-within-canonical-corpus-scope",
          "bounded-search",
        ]),
        certificateKind: z.enum(["certified", "heuristic-bounded"]),
        optimalityClaim: z.enum([
          "exhaustive-across-constraint-eligible-teams-leaders-and-frozen-corpus-under-canonical-order",
          "not-certified",
        ]),
        objective: z.literal("equal-chart-average-relative-utility"),
        comparisonOrder: z.literal("canonical-card-id-order"),
        teamSetsInScope: z.number().int().nonnegative(),
        teamSetsConsidered: z.number().int().nonnegative(),
        unsearchedTeamSets: z.number().int().nonnegative(),
        candidateGenerationMode: z.enum(["exhaustive", "bounded-native-search"]),
        candidateGenerationChartCount: z.number().int().min(0).max(30),
        candidateGenerationChartKeys: z.array(z.string().regex(/^m\d{4}:expert$/)).max(5),
        initialLeaderTeamFormationsReranked: z.number().int().positive(),
        searchLeaderTeamFormationsReranked: z.number().int().positive(),
        replacementLeaderTeamFormationsReranked: z.number().int().nonnegative(),
        localRefinementScope: z.enum([
          "not-needed-exhaustive",
          "two-stage-screened-one-member-swap-or-leader-change",
        ]),
        localRefinementStatus: z.enum([
          "not-needed-exhaustive",
          "fixed-point",
          "cycle-guard",
          "iteration-cap",
          "bounded-pass-complete",
        ]),
        localRefinementIterations: z.number().int().nonnegative(),
        candidateGenerationUtilityEvaluations: z.number().int().nonnegative(),
        corpusUtilityEvaluations: z.number().int().positive(),
        utilityEvaluations: z.number().int().positive(),
        formationOrderGloballyCertified: z.literal(false),
        canonicalCorpusOptimalityClaim: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((result, context) => {
    const memberCardIds = result.members.map((member) => member.cardId);
    const memberCardIdSet = new Set(memberCardIds);
    if (memberCardIdSet.size !== 5) {
      context.addIssue({ code: "custom", path: ["members"], message: "Member cards must be unique" });
    }
    if (new Set(result.members.map((member) => member.talentId)).size !== 5) {
      context.addIssue({ code: "custom", path: ["members"], message: "Member talents must be unique" });
    }
    const orderCardIds = result.formationOrder.cardIds;
    const orderComponents = result.formationOrder.members;
    const timedOrder = result.formationOrder.kind === "timed-corpus";
    const orderDiscriminatorMismatch = timedOrder
      ? result.formationOrder.label !== "Chart-timed corpus order" ||
        result.formationOrder.methodologyVersion !== "yd-formation-order-timed-corpus-1.0.0" ||
        !result.formationOrder.exactTimelineAvailable ||
        !result.formationOrder.changesModeledTimingUtility ||
        !["timed-corpus", "indeterminate"].includes(result.formationOrder.status)
      : result.formationOrder.label !== "Suggested general order" ||
        result.formationOrder.methodologyVersion !== "yd-formation-order-modeled-general-1.0.0" ||
        result.formationOrder.exactTimelineAvailable ||
        result.formationOrder.changesModeledTimingUtility ||
        !["modeled-general", "indeterminate"].includes(result.formationOrder.status);
    if (
      orderDiscriminatorMismatch ||
      result.formationOrder.status !== result.formationOrder.confidence.kind ||
      result.formationOrder.timingScenarioCount !==
        result.formationOrder.corpusChartCount * result.formationOrder.markerLayoutCount ||
      new Set(orderCardIds).size !== 5 ||
      orderCardIds.some((cardId, index) => cardId !== memberCardIds[index]) ||
      orderComponents.some(
        (component, index) =>
          component.cardId !== orderCardIds[index] ||
          component.slot !== index + 1 ||
          component.bloomStage !== result.members[index]?.bloomStage ||
          component.active.persistentSupportPermilAcrossCorpus.minimum >
            component.active.persistentSupportPermilAcrossCorpus.maximum,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["formationOrder"],
        message: "Formation order must match the five displayed Members and modeled timing summary",
      });
    }
    if (result.oshi) {
      const memberRequired =
        result.oshi.role === "member" || result.oshi.role === "member-and-leader";
      const leaderRequired =
        result.oshi.role === "leader" || result.oshi.role === "member-and-leader";
      const expectedRoleLabel = {
        member: "Must include as Member",
        leader: "Must use as Leader Outfit",
        "member-and-leader": "Must include as Member and use as Leader Outfit",
      }[result.oshi.role];
      const selectedMember = result.members.find(
        (member) => member.cardId === result.oshi?.resolution.member.selectedCardId,
      );
      const selectedLeaderMatches =
        result.leader.cardId === result.oshi.resolution.leader.selectedCardId;
      const eligibleMemberIds = result.oshi.eligibleOwnedMemberCardIds;
      const eligibleLeaderIds = result.oshi.eligibleOwnedLeaderCardIds;
      if (
        result.oshi.roleLabel !== expectedRoleLabel ||
        result.oshi.resolution.member.status !== (memberRequired ? "fulfilled" : "not-required") ||
        result.oshi.resolution.leader.status !== (leaderRequired ? "fulfilled" : "not-required") ||
        (!memberRequired && result.oshi.resolution.member.selectedCardId !== null) ||
        (!leaderRequired && result.oshi.resolution.leader.selectedCardId !== null) ||
        (result.oshi.resolution.member.selectedCardId !== null &&
          (!selectedMember ||
            selectedMember.talentId !== result.oshi.talentId ||
            !eligibleMemberIds.includes(result.oshi.resolution.member.selectedCardId))) ||
        (memberRequired && !selectedMember) ||
        (result.oshi.resolution.leader.selectedCardId !== null &&
          (!selectedLeaderMatches ||
            result.leader.talentId !== result.oshi.talentId ||
            !eligibleLeaderIds.includes(result.oshi.resolution.leader.selectedCardId))) ||
        (leaderRequired && !selectedLeaderMatches) ||
        new Set(eligibleMemberIds).size !== eligibleMemberIds.length ||
        new Set(eligibleLeaderIds).size !== eligibleLeaderIds.length ||
        eligibleMemberIds.some((cardId) => !eligibleLeaderIds.includes(cardId)) ||
        eligibleLeaderIds.some((cardId) => !eligibleMemberIds.includes(cardId))
      ) {
        context.addIssue({
          code: "custom",
          path: ["oshi"],
          message: "Oshi selection and fulfillment must match the requested role",
        });
      }
    }
    if (new Set(result.corpus.charts.map((chart) => chart.chartKey)).size !== 30) {
      context.addIssue({ code: "custom", path: ["corpus", "charts"], message: "Corpus charts must be unique" });
    }
    if (
      result.corpus.charts.filter((chart) => chart.segment === "reference").length !== 21 ||
      result.corpus.charts.filter((chart) => chart.segment === "current").length !== 9
    ) {
      context.addIssue({ code: "custom", path: ["corpus", "charts"], message: "Corpus segment counts must retain 70:30" });
    }
    (["lower", "central", "upper"] as const).forEach((bound) => {
      const expected =
        (result.score.referenceAverage[bound] * 21 + result.score.currentAverage[bound] * 9) / 30;
      if (Math.abs(result.score.relativeUtility[bound] - expected) > 0.000_01) {
        context.addIssue({
          code: "custom",
          path: ["score", "relativeUtility", bound],
          message: "Overall utility must equal the 21:9 weighted segment averages",
        });
      }
    });
    result.synergies.forEach((synergy, synergyIndex) => {
      if (synergy.source === "leader" && synergy.sourceCardId !== result.leader.cardId) {
        context.addIssue({
          code: "custom",
          path: ["synergies", synergyIndex, "sourceCardId"],
          message: "Leader synergy must come from the selected Leader card",
        });
      }
      if (synergy.source === "passive" && !memberCardIdSet.has(synergy.sourceCardId)) {
        context.addIssue({
          code: "custom",
          path: ["synergies", synergyIndex, "sourceCardId"],
          message: "Passive synergy must come from a selected Member card",
        });
      }
      if (synergy.activationSharePermil !== Math.round((synergy.activeChartCount * 1_000) / 30)) {
        context.addIssue({
          code: "custom",
          path: ["synergies", synergyIndex, "activationSharePermil"],
          message: "Synergy activation share must match its chart coverage",
        });
      }
      synergy.recipientAlternatives.forEach((alternative, alternativeIndex) => {
        if (alternative.some((cardId) => !memberCardIdSet.has(cardId))) {
          context.addIssue({
            code: "custom",
            path: ["synergies", synergyIndex, "recipientAlternatives", alternativeIndex],
            message: "Synergy recipients must be selected Member cards",
          });
        }
      });
    });
    const replacementKeys = result.alternatives.map((alternative) => alternative.replacesCardId);
    if (
      new Set(replacementKeys).size !== 5 ||
      replacementKeys.some((cardId) => !memberCardIdSet.has(cardId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["alternatives"],
        message: "Replacement groups must cover each selected Member exactly once",
      });
    }
    result.alternatives.forEach((alternative, alternativeIndex) => {
      const coverage = alternative.coverage;
      if (
        alternative.fixedLeaderCardId !== result.leader.cardId ||
        coverage.returnedCardCount !== alternative.cards.length ||
        coverage.returnedCardCount > coverage.fullCorpusRerankedCardCount ||
        new Set(alternative.cards.map((card) => card.cardId)).size !== alternative.cards.length ||
        alternative.cards.some((card) => memberCardIdSet.has(card.cardId))
      ) {
        context.addIssue({
          code: "custom",
          path: ["alternatives", alternativeIndex],
          message: "Replacement identity and returned coverage must reconcile",
        });
      }
      if (result.oshi && result.oshi.resolution.member.status === "fulfilled") {
        const remainingTalentIds = result.members
          .filter((member) => member.cardId !== alternative.replacesCardId)
          .map((member) => member.talentId);
        if (
          alternative.cards.some(
            (card) =>
              !remainingTalentIds.includes(result.oshi!.talentId) &&
              card.talentId !== result.oshi!.talentId,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["alternatives", alternativeIndex, "cards"],
            message: "Member replacements must preserve the Oshi constraint",
          });
        }
      }
      const exhaustive = coverage.selectionMethod === "exhaustive-full-corpus";
      if (
        (exhaustive &&
          (coverage.coarseScreenedCardCount !== 0 ||
            coverage.corpusProxyScreenedCardCount !== 0 ||
            coverage.fullCorpusRerankedCardCount !== coverage.eligibleCardCount)) ||
        (!exhaustive &&
          (coverage.coarseScreenedCardCount !== coverage.eligibleCardCount ||
            coverage.corpusProxyScreenedCardCount > coverage.coarseScreenedCardCount ||
            coverage.fullCorpusRerankedCardCount > coverage.corpusProxyScreenedCardCount))
      ) {
        context.addIssue({
          code: "custom",
          path: ["alternatives", alternativeIndex, "coverage"],
          message: "Replacement screening coverage must match its selection method",
        });
      }
    });
    if (
      result.search.teamSetsConsidered > result.search.teamSetsInScope ||
      result.search.teamSetsInScope - result.search.teamSetsConsidered !== result.search.unsearchedTeamSets
    ) {
      context.addIssue({ code: "custom", path: ["search"], message: "Search coverage counts must reconcile" });
    }
    if (
      result.search.candidateGenerationChartKeys.length !==
        result.search.candidateGenerationChartCount ||
      result.search.candidateGenerationChartKeys.some(
        (chartKey) => !result.corpus.charts.some((chart) => chart.chartKey === chartKey),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["search", "candidateGenerationChartKeys"],
        message: "Candidate-generation charts must be an explicit subset of the frozen corpus",
      });
    }
    const generationCharts = result.search.candidateGenerationChartKeys.map((chartKey) =>
      result.corpus.charts.find((chart) => chart.chartKey === chartKey),
    );
    if (
      result.search.candidateGenerationMode === "bounded-native-search" &&
      (generationCharts.filter((chart) => chart?.segment === "reference").length !== 3 ||
        generationCharts.filter((chart) => chart?.segment === "current").length !== 2)
    ) {
      context.addIssue({
        code: "custom",
        path: ["search", "candidateGenerationChartKeys"],
        message: "Bounded candidate generation must retain the frozen 3:2 reference/current mix",
      });
    }
    if (
      (result.search.resultClaim === "certified-within-canonical-corpus-scope" &&
        (!result.search.canonicalCorpusOptimalityClaim ||
          result.search.certificateKind !== "certified" ||
          result.search.optimalityClaim !==
            "exhaustive-across-constraint-eligible-teams-leaders-and-frozen-corpus-under-canonical-order" ||
          result.search.candidateGenerationMode !== "exhaustive" ||
          result.search.candidateGenerationChartCount !== 0 ||
          result.search.unsearchedTeamSets !== 0 ||
          result.search.teamSetsConsidered !== result.search.teamSetsInScope ||
          result.search.localRefinementStatus !== "not-needed-exhaustive" ||
          result.search.localRefinementScope !== "not-needed-exhaustive" ||
          result.search.localRefinementIterations !== 0)) ||
      (result.search.resultClaim === "bounded-search" &&
        (result.search.canonicalCorpusOptimalityClaim ||
          result.search.certificateKind !== "heuristic-bounded" ||
          result.search.optimalityClaim !== "not-certified" ||
          result.search.candidateGenerationMode !== "bounded-native-search" ||
          result.search.candidateGenerationChartCount !== 5 ||
          result.search.unsearchedTeamSets === 0 ||
          result.search.localRefinementStatus === "not-needed-exhaustive" ||
          result.search.localRefinementScope !==
            "two-stage-screened-one-member-swap-or-leader-change"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["search", "resultClaim"],
        message: "The public result claim must match the search certificate",
      });
    }
    if (
      result.search.searchLeaderTeamFormationsReranked <
        result.search.initialLeaderTeamFormationsReranked ||
      result.search.teamSetsConsidered > result.search.searchLeaderTeamFormationsReranked ||
      result.search.utilityEvaluations !==
        result.search.candidateGenerationUtilityEvaluations +
          result.search.corpusUtilityEvaluations
    ) {
      context.addIssue({
        code: "custom",
        path: ["search"],
        message: "Team-set, Leader-team formation, and utility counts must remain distinct",
      });
    }
  });

export type TeamCalculatorBloomStage = z.infer<typeof TeamCalculatorBloomStageSchema>;
export type TeamCalculatorOwnedCard = z.infer<typeof TeamCalculatorOwnedCardSchema>;
export type TeamCalculatorOshiRole = z.infer<typeof TeamCalculatorOshiRoleSchema>;
export type TeamCalculatorOshi = z.infer<typeof TeamCalculatorOshiSchema>;
export type TeamCalculatorRequest = z.infer<typeof TeamCalculatorRequestSchema>;
export type TeamCalculatorResult = z.infer<typeof TeamCalculatorResultSchema>;
