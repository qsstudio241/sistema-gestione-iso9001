/**
 * Impostazioni — Anagrafica organizzazione (P.IVA e logo tenant).
 * Dopo provisioning dell’account sulla nuova organizzazione, l’admin può
 * compilare questi dati; compaiono in banner, export Word e GET /auth/me.
 */

import React from "react";
import OrganizationProfileForm from "../components/OrganizationProfileForm";
import { Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import "./OrganizationSettingsPage.css";

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  if (!isAdmin) {
    return (
      <div className="org-settings-page">
        <h1>Organizzazione</h1>
        <p className="org-settings-denied">
          Solo gli amministratori dell&apos;organizzazione possono modificare partita IVA e logo.
          Chiedi a un amministratore di completare l&apos;anagrafica tenant.
        </p>
      </div>
    );
  }

  return (
    <div className="org-settings-page">
      <h1>Organizzazione</h1>
      <p className="org-settings-lead">
        Dati dell&apos;organizzazione a cui è collegato il tuo account (tenant). Servono per intestazioni nei report e
        per il marchio nell&apos;interfaccia.
      </p>
      <OrganizationProfileForm sectionTitle="Partita IVA e logo" showHeading={false} />
      <p className="org-settings-footnote">
        Per attivare o disattivare i moduli software dell&apos;organizzazione usa{" "}
        <Link to="/settings/licenses" className="org-settings-link">
          Impostazioni → Licenze moduli
        </Link>
        .
      </p>
    </div>
  );
}
