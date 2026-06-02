/**
 * NcResponsibleSelect ù select rubrica referenti + testo libero esterno
 */

import React, { useMemo } from "react";

const ROLE_LABELS = {
  attuazione: "Attuazione",
  verifica: "Verifica",
  generico: "Generico",
};

/**
 * @param {object} props
 * @param {Array} props.contacts
 * @param {string[]} [props.roleFilter] ù es. ['attuazione','generico']
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
          <option value="">ù Seleziona dalla rubrica ù</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({ROLE_LABELS[c.role_type] || c.role_type}) ù {c.email}
            </option>
          ))}
        </select>
      )}
      {!useExternal && filtered.length === 0 && (
        <p className="notif-hint">Nessun referente in rubrica. Aggiungine uno in Impostazioni ? Notifiche.</p>
      )}
    </div>
  );
}

export { ROLE_LABELS };
