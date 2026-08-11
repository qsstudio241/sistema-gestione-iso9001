import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersAdminPage from "../components/UsersAdminPage";

const mockGetAdminUsers = vi.fn();
const mockGetAuditorOrgs = vi.fn();
const mockGetUserCompanyAccess = vi.fn();
const mockGetCompanies = vi.fn();
const mockAddUserCompanyAccess = vi.fn();
const mockRemoveUserCompanyAccess = vi.fn();
const mockGetUserAuditLog = vi.fn();

let mockAuthUser = null;

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

const mockCreateAdminUser = vi.fn();
const mockResendUserInvite = vi.fn();
const mockCreateAuditorOrg = vi.fn();
const mockInviteStudioAdmin = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getAdminUsers: (...args) => mockGetAdminUsers(...args),
    getAuditorOrgs: (...args) => mockGetAuditorOrgs(...args),
    getUserCompanyAccess: (...args) => mockGetUserCompanyAccess(...args),
    getCompanies: (...args) => mockGetCompanies(...args),
    addUserCompanyAccess: (...args) => mockAddUserCompanyAccess(...args),
    removeUserCompanyAccess: (...args) => mockRemoveUserCompanyAccess(...args),
    getUserAuditLog: (...args) => mockGetUserAuditLog(...args),
    patchAdminUser: vi.fn(),
    createAdminUser: (...args) => mockCreateAdminUser(...args),
    resendUserInvite: (...args) => mockResendUserInvite(...args),
    deactivateAdminUser: vi.fn(),
    updateUserStandards: vi.fn(),
    patchOrgLicenses: vi.fn(),
    createAuditorOrg: (...args) => mockCreateAuditorOrg(...args),
    inviteStudioAdmin: (...args) => mockInviteStudioAdmin(...args),
  },
}));

const USERS_CROSS_TENANT = [
  {
    user_id: 1,
    email: "mario@studiouno.it",
    full_name: "Mario Rossi",
    role: "auditor",
    auditor_org_id: 10,
    organization_id: 1001,
    organization_name: "Org Uno",
    auditor_org_name: "Studio Uno",
    is_active: true,
    allowed_standard_ids: [],
  },
  {
    user_id: 2,
    email: "luigi@studiodue.it",
    full_name: "Luigi Bianchi",
    role: "viewer",
    auditor_org_id: 20,
    organization_id: 1002,
    organization_name: "Org Due",
    auditor_org_name: "Studio Due",
    is_active: true,
    allowed_standard_ids: [],
  },
];

const AUDITOR_ORGS = [
  { id: 10, organization_id: 1001, name: "Studio Uno", licensed_modules: null },
  { id: 20, organization_id: 1002, name: "Studio Due", licensed_modules: null },
];

beforeEach(() => {
  mockCreateAdminUser.mockReset().mockResolvedValue({ success: true, data: {} });
  mockResendUserInvite.mockReset().mockResolvedValue({ success: true });
  mockCreateAuditorOrg.mockReset();
  mockInviteStudioAdmin.mockReset().mockResolvedValue({ success: true, data: {} });
  global.alert = vi.fn();
  mockGetAdminUsers.mockResolvedValue({ data: USERS_CROSS_TENANT });
  mockGetAuditorOrgs.mockResolvedValue({ data: AUDITOR_ORGS });
  mockGetUserCompanyAccess.mockResolvedValue({
    data: [{ id: 1, company_id: 7, permission: "read", company_name: "Azienda Sette" }],
  });
  mockGetCompanies.mockResolvedValue({
    data: [
      { id: 7, name: "Azienda Sette" },
      { id: 8, name: "Azienda Otto" },
    ],
  });
  mockAddUserCompanyAccess.mockResolvedValue({ success: true, data: { company_id: 8, permission: "read" } });
  mockRemoveUserCompanyAccess.mockResolvedValue({ success: true });
  mockGetUserAuditLog.mockResolvedValue({
    data: [
      {
        id: 2,
        action_type: "deactivated",
        field_changed: "is_active",
        created_at: "2026-07-23T10:00:00Z",
        actor_name: "Admin Uno",
      },
      {
        id: 1,
        action_type: "user_created",
        created_at: "2026-07-01T09:00:00Z",
        actor_name: "Admin Uno",
      },
    ],
  });
});

