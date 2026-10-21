/**
 * i18n Type System
 *
 * Defines the strict schema for all translation dictionaries. The `en.json`
 * file is the Single Source of Truth; every other locale must be structurally
 * compatible with this interface.
 *
 * CONTRIBUTING A NEW LOCALE
 * --------------------------
 * 1. Create `apps/web/src/locales/<code>.json` following this interface exactly.
 * 2. Add the locale to SUPPORTED_LOCALES in `config.ts`.
 * 3. Run `pnpm i18n:check` to verify completeness before opening a PR.
 *
 * NON-TRANSLATABLE TERMS
 * ----------------------
 * The following MUST NOT be translated in any locale file — use the exact
 * English strings from the game / brand as-is:
 *   - Talent names (e.g. "Tokino Sora", "Usada Pekora")
 *   - Card titles (e.g. "A Flower in Full Bloom")
 *   - Leader Outfit names (e.g. "Bright Bouquet")
 *   - Song names and chart difficulties (Normal, Hard, Expert, Master)
 *   - Generation / branch names (Gen 0, Gen 1, GAMERS, holoX, Advent …)
 *   - Attribute names: Cute, Pure, Happy
 *   - Stat names: Performance, Technique, Sense
 *   - Skill categories: Active Skill, Passive Skill, Special Skill, Leader Skill
 *   - Mechanics: Bloom, Potential, Skill Tree, Connect Effect, Oshi
 *   - Score terms: Live Score, Combo, Normal Note, Skill Note, Chart, Timeline
 *   - Tier labels: SS, S, A, B, C, D
 *   - Navigation tool names: Team Builder, Roll Compare, Database, Tier List,
 *                            Cards & Outfits, Guides
 *   - Legal footer (must appear verbatim):
 *       "Unofficial fan site; not affiliated with COVER Corp. or QualiArts."
 */

/** Flat dot-notation key for a translation entry (used by the `t()` helper). */
export type TranslationKey = DotPaths<Dictionary>;

