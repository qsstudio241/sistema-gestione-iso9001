/**
 * Larghezza pannello dettaglio documento — persistenza localStorage + drag bordo sinistro.
 * Stesso pattern di useNcDrawerWidth.
 */
import { useState, useCallback, useRef, useEffect } from "react";

export const DOC_DETAIL_WIDTH_KEY = "doc-detail-panel-width";
export const DOC_DETAIL_WIDTH_DEFAULT = 420;
export const DOC_DETAIL_WIDTH_MIN = 320;
export const DOC_DETAIL_WIDTH_MAX = 800;

export function getDocDetailMaxWidth(viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200) {
  return Math.min(DOC_DETAIL_WIDTH_MAX, Math.floor(viewportWidth * 0.9));
}

export function clampDocDetailWidth(value, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DOC_DETAIL_WIDTH_DEFAULT;
  const max = getDocDetailMaxWidth(viewportWidth);
  return Math.min(max, Math.max(DOC_DETAIL_WIDTH_MIN, Math.round(n)));
}

export function readStoredDocDetailWidth(storage = localStorage, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200) {
  try {
    const raw = storage.getItem(DOC_DETAIL_WIDTH_KEY);
    if (raw == null) return clampDocDetailWidth(DOC_DETAIL_WIDTH_DEFAULT, viewportWidth);
    return clampDocDetailWidth(parseInt(raw, 10), viewportWidth);
  } catch {
    return clampDocDetailWidth(DOC_DETAIL_WIDTH_DEFAULT, viewportWidth);
  }
}

export default function useDocDetailPanelWidth() {
  const [width, setWidth] = useState(() => readStoredDocDetailWidth());
  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    function onResize() {
      setWidth((current) => clampDocDetailWidth(current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persistWidth = useCallback((next) => {
    const clamped = clampDocDetailWidth(next);
    setWidth(clamped);
    try {
      localStorage.setItem(DOC_DETAIL_WIDTH_KEY, String(clamped));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const startResize = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const startX = e.clientX;
    const startWidth = widthRef.current;

    document.body.classList.add("sgq-doc-detail-resizing");

    function onMouseMove(moveEvent) {
      if (!draggingRef.current) return;
      const delta = startX - moveEvent.clientX;
      persistWidth(startWidth + delta);
    }

    function onMouseUp() {
      draggingRef.current = false;
      document.body.classList.remove("sgq-doc-detail-resizing");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [persistWidth]);

  return { width, startResize };
}
