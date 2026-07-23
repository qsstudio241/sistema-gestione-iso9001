/**
 * Test slice UAL-3 — AcceptInvitePage (pagina pubblica "Attiva il tuo account").
 * Verifica: verifica token (loading/valido/invalido), validazione password lato
 * form, invio corretto e messaggio di successo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AcceptInvitePage from "../pages/AcceptInvitePage";

const mockNavigate = vi.fn();
const mockCheckInviteToken = vi.fn();
const mockAcceptInvite = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../services/apiService", () => ({
  default: {
    checkInviteToken: (...args) => mockCheckInviteToken(...args),
    acceptInvite: (...args) => mockAcceptInvite(...args),
  },
}));

beforeEach(() => {
  mockNavigate.mockReset();
  mockCheckInviteToken.mockReset();
  mockAcceptInvite.mockReset();
});

describe("AcceptInvitePage — verifica del token", () => {
  it("mostra un messaggio di caricamento mentre verifica il token", () => {
    mockCheckInviteToken.mockReturnValue(new Promise(() => {})); // pending
    render(<AcceptInvitePage token="tok-123" />);
    expect(screen.getByText("Verifica del link di invito in corso...")).toBeInTheDocument();
  });

  it("mostra un errore comprensibile per un token scaduto o invalido", async () => {
    mockCheckInviteToken.mockRejectedValue(new Error("Il link di invito è scaduto."));
    render(<AcceptInvitePage token="tok-scaduto" />);

    await waitFor(() => {
      expect(screen.getByText("Il link di invito è scaduto.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Vai al login" })).toBeInTheDocument();
  });

  it("senza token in URL mostra subito l'errore, senza chiamare l'API", () => {
    render(<AcceptInvitePage token="" />);
    expect(screen.getByText("Link di invito non valido.")).toBeInTheDocument();
    expect(mockCheckInviteToken).not.toHaveBeenCalled();
  });

  it("mostra il form password con email/nome dell'invitato per un token valido", async () => {
    mockCheckInviteToken.mockResolvedValue({ data: { email: "nuovo@test.it", full_name: "Mario Rossi" } });
    render(<AcceptInvitePage token="tok-valido" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Nuova password/)).toBeInTheDocument();
    });
    expect(screen.getByText("nuovo@test.it")).toBeInTheDocument();
    expect(screen.getByText(/Ciao Mario Rossi/)).toBeInTheDocument();
  });
});

describe("AcceptInvitePage — invio del form", () => {
  beforeEach(() => {
    mockCheckInviteToken.mockResolvedValue({ data: { email: "nuovo@test.it", full_name: "Mario Rossi" } });
  });

  it("rifiuta una password troppo corta senza chiamare l'API", async () => {
    const user = userEvent.setup();
    render(<AcceptInvitePage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "corta");
    await user.type(screen.getByLabelText(/Conferma password/), "corta");
    await user.click(screen.getByRole("button", { name: "Attiva account" }));

    expect(screen.getByText("La password deve avere almeno 8 caratteri.")).toBeInTheDocument();
    expect(mockAcceptInvite).not.toHaveBeenCalled();
  });

  it("rifiuta se le due password non coincidono", async () => {
    const user = userEvent.setup();
    render(<AcceptInvitePage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "password123");
    await user.type(screen.getByLabelText(/Conferma password/), "password456");
    await user.click(screen.getByRole("button", { name: "Attiva account" }));

    expect(screen.getByText("Le due password non coincidono.")).toBeInTheDocument();
    expect(mockAcceptInvite).not.toHaveBeenCalled();
  });

  it("invia token e password all'API e mostra il messaggio di successo", async () => {
    mockAcceptInvite.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<AcceptInvitePage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "password123");
    await user.type(screen.getByLabelText(/Conferma password/), "password123");
    await user.click(screen.getByRole("button", { name: "Attiva account" }));

    await waitFor(() => {
      expect(mockAcceptInvite).toHaveBeenCalledWith("tok-valido", "password123");
    });
    expect(await screen.findByText(/Password impostata correttamente/)).toBeInTheDocument();
  });

  it("mostra l'errore del server se accept-invite fallisce (es. token consumato nel frattempo)", async () => {
    mockAcceptInvite.mockRejectedValue(new Error("Il link è già stato utilizzato."));
    const user = userEvent.setup();
    render(<AcceptInvitePage token="tok-valido" />);

    await waitFor(() => screen.getByLabelText(/Nuova password/));

    await user.type(screen.getByLabelText(/Nuova password/), "password123");
    await user.type(screen.getByLabelText(/Conferma password/), "password123");
    await user.click(screen.getByRole("button", { name: "Attiva account" }));

    expect(await screen.findByText("Il link è già stato utilizzato.")).toBeInTheDocument();
  });
});
