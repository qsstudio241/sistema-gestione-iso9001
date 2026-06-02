/**
 * NcResponsibleSelect ? select rubrica referenti + testo libero esterno
 */

import React, { useMemo } from "react";

const ROLE_LABELS = {
  attuazione: "Attuazione",
  verifica: "Verifica",
  generico: "Generico",
};

const PLACEHOLDER_OPTION = "\u2014 Seleziona dalla rubrica \u2014";
const EMPTY_RUBRICA_HINT =
  "Nessun referente in rubrica. Aggiungine uno in Impostazioni \u2192 Notifiche.";

/** Etichetta option: nome + ruolo, senza email (email solo in title). */
export function formatContactOptionLabel(contact) {
  const role = ROLE_LABELS[contact.role_type] || contact.role_type || "";
  return role ? `${contact.name} (${role})` : contact.name;
}

/**
 * @param {object} props
 * @param {Array} props.contacts
 * @param {string[]} [props.roleFilter] ? es. ['attuazione','generico']
 * @param {number|string|null} props.contactId
 * @param {string} props.textValue
 * @param {boolean} props.useExternal
 * @param {function} props.onContactIdChange
 * @param {function} props.onTextChange
 * @param {function} props.onUseExternalChange
 * @param {string} [props.label]
 * @param {string} [props.placeholder]
 */
export default function NcResponsibleSelect({
  contacts = [],
  roleFilter = null,
  contactId,
  textValue,
  useExternal,
  onContactIdChange,
  onTextChange,
  onUseExternalChange,
  readOnly = false,
  label = "Responsabile",
  fieldId = "nc-responsible",
  placeholder = "Nome referente esterno",
}) {
  const filtered = useMemo(() => {
    const active = contacts.filter((c) => c.active !== false && c.active !== 0);
    if (!roleFilter || roleFilter.length === 0) return active;
    return active.filter((c) => roleFilter.includes(c.role_type));
  }, [contacts, roleFilter]);

  return (
    <div className="nc-form-row nc-responsible-select">
      <label htmlFor={fieldId}>{label}</label>
      <label className="nc-inline-check">
        <input
          type="checkbox"
          checked={!!useExternal}
          disabled={readOnly}
          onChange={(e) => onUseExternalChange(e.target.checked)}
        />
        Referente esterno (testo libero)
      </label>
      {useExternal ? (
        <input
          id={fieldId}
          type="text"
          value={textValue || ""}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <select
          id={fieldId}
          value={contactId != null && contactId !== "" ? String(contactId) : ""}
          disabled={readOnly}
          onChange={(e) => {
            const val = e.target.value;
            onContactIdChange(val ? parseInt(val, 10) : null);
            const picked = filtered.find((c) => String(c.id) === val);
            if (picked) onTextChange(picked.name);
          }}
        >
          <option value="">{PLACEHOLDER_OPTION}</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id} title={c.email || undefined}>
              {formatContactOptionLabel(c)}
            </option>
          ))}
        </select>
      )}
      {!useExternal && filtered.length === 0 && (
        <p className="notif-hint">{EMPTY_RUBRICA_HINT}</p>
      )}
    </div>
  );
}

export { ROLE_LABELS };