describe("UsersAdminPage — G7/G8 vista piattaforma superadmin", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 99, role: "superadmin", organization_id: 1001 };
  });

  it("mostra il banner 'Vista piattaforma' e il badge organizzazione per ogni utente (superadmin)", async () => {
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Vista piattaforma — tutte le organizzazioni")).toBeInTheDocument();
    });

    expect(screen.getByText("Org Uno")).toBeInTheDocument();
    expect(screen.getByText("Org Due")).toBeInTheDocument();
  });
});

describe("UsersAdminPage — admin di studio (non cross-tenant)", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 5, role: "admin", organization_id: 1001, auditor_org_id: 10 };
    mockGetAdminUsers.mockResolvedValue({ data: [USERS_CROSS_TENANT[0]] });
  });

  it("non mostra il banner piattaforma né il badge organizzazione", async () => {
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    expect(screen.queryByText("Vista piattaforma — tutte le organizzazioni")).not.toBeInTheDocument();
    expect(screen.queryByText("Org Uno")).not.toBeInTheDocument();
  });
});

describe("UsersAdminPage — sezione Accesso aziende clienti", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 5, role: "admin", organization_id: 1001, auditor_org_id: 10 };
    mockGetAdminUsers.mockResolvedValue({ data: [USERS_CROSS_TENANT[0]] });
  });

  it("apre la sezione, elenca gli accessi assegnati e permette di aggiungerne uno nuovo", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    const toggle = screen.getByText("Accesso aziende clienti (clic per aprire o chiudere)");
    await user.click(toggle);

    await waitFor(() => {
      expect(mockGetUserCompanyAccess).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText("Azienda Sette")).toBeInTheDocument();
    });
    expect(document.querySelector(".company-access-badge.read").textContent).toBe("Lettura");

    await waitFor(() => {
      expect(mockGetCompanies).toHaveBeenCalledWith(
        expect.objectContaining({ auditor_org_id: 10 })
      );
    });

    const details = toggle.closest("details");
    const select = within(details).getByDisplayValue("- Seleziona azienda -");
    // L'azienda già assegnata (Azienda Sette) non deve comparire tra le opzioni disponibili
    expect(within(select).queryByText("Azienda Sette")).not.toBeInTheDocument();
    expect(within(select).getByText("Azienda Otto")).toBeInTheDocument();

    await user.selectOptions(select, "8");
    const addButton = within(details).getByRole("button", { name: "Aggiungi" });
    await user.click(addButton);

    await waitFor(() => {
      expect(mockAddUserCompanyAccess).toHaveBeenCalledWith(1, { company_id: 8, permission: "read" });
    });
  });
});

describe("UsersAdminPage — sezione Storico modifiche (UAL-2)", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 5, role: "admin", organization_id: 1001, auditor_org_id: 10 };
    mockGetAdminUsers.mockResolvedValue({ data: [USERS_CROSS_TENANT[0]] });
  });

  it("apre la sezione e mostra gli eventi in ordine cronologico inverso (data, autore, cosa)", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    const toggle = screen.getByText("Storico modifiche (clic per aprire o chiudere)");
    await user.click(toggle);

    await waitFor(() => {
      expect(mockGetUserAuditLog).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText("Account disattivato")).toBeInTheDocument();
    });
    expect(screen.getByText("Utente creato")).toBeInTheDocument();

    const details = toggle.closest("details");
    const items = within(details).getAllByRole("listitem");
    // Ordine cronologico inverso: l'evento più recente (deactivated) è il primo
    expect(within(items[0]).getByText("Account disattivato")).toBeInTheDocument();
    expect(within(items[1]).getByText("Utente creato")).toBeInTheDocument();
    expect(within(details).getAllByText("Admin Uno").length).toBeGreaterThan(0);
  });

  it("mostra un messaggio quando non ci sono eventi registrati", async () => {
    mockGetUserAuditLog.mockResolvedValueOnce({ data: [] });
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    const toggle = screen.getByText("Storico modifiche (clic per aprire o chiudere)");
    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByText("Nessuna modifica registrata per questo utente.")).toBeInTheDocument();
    });
  });
});

