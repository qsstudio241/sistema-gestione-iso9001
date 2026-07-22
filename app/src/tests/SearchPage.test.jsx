import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPage from "../pages/SearchPage";

const mockReplace = vi.fn();
const mockNavigate = vi.fn();
const mockGlobalSearch = vi.fn();
const mockAiChat = vi.fn();
const mockGetCompanies = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
  useRouter: () => ({ replace: mockReplace, navigate: mockNavigate, path: "/search" }),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { organization_name: "Studio Test", role: "auditor" },
  }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: (...args) => mockGetCompanies(...args),
    globalSearch: (...args) => mockGlobalSearch(...args),
    aiChat: (...args) => mockAiChat(...args),
  },
}));

describe("SearchPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockReplace.mockReset();
    mockNavigate.mockReset();
    mockGetCompanies.mockResolvedValue({
      data: [{ id: 10, name: "Acme Srl" }],
    });
    mockGlobalSearch.mockResolvedValue({
      success: true,
      totalCount: 1,
      groups: {
        non_conformity: [{
          entityType: "non_conformity",
          id: 42,
          title: "NC-2024-001",
          snippet: "Difetto saldatura",
          status: "open",
          companyName: "Acme Srl",
        }],
        document: [],
        audit: [],
        complaint: [],
        risk: [],
        qualification: [],
      },
    });
    mockAiChat.mockResolvedValue({
      reply: "Trovata una NC simile su saldatura.",
      citations: [{
        entityType: "non_conformity",
        entityId: "42",
        label: "NC-2024-001",
      }],
      sourcesCount: 1,
      contextUsed: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders exact search results grouped with deep links", async () => {
    render(<SearchPage />);

    const input = screen.getByLabelText("Testo ricerca");
    await userEvent.type(input, "saldatura");

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(mockGlobalSearch).toHaveBeenCalledWith(
        expect.objectContaining({ q: "saldatura", limit: 10 }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Non conformit\u00E0 \(1\)/)).toBeTruthy();
    });
    expect(screen.getByText("NC-2024-001")).toBeTruthy();
    expect(screen.getByText("NC-2024-001").closest("a")).toHaveAttribute(
      "href",
      "/nc?select=42",
    );
  });

  it("switches to semantic mode and calls aiChat", async () => {
    render(<SearchPage />);

    const input = screen.getByLabelText("Testo ricerca");
    await userEvent.type(input, "NC simili saldatura");

    await vi.advanceTimersByTimeAsync(400);
    mockGlobalSearch.mockClear();

    await userEvent.click(screen.getByRole("tab", { name: "Significato" }));
    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(mockAiChat).toHaveBeenCalledWith(
        "NC simili saldatura",
        expect.any(Object),
      );
    });

    expect(mockGlobalSearch).not.toHaveBeenCalled();
    expect(screen.getByText(/Trovata una NC simile/)).toBeTruthy();
    expect(screen.getByText(/Basato su 1 record del SGQ/)).toBeTruthy();
  });

  it("passes companyId filter when scope is selected", async () => {
    render(<SearchPage />);

    await waitFor(() => {
      expect(mockGetCompanies).toHaveBeenCalled();
    });

    await userEvent.selectOptions(
      screen.getByLabelText("Ambito ricerca"),
      "10",
    );

    const input = screen.getByLabelText("Testo ricerca");
    await userEvent.type(input, "procedura");

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() => {
      expect(mockGlobalSearch).toHaveBeenCalledWith(
        expect.objectContaining({ q: "procedura", companyId: "10" }),
      );
    });
  });
});
