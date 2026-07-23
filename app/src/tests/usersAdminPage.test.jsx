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
    createAdminUser: vi.fn(),
    deactivateAdminUser: vi.fn(),
    updateUserStandards: vi.fn(),
    patchOrgLicenses: vi.fn(),
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
