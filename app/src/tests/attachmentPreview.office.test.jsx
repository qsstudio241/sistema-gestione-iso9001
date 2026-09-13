import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AttachmentPreview from "../components/AttachmentPreview";

const mockGetAttachments = vi.fn();
const mockFetchAttachmentBlob = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getAttachments: (...args) => mockGetAttachments(...args),
    fetchAttachmentBlob: (...args) => mockFetchAttachmentBlob(...args),
    deleteAttachment: vi.fn(),
    replaceAttachment: vi.fn(),
  },
}));

vi.mock("../components/InAppOfficeViewer", () => ({
  default: ({ fileName }) => <div data-testid="office-viewer">{fileName}</div>,
}));

vi.mock("../components/AttachmentPreview.css", () => ({}));

describe("AttachmentPreview — Office in-app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttachments.mockResolvedValue({
      data: [
        {
          attachment_id: 11,
          file_name: "matrice.xlsx",
          mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          file_size: 2048,
        },
      ],
    });
    mockFetchAttachmentBlob.mockResolvedValue({ blob: new Blob(["PK"]) });
  });

  it("al click su Excel apre InAppOfficeViewer, non scarica", async () => {
    render(<AttachmentPreview auditId="a1" questionId={5} />);
    await waitFor(() => {
      expect(screen.getByText("matrice.xlsx")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("matrice.xlsx"));
    await waitFor(() => {
      expect(mockFetchAttachmentBlob).toHaveBeenCalledWith(11, "download");
      expect(screen.getByTestId("office-viewer")).toHaveTextContent("matrice.xlsx");
    });
  });
});
