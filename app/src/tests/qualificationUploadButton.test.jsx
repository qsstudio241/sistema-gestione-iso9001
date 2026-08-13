/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import QualificationUploadButton, { suggestedDocTypeFromTab } from "../components/QualificationUploadButton.jsx";

vi.mock("../services/apiService", () => ({ default: {} }));
vi.mock("../components/IngestReviewDialog", () => ({ default: () => null }));

describe("suggestedDocTypeFromTab", () => {
  it("suggerisce cert_ndt dalla tab NDT", () => {
    expect(suggestedDocTypeFromTab("ndt")).toBe("cert_ndt");
  });

  it("suggerisce patentino dalle tab saldatori", () => {
    expect(suggestedDocTypeFromTab("iso9606_1")).toBe("patentino_saldatore");
    expect(suggestedDocTypeFromTab("iso9606_2")).toBe("patentino_saldatore");
  });

  it("suggerisce 14732 dalla tab operatori", () => {
    expect(suggestedDocTypeFromTab("iso14732")).toBe("qualifica_14732");
  });

  it("non impone default su tab Tutti / altre", () => {
    expect(suggestedDocTypeFromTab("tutti")).toBe("");
    expect(suggestedDocTypeFromTab("iso14731")).toBe("");
    expect(suggestedDocTypeFromTab("")).toBe("");
  });
});

describe("QualificationUploadButton — visibile anche senza azienda", () => {
  it("mostra il pulsante Carica qualifiche (batch) disabilitato se manca l'azienda", () => {
    render(<QualificationUploadButton companyId="" companyName="" onUploadComplete={() => {}} />);
    const btn = screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it("resta cliccabile quando l'azienda e' valida", () => {
    render(
      <QualificationUploadButton companyId="47" companyName="C.M.P." onUploadComplete={() => {}} />
    );
    const btn = screen.getByRole("button", { name: /Carica qualifiche \(batch\)/i });
    expect(btn).not.toBeDisabled();
  });
});
