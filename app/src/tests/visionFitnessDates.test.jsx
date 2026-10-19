import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { VISION_FITNESS_TYPE } from "../data/occupationalQualificationTypes";
import {
  applyVisitDateChange,
  earliestIsoDate,
  visionDatesForSave,
  visionListPresentation,
} from "../utils/visionFitnessDates";
import { QualRow } from "../pages/QualificationsPage";

const VISION = VISION_FITNESS_TYPE;

describe("visionFitnessDates", () => {
  it("la scadenza effettiva è la più vicina e una data vuota non conta", () => {
    expect(earliestIsoDate(["2027-03-01", null, "2020-01-01"])).toBe("2020-01-01");
    expect(earliestIsoDate(["2027-03-01", "", null])).toBe("2027-03-01");
  });

  it("cambiare la visita non cancella una expiry_date diversa", () => {
    const next = applyVisitDateChange({
      expiry_date: "2020-01-01",
      near_vision_expiry_date: "2027-06-01",
      colour_vision_expiry_date: "",
    }, "2028-01-15");
    expect(next.near_vision_expiry_date).toBe("2028-01-15");
    expect(next.expiry_date).toBe("2020-01-01");
    expect(visionDatesForSave(next).colour_vision_expiry_date).toBe("");
    const cleared = applyVisitDateChange({
      expiry_date: "2020-01-01",
      near_vision_expiry_date: "2027-06-01",
    }, "");
    const saved = visionDatesForSave(cleared, "");
    expect(saved.near_vision_expiry_date).toBe("");
    expect(saved.expiry_date).toBe("2020-01-01");
  });

  it("elenco: una data se i colori sono vuoti, due se sono diversi", () => {
    const single = visionListPresentation({
      qualification_type: VISION,
      expiry_date: "2020-01-01",
      near_vision_expiry_date: "2027-06-01",
      colour_vision_expiry_date: null,
    });
    expect(single.mode).toBe("single");
    expect(single.date).toBe("2020-01-01");
    expect(single.hint).toBe("");
    const same = visionListPresentation({
      qualification_type: VISION,
      expiry_date: "2027-06-01",
      near_vision_expiry_date: "2027-06-01",
      colour_vision_expiry_date: "",
    });
    expect(same.mode).toBe("single");
    expect(same.hint).toBe("colori: come visita");

    const split = visionListPresentation({
      qualification_type: VISION,
      expiry_date: "2028-01-01",
      near_vision_expiry_date: "2027-06-01",
      colour_vision_expiry_date: "2030-06-01",
    });
    expect(split.mode).toBe("split");
    expect(split.lines.map((line) => line.key)).toEqual(["visit", "colour"]);
    expect(split.lines.map((line) => line.date)).toEqual(["2027-06-01", "2030-06-01"]);
  });
});

describe("QualRow — idoneità visiva", () => {
  const handlers = {
    onEdit: vi.fn(),
    onHardDelete: vi.fn(),
    onRenew: vi.fn(),
    onHistory: vi.fn(),
    setHardDeleteId: vi.fn(),
  };

  function row(q) {
    return render(
      <table>
        <tbody>
          <QualRow q={q} tabKey="salute_mansione" hardDeleteId={null} {...handlers} />
        </tbody>
      </table>
    );
  }

  it("colori vuoti: una sola data in elenco", () => {
    row({
      id: 1,
      person_name: "ZZ Visita",
      qualification_type: VISION,
      semaforo: "verde",
      expiry_date: "2027-06-01",
      near_vision_expiry_date: "2027-06-01",
      colour_vision_expiry_date: null,
      effective_expiry_date: "2027-06-01",
    });
    expect(screen.getByText(/colori: come visita/)).toBeInTheDocument();
    expect(screen.getByText(/01\/06\/2027/)).toBeInTheDocument();
    expect(screen.queryByText(/Scadenza test colori/)).not.toBeInTheDocument();
  });

  it("colori diversi: due scadenze in elenco", () => {
    row({
      id: 2,
      person_name: "ZZ Visita",
      qualification_type: VISION,
      semaforo: "verde",
      expiry_date: "2028-01-01",
      near_vision_expiry_date: "2027-06-01",
      colour_vision_expiry_date: "2030-06-01",
      effective_expiry_date: "2027-06-01",
    });
    expect(screen.getByText(/Scadenza visita oculistica/)).toBeInTheDocument();
    expect(screen.getByText(/Scadenza test colori/)).toBeInTheDocument();
    expect(screen.queryByText(/colori: come visita/)).not.toBeInTheDocument();
  });
});
