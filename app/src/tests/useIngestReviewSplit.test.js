/**
 * Test L1 — split ridimensionabile revisione ingest
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useIngestReviewSplit, {
  clampIngestReviewSplitRatio,
  clampIngestReviewSplitForWidth,
  readStoredIngestReviewSplit,
  buildIngestReviewGridColumns,
  INGEST_REVIEW_SPLIT_KEY,
  INGEST_REVIEW_SPLIT_DEFAULT,
  INGEST_REVIEW_SPLIT_MIN,
  INGEST_REVIEW_SPLIT_MAX,
} from "../hooks/useIngestReviewSplit";

describe("clampIngestReviewSplitRatio", () => {
  it("clampa tra min e max", () => {
    expect(clampIngestReviewSplitRatio(0.1)).toBe(INGEST_REVIEW_SPLIT_MIN);
    expect(clampIngestReviewSplitRatio(0.9)).toBe(INGEST_REVIEW_SPLIT_MAX);
    expect(clampIngestReviewSplitRatio(0.55)).toBe(0.55);
  });

  it("fallback su default se non numerico", () => {
    expect(clampIngestReviewSplitRatio("abc")).toBe(INGEST_REVIEW_SPLIT_DEFAULT);
  });
});

describe("clampIngestReviewSplitForWidth", () => {
  it("rispetta larghezze minime in pixel", () => {
    expect(clampIngestReviewSplitForWidth(0.1, 1000)).toBeGreaterThanOrEqual(INGEST_REVIEW_SPLIT_MIN);
    expect(clampIngestReviewSplitForWidth(0.9, 1000)).toBeLessThanOrEqual(INGEST_REVIEW_SPLIT_MAX);
  });
});

describe("readStoredIngestReviewSplit", () => {
  it("legge e clampa da localStorage", () => {
    const storage = { getItem: vi.fn(() => "0.62") };
    expect(readStoredIngestReviewSplit(storage)).toBe(0.62);
  });

  it("usa default se chiave assente", () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(readStoredIngestReviewSplit(storage)).toBe(INGEST_REVIEW_SPLIT_DEFAULT);
  });
});

describe("buildIngestReviewGridColumns", () => {
  it("genera tre colonne con resizer centrale", () => {
    const cols = buildIngestReviewGridColumns(0.5);
    expect(cols).toContain("6px");
    expect(cols).toContain("minmax(220px");
    expect(cols).toContain("minmax(260px");
  });
});

describe("useIngestReviewSplit", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persiste il rapporto in localStorage al drag", () => {
    const layoutRef = {
      current: {
        getBoundingClientRect: () => ({ left: 0, width: 1000 }),
      },
    };
    const { result } = renderHook(() => useIngestReviewSplit(layoutRef));

    act(() => {
      result.current.startResize({ button: 0, clientX: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 596 }));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.ratio).toBeCloseTo(0.6, 2);
    expect(parseFloat(localStorage.getItem(INGEST_REVIEW_SPLIT_KEY))).toBeCloseTo(0.6, 2);
    expect(document.body.classList.contains("sgq-ingest-review-resizing")).toBe(false);
  });
});
