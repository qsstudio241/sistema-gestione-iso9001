import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrashPage from "../pages/TrashPage";

const listTrash = vi.fn();
const restoreTrash = vi.fn();

vi.mock("../services/apiService", () => ({
    default: {
        listTrash: (...args) => listTrash(...args),
        restoreTrash: (...args) => restoreTrash(...args),
    },
}));

let role = "admin";
vi.mock("../contexts/AuthContext", () => ({
    useAuth: () => ({ user: { role, user_id: 1, organization_id: 1 } }),
}));

describe("TrashPage", () => {
    beforeEach(() => {
        role = "admin";
        listTrash.mockReset();
        restoreTrash.mockReset();
        listTrash.mockResolvedValue({
            data: [{ entity: "qualifications", entity_label: "Qualifica", id: 4, title: "Ada", code: "C-1", status: "valida", deleted_at: "2026-10-17T08:00:00Z" }],
        });
        restoreTrash.mockResolvedValue({ success: true });
    });

    it("l'admin vede la riga e la ripristina", async () => {
        const user = userEvent.setup();
        render(<TrashPage />);
        expect(await screen.findByText("Ada")).toBeTruthy();
        await user.click(screen.getByRole("button", { name: "Ripristina" }));
        await waitFor(() => expect(restoreTrash).toHaveBeenCalledWith("qualifications", 4));
    });

    it("un altro ruolo non carica il cestino", async () => {
        role = "auditor";
        render(<TrashPage />);
        expect(await screen.findByText(/Solo admin e superadmin/)).toBeTruthy();
        expect(listTrash).not.toHaveBeenCalled();
    });
});