/** A locale dictionary — every locale file must satisfy this shape. */
export type Dictionary = {
  common: {
    /** "All" label used in filter buttons */
    all: string;
    /** "New" chip on cards */
    new: string;
    /** Generic search placeholder */
    searchPlaceholder: string;
    /** aria-label for clear-search button */
    clearSearch: string;
    /** "Reset" label on filter-reset button */
    reset: string;
    /** Shown when count is exactly 1 (e.g. "1 card") */
    card_one: string;
    /** Shown when count ≠ 1 (e.g. "5 cards") */
    card_other: string;
  };

  nav: {
    /** Screen-reader label for "Skip to content" link */
    skipToContent: string;
    /** aria-label for the primary sidebar brand link */
    homeLabel: string;
    /** Small sub-title under the brand mark */
    subTitle: string;
    /** Nav group: "Overview" */
    groupOverview: string;
    /** Nav group: "Database" */
    groupDatabase: string;
    /** Nav group: "Rankings" */
    groupRankings: string;
    /** Nav group: "Tools" */
    groupTools: string;
    /** Nav group: "Learn" */
    groupLearn: string;
    /** Nav item labels */
    home: string;
    cardsAndOutfits: string;
    talents: string;
    tierList: string;
    teamCalculator: string;
    rollCompare: string;
    teamGuides: string;
    /** Mobile menu button labels */
    openMenu: string;
    closeMenu: string;
    /** Mobile drawer heading */
    drawerHeading: string;
    drawerSubHeading: string;
    /** Language switcher */
    language: string;
  };

  home: {
    kicker: string;
    headline: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    statMemberCards: string;
    statTalents: string;
    statFiveStar: string;
    memberSpotlight: string;
    /** Banner section */
    featuredBanner: string;
    bannerKicker: string;
    newFiveStar: string;
    featured: string;
    newEventTracks: string;
    endsJst: string;
    browseFiveStar: string;
    newEventTracksHeading: string;
    /** Quick-link section */
    startHere: string;
    getToAnswer: string;
    cardsSkillsRoles: string;
    /** Quick-links cards */
    qlRankingsEyebrow: string;
    qlRankingsTitle: string;
    qlRankingsText: string;
    qlRankingsStat: string;
    qlFindCardEyebrow: string;
    qlFindCardTitle: string;
    qlFindCardText: string;
    qlCompareLeaderEyebrow: string;
    qlCompareLeaderTitle: string;
    qlCompareLeaderText: string;
    /** Latest additions section */
    latestAdditions: string;
    newestFiveStar: string;
    viewEveryFiveStar: string;
    /** Browse section */
    browseGame: string;
    planTeam: string;
    allLinkedCards: string;
    statsSkillsArtwork: string;
    teamWideEffects: string;
    exactFormations: string;
  };

  catalog: {
    /** Context tab labels */
    memberCards: string;
    leaderOutfits: string;
    /** Filter labels */
    searchMemberCards: string;
    searchOutfits: string;
    searchCardsPlaceholder: string;
    searchOutfitsPlaceholder: string;
    rarityFilter: string;
    attributeFilter: string;
    generationFilter: string;
    allTypes: string;
    allGenerations: string;
    /** Sort */
    sortLabel: string;
    sortGeneration: string;
    sortNewest: string;
    sortOldest: string;
    /** Result count e.g. "32 / 142" */
    resultCount: string;
    /** "From {title}" label in outfit row */
    fromCard: string;
    /** "{n}★ unlock" label on outfit rarity badge */
    unlockSuffix: string;
    /** Empty state */
    noMatchingOutfits: string;
    noMatchingCards: string;
    noMatchingHint: string;
  };

  tierList: {
    pageTitle: string;
    pageDescription: string;
    /** Context tabs */
    memberCards: string;
    memberCardsCaption: string;
    leaderOutfits: string;
    leaderOutfitsCaption: string;
    /** Lenses */
    lensStandardManual: string;
    lensStandardManualCaption: string;
    lensLowInvestment: string;
    lensLowInvestmentCaption: string;
    lensMaxCeiling: string;
    lensMaxCeilingCaption: string;
    /** Filters */
    searchCards: string;
    searchPlaceholder: string;
    rarityFilter: string;
    attributeFilter: string;
    generationFilter: string;
    allGenerations: string;
    /** Results line */
    cardsShown: string;
    outfitsShown: string;
    howTiersWork: string;
    /** Tier band captions */
    bandSS: string;
    bandS: string;
    bandA: string;
    bandB: string;
    bandC: string;
    bandD: string;
    /** Quick view dialog */
    closeQuickView: string;
    quickView: string;
    memberCard: string;
    leaderOutfit: string;
    provisional: string;
    modelIndex: string;
    indexRange: string;
    matchedContexts: string;
    openFullCard: string;
    leaderEffect: string;
    /** Empty tier band messages */
    emptySS: string;
    emptyD: string;
    emptyOther: string;
    modelTierSubtitle: string;
  };

  methodology: {
    pageTitle: string;
    pageDescription: string;
    /** Header */
    eyebrow: string;
    headline: string;
    intro: string;
    statRoster: string;
    statCharts: string;
    statLenses: string;
    /** Pipeline diagram */
    pipelineTitle: string;
    pipelineCaption: string;
    /** Step sections */
    stepOne: string;
    stepOneHeadline: string;
    stepTwo: string;
    stepTwoHeadline: string;
    stepThree: string;
    stepThreeHeadline: string;
    stepFour: string;
    stepFourHeadline: string;
    stepFive: string;
    stepFiveHeadline: string;
    stepSix: string;
    stepSixHeadline: string;
    stepReading: string;
    stepReadingHeadline: string;
    stepProvenance: string;
    stepProvenanceHeadline: string;
    /** Metrics */
    metricG: string;
    metricGName: string;
    metricGFormula: string;
    metricGDetail: string;
    metricP: string;
    metricPName: string;
    metricPFormula: string;
    metricPDetail: string;
    metricB: string;
    metricBName: string;
    metricBFormula: string;
    metricBDetail: string;
    metricE: string;
    metricEName: string;
    metricEFormula: string;
    metricEDetail: string;
    /** Lanes */
    laneLower: string;
    laneLowerRule: string;
    laneLowerTargeting: string;
    laneCentral: string;
    laneCentralRule: string;
    laneCentralTargeting: string;
    laneUpper: string;
    laneUpperRule: string;
    laneUpperTargeting: string;
    /** Tier table */
    frozenCutoffs: string;
    lensColumn: string;
    /** Actions */
    openTierList: string;
    browseCards: string;
  };

  calculator: {
    stepOneTitle: string;
    stepOneDesc: string;
    selectedCount: string;
    searchPlaceholder: string;
    searchAria: string;
    clearSearch: string;
    rarityFilterAria: string;
    typeLabel: string;
    cardTypeAria: string;
    allTypes: string;
    fiveStarCards: string;
    fourStarCards: string;
    selectCardHint: string;
    bloomLevelAria: string;
    noMatchingCards: string;
    resetFilters: string;
    optionalConstraint: string;
    oshiModeTitle: string;
    oshiModeDesc: string;
    oshiAria: string;
    on: string;
    off: string;
    favoriteTalent: string;
    chooseFromRoster: string;
    addCardFirst: string;
    requiredRole: string;
    roleMember: string;
    roleMemberHint: string;
    roleLeader: string;
    roleLeaderHint: string;
    roleBoth: string;
    roleBothHint: string;
    oshiHelp: string;
    lineupLocks: string;
    requiredMembersTitle: string;
    requiredMembersDesc: string;
    selectCardsFirst: string;
    btnRequired: string;
    btnSameTalent: string;
    btnFull: string;
    btnRequire: string;
    btnUnrequire: string;
    helpOshiConflict: string;
    helpFullSlots: string;
    helpGeneral: string;
    evaluatingTitle: string;
    evaluatingDesc: string;
    calcStopped: string;
    tryAgain: string;
    yourRoster: string;
    clearRoster: string;
    clearAria: string;
    rosterReadyTitle: string;
    rosterReadyDesc: string;
    talentsNeededTitle: string;
    talentsNeededDesc: string;
    emptyRosterHint: string;
    storagePersistent: string;
    storageSession: string;
    storageLoading: string;
    btnCalculate: string;
    btnCancel: string;
    btnChooseOshi: string;
    btnUnlockMember: string;
    btnAddMoreTalents: string;
    mobileReady: string;
    mobileSelectTalents: string;
    mobileBtnCancel: string;
    mobileBtnUnlock: string;
    mobileBtnSetOshi: string;
    mobileBtnCalculate: string;
    recommendedFormation: string;
    strongestBounded: string;
    strongestFull: string;
    benchmarkSubtitle: string;
    modelUtility: string;
    utilityRangeNote: string;
    relativeValueNote: string;
    oshiFulfilled: string;
    lineupFulfilled: string;
    requiredRetained: string;
    sourceCardBloom: string;
    specialActivationOrder: string;
    leftToRight: string;
    timingTie: string;
    chartTimed: string;
    timingModeled: string;
    memberFieldReport: string;
    whyMembersHere: string;
    oneForOneNote: string;
    showEvidence: string;
    hideEvidence: string;
    teamLinksTitle: string;
    activeStatSynergies: string;
    noSynergies: string;
    claimBounded: string;
    claimFull: string;
    formationsCompared: string;
    swapImpactReport: string;
    oneForOneReplacements: string;
    withRecommendedLeader: string;
    insteadOf: string;
    teamValue: string;
    inspectDetails: string;
  };

  teamBuilder: {
    eyebrow: string;
    title: string;
    intro: string;
    statCards: string;
    statTalents: string;
    loading: string;
  };

  rollCompare: {
    pageEyebrow: string;
    pageTitle: string;
    pageIntro: string;
    loading: string;
    emptyHeading: string;
    emptyDesc: string;
    buildRosterLink: string;
    btnCancel: string;
    btnCompare: string;
    targetsEyebrow: string;
    targetsHeading: string;
    targetsDesc: string;
    btnCompareAll: string;
    btnPause: string;
    btnResume: string;
    btnAllDone: string;
    respectLocks: string;
    searchAria: string;
    searchPlaceholder: string;
    seeIfStrengthens: string;
    verdictHeading: string;
    verdictForcedMember: string;
    verdictImproves: string;
    verdictDoesNotImprove: string;
    verdictForcedDetail: string;
    verdictNeutralOrWorse: string;
    verdictNotUsed: string;
    verdictBoth: string;
    verdictMember: string;
    verdictLeader: string;
    disclosureCharts: string;
    disclosureBounded: string;
    disclosureRelative: string;
    savedRoster: string;
    withCard: string;
    ownedBaseline: string;
    modelUtility: string;
    utilityRange: string;
    sourceCard: string;
    fiveMembers: string;
    legalFormation: string;
    displacedHeading: string;
    noDisplaced: string;
    stayedHeading: string;
    noStayed: string;
    slotsLocked: string;
    allSlotsOpen: string;
    lockedList: string;
    allSlotsLockedWarning: string;
    bloomNote: string;
    targetsDisclosure: string;
    catalogStats: string;
    comparisonProgress: string;
    backgroundProgressSuffix: string;
    searchMatchesNotice: string;
    ownedTeamSummary: string;
    upgradesFound: string;
    partialRanking: string;
    noSearchMatchesYet: string;
    replaces: string;
    leaderOutfitOnly: string;
    ifUsedReplaces: string;
    keepOwnedTeam: string;
    upgradeFound: string;
    noUpgradeFound: string;
    weakerIfUsed: string;
    tiesIfUsed: string;
    awaitingCount: string;
    cardsEntity: string;
    matchingCardsEntity: string;
    awaitingDesc: string;
    compareNow: string;
    comparing: string;
    notComparedYet: string;
    ownEveryCard: string;
    step1Eyebrow: string;
    step1Heading: string;
    step1Desc: string;
    availableCount: string;
    recentlyAdded: string;
    noUnownedMatches: string;
    memberCardBadge: string;
    tierBadge: string;
    clearCard: string;
    tierDisclaimer: string;
    compareAssumption: string;
    comparingTitle: string;
    comparingDesc: string;
    calcStopped: string;
    tryAgain: string;
    memberTrialReason: string;
  };

  talentsPage: {
    eyebrow: string;
    title: string;
    intro: string;
    statTalents: string;
    statCards: string;
    statBranches: string;
    cardsAndOutfits: string;
    backToDirectory: string;
    talentIntro: string;
    memberCards: string;
    leaderOutfits: string;
    recordsHeading: string;
    maxPotential: string;
    rewardOutfitsHeading: string;
    leaderOutfitsEyebrow: string;
    unlockedBy: string;
    noLeaderEffect: string;
  };

  cardProfile: {
    backToCatalog: string;
    leaderOutfitLabel: string;
    memberCardBadge: string;
    memberTierBadge: string;
    leaderTierBadge: string;
    tierNote: string;
    memberRange: string;
    leaderRange: string;
    parametersEyebrow: string;
    parametersHeading: string;
    parametersDesc: string;
    oneCopy: string;
    maxPotential: string;
    mechanicsEyebrow: string;
    mechanicsHeading: string;
    memberSkill: string;
    chance: string;
    interval: string;
    duration: string;
    potentialUpgrade: string;
    leaderSkillEyebrow: string;
    leaderEffect: string;
    sameTalentEyebrow: string;
    sameTalentHeading: string;
    teamGuideEyebrow: string;
    teamGuideHeading: string;
    teamGuideDesc: string;
  };

  notFound: {
    eyebrow: string;
    title: string;
    desc: string;
    returnHome: string;
  };

  cardsPage: {
    eyebrow: string;
    title: string;
    intro: string;
    statTotal: string;
    statFiveStar: string;
    statFourStar: string;
    loading: string;
  };

  tierListPage: {
    eyebrow: string;
    title: string;
    intro: string;
    note: string;
    statRoster: string;
    statContexts: string;
    statLenses: string;
    loading: string;
  };

  footer: {
    /**
     * IMMUTABLE — must appear verbatim in every locale.
     * Do NOT translate or paraphrase this string.
     */
    disclaimer: string;
  };
};

// ---------------------------------------------------------------------------
// Utility: derive dot-notation string paths for a nested object type
// ---------------------------------------------------------------------------
type DotPaths<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? DotPaths<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;
