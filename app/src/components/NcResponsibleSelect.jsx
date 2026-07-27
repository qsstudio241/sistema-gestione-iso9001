/**

 * NcResponsibleSelect ? select rubrica referenti (+ testo libero opzionale per verifica/azioni)

 */



import React, { useMemo } from "react";



const ROLE_LABELS = {

  attuazione: "Attuazione",

  verifica: "Verifica",

  generico: "Generico",

};



const PLACEHOLDER_OPTION = "\u2014 Seleziona dalla rubrica \u2014";

const EMPTY_RUBRICA_HINT =

  "Nessun referente disponibile. Aggiungi personale in Aziende oppure referenti in Impostazioni \u2192 Notifiche.";



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

 * @param {string} [props.textValue] ? solo se allowExternal

 * @param {boolean} [props.useExternal] ? solo se allowExternal

 * @param {boolean} [props.allowExternal] ? abilita checkbox testo libero (verifica/azioni)

 * @param {string|null} [props.legacyText] ? nome legacy senza contact_id (solo display)

 * @param {function} props.onContactIdChange

 * @param {function} props.onTextChange

 * @param {function} [props.onUseExternalChange]

 * @param {string} [props.label]

 * @param {string} [props.placeholder]

 */

export default function NcResponsibleSelect({

  contacts = [],

  roleFilter = null,

  contactId,

  textValue = "",

  useExternal = false,

  allowExternal = false,

  legacyText = null,

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



  const showExternal = allowExternal && useExternal;



  return (

    <div className="nc-form-row nc-responsible-select">

      <label htmlFor={fieldId}>{label}</label>

      {legacyText && !contactId && (

        <p className="nc-legacy-readonly" id={`${fieldId}-legacy`}>

          Valore attuale: {legacyText}. Seleziona un referente dalla rubrica per aggiornare.

        </p>

      )}

      {showExternal ? (

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

          aria-describedby={legacyText && !contactId ? `${fieldId}-legacy` : undefined}

          onChange={(e) => {

            const val = e.target.value;

            onContactIdChange(val ? parseInt(val, 10) : null);

            const picked = filtered.find((c) => String(c.id) === val);

            if (picked) onTextChange(picked.name);

            else if (!val) onTextChange("");

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

      {allowExternal && (

        <label className="nc-inline-check">

          <input

            type="checkbox"

            checked={!!useExternal}

            disabled={readOnly}

            onChange={(e) => onUseExternalChange?.(e.target.checked)}

          />

          Referente esterno (testo libero)

        </label>

      )}

      {!showExternal && filtered.length === 0 && (

        <p className="notif-hint">{EMPTY_RUBRICA_HINT}</p>

      )}

    </div>

  );

}



export { ROLE_LABELS };


