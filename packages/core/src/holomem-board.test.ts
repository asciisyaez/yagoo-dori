import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assertHolomemBoardModelValid,
  boardAdjacency,
  buildBoardAdjacency,
  computeHolomemBoardModelHash,
  holomemBoardModel,
  resolveBoardNodeForTalent,
  type BoardNode,
  type HolomemBoardModel,
} from "./holomem-board";
import { mechanicsData, type MechanicsData } from "./mechanics";

function clonedCatalogs(): MechanicsData["catalogs"] {
  return structuredClone(mechanicsData.catalogs);
}

function fixtureNode(id: string, groupId: string, characterIds: string[]): BoardNode {
  return { ...mechanicsData.catalogs.boardNodes[0]!, id, groupId, characterIds };
}

function resignedModel(mutate: (model: HolomemBoardModel) => void): HolomemBoardModel {
  const model = structuredClone(holomemBoardModel);
  mutate(model);
  const { modelHash: _staleHash, ...withoutHash } = model;
  return { ...model, modelHash: computeHolomemBoardModelHash(withoutHash) };
}

describe("holomem Board model", () => {
  it("derives the real deterministic 152-group, 171-edge topology", () => {
    expect(boardAdjacency.ruleId).toBe("board-derived-adjacency");
    expect(boardAdjacency.startGroupId).toBe("S-001");
    expect(boardAdjacency.nodeGroupCount).toBe(152);
    expect(boardAdjacency.edgeCount).toBe(171);
    expect(boardAdjacency.treeModelIds).toHaveLength(4);
    expect([...boardAdjacency.neighborsByGroupId.keys()]).toHaveLength(152);
    expect(boardAdjacency.treeModelIds.map((id) => [...boardAdjacency.cellByGroupIdByTreeModel.get(id)!.keys()].length))
      .toEqual([152, 152, 152, 152]);
    expect(buildBoardAdjacency()).toEqual(boardAdjacency);

    const input = clonedCatalogs();
    expect(buildBoardAdjacency(input)).toEqual(buildBoardAdjacency(input));
    expect(buildBoardAdjacency(structuredClone(input))).toEqual(buildBoardAdjacency(input));
  });

  it("rejects incomplete, duplicate, model-divergent, and rootless layouts", () => {
    const threeModels = clonedCatalogs();
    threeModels.boardNodePositions = threeModels.boardNodePositions.filter((row) => row.treeModelId !== "tree-model-004");
    expect(() => buildBoardAdjacency(threeModels)).toThrow(/exactly 4 tree models/);

    const missingPosition = clonedCatalogs();
    missingPosition.boardNodePositions = missingPosition.boardNodePositions.filter(
      (row) => !(row.treeModelId === "tree-model-004" && row.nodeGroupId === "S-001"),
    );
    expect(() => buildBoardAdjacency(missingPosition)).toThrow(/tree-model-004 must have exactly 152 groups/);

    const duplicateCell = clonedCatalogs();
    const root = duplicateCell.boardNodePositions.find((row) => row.treeModelId === "tree-model-001" && row.nodeGroupId === "S-001")!;
    const other = duplicateCell.boardNodePositions.find((row) => row.treeModelId === "tree-model-001" && row.nodeGroupId !== "S-001")!;
    other.x = root.x;
    other.y = root.y;
    expect(() => buildBoardAdjacency(duplicateCell)).toThrow(/duplicate cell/);

    const divergent = clonedCatalogs();
    const shifted = divergent.boardNodePositions.find((row) => row.treeModelId === "tree-model-004" && row.nodeGroupId === "S-001")!;
    shifted.x += 100;
    shifted.y += 100;
    expect(() => buildBoardAdjacency(divergent)).toThrow(/differs across tree models/);

    const rootless = clonedCatalogs();
    rootless.boardNodes.forEach((row) => {
      if (row.groupId === "S-001") row.groupId = "S-999";
    });
    rootless.boardNodePositions.forEach((row) => {
      if (row.nodeGroupId === "S-001") row.nodeGroupId = "S-999";
    });
    expect(() => buildBoardAdjacency(rootless)).toThrow(/start group S-001 is missing/);
  });

  it("rejects coordinated topology drift and canonicalizes position iteration order", () => {
    const coordinatedSwap = clonedCatalogs();
    for (const treeModelId of boardAdjacency.treeModelIds) {
      const first = coordinatedSwap.boardNodePositions.find(
        (row) => row.treeModelId === treeModelId && row.nodeGroupId === "G-001",
      )!;
      const second = coordinatedSwap.boardNodePositions.find(
        (row) => row.treeModelId === treeModelId && row.nodeGroupId === "G-002",
      )!;
      [first.x, second.x] = [second.x, first.x];
      [first.y, second.y] = [second.y, first.y];
    }
    expect(() => buildBoardAdjacency(coordinatedSwap)).toThrow(/canonical evidence edge digest/);

    const permuted = clonedCatalogs();
    permuted.boardNodePositions.reverse();
    const rebuilt = buildBoardAdjacency(permuted);
    expect(rebuilt).toEqual(boardAdjacency);
    expect([...rebuilt.cellByGroupIdByTreeModel.entries()].map(([modelId, cells]) => [modelId, [...cells.keys()]]))
      .toEqual([...boardAdjacency.cellByGroupIdByTreeModel.entries()].map(([modelId, cells]) => [modelId, [...cells.keys()]]));
  });

  it("resolves board variants exactly and rejects ambiguity", () => {
    expect(resolveBoardNodeForTalent("S-001", "chr-00001").groupId).toBe("S-001");
    expect(resolveBoardNodeForTalent("G-008", "chr-00001").characterIds).toContain("chr-00001");

    const catalogs = clonedCatalogs();
    catalogs.boardNodes = [
      fixtureNode("fixture:single", "fixture:single", []),
      fixtureNode("fixture:match", "fixture:match", ["talent-a"]),
      fixtureNode("fixture:default", "fixture:match", []),
      fixtureNode("fixture:other", "fixture:match", ["talent-b"]),
    ];
    expect(resolveBoardNodeForTalent("fixture:single", "talent-a", catalogs).id).toBe("fixture:single");
    expect(resolveBoardNodeForTalent("fixture:match", "talent-a", catalogs).id).toBe("fixture:match");
    expect(resolveBoardNodeForTalent("fixture:match", "talent-c", catalogs).id).toBe("fixture:default");

    catalogs.boardNodes.push(fixtureNode("fixture:ambiguous-match", "fixture:match", ["talent-a"]));
    expect(() => resolveBoardNodeForTalent("fixture:match", "talent-a", catalogs)).toThrow(/ambiguous talent matches/);
    expect(() => resolveBoardNodeForTalent("missing", "talent-a", catalogs)).toThrow(/is missing/);

    const ambiguousDefault = clonedCatalogs();
    ambiguousDefault.boardNodes = [
      fixtureNode("fixture:first-default", "fixture:defaults", []),
      fixtureNode("fixture:second-default", "fixture:defaults", []),
    ];
    expect(() => resolveBoardNodeForTalent("fixture:defaults", "talent-a", ambiguousDefault)).toThrow(/ambiguous defaults/);

    const unresolved = clonedCatalogs();
    unresolved.boardNodes = [
      fixtureNode("fixture:one", "fixture:unresolved", ["talent-b"]),
      fixtureNode("fixture:two", "fixture:unresolved", ["talent-c"]),
    ];
    expect(() => resolveBoardNodeForTalent("fixture:unresolved", "talent-a", unresolved)).toThrow(/unresolved/);
  });

  it("binds the canonical artifact to topology, budgets, and raw mechanics bytes", () => {
    const { modelHash, ...withoutHash } = holomemBoardModel;
    expect(computeHolomemBoardModelHash(withoutHash)).toBe(modelHash);
    expect(() => assertHolomemBoardModelValid({ ...holomemBoardModel, modelHash: "0".repeat(64) })).toThrow(/canonical manifest/);
    const semanticTamper = structuredClone(holomemBoardModel);
    semanticTamper.adjacency.edgeSetSha256 = "0".repeat(64);
    const { modelHash: _staleHash, ...semanticTamperWithoutHash } = semanticTamper;
    semanticTamper.modelHash = computeHolomemBoardModelHash(semanticTamperWithoutHash);
    expect(() => assertHolomemBoardModelValid(semanticTamper)).toThrow(/edge digest/);
    expect(() => assertHolomemBoardModelValid(resignedModel((model) => {
      model.mechanics.sha256 = "0".repeat(64);
    }))).toThrow(/mechanics SHA-256/);
    expect(() => assertHolomemBoardModelValid(resignedModel((model) => {
      model.assumptions[0]!.default = "not-independent";
    }))).toThrow(/assumptions/);
    expect(() => assertHolomemBoardModelValid(resignedModel((model) => {
      model.assumptions.find((assumption) => assumption.id === "cross-board-connect-restriction")!.statement = "Changed declaration.";
    }))).toThrow(/assumptions/);
    expect(() => assertHolomemBoardModelValid(resignedModel((model) => {
      model.nonClaims[0] = "Changed non-claim.";
    }))).toThrow(/non-claims/);
    expect(createHash("sha256").update(readFileSync(new URL("../../../data/generated/holodori-mechanics.json", import.meta.url))).digest("hex"))
      .toBe(holomemBoardModel.mechanics.sha256);
    assertHolomemBoardModelValid(holomemBoardModel);
  });

  it("keeps the Board module outside utility, formation, calculator, and optimizer internals", () => {
    for (const moduleName of ["holomem-board.ts", "holomem-board-connect.ts"]) {
      const source = readFileSync(new URL(`./${moduleName}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*(?:native-utility|formation-evaluator|team-calculator(?:-[a-z-]+)?|exact-optimizer-[a-z-]+)[^"']*["']/);
      expect(source).not.toMatch(new RegExp(["Math", "random"].join("\\.")));
      expect(source).not.toMatch(/toBeCloseTo/);
    }
  });
});
