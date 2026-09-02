/**
 * @vitest-environment jsdom
 *
 * CONS-2 — AuditLockBanner mode offline: testo PC visibile.
 * Integra il messaggio lock non attivo. Non tocca StorageContext.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const DEFAULT_OFFLINE_MESSAGE =
  "Sei offline: lock non attivo sul server. Evita modifiche concorrenti sullo stesso audit con altri utenti.";

let storageState;

vi.mock("../contexts/StorageContext", () => ({
  useStorage: () => storageState,
}));

import AuditLockBanner from "../components/AuditLockBanner";

function setLock(partial) {
  storageState = {
    currentAudit: { id: "audit-cons2" },
    refreshAuditLock: vi.fn(),
    auditLock: {
      mode: "offline",
      lockedByName: null,
      message: DEFAULT_OFFLINE_MESSAGE,
      ...partial,
    },
  };
}

describe("AuditLockBanner — avviso offline PC (CONS-2)", () => {
  beforeEach(() => {
    setLock({ mode: "offline", message: DEFAULT_OFFLINE_MESSAGE });
  });

  it("in mode offline mostra lock non attivo e avviso di non aprire dal PC", () => {
    render(<AuditLockBanner />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Offline");
    expect(banner).toHaveTextContent(/lock non attivo/i);
    expect(banner).toHaveTextContent("QUESTO telefono");
    expect(banner).toHaveTextContent(/NON aprire lo stesso audit dal PC/);
    expect(banner).toHaveTextContent(/sincronizzazione è completata/);
  });

  it("in mode offline senza message server mostra comunque l'avviso PC", () => {
    setLock({ mode: "offline", message: null });
    render(<AuditLockBanner />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent(/NON aprire lo stesso audit dal PC/);
    expect(banner).toHaveTextContent("QUESTO telefono");
  });

  it("non mostra l'avviso PC in mode foreign", () => {
    setLock({
      mode: "foreign",
      lockedByName: "Mario Rossi",
      message: "locked",
    });
    render(<AuditLockBanner />);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Sola lettura");
    expect(banner).not.toHaveTextContent(/dal PC/);
    expect(banner).not.toHaveTextContent(/QUESTO telefono/);
  });

  it("non renderizza se mode owner o assente audit", () => {
    setLock({ mode: "owner", message: null });
    const { unmount } = render(<AuditLockBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();

    storageState = {
      currentAudit: null,
      refreshAuditLock: vi.fn(),
      auditLock: {
        mode: "offline",
        lockedByName: null,
        message: DEFAULT_OFFLINE_MESSAGE,
      },
    };
    render(<AuditLockBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
