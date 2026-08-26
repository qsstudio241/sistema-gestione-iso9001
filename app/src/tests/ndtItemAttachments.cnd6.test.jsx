/**
 * @vitest-environment jsdom
 * CND-6: NdtItemAttachments — touch/feedback/read-only + validazione file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { createRef } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "fs";
import { resolve } from "path";

vi.mock("../services/apiService", () => ({
  default: {
    baseUrl: "https://api.test",
    getToken: () => "tok",
    get: vi.fn().mockResolvedValue({ data: [] }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../hooks/useAttachmentManager", () => ({
  compressImageFile: vi.fn(async (f) => f),
}));

import apiService from "../services/apiService";
import NdtItemAttachments, { isAcceptedImage } from "../components/NdtItemAttachments.jsx";

describe("isAcceptedImage", () => {
  it("accetta JPEG/PNG/WebP e HEIC per nome", () => {
    expect(isAcceptedImage({ type: "image/jpeg", name: "a.jpg" })).toBe(true);
    expect(isAcceptedImage({ type: "image/png", name: "a.png" })).toBe(true);
    expect(isAcceptedImage({ type: "", name: "foto.heic" })).toBe(true);
    expect(isAcceptedImage({ type: "application/pdf", name: "x.pdf" })).toBe(false);
  });
});

describe("NdtItemAttachments — CND-6", () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    apiService.get.mockResolvedValue({ data: [] });
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("in read-only openFilePicker non apre e non mostra elimina", async () => {
    apiService.get.mockResolvedValue({
      data: [{ attachment_id: 9, file_name: "marca.jpg" }],
    });
    const ref = createRef();
    render(<NdtItemAttachments ref={ref} itemId={42} readOnly />);
    await screen.findByAltText("marca.jpg");
    expect(screen.getByText(/Solo lettura/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Elimina foto/ })).toBeNull();

    const clickSpy = vi.fn();
    const input = document.querySelector(".ndt-att-file-input");
    input.addEventListener("click", clickSpy);
    act(() => {
      ref.current.openFilePicker();
    });
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("rifiuta PDF con errore leggibile e Chiudi", async () => {
    const user = userEvent.setup();
    render(<NdtItemAttachments itemId={7} />);
    await waitFor(() => expect(apiService.get).toHaveBeenCalled());

    const input = document.querySelector(".ndt-att-file-input");
    const pdf = new File(["%PDF"], "verbale.pdf", { type: "application/pdf" });
    // bypass accept= del browser: onChange diretto
    await act(async () => {
      Object.defineProperty(input, "files", { value: [pdf], configurable: true });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Formato non supportato/);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Chiudi messaggio/ }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra status durante upload e aggiorna galleria", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ attachment_id: 1 }),
    });
    apiService.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ attachment_id: 1, file_name: "scatto.jpg" }],
      });

    render(<NdtItemAttachments itemId={3} />);
    await waitFor(() => expect(apiService.get).toHaveBeenCalled());

    const input = document.querySelector(".ndt-att-file-input");
    const img = new File([new Uint8Array([1, 2, 3])], "scatto.jpg", { type: "image/jpeg" });
    await user.upload(input, img);

    await screen.findByAltText("scatto.jpg");
    expect(fetchMock).toHaveBeenCalled();
    expect(document.querySelector(".ndt-att-file-input").getAttribute("capture")).toBe("environment");
  });

  it("CSS mobile ha delete >= 44px e thumb grandi", () => {
    const css = readFileSync(resolve("src/components/NdtItemAttachments.css"), "utf8");
    expect(css).toMatch(/@media \(max-width:\s*768px\)/);
    expect(css).toMatch(/width:\s*44px/);
    expect(css).toMatch(/height:\s*44px/);
    expect(css).toMatch(/ndt-att-error/);
  });
});
