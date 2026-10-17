/**
 * ProtectedFileLink / ProtectedFilePreview — anteprima e download dei certificati
 * senza URL pubblico: fetch autenticato -> blob, errori 401/403/404, fallback mobile.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProtectedFileLink, ProtectedFilePreview } from "../components/ProtectedFile";

const mockFetchBlob = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    fetchProtectedFileBlob: (...args) => mockFetchBlob(...args),
  },
}));

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const UA_DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const URL_PDF = "/uploads/qualifications/qual_1_x.pdf";

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function pdfBlob() {
  return new Blob(["%PDF-1.4"], { type: "application/pdf" });
}

describe("ProtectedFileLink", () => {
  let realUA;
  beforeEach(() => {
    realUA = window.navigator.userAgent;
    window.matchMedia = vi.fn(() => ({ matches: false, media: "", addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
    mockFetchBlob.mockReset();
    mockFetchBlob.mockResolvedValue(pdfBlob());
    setUserAgent(UA_DESKTOP);
  });
  afterEach(() => {
    setUserAgent(realUA);
    vi.restoreAllMocks();
  });

  it("non espone alcun href verso /uploads e non scarica finché non si clicca", () => {
    const { container } = render(
      <ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={5}>Certificato</ProtectedFileLink>,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toContain("/uploads/");
    expect(mockFetchBlob).not.toHaveBeenCalled();
  });

  it("senza fileUrl non renderizza nulla", () => {
    const { container } = render(<ProtectedFileLink fileUrl="" kind="qualifica" recordId={1}>x</ProtectedFileLink>);
    expect(container.innerHTML).toBe("");
  });

  it("desktop: al click scarica il blob e lo mostra in iframe (blob URL)", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(
      <ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={5}>Certificato</ProtectedFileLink>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Certificato" }));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(mockFetchBlob).toHaveBeenCalledWith(URL_PDF);
    expect(container.querySelector("iframe").getAttribute("src")).toBe("blob:fake-url");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("il click non risale alla riga/cella contenitore", async () => {
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <ProtectedFileLink fileUrl={URL_PDF} kind="wpqr" recordId={2}>Apri</ProtectedFileLink>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apri" }));
    await waitFor(() => expect(mockFetchBlob).toHaveBeenCalled());
    expect(onRow).not.toHaveBeenCalled();
  });

  it("download: nome file tipo+id senza PII", async () => {
    const clicked = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") el.click = () => clicked.push({ download: el.download, href: el.href, target: el.target });
      return el;
    });
    render(<ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={12}>Cert</ProtectedFileLink>);
    fireEvent.click(screen.getByRole("button", { name: "Cert" }));
    const dl = await screen.findByTitle("Scarica file");
    await waitFor(() => expect(dl.disabled).toBe(false));
    fireEvent.click(dl);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("qualifica-12.pdf");
    expect(clicked[0].href).toBe("blob:fake-url");
    expect(clicked[0].download).not.toMatch(/qual_1_x/);
  });

  it.each([
    [401, /accedi di nuovo/i],
    [403, /permessi/i],
    [404, /non trovato/i],
  ])("errore %s: messaggio chiaro e nessun iframe", async (status, re) => {
    mockFetchBlob.mockRejectedValue(Object.assign(new Error("x"), { status }));
    const { container } = render(<ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={5}>Cert</ProtectedFileLink>);
    fireEvent.click(screen.getByRole("button", { name: "Cert" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(re);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("errore transitorio: pulsante Riprova che ricarica", async () => {
    mockFetchBlob.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    render(<ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={5}>Cert</ProtectedFileLink>);
    fireEvent.click(screen.getByRole("button", { name: "Cert" }));
    fireEvent.click(await screen.findByRole("button", { name: "Riprova" }));
    await waitFor(() => expect(mockFetchBlob).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["iPhone Safari", UA_IPHONE],
    ["Android Chrome", UA_ANDROID],
  ])("mobile (%s): niente iframe né window.open, pulsante Apri sul blob già scaricato", async (_n, ua) => {
    setUserAgent(ua);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { container } = render(
      <ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={5}>Cert</ProtectedFileLink>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cert" }));
    const apri = await screen.findByRole("button", { name: "Apri" });
    expect(container.querySelector("iframe")).toBeNull();
    expect(mockFetchBlob).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(apri.disabled).toBe(false));

    const clicked = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === "a") el.click = () => clicked.push({ href: el.href, target: el.target });
      return el;
    });
    fireEvent.click(apri);
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(clicked[0]).toMatchObject({ href: "blob:fake-url", target: "_blank" });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("mobile con Web Share: condivide il file con nome tipo+id", async () => {
    setUserAgent(UA_IPHONE);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<ProtectedFileLink fileUrl={URL_PDF} kind="qualifica" recordId={9}>Cert</ProtectedFileLink>);
    fireEvent.click(screen.getByRole("button", { name: "Cert" }));
    const apri = await screen.findByRole("button", { name: "Apri" });
    await waitFor(() => expect(apri.disabled).toBe(false));
    fireEvent.click(apri);
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].files[0].name).toBe("qualifica-9.pdf");
    delete navigator.canShare;
    delete navigator.share;
  });

  it("immagini (es. scansione JPG): mostrate con img e nome .jpg", async () => {
    mockFetchBlob.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
    const { container } = render(<ProtectedFileLink fileUrl="/uploads/qualifications/s.jpg" kind="qualifica" recordId={3}>Cert</ProtectedFileLink>);
    fireEvent.click(screen.getByRole("button", { name: "Cert" }));
    await waitFor(() => expect(container.querySelector("img.pdf-viewer-image")).not.toBeNull());
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("ProtectedFilePreview", () => {
  let realUA;
  beforeEach(() => {
    realUA = window.navigator.userAgent;
    window.matchMedia = vi.fn(() => ({ matches: false, media: "", addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    URL.createObjectURL = vi.fn(() => "blob:preview-url");
    URL.revokeObjectURL = vi.fn();
    mockFetchBlob.mockReset();
    mockFetchBlob.mockResolvedValue(pdfBlob());
    setUserAgent(UA_DESKTOP);
  });
  afterEach(() => setUserAgent(realUA));

  it("desktop: iframe con blob URL e revoke allo smontaggio", async () => {
    const { container, unmount } = render(
      <ProtectedFilePreview fileUrl="/uploads/material-certificates/1/a.pdf" kind="materiale" recordId={4} className="mc-pdf" />,
    );
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(container.querySelector("iframe").getAttribute("src")).toBe("blob:preview-url");
    expect(container.querySelector("iframe").className).toBe("mc-pdf");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-url");
  });

  it("errore 403: messaggio, nessun iframe", async () => {
    mockFetchBlob.mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));
    const { container } = render(
      <ProtectedFilePreview fileUrl="/uploads/material-certificates/1/a.pdf" kind="materiale" recordId={4} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/permessi/i);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("mobile: nessun download automatico né iframe, solo pulsante Apri il PDF", () => {
    setUserAgent(UA_ANDROID);
    const { container } = render(
      <ProtectedFilePreview fileUrl="/uploads/material-certificates/1/a.pdf" kind="materiale" recordId={4} />,
    );
    expect(screen.getByRole("button", { name: "Apri il PDF" })).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(mockFetchBlob).not.toHaveBeenCalled();
  });
});