describe("UsersAdminPage — creazione utente: modalità password vs invito (UAL-3)", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 5, role: "admin", organization_id: 1001, auditor_org_id: 10 };
    mockGetAdminUsers.mockResolvedValue({ data: [USERS_CROSS_TENANT[0]] });
  });

  it("di default è selezionata la modalità 'Imposta password ora' e il campo password è visibile", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    await user.click(screen.getByText("+ Nuovo utente"));

    const passwordRadio = screen.getByRole("radio", { name: "Imposta password ora" });
    const inviteRadio = screen.getByRole("radio", { name: "Invia invito via email" });
    expect(passwordRadio).toBeChecked();
    expect(inviteRadio).not.toBeChecked();
    expect(screen.getByLabelText("Password (min. 8)")).toBeInTheDocument();
  });

  it("crea l'utente con password quando la modalità classica è selezionata (comportamento invariato)", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    await user.click(screen.getByText("+ Nuovo utente"));
    await user.type(screen.getByLabelText("Email"), "nuovo@test.it");
    await user.type(screen.getByLabelText("Password (min. 8)"), "password123");
    await user.type(screen.getByLabelText("Nome e cognome"), "Nuovo Utente");
    await user.selectOptions(screen.getByLabelText("Ruolo"), "viewer");
    await user.click(screen.getByRole("button", { name: "Crea utente" }));

    await waitFor(() => {
      expect(mockCreateAdminUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nuovo@test.it",
          password: "password123",
          full_name: "Nuovo Utente",
        })
      );
    });
    expect(mockCreateAdminUser.mock.calls[0][0].send_invite).toBeUndefined();
  });

  it("selezionando 'Invia invito via email' nasconde il campo password e invia send_invite: true", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    await user.click(screen.getByText("+ Nuovo utente"));
    await user.click(screen.getByRole("radio", { name: "Invia invito via email" }));

    expect(screen.queryByLabelText("Password (min. 8)")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "invitato@test.it");
    await user.type(screen.getByLabelText("Nome e cognome"), "Invitato Test");
    await user.selectOptions(screen.getByLabelText("Ruolo"), "viewer");
    await user.click(screen.getByRole("button", { name: "Crea utente e invia invito" }));

    await waitFor(() => {
      expect(mockCreateAdminUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "invitato@test.it",
          full_name: "Invitato Test",
          send_invite: true,
        })
      );
    });
    expect(mockCreateAdminUser.mock.calls[0][0].password).toBeUndefined();
  });
});

describe("UsersAdminPage — badge 'In attesa di attivazione' e reinvio invito (UAL-3)", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 5, role: "admin", organization_id: 1001, auditor_org_id: 10 };
    mockGetAdminUsers.mockResolvedValue({
      data: [{ ...USERS_CROSS_TENANT[0], pending_activation: true }],
    });
  });

  it("mostra il badge 'In attesa di attivazione' e il pulsante Reinvia invito per un utente pending", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    expect(screen.getByText("In attesa di attivazione")).toBeInTheDocument();
    const resendButton = screen.getByRole("button", { name: "Reinvia invito" });

    await user.click(resendButton);

    await waitFor(() => {
      expect(mockResendUserInvite).toHaveBeenCalledWith(1);
    });
  });

  it("non mostra il badge pending né il pulsante Reinvia invito per un utente già attivato", async () => {
    mockGetAdminUsers.mockResolvedValue({
      data: [{ ...USERS_CROSS_TENANT[0], pending_activation: false }],
    });
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    expect(screen.queryByText("In attesa di attivazione")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reinvia invito" })).not.toBeInTheDocument();
  });
});

