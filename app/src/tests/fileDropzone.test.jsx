/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import FileDropzone from "../components/FileDropzone.jsx";

function makeFile(name = "doc.pdf", type = "application/pdf") {
  return new File(["x"], name, { type });
}

describe("FileDropzone", () => {
  it("apre il picker e emette il file scelto", () => {
    const onFiles = vi.fn();
    render(<FileDropzone onFiles={onFiles} />);
    const input = document.querySelector('input[type="file"]');
    const file = makeFile();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0]).toBe(file);
  });

  it("accetta il drop da dataTransfer", () => {
    const onFiles = vi.fn();
    render(<FileDropzone onFiles={onFiles} ariaLabel="Zona file" />);
    const zone = screen.getByRole("button", { name: "Zona file" });
    const file = makeFile("rilasciato.pdf");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe("rilasciato.pdf");
  });

  it("in multiple passa tutti i file", () => {
    const onFiles = vi.fn();
    render(<FileDropzone multiple onFiles={onFiles} />);
    const input = document.querySelector('input[type="file"]');
    const files = [makeFile("a.pdf"), makeFile("b.pdf")];
    fireEvent.change(input, { target: { files } });
    expect(onFiles.mock.calls[0][0]).toHaveLength(2);
  });

  it("disabilitato non emette file", () => {
    const onFiles = vi.fn();
    render(<FileDropzone disabled onFiles={onFiles} ariaLabel="Zona bloccata" />);
    const zone = screen.getByRole("button", { name: "Zona bloccata" });
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile()] } });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
