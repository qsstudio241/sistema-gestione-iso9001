/**
 * Rapporto larghezza anteprima/campi nella revisione ingest — localStorage + drag.
 */
import { useState, useCallback, useRef, useEffect } from "react";

export const INGEST_REVIEW_SPLIT_KEY = "sgq-ingest-review-split-ratio";
export const INGEST_REVIEW_SPLIT_DEFAULT = 0.5;
export const INGEST_REVIEW_SPLIT_MIN = 0.28;
export const INGEST_REVIEW_SPLIT_MAX = 0.72;
export const INGEST_REVIEW_PREVIEW_MIN_PX = 220;
export const INGEST_REVIEW_FORM_MIN_PX = 260;
export const INGEST_REVIEW_RESIZER_PX = 6;

export function clampIngestReviewSplitRatio(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return INGEST_REVIEW_SPLIT_DEFAULT;
  return Math.min(INGEST_REVIEW_SPLIT_MAX, Math.max(INGEST_REVIEW_SPLIT_MIN, n));
}

export function clampIngestReviewSplitForWidth(ratio, containerWidth) {
  const available = Math.max(0, containerWidth - INGEST_REVIEW_RESIZER_PX);
  if (available <= INGEST_REVIEW_PREVIEW_MIN_PX + INGEST_REVIEW_FORM_MIN_PX) {
    return INGEST_REVIEW_SPLIT_DEFAULT;
  }
  const minRatio = INGEST_REVIEW_PREVIEW_MIN_PX / available;
  const maxRatio = (available - INGEST_REVIEW_FORM_MIN_PX) / available;
  return Math.min(maxRatio, Math.max(minRatio, clampIngestReviewSplitRatio(ratio)));
}

export function readStoredIngestReviewSplit(storage = localStorage) {
  try {
    const raw = storage.getItem(INGEST_REVIEW_SPLIT_KEY);
    if (raw == null) return INGEST_REVIEW_SPLIT_DEFAULT;
    return clampIngestReviewSplitRatio(parseFloat(raw, 10));
  } catch {
    return INGEST_REVIEW_SPLIT_DEFAULT;
  }
}

export function buildIngestReviewGridColumns(ratio) {
  const previewFr = clampIngestReviewSplitRatio(ratio);
  const formFr = 1 - previewFr;
  return `minmax(${INGEST_REVIEW_PREVIEW_MIN_PX}px, ${previewFr}fr) ${INGEST_REVIEW_RESIZER_PX}px minmax(${INGEST_REVIEW_FORM_MIN_PX}px, ${formFr}fr)`;
}

export default function useIngestReviewSplit(layoutRef) {
  const [ratio, setRatio] = useState(readStoredIngestReviewSplit);
  const ratioRef = useRef(ratio);
  const draggingRef = useRef(false);

  useEffect(() => {
    ratioRef.current = ratio;
  }, [ratio]);

  const persistRatio = useCallback((next, containerWidth) => {
    const clamped = containerWidth != null
      ? clampIngestReviewSplitForWidth(next, containerWidth)
      : clampIngestReviewSplitRatio(next);
    setRatio(clamped);
    try {
      localStorage.setItem(INGEST_REVIEW_SPLIT_KEY, String(clamped));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const startResize = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const layout = layoutRef?.current;
    if (!layout) return;

    draggingRef.current = true;
    const rect = layout.getBoundingClientRect();

    document.body.classList.add("sgq-ingest-review-resizing");

    function onMouseMove(moveEvent) {
      if (!draggingRef.current) return;
      const available = rect.width - INGEST_REVIEW_RESIZER_PX;
      if (available <= 0) return;
      const previewWidth = moveEvent.clientX - rect.left;
      persistRatio(previewWidth / available, rect.width);
    }

    function onMouseUp() {
      draggingRef.current = false;
      document.body.classList.remove("sgq-ingest-review-resizing");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [layoutRef, persistRatio]);

  return {
    ratio,
    gridTemplateColumns: buildIngestReviewGridColumns(ratio),
    startResize,
  };
}
