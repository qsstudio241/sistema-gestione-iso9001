/**
 * Larghezza drawer dettaglio NC — persistenza localStorage + drag bordo sinistro.
 */
import { useState, useCallback, useRef, useEffect } from "react";

export const NC_DRAWER_WIDTH_KEY = "nc-drawer-width";
export const NC_DRAWER_WIDTH_DEFAULT = 520;
export const NC_DRAWER_WIDTH_MIN = 520;
export const NC_DRAWER_WIDTH_MAX = 900;

export function getNcDrawerMaxWidth(viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200) {
  return Math.min(NC_DRAWER_WIDTH_MAX, Math.floor(viewportWidth * 0.9));
}

export function clampNcDrawerWidth(value, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NC_DRAWER_WIDTH_DEFAULT;
  const max = getNcDrawerMaxWidth(viewportWidth);
  return Math.min(max, Math.max(NC_DRAWER_WIDTH_MIN, Math.round(n)));
}

export function readStoredNcDrawerWidth(storage = localStorage, viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200) {
  try {
    const raw = storage.getItem(NC_DRAWER_WIDTH_KEY);
    if (raw == null) return clampNcDrawerWidth(NC_DRAWER_WIDTH_DEFAULT, viewportWidth);
    return clampNcDrawerWidth(parseInt(raw, 10), viewportWidth);
  } catch {
    return clampNcDrawerWidth(NC_DRAWER_WIDTH_DEFAULT, viewportWidth);
  }
}

export default function useNcDrawerWidth() {
  const [width, setWidth] = useState(() => readStoredNcDrawerWidth());
  const widthRef = useRef(width);
  const draggingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    function onResize() {
      setWidth((current) => clampNcDrawerWidth(current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persistWidth = useCallback((next) => {
    const clamped = clampNcDrawerWidth(next);
    setWidth(clamped);
    try {
      localStorage.setItem(NC_DRAWER_WIDTH_KEY, String(clamped));
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

    document.body.classList.add("sgq-nc-drawer-resizing");

    function onMouseMove(moveEvent) {
      if (!draggingRef.current) return;
      const delta = startX - moveEvent.clientX;
      persistWidth(startWidth + delta);
    }

    function onMouseUp() {
      draggingRef.current = false;
      document.body.classList.remove("sgq-nc-drawer-resizing");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [persistWidth]);

  return { width, startResize };
}
