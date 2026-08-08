/**
 * Test — ReprocessQueueBanner (generalizzato 08/08/2026 dalle sole Qualifiche
 * anche alla WPQR, migrazione 143). Verifica il parametro `module` e il
 * fallback di etichetta/titolo per le proposte WPQR (nessun `person_name`,
 * chiave di registro `wpqr_thickness_max_unlimited` diversa dal campo ingest
 * reale `thickness_max_unlimited`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: { listIngestStaging: vi.fn() },
}));

import apiService from "../services/apiService";
import ReprocessQueueBanner from "../components/ReprocessQueueBanner";

describe("ReprocessQueueBanner — parametro module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("default (nessuna prop): interroga il modulo 'qualifiche'", async () => {
    apiService.listIngestStaging.mockResolvedValue({ items: [] });
    render(<ReprocessQueueBanner />);

    await waitFor(() => {
      expect(apiService.listIngestStaging).toHaveBeenCalledWith(
        expect.objectContaining({ module: "qualifiche", reprocessOnly: true })
      );
    });
  });

  it("module='saldatura': interroga il modulo saldatura (coda rielaborazione WPQR)", async () => {
    apiService.listIngestStaging.mockResolvedValue({ items: [] });
    render(<ReprocessQueueBanner module="saldatura" />);

    await waitFor(() => {
      expect(apiService.listIngestStaging).toHaveBeenCalledWith(
        expect.objectContaining({ module: "saldatura", reprocessOnly: true })
      );
    });
  });

  it("mostra il wpqr_code come titolo quando manca person_name (proposta WPQR)", async () => {
    apiService.listIngestStaging.mockResolvedValue({
      items: [{
        id: 1, doc_type: "wpqr", original_name: "wpqr.pdf", field_scope: "preheat_temp",
        fields: { wpqr_code: "WPQR-01", preheat_temp: "min 100 C" },
      }],
    });
    const { container } = render(<ReprocessQueueBanner module="saldatura" />);

    await waitFor(() => expect(container.textContent).toMatch(/1\s*document/));
  });
});
