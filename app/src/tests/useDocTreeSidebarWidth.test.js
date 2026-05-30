/**
 * Test L1 — larghezza sidebar albero documenti
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDocTreeSidebarWidth, {
  clampDocTreeWidth,
  readStoredDocTreeWidth,
  DOC_TREE_WIDTH_KEY,
  DOC_TREE_WIDTH_MIN,
  DOC_TREE_WIDTH_MAX,
  DOC_TREE_WIDTH_DEFAULT,
} from "../hooks/useDocTreeSidebarWidth";

describe("clampDocTreeWidth", () => {
  it("clampa tra min e max", () => {
    expect(clampDocTreeWidth(100)).toBe(DOC_TREE_WIDTH_MIN);
    expect(clampDocTreeWidth(999)).toBe(DOC_TREE_WIDTH_MAX);
    expect(clampDocTreeWidth(300)).toBe(300);
  });

  it("fallback su default se non numerico", () => {
    expect(clampDocTreeWidth("abc")).toBe(DOC_TREE_WIDTH_DEFAULT);
  });
});

describe("readStoredDocTreeWidth", () => {
  it("legge e clampa da localStorage", () => {
    const storage = { getItem: vi.fn(() => "350") };
    expect(readStoredDocTreeWidth(storage)).toBe(350);
  });

  it("usa default se chiave assente", () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(readStoredDocTreeWidth(storage)).toBe(DOC_TREE_WIDTH_DEFAULT);
  });
});

describe("useDocTreeSidebarWidth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persiste la larghezza in localStorage al drag", () => {
    const { result } = renderHook(() => useDocTreeSidebarWidth());

    act(() => {
      result.current.startResize({ button: 0, clientX: 100, preventDefault: vi.fn() });
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 160 }));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.width).toBe(320);
    expect(localStorage.getItem(DOC_TREE_WIDTH_KEY)).toBe("320");
    expect(document.body.classList.contains("sgq-doc-tree-resizing")).toBe(false);
  });
});
