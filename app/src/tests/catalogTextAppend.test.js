import { describe, it, expect } from "vitest";
import {
  formatContextFactorLine,
  formatInterestedPartyLine,
  appendCatalogLine,
} from "../utils/catalogTextAppend";

describe("catalogTextAppend", () => {
  it("formatta fattore e parte", () => {
    expect(formatContextFactorLine({ category: "Mercato", description: "Nuovo competitor" }))
      .toBe("Mercato: Nuovo competitor");
    expect(formatContextFactorLine({ description: "Solo testo" })).toBe("Solo testo");
    expect(formatContextFactorLine({})).toBe("");
    expect(formatInterestedPartyLine({ name: "Cliente", requirements: "On time" }))
      .toBe("Cliente — On time");
    expect(formatInterestedPartyLine({ name: "Ente" })).toBe("Ente");
  });

  it("accoda senza sovrascrivere e non duplica", () => {
    expect(appendCatalogLine("", "Cliente — On time")).toBe("Cliente — On time");
    expect(appendCatalogLine("Già scritto", "Cliente — On time")).toBe("Già scritto\nCliente — On time");
    expect(appendCatalogLine("Cliente — On time", "Cliente — On time")).toBe("Cliente — On time");
    expect(appendCatalogLine("Prefisso Cliente — On time", "Cliente — On time"))
      .toBe("Prefisso Cliente — On time");
  });
});
