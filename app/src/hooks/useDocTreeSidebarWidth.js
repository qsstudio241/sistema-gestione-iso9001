/**
 * Larghezza sidebar albero Registro Documenti — persistenza localStorage + drag.
 */
import { useState, useCallback, useRef, useEffect } from "react";

export const DOC_TREE_WIDTH_KEY = "sgq-doc-tree-width";
export const DOC_TREE_WIDTH_MIN = 220;
export const DOC_TREE_WIDTH_MAX = 480;
export const DOC_TREE_WIDTH_DEFAULT = 260;

export function clampDocTreeWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DOC_TREE_WIDTH_DEFAULT;
  return Math.min(DOC_TREE_WIDTH_MAX, Math.max(DOC_TREE_WIDTH_MIN, Math.round(n)));
}

export function readStoredDocTreeWidth(storage = localStorage) {
  try {
    const raw = storage.getItem(DOC_TREE_WIDTH_KEY);
    if (raw == null) return DOC_TREE_WIDTH_DEFAULT;
    return clampDocTreeWidth(parseInt(raw, 10));
  } catch {
    return DOC_TREE_WIDTH_DEFAULT;
  }
}

export default function useDocTreeSidebarWidth() {
  const [width, setWidth] = useState(readStoredDocTreeWidth);
  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const persistWidth = useCallback((next) => {
    const clamped = clampDocTreeWidth(next);
    setWidth(clamped);
    try {
      localStorage.setItem(DOC_TREE_WIDTH_KEY, String(clamped));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const startResize = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingRef.current = true;
    const startX = e.clientX;
    const startWidth = widthRef.current;

    document.body.classList.add("sgq-doc-tree-resizing");

    function onMouseMove(moveEvent) {
      if (!draggingRef.current) return;
      const delta = moveEvent.clientX - startX;
      persistWidth(startWidth + delta);
    }

    function onMouseUp() {
      draggingRef.current = false;
      document.body.classList.remove("sgq-doc-tree-resizing");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [persistWidth]);

  return { width, startResize };
}
