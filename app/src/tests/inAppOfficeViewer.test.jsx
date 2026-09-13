import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import InAppOfficeViewer from "../components/InAppOfficeViewer";

vi.mock("../components/DocumentDocxViewer", () => ({
  default: ({ fileName }) => <div data-testid="word-viewer">{fileName}</div>,
}));

vi.mock("../components/SpreadsheetViewer", () => ({
  default: ({ fileName }) => <div data-testid="excel-viewer">{fileName}</div>,
}));

describe("InAppOfficeViewer", () => {
  const file = new File([new Uint8Array([1])], "x.docx");

  it("instrada Word al DocumentDocxViewer", () => {
    render(
      <InAppOfficeViewer kind="word" file={file} fileName="verbale.docx" onClose={() => {}} />
    );
    expect(screen.getByTestId("word-viewer")).toHaveTextContent("verbale.docx");
    expect(screen.queryByTestId("excel-viewer")).toBeNull();
  });

  it("instrada Excel allo SpreadsheetViewer", () => {
    render(
      <InAppOfficeViewer kind="excel" file={file} fileName="tab.xlsx" onClose={() => {}} />
    );
    expect(screen.getByTestId("excel-viewer")).toHaveTextContent("tab.xlsx");
  });

  it("non renderizza nulla per kind sconosciuto", () => {
    const { container } = render(
      <InAppOfficeViewer kind="pdf" file={file} fileName="x.pdf" onClose={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });
});