describe("UsersAdminPage — provisioning nuovo studio (DEPUTYTASK1 S2/S3)", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 99, role: "superadmin", organization_id: 1001 };
  });

  it("mostra il pulsante '+ Nuovo studio' solo per superadmin", async () => {
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "+ Nuovo studio" })).toBeInTheDocument();
  });

  it("non mostra il pulsante '+ Nuovo studio' per admin di studio (non superadmin)", async () => {
    mockAuthUser = { user_id: 5, role: "admin", organization_id: 1001, auditor_org_id: 10 };
    mockGetAdminUsers.mockResolvedValue({ data: [USERS_CROSS_TENANT[0]] });
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    });

    expect(screen.queryByText("Licenze moduli per studio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nuovo studio" })).not.toBeInTheDocument();
  });

  it("validazione client-side: blocca il submit se un campo obbligatorio è vuoto", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "+ Nuovo studio" }));
    await user.type(screen.getByLabelText("Nome cliente/organizzazione"), "Nuovo Cliente Srl");
    // Nome studio ed email referente restano vuoti
    await user.click(screen.getByRole("button", { name: "Crea studio" }));

    await waitFor(() => {
      expect(
        screen.getByText("Compila nome cliente, nome studio ed email referente.")
      ).toBeInTheDocument();
    });
    expect(mockCreateAuditorOrg).not.toHaveBeenCalled();
  });

  it("submit valido: crea lo studio, lo aggiunge subito alla lista e mostra il messaggio di successo", async () => {
    const newAo = {
      id: 30,
      organization_id: 1003,
      name: "Studio Tre",
      email: "referente@studiotre.it",
      subscription_plan: "standard",
      is_active: true,
      organization_name: "Cliente Tre Srl",
      licensed_modules: null,
    };
    mockCreateAuditorOrg.mockResolvedValue({ success: true, data: newAo });

    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "+ Nuovo studio" }));
    await user.type(screen.getByLabelText("Nome cliente/organizzazione"), "Cliente Tre Srl");
    await user.type(screen.getByLabelText("Nome studio"), "Studio Tre");
    await user.type(screen.getByLabelText("Email referente"), "referente@studiotre.it");
    await user.click(screen.getByRole("button", { name: "Crea studio" }));

    await waitFor(() => {
      expect(mockCreateAuditorOrg).toHaveBeenCalledWith({
        organization_name: "Cliente Tre Srl",
        studio_name: "Studio Tre",
        studio_email: "referente@studiotre.it",
        subscription_plan: "standard",
      });
    });

    // La nuova entry appare immediatamente in lista (S2), senza refetch
    await waitFor(() => {
      expect(screen.getByText("Studio Tre")).toBeInTheDocument();
    });
    expect(screen.getByText("Cliente Tre Srl")).toBeInTheDocument();
    expect(screen.getByText(/Studio creato/)).toBeInTheDocument();

    // Il form si chiude dopo il successo
    expect(screen.queryByLabelText("Nome studio")).not.toBeInTheDocument();
  });

  // S3 (verifica — gap architetturale documentato, non un fix applicato qui):
  // il selettore studio del form "Nuovo utente" filtra su
  // `ao.organization_id === user.organization_id` (riga ~727), quindi anche per
  // superadmin mostra solo gli studi della PROPRIA organizzazione. Un nuovo studio
  // creato da questo brief ha sempre un organization_id NUOVO e diverso da quello
  // del superadmin che lo crea: non compare in questo selettore, e anche se
  // comparisse il backend (admin.controller.js createUser) forza
  // organization_id = req.user.organization_id e valida auditor_org_id sulla
  // stessa organizzazione, quindi il submit fallirebbe con 400
  // INVALID_AUDITOR_ORG. Risolverlo richiede toccare POST /admin/users
  // (esplicitamente "Cosa NON toccare" in questo brief, ed è comunque un cambio
  // Alto rischio su creazione utenti/auth cross-tenant) — FIX NON APPLICABILE
  // in questo slice, da riportare come backlog al committente/Lead.
  it("S3: il selettore studio di 'Nuovo utente' NON mostra ancora un nuovo studio cross-tenant (gap noto, backend createUser fuori scope)", async () => {
    const newAo = {
      id: 30,
      organization_id: 1003,
      name: "Studio Tre",
      email: "referente@studiotre.it",
      subscription_plan: "standard",
      is_active: true,
      organization_name: "Cliente Tre Srl",
      licensed_modules: null,
    };
    mockCreateAuditorOrg.mockResolvedValue({ success: true, data: newAo });

    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "+ Nuovo studio" }));
    await user.type(screen.getByLabelText("Nome cliente/organizzazione"), "Cliente Tre Srl");
    await user.type(screen.getByLabelText("Nome studio"), "Studio Tre");
    await user.type(screen.getByLabelText("Email referente"), "referente@studiotre.it");
    await user.click(screen.getByRole("button", { name: "Crea studio" }));

    await waitFor(() => {
      expect(screen.getByText("Studio Tre")).toBeInTheDocument();
    });

    await user.click(screen.getByText("+ Nuovo utente"));
    const studioSelect = screen.getByLabelText(/Studio \(auditor org\)/);
    // Documenta il gap: lo studio appena creato (org 1003, diversa da quella del
    // superadmin loggato, 1001) non è selezionabile da questo form.
    expect(within(studioSelect).queryByText("Studio Tre")).not.toBeInTheDocument();
  });

  it("mostra un messaggio di errore inline se il backend risponde 409 (nome/email duplicati)", async () => {
    mockCreateAuditorOrg.mockRejectedValue(
      Object.assign(new Error("Esiste già un'organizzazione con questo nome"), {
        code: "DUPLICATE_ORGANIZATION_NAME",
      })
    );

    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "+ Nuovo studio" }));
    await user.type(screen.getByLabelText("Nome cliente/organizzazione"), "Studio Uno Org");
    await user.type(screen.getByLabelText("Nome studio"), "Studio Duplicato");
    await user.type(screen.getByLabelText("Email referente"), "dup@studio.it");
    await user.click(screen.getByRole("button", { name: "Crea studio" }));

    await waitFor(() => {
      expect(
        screen.getByText("Esiste già un'organizzazione con questo nome")
      ).toBeInTheDocument();
    });
    // Il form resta aperto e la lista non cambia (nessuna entry aggiunta)
    expect(screen.getByLabelText("Nome studio")).toBeInTheDocument();
    expect(screen.queryByText("Studio Duplicato")).not.toBeInTheDocument();
  });
});

