/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import AttachmentSection, {
  splitDroppedAttachmentFiles,
} from "../components/AttachmentSection.jsx";

vi.mock("../components/PhotoEditModal", () => ({
  default: ({ files }) => (
    <div data-testid="photo-edit-modal">
      {files.map((f) => (
        <span key={f.name}>{f.name}</span>
      ))}
    </div>
  ),
}));

function makeFile(name, type) {
  return new File(["x"], name, { type });
}

function mockManager(overrides = {}) {
  return {
    listAttachments: () => [],
    getStats: () => ({ count: 0, totalSizeMB: 0, remaining: 5 }),
    addAttachments: vi.fn().mockResolvedValue({ success: true, uploaded: 1 }),
    isUploading: false,
    uploadProgress: null,
    limits: {
      maxFilesPerQuestion: 10,
      maxFileSize: 10 * 1024 * 1024,
      maxCumulativeSize: 50 * 1024 * 1024,
    },
    openFilePicker: vi.fn(),
    removeAttachment: vi.fn(),
    ...overrides,
  };
}

describe("splitDroppedAttachmentFiles", () => {
  it("separa immagini e documenti", () => {
    const foto = makeFile("saldatura.jpg", "image/jpeg");
    const pdf = makeFile("verbale.pdf", "application/pdf");
    const { images, documents } = splitDroppedAttachmentFiles([foto, pdf]);
    expect(images).toEqual([foto]);
    expect(documents).toEqual([pdf]);
  });
});

describe("AttachmentSection drop misto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("le foto vanno all'editor, i PDF restano documenti", async () => {
    const attachmentManager = mockManager();
    render(
      <AttachmentSection
        questionId="4.1"
        attachmentManager={attachmentManager}
      />
    );

    const zone = screen.getByRole("button", {
      name: /Trascina qui i file o clicca per selezionare/i,
    });
    const foto = makeFile("saldatura.jpg", "image/jpeg");
    const pdf = makeFile("verbale.pdf", "application/pdf");
    fireEvent.drop(zone, { dataTransfer: { files: [foto, pdf] } });

    expect(screen.getByTestId("photo-edit-modal")).toHaveTextContent(
      "saldatura.jpg"
    );
    expect(screen.getByTestId("photo-edit-modal")).not.toHaveTextContent(
      "verbale.pdf"
    );

    await waitFor(() => {
      expect(attachmentManager.addAttachments).toHaveBeenCalledTimes(1);
    });
    const [, category, files] = attachmentManager.addAttachments.mock.calls[0];
    expect(category).toBe("documenti");
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("verbale.pdf");
  });
});
