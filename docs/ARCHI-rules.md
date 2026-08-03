# Architecture Documentation Rules

[ARCHI.md](ARCHI.md) documents the Yagoo-dori architecture. After each task
(new feature, refactor, bug fix), determine if ARCHI.md needs updating.

## When to Update

Update after ANY change that alters:

- Project structure (new directories, moved files, new workspace packages)
- Technology stack (new dependencies, version changes)
- Data Pipeline & Generated Artifacts (new sources, sync scripts, generated
  files, validation assertions)
- Evaluation & Ranking Engine (evaluator semantics, search/bounding, ranking
  lenses, calculator contract)
- Exact Optimizer & Certification Subsystem (spec, parity harnesses, evidence
  artifacts, gates, certificate state semantics)
- Components & UI Architecture / Routing / Styling (new routes, client
  islands, worker protocols)
- Configuration (env vars, pinned constants, methodology identifiers)
- Build System & Toolchain or Deployment (scripts, workflows, gating)

## How to Update by Change Type

### Major Feature / Refactor

Review: Overview; Project Structure; Core Architecture Principles; the
affected domain section (12 Data Pipeline / 13 Evaluation & Ranking Engine /
14 Exact Optimizer / 8–11 web sections); Data Flow Diagrams; Testing Strategy.

### Minor Feature / Enhancement

Update: the single affected domain section, plus Configuration if identifiers
or constants changed.

### Bug Fix

Usually no update needed, unless it reveals/fixes an architectural flaw.

### Dependency Changes

Update: Technology Stack, and any affected architectural sections.

### Optimizer Ticket (X-series)

Update: section 14 (Exact Optimizer & Certification Subsystem) when gates,
evidence artifacts, or certificate-state semantics change; section 15 when the
epic/ticket workflow itself changes. Keep the optimizer mermaid diagram in
sync with the actual gate flow.

## Guidelines

- Be precise and factual - reflect the actual codebase
- Be concise - enough detail to understand, not implementation specifics
- Update diagrams when data flow changes
- Reference actual file paths
- Never let ARCHI.md overstate a claim the evidence artifacts do not support
  (e.g., parity is not a certificate; plan-only artifacts are not runs)