// Colma il gap S3 sopra (createUser non può assegnare un utente a un nuovo
// studio cross-tenant): endpoint/UI dedicati per invitare un admin per
// qualunque studio, senza toccare il form "Nuovo utente" esistente.
describe("UsersAdminPage — invito primo admin di uno studio (gap S3, endpoint dedicato)", () => {
  beforeEach(() => {
    mockAuthUser = { user_id: 99, role: "superadmin", organization_id: 1001 };
  });

  it("mostra il pulsante '+ Invita admin' per ogni studio (solo superadmin)", async () => {
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    const inviteButtons = screen.getAllByRole("button", { name: "+ Invita admin" });
    expect(inviteButtons).toHaveLength(AUDITOR_ORGS.length);
  });

  it("validazione client-side: blocca il submit se il nome è vuoto", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "+ Invita admin" })[0]);
    await user.click(screen.getByRole("button", { name: "Invia invito" }));

    await waitFor(() => {
      expect(screen.getByText("❌ Nome e cognome obbligatorio.")).toBeInTheDocument();
    });
    expect(mockInviteStudioAdmin).not.toHaveBeenCalled();
  });

  it("submit valido: invia l'invito per l'id dell'auditor_org corretto, ricarica la lista utenti e mostra il messaggio di successo", async () => {
    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    const callsBeforeSubmit = mockGetAdminUsers.mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "+ Invita admin" })[0]);
    await user.type(screen.getByLabelText("Nome e cognome"), "Mario Rossi");
    await user.click(screen.getByRole("button", { name: "Invia invito" }));

    await waitFor(() => {
      expect(mockInviteStudioAdmin).toHaveBeenCalledWith(10, {
        full_name: "Mario Rossi",
        email: undefined,
      });
    });
    await waitFor(() => {
      expect(screen.getByText("✅ Invito inviato.")).toBeInTheDocument();
    });
    // Il form si chiude dopo il successo
    expect(screen.queryByLabelText("Nome e cognome")).not.toBeInTheDocument();
    // Fix Bugbot: la lista utenti va ricaricata (il nuovo admin è cross-tenant,
    // altrimenti resta invisibile finché non si ricarica manualmente la pagina)
    expect(mockGetAdminUsers.mock.calls.length).toBeGreaterThan(callsBeforeSubmit);
  });

  it("mostra un messaggio di errore inline se il backend risponde con errore (es. 409 email duplicata)", async () => {
    mockInviteStudioAdmin.mockRejectedValue(new Error("Esiste già un utente con questa email in questo studio"));

    const user = userEvent.setup();
    render(<UsersAdminPage />);

    await waitFor(() => {
      expect(screen.getByText("Licenze moduli per studio")).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole("button", { name: "+ Invita admin" })[0]);
    await user.type(screen.getByLabelText("Nome e cognome"), "Mario Rossi");
    await user.click(screen.getByRole("button", { name: "Invia invito" }));

    await waitFor(() => {
      expect(
        screen.getByText("❌ Esiste già un utente con questa email in questo studio")
      ).toBeInTheDocument();
    });
    // Il form resta aperto per correggere/riprovare
    expect(screen.getByLabelText("Nome e cognome")).toBeInTheDocument();
  });
});
