/**
 * CONS-1: flush autosave su unmount / pagehide / visibility hidden.
 * Debounce 2s resta: niente write a ogni tasto.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "../hooks/useAutoSave";

function makeAudit(overrides = {}) {
  return {
    metadata: { id: "audit-cons-1" },
    checklist: { q1: { status: "C", notes: "prima" } },
    ...overrides,
  };
}

describe("useAutoSave flush (CONS-1)", () => {
  let visibilityState = "visible";
  let visibilityDescriptor;

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = "visible";
    visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (visibilityDescriptor) {
      Object.defineProperty(document, "visibilityState", visibilityDescriptor);
    } else {
      delete document.visibilityState;
    }
  });

  it("unmount prima del delay chiama saveAudit almeno una volta", () => {
    const saveAudit = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useAutoSave(makeAudit(), { saveAudit }, "audit", 2000)
    );

    expect(saveAudit).not.toHaveBeenCalled();

    unmount();

    expect(saveAudit).toHaveBeenCalledTimes(1);
    expect(saveAudit).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { id: "audit-cons-1" } })
    );
  });

  it("dati identici: nessun save dopo il primo persist", async () => {
    const saveAudit = vi.fn().mockResolvedValue(undefined);
    const audit = makeAudit();
    const { rerender, unmount } = renderHook(
      ({ data }) => useAutoSave(data, { saveAudit }, "audit", 2000),
      { initialProps: { data: audit } }
    );

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(saveAudit).toHaveBeenCalledTimes(1);

    rerender({ data: { ...audit } });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(saveAudit).toHaveBeenCalledTimes(1);

    unmount();
    expect(saveAudit).toHaveBeenCalledTimes(1);
  });

  it("pagehide con pending chiama saveAudit", () => {
    const saveAudit = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave(makeAudit(), { saveAudit }, "audit", 2000));

    expect(saveAudit).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(saveAudit).toHaveBeenCalledTimes(1);
  });

  it("visibilitychange hidden con pending chiama saveAudit", () => {
    const saveAudit = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoSave(makeAudit(), { saveAudit }, "audit", 2000));

    expect(saveAudit).not.toHaveBeenCalled();

    act(() => {
      visibilityState = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(saveAudit).toHaveBeenCalledTimes(1);
  });

  it("il debounce non scrive a ogni cambio dati", () => {
    const saveAudit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ notes }) =>
        useAutoSave(
          makeAudit({ checklist: { q1: { status: "C", notes } } }),
          { saveAudit },
          "audit",
          2000
        ),
      { initialProps: { notes: "a" } }
    );

    rerender({ notes: "ab" });
    rerender({ notes: "abc" });

    act(() => {
      vi.advanceTimersByTime(1999);
    });

    expect(saveAudit).not.toHaveBeenCalled();
  });

  it("errore saveAudit (quota) imposta error e non lancia", async () => {
    const saveAudit = vi.fn().mockRejectedValue(new Error("QuotaExceededError"));
    const { result } = renderHook(() =>
      useAutoSave(makeAudit(), { saveAudit }, "audit", 2000)
    );

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });

    expect(result.current).toBe("error");
  });
});
