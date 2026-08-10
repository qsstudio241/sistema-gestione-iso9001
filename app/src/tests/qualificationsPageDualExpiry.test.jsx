/**
 * Test L1 — QualRow, doppia data per saldatori ISO 9606-1 / operatori ISO 14732
 * (fix incongruenza dashboard segnalata dal committente 09/08/2026: uno stato
 * "Scaduta"/"In scadenza" appariva accanto a una data di scadenza certificato
 * ancora lontana nel tempo, perché la colonna "Scadenza" mostrava solo
 * expiry_date e non la conferma semestrale che in realtà determina il colore).
 *
 * Riproduce lo scenario del cliente Studio Mason (LUKIC BLAGO, C.M.P. SRL):
 * certificato ISO 9606-1 valido fino al 2027, conferma semestrale scaduta.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QualRow } from "../pages/QualificationsPage";

function renderRow(q, tabKey = "tutti") {
  render(
    <table>
      <tbody>
        <QualRow
          q={q}
          tabKey={tabKey}
          onEdit={() => {}}
          onHardDelete={() => {}}
          onRenew={() => {}}
          onHistory={() => {}}
          hardDeleteId={null}
          setHardDeleteId={() => {}}
        />
      </tbody>
    </table>
  );
}

describe("QualificationsPage — QualRow, doppia data certificato/conferma semestrale", () => {
  it("mostra entrambe le date e colora quella vincolante (conferma semestrale scaduta, certificato ancora lontano)", () => {
    const q = {
      id: 1,
      person_name: "Lukic Blago",
      qualification_type: "Saldatore ISO 9606-1",
      certificate_number: "24-00824-01-001",
      expiry_date: "2027-02-04",
      next_confirmation_due: "2026-02-04",
      effective_expiry_date: "2026-02-04",
      semaforo: "rosso",
    };

    renderRow(q);

    const certLine = screen.getByText(/Certificato:/).closest("span");
    const confirmLine = screen.getByText(/Conferma 6 mesi:/).closest("span");

    expect(certLine.textContent).toContain("04/02/2027");
    expect(confirmLine.textContent).toContain("04/02/2026");

    // La data che sta davvero "guidando" lo stato (la conferma, più imminente
    // del certificato) porta il colore del semaforo; l'altra resta neutra.
    expect(confirmLine.className).toContain("sq-expiry-rosso");
    expect(certLine.className).not.toContain("sq-expiry-rosso");
  });

  it("colora la data del certificato quando è quella vincolante (conferma più lontana dell'expiry)", () => {
    const q = {
      id: 2,
      person_name: "Marius Andrei Asavei",
      qualification_type: "Saldatore ISO 9606-1",
      certificate_number: "23-07914-01-001",
      expiry_date: "2026-11-26",
      next_confirmation_due: "2027-01-01",
      effective_expiry_date: "2026-11-26",
      semaforo: "giallo",
    };

    renderRow(q);

    const certLine = screen.getByText(/Certificato:/).closest("span");
    const confirmLine = screen.getByText(/Conferma 6 mesi:/).closest("span");

    expect(certLine.className).toContain("sq-expiry-giallo");
    expect(confirmLine.className).not.toContain("sq-expiry-giallo");
  });

  it("per tipi senza conferma semestrale (es. Coordinatore ISO 14731) mostra una sola data, comportamento invariato", () => {
    const q = {
      id: 3,
      person_name: "Mario Coordinatore",
      qualification_type: "Coordinatore ISO 14731",
      certificate_number: "X-1",
      expiry_date: "2027-01-01",
      next_confirmation_due: null,
      effective_expiry_date: "2027-01-01",
      semaforo: "verde",
    };

    renderRow(q);

    expect(screen.queryByText(/Conferma 6 mesi:/)).toBeNull();
    expect(screen.getByText("01/01/2027")).toBeTruthy();
  });

  it("saldatore 9606-1 senza next_confirmation_due valorizzato mostra una sola data (nessuna conferma ancora registrata)", () => {
    const q = {
      id: 4,
      person_name: "Nuovo Saldatore",
      qualification_type: "Saldatore ISO 9606-1",
      certificate_number: "X-2",
      expiry_date: "2028-01-01",
      next_confirmation_due: null,
      effective_expiry_date: "2028-01-01",
      semaforo: "verde",
    };

    renderRow(q);

    expect(screen.queryByText(/Conferma 6 mesi:/)).toBeNull();
    expect(screen.getByText("01/01/2028")).toBeTruthy();
  });
});
