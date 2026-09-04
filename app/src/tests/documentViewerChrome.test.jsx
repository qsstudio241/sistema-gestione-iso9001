/**
 * Test L1 — chrome unico visualizzatori documenti (Chiudi / Scarica / Schermo intero).
 */
import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DocumentViewerChrome, { withFullscreenClass } from "../components/DocumentViewerChrome";

describe("withFullscreenClass", () => {
  it("aggiunge il suffisso --fullscreen a ogni classe", () => {
    expect(withFullscreenClass("pdf-viewer-overlay", false)).toBe("pdf-viewer-overlay");
    expect(withFullscreenClass("pdf-viewer-overlay", true)).toBe(
      "pdf-viewer-overlay pdf-viewer-overlay--fullscreen"
    );
  });
});

describe("DocumentViewerChrome", () => {
  it("mostra Chiudi, Scarica e Schermo intero senza pulsanti da finestra OS", () => {
    render(
      <DocumentViewerChrome
        title="Verbale.pdf"
        onClose={() => {}}
        downloadHref="/file.pdf"
        fullscreen={false}
        onToggleFullscreen={() => {}}
      >
        <div>anteprima</div>
      </DocumentViewerChrome>
    );

    expect(screen.getByTitle("Chiudi")).toBeInTheDocument();
    expect(screen.getByTitle("Scarica file")).toBeInTheDocument();
    expect(screen.getByTitle("Schermo intero")).toBeInTheDocument();
    expect(screen.queryByTitle("Ingrandisci")).toBeNull();
    expect(screen.queryByLabelText("chiudi finestra")).toBeNull();
    expect(document.body.textContent).not.toMatch(/[─□✕]/);
  });

  it("toggla la classe fullscreen sul overlay (viewport in-app)", () => {
    function Harness() {
      const [fullscreen, setFullscreen] = useState(false);
      return (
        <DocumentViewerChrome
          title="Scheda.docx"
          onClose={() => {}}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
        >
          <div>corpo</div>
        </DocumentViewerChrome>
      );
    }

    const { container } = render(<Harness />);
    const overlay = container.querySelector('[data-testid="document-viewer-overlay"]');
    const box = container.querySelector('[data-testid="document-viewer-container"]');

    expect(overlay.className).toContain("pdf-viewer-overlay");
    expect(overlay.className).not.toContain("pdf-viewer-overlay--fullscreen");
    expect(overlay.getAttribute("data-fullscreen")).toBe("false");

    fireEvent.click(screen.getByTitle("Schermo intero"));
    expect(overlay.className).toContain("pdf-viewer-overlay--fullscreen");
    expect(box.className).toContain("pdf-viewer-container--fullscreen");
    expect(overlay.getAttribute("data-fullscreen")).toBe("true");
    expect(screen.getByTitle("Riduci")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Riduci"));
    expect(overlay.className).not.toContain("--fullscreen");
    expect(screen.getByTitle("Schermo intero")).toBeInTheDocument();
  });

  it("nasconde Scarica se non è previsto", () => {
    render(
      <DocumentViewerChrome title="Solo lettura" onClose={() => {}} onToggleFullscreen={() => {}}>
        <div />
      </DocumentViewerChrome>
    );
    expect(screen.queryByTitle("Scarica file")).toBeNull();
    expect(screen.getByTitle("Chiudi")).toBeInTheDocument();
  });

  it("chiude dal pulsante e dal click sull overlay", () => {
    const onClose = vi.fn();
    render(
      <DocumentViewerChrome title="x" onClose={onClose} onToggleFullscreen={() => {}}>
        <div>corpo</div>
      </DocumentViewerChrome>
    );
    fireEvent.click(screen.getByTitle("Chiudi"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("document-viewer-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
