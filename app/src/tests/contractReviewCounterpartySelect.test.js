/**
 * Test L1 — ContractReviewPage: logica select committente (PR2 Controparti)
 *
 * Copre:
 *  1. rowCase normalizza commercial_customer_id
 *  2. buildCreatePayload: controparte FK selezionata vs testo libero
 *  3. buildUpdatePayload: controparte FK vs testo libero vs deseleziona FK
 */

import { describe, it, expect } from 'vitest';

// ─── Replica funzione rowCase ────────────────────────────────────────────────
function rowCase(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    company_id: row.company_id ?? row.companyId,
    commercial_customer_id: row.commercial_customer_id ?? row.commercialCustomerId ?? null,
    commercial_customer_name: row.commercial_customer_name ?? row.commercialCustomerName ?? null,
    commercial_customer_ref: row.commercial_customer_ref ?? row.commercialCustomerRef ?? null,
    external_ref: row.external_ref ?? row.externalRef,
    notes: row.notes,
    updated_at: row.updated_at ?? row.updatedAt,
    source_import_job_id: row.source_import_job_id ?? row.sourceImportJobId ?? null,
    handoff_ref: row.handoff_ref ?? row.handoffRef ?? null,
    handoff_at: row.handoff_at ?? row.handoffAt ?? null,
    handoff_notes: row.handoff_notes ?? row.handoffNotes ?? null,
  };
}

// ─── Replica logica payload create ──────────────────────────────────────────
function buildCreatePayload(createForm) {
  const body = {
    title: createForm.title.trim(),
  };
  if (createForm.external_ref?.trim()) {
    body.external_ref = createForm.external_ref.trim();
  }
  if (createForm.company_id) {
    body.company_id = parseInt(createForm.company_id, 10);
  }
  if (createForm.commercial_customer_id) {
    body.commercial_customer_id = parseInt(createForm.commercial_customer_id, 10);
  } else {
    if (createForm.commercial_customer_name?.trim()) {
      body.commercial_customer_name = createForm.commercial_customer_name.trim();
    }
    if (createForm.commercial_customer_ref?.trim()) {
      body.commercial_customer_ref = createForm.commercial_customer_ref.trim();
    }
  }
  return body;
}

// ─── Replica logica payload update ──────────────────────────────────────────
function buildUpdatePayload({ editTitle, editNotes, editCompanyId, editCommercialCustomerId, editCommercialCustomerName, editCommercialCustomerRef }) {
  const body = {
    title: editTitle.trim(),
    notes: editNotes,
    company_id: editCompanyId ? parseInt(editCompanyId, 10) : null,
  };
  if (editCommercialCustomerId) {
    body.commercial_customer_id = parseInt(editCommercialCustomerId, 10);
  } else {
    body.commercial_customer_id = null;
    body.commercial_customer_name = editCommercialCustomerName?.trim() || null;
    body.commercial_customer_ref = editCommercialCustomerRef?.trim() || null;
  }
  return body;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('rowCase — normalizzazione commercial_customer_id', () => {
  it('include commercial_customer_id dal server', () => {
    const row = { id: 1, title: 'Test', status: 'DRAFT', commercial_customer_id: 9, commercial_customer_name: 'PT.MAIDO' };
    const result = rowCase(row);
    expect(result.commercial_customer_id).toBe(9);
  });

  it('restituisce null se commercial_customer_id assente', () => {
    const row = { id: 1, title: 'Test', status: 'DRAFT', commercial_customer_name: 'PT.MAIDO' };
    const result = rowCase(row);
    expect(result.commercial_customer_id).toBeNull();
  });

  it('gestisce chiave camelCase commercialCustomerId', () => {
    const row = { id: 1, title: 'Test', status: 'DRAFT', commercialCustomerId: 7 };
    const result = rowCase(row);
    expect(result.commercial_customer_id).toBe(7);
  });

  it('snake_case ha precedenza su camelCase', () => {
    const row = { id: 1, title: 'Test', status: 'DRAFT', commercial_customer_id: 3, commercialCustomerId: 99 };
    const result = rowCase(row);
    expect(result.commercial_customer_id).toBe(3);
  });
});

describe('buildCreatePayload — controparte commerciale', () => {
  it('usa commercial_customer_id FK quando selezionata', () => {
    const form = {
      title: 'Commessa LM',
      company_id: '55',
      commercial_customer_id: '9',
      commercial_customer_name: 'PT.MAIDO',
      commercial_customer_ref: 'PT001',
      external_ref: '',
    };
    const body = buildCreatePayload(form);
    expect(body.commercial_customer_id).toBe(9);
    expect(body).not.toHaveProperty('commercial_customer_name');
    expect(body).not.toHaveProperty('commercial_customer_ref');
  });

  it('usa testo libero quando commercial_customer_id vuoto', () => {
    const form = {
      title: 'Commessa LM',
      company_id: '55',
      commercial_customer_id: '',
      commercial_customer_name: 'PT.MAIDO',
      commercial_customer_ref: 'PT001',
      external_ref: '',
    };
    const body = buildCreatePayload(form);
    expect(body).not.toHaveProperty('commercial_customer_id');
    expect(body.commercial_customer_name).toBe('PT.MAIDO');
    expect(body.commercial_customer_ref).toBe('PT001');
  });

  it('non invia name/ref se entrambi vuoti (nessun committente)', () => {
    const form = {
      title: 'Commessa X',
      company_id: '',
      commercial_customer_id: '',
      commercial_customer_name: '',
      commercial_customer_ref: '',
      external_ref: '',
    };
    const body = buildCreatePayload(form);
    expect(body).not.toHaveProperty('commercial_customer_id');
    expect(body).not.toHaveProperty('commercial_customer_name');
    expect(body).not.toHaveProperty('commercial_customer_ref');
  });
});

describe('buildUpdatePayload — committente commerciale', () => {
  const base = {
    editTitle: 'Caso LM&CO',
    editNotes: '',
    editCompanyId: '55',
    editCommercialCustomerName: '',
    editCommercialCustomerRef: '',
  };

  it('collega controparte FK', () => {
    const body = buildUpdatePayload({ ...base, editCommercialCustomerId: '9' });
    expect(body.commercial_customer_id).toBe(9);
    expect(body).not.toHaveProperty('commercial_customer_name');
    expect(body).not.toHaveProperty('commercial_customer_ref');
  });

  it('deseleziona FK → invia null + testo', () => {
    const body = buildUpdatePayload({
      ...base,
      editCommercialCustomerId: '',
      editCommercialCustomerName: 'PT.MAIDO',
      editCommercialCustomerRef: 'PT001',
    });
    expect(body.commercial_customer_id).toBeNull();
    expect(body.commercial_customer_name).toBe('PT.MAIDO');
    expect(body.commercial_customer_ref).toBe('PT001');
  });

  it('senza committente invia commercial_customer_id: null e name: null', () => {
    const body = buildUpdatePayload({ ...base, editCommercialCustomerId: '' });
    expect(body.commercial_customer_id).toBeNull();
    expect(body.commercial_customer_name).toBeNull();
    expect(body.commercial_customer_ref).toBeNull();
  });

  it('include company_id come intero', () => {
    const body = buildUpdatePayload({ ...base, editCommercialCustomerId: '' });
    expect(body.company_id).toBe(55);
  });

  it('company_id vuoto → null', () => {
    const body = buildUpdatePayload({ ...base, editCompanyId: '', editCommercialCustomerId: '' });
    expect(body.company_id).toBeNull();
  });
});
