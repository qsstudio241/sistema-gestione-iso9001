/**
 * L1 — match rotte: confine di segmento + prefisso più lungo.
 * Regressione: /saldatura/materiali/3 non deve aprire /sal.
 */
import { describe, it, expect } from "vitest";
import { pathMatchesRoute, resolveMatchingRoute } from "../contexts/RouterContext";

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
});
