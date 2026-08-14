/**
 * Selettore Ambito unico (header). Unico punto in cui l'utente cambia azienda.
 * Combobox: si digita per filtrare (il select HTML nativo non lo fa).
 */

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { buildScopeMenuOptions, filterScopeMenuOptions } from "../utils/appCompanyScope";

export default function CompanyScopeSelect() {
  const { user } = useAuth();
  const { companyId, setCompanyId, companies, locked, companyScoped, scopeCompanyName } =
    useCompanyScope();

  if (locked) {
    return (
      <div className="layout-scope" title="Ambito fissato sulla tua azienda">
        <span className="layout-scope-label">{"Ambito"}</span>
        <span className="layout-scope-locked" aria-label="Ambito azienda non modificabile">
          {scopeCompanyName}
        </span>
      </div>
    );
  }

  return (
    <CompanyScopeCombobox
      user={user}
      companyId={companyId}
      setCompanyId={setCompanyId}
      companies={companies}
      companyScoped={companyScoped}
    />
  );
}

function CompanyScopeCombobox({ user, companyId, setCompanyId, companies, companyScoped }) {
  const options = useMemo(
    () =>
      buildScopeMenuOptions(companies, user?.organization_name, {
        canSeeAllCompanies: !companyScoped,
      }),
    [companies, user?.organization_name, companyScoped]
  );

  const selected =
    options.find((o) => o.value === String(companyId ?? "")) || options[0] || { value: "", label: "" };
  const selectedLabel = selected.label;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const listId = useId();

  const filtered = useMemo(
    () => filterScopeMenuOptions(options, open ? draft : ""),
    [options, open, draft]
  );

  useEffect(() => {
    if (!open) {
      setDraft("");
      setHighlight(0);
    }
  }, [open]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function choose(opt) {
    if (!opt) return;
    setCompanyId(opt.value);
    setOpen(false);
    setDraft("");
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(filtered[highlight]);
    }
  }

  return (
    <div className="layout-scope" ref={rootRef}>
      <span className="layout-scope-label">{"Ambito"}</span>
      <div className="layout-scope-combo">
        <input
          className="layout-scope-select"
          role="combobox"
          aria-label="Ambito azienda"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[highlight] ? `${listId}-opt-${highlight}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          value={open ? draft : selectedLabel}
          placeholder={selectedLabel}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            setDraft("");
          }}
          onKeyDown={onKeyDown}
        />
        {open ? (
          <ul id={listId} className="layout-scope-listbox" role="listbox">
            {filtered.length === 0 ? (
              <li className="layout-scope-empty" role="presentation">
                {"Nessun risultato"}
              </li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={`${opt.value}:${opt.label}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  data-value={opt.value}
                  aria-selected={opt.value === String(companyId ?? "")}
                  className={
                    "layout-scope-option" +
                    (i === highlight ? " is-highlight" : "") +
                    (opt.value === String(companyId ?? "") ? " is-selected" : "")
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(opt);
                  }}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
