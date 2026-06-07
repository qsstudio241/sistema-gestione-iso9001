/**
 * Test L1 — helper albero documentale
 */
import { describe, it, expect } from "vitest";
import {
  findNodeById,
  isTreeFolderNode,
  resolveNewFolderParentId,
} from "../hooks/useDocumentTree";

const tree = [
  {
    id: 1,
    title: "Root folder",
    doc_type: "folder",
    children: [
      { id: 2, title: "Child doc", doc_type: "manuale", parent_id: 1 },
      {
        id: 3,
        title: "Sub",
        doc_type: "folder",
        children: [],
      },
    ],
  },
];

describe("useDocumentTree helpers", () => {
  it("resolveNewFolderParentId usa cartella selezionata", () => {
    const folder = findNodeById(tree, 1);
    expect(resolveNewFolderParentId(folder)).toBe(1);
  });

  it("resolveNewFolderParentId usa parent se selezionato un documento", () => {
    const doc = findNodeById(tree, 2);
    expect(resolveNewFolderParentId(doc)).toBe(1);
  });

  it("isTreeFolderNode riconosce folder e is_folder", () => {
    expect(isTreeFolderNode({ doc_type: "folder" })).toBe(true);
    expect(isTreeFolderNode({ is_folder: true })).toBe(true);
    expect(isTreeFolderNode({ doc_type: "manuale" })).toBe(false);
  });
});
