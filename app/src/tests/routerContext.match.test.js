/**
 * L1 — match rotte: confine di segmento + prefisso più lungo.
 * Regressione: /saldatura/materiali/3 non deve aprire /sal.
 */
import { describe, it, expect } from "vitest";
import { pathMatchesRoute, pathnameOnly, resolveMatchingRoute } from "../contexts/RouterContext";

const APP_PATHS = [
  "/sal",
  "/saldatura/procedure",
  "/saldatura/commesse",
  "/saldatura/materiali",
  "/saldatura/welding-book",
  "/saldatura",
  "/saldatura/rdp",
  "/companies/",
  "/companies",
  "/",
];

describe("pathMatchesRoute", () => {
  it("non confonde /sal con /saldatura", () => {
    expect(pathMatchesRoute("/saldatura", "/sal")).toBe(false);
    expect(pathMatchesRoute("/saldatura/materiali/3", "/sal")).toBe(false);
    expect(pathMatchesRoute("/sal", "/sal")).toBe(true);
    expect(pathMatchesRoute("/sal/extra", "/sal")).toBe(true);
  });

  it("annida /saldatura/materiali/:id sulla pagina Materiali", () => {
    expect(pathMatchesRoute("/saldatura/materiali/4", "/saldatura/materiali")).toBe(true);
    expect(pathMatchesRoute("/saldatura/materiali", "/saldatura/materiali")).toBe(true);
  });

  it("accetta /companies/ con slash finale come prefisso del dettaglio", () => {
    expect(pathMatchesRoute("/companies/42", "/companies/")).toBe(true);
    expect(pathMatchesRoute("/companies/42", "/companies")).toBe(true);
    expect(pathMatchesRoute("/companies", "/companies/")).toBe(false);
  });

  it("ignora ?tab= albero e resta su /documents", () => {
    expect(pathMatchesRoute("/documents?tab=tree", "/documents")).toBe(true);
    expect(pathMatchesRoute("/documents?tab=tree", "/")).toBe(false);
  });
});

describe("resolveMatchingRoute", () => {
  it("sul dettaglio certificato sceglie Materiali, non SAL né dashboard 3834", () => {
    expect(resolveMatchingRoute("/saldatura/materiali/3", APP_PATHS)).toBe("/saldatura/materiali");
  });

  it("sulla lista Materiali resta il match esatto", () => {
    expect(resolveMatchingRoute("/saldatura/materiali", APP_PATHS)).toBe("/saldatura/materiali");
  });

  it("su /sal resta SAL", () => {
    expect(resolveMatchingRoute("/sal", APP_PATHS)).toBe("/sal");
  });

  it("sul dettaglio azienda preferisce /companies/ (più lungo) alla lista", () => {
    expect(resolveMatchingRoute("/companies/42", APP_PATHS)).toBe("/companies/");
  });

  it("sulla lista aziende non apre il dettaglio", () => {
    expect(resolveMatchingRoute("/companies", APP_PATHS)).toBe("/companies");
  });

  it("query string su qualsiasi pagina nota non cade sulla Home", () => {
    const paths = [
      "/",
      "/documents",
      "/nc",
      "/qualifiche",
      "/reclami",
      "/search",
      ...APP_PATHS,
    ];
    const deepLinks = [
      ["/documents?tab=tree", "/documents"],
      ["/documents?tab=catalog", "/documents"],
      ["/documents?tab=tree&select=99&company_id=5", "/documents"],
      ["/nc?select=12", "/nc"],
      ["/qualifiche?qualification_type=iso9606_1", "/qualifiche"],
      ["/qualifiche?company_id=3&highlight=8&section=conferma", "/qualifiche"],
      ["/sal?company_id=11&standard=ISO_9001_2015&clause=4.1", "/sal"],
      ["/reclami?complaint=7", "/reclami"],
    ];
    for (const [href, page] of deepLinks) {
      expect(resolveMatchingRoute(href, paths), href).toBe(page);
    }
  });
});

describe("pathnameOnly", () => {
  it("toglie query e hash", () => {
    expect(pathnameOnly("/documents?tab=tree")).toBe("/documents");
    expect(pathnameOnly("/nc?select=1#x")).toBe("/nc");
    expect(pathnameOnly("/")).toBe("/");
  });
});
