/**
 * Test L1 — larghezza drawer NC ridimensionabile
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useNcDrawerWidth, {
  clampNcDrawerWidth,
  readStoredNcDrawerWidth,
  getNcDrawerMaxWidth,
  NC_DRAWER_WIDTH_KEY,
  NC_DRAWER_WIDTH_MIN,
  NC_DRAWER_WIDTH_DEFAULT,
} from "../hooks/useNcDrawerWidth";

describe("clampNcDrawerWidth", () => {
  it("clampa tra min e max viewport-aware", () => {
    expect(clampNcDrawerWidth(400, 1200)).toBe(NC_DRAWER_WIDTH_MIN);
    expect(clampNcDrawerWidth(999, 1200)).toBe(getNcDrawerMaxWidth(1200));
    expect(clampNcDrawerWidth(600, 1200)).toBe(600);
  });

  it("fallback su default se non numerico", () => {
    expect(clampNcDrawerWidth("abc", 1200)).toBe(NC_DRAWER_WIDTH_DEFAULT);
  });
});

describe("readStoredNcDrawerWidth", () => {
  it("legge e clampa da localStorage", () => {
    const storage = { getItem: vi.fn(() => "640") };
    expect(readStoredNcDrawerWidth(storage, 1200)).toBe(640);
  });

  it("usa default se chiave assente", () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(readStoredNcDrawerWidth(storage, 1200)).toBe(NC_DRAWER_WIDTH_DEFAULT);
  });
});

describe("useNcDrawerWidth", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("allarga il drawer trascinando verso sinistra e persiste", () => {
    const { result } = renderHook(() => useNcDrawerWidth());

    act(() => {
      result.current.startResize({ button: 0, clientX: 500, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 420 }));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(result.current.width).toBe(600);
    expect(localStorage.getItem(NC_DRAWER_WIDTH_KEY)).toBe("600");
    expect(document.body.classList.contains("sgq-nc-drawer-resizing")).toBe(false);
  });
});
