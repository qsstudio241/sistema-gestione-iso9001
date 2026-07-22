/**
 * Test L1 — ParticipantsList (Riesame di Direzione §9.3)
 *
 * Copre il comportamento stabile della lista strutturata partecipanti:
 *   - aggiunta / rimozione riga
 *   - aggiornamento campi (array { name, role })
 *   - importazione dall'anagrafica personale (mock apiService.getCompanyPersonnel)
 *   - deduplica per nome (case-insensitive)
 *   - stati di errore (nessun personale attivo / tutti gia in lista)
 *   - visibilita del pulsante import legata a companyId
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ParticipantsList from '../components/ParticipantsList';

vi.mock('../services/apiService', () => ({
  default: {
    getCompanyPersonnel: vi.fn(),
  },
}));

import apiService from '../services/apiService';

describe('ParticipantsList — gestione righe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggiunge una riga vuota mantenendo le esistenti', () => {
    const onChange = vi.fn();
    render(<ParticipantsList participants={[{ name: 'Mario Rossi', role: 'RQ' }]} onChange={onChange} />);

    fireEvent.click(screen.getByText('+ Aggiungi partecipante'));

    expect(onChange).toHaveBeenCalledWith([
      { name: 'Mario Rossi', role: 'RQ' },
      { name: '', role: '' },
    ]);
  });

  it('rimuove la riga selezionata per indice', () => {
    const onChange = vi.fn();
    render(
      <ParticipantsList
        participants={[
          { name: 'Mario Rossi', role: 'RQ' },
          { name: 'Luigi Verdi', role: 'Direttore' },
        ]}
        onChange={onChange}
      />
    );

    const removeButtons = screen.getAllByLabelText('Rimuovi partecipante');
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([{ name: 'Luigi Verdi', role: 'Direttore' }]);
  });

  it('aggiorna il campo name di una riga mantenendo array { name, role }', () => {
    const onChange = vi.fn();
    render(<ParticipantsList participants={[{ name: '', role: '' }]} onChange={onChange} />);

    const nameInput = screen.getByLabelText('Nome partecipante');
    fireEvent.change(nameInput, { target: { value: 'Anna Bianchi' } });

    expect(onChange).toHaveBeenCalledWith([{ name: 'Anna Bianchi', role: '' }]);
  });

  it('mostra il messaggio vuoto quando non ci sono partecipanti', () => {
    render(<ParticipantsList participants={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/Nessun partecipante aggiunto/)).toBeInTheDocument();
  });

  it('nasconde il pulsante di import quando non c e companyId', () => {
    render(<ParticipantsList participants={[]} onChange={vi.fn()} />);
    expect(screen.queryByText(/Importa da anagrafica/)).toBeNull();
  });
});

describe('ParticipantsList — import da anagrafica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('importa personale attivo normalizzando nome e ruolo', async () => {
    const onChange = vi.fn();
    apiService.getCompanyPersonnel.mockResolvedValue({
      data: [
        { first_name: 'Mario', last_name: 'Rossi', job_title: 'Responsabile Qualita', is_active: true },
        { full_name: 'Luigi Verdi', role: 'Direttore' },
        { first_name: 'Inattivo', last_name: 'Persona', is_active: false },
        { first_name: 'Sospeso', last_name: 'Tizio', status: 'inactive' },
      ],
    });

    render(<ParticipantsList participants={[]} onChange={onChange} companyId={7} />);

    fireEvent.click(screen.getByText(/Importa da anagrafica/));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(apiService.getCompanyPersonnel).toHaveBeenCalledWith(7);
    expect(onChange).toHaveBeenCalledWith([
      { name: 'Mario Rossi', role: 'Responsabile Qualita' },
      { name: 'Luigi Verdi', role: 'Direttore' },
    ]);
  });

  it('deduplica i nomi gia presenti (case-insensitive)', async () => {
    const onChange = vi.fn();
    apiService.getCompanyPersonnel.mockResolvedValue({
      data: [
        { first_name: 'Mario', last_name: 'Rossi', job_title: 'RQ', is_active: true },
        { full_name: 'Luigi Verdi', role: 'Direttore', is_active: true },
      ],
    });

    render(
      <ParticipantsList
        participants={[{ name: '  mario rossi  ', role: 'Presidente' }]}
        onChange={onChange}
        companyId={7}
      />
    );

    fireEvent.click(screen.getByText(/Importa da anagrafica/));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange).toHaveBeenCalledWith([
      { name: '  mario rossi  ', role: 'Presidente' },
      { name: 'Luigi Verdi', role: 'Direttore' },
    ]);
  });

  it('mostra errore se non c e personale attivo', async () => {
    const onChange = vi.fn();
    apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });

    render(<ParticipantsList participants={[]} onChange={onChange} companyId={7} />);

    fireEvent.click(screen.getByText(/Importa da anagrafica/));

    await waitFor(() => expect(screen.getByText(/Nessun personale attivo/)).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('mostra errore se tutti i dipendenti sono gia in lista', async () => {
    const onChange = vi.fn();
    apiService.getCompanyPersonnel.mockResolvedValue({
      data: [{ first_name: 'Mario', last_name: 'Rossi', job_title: 'RQ', is_active: true }],
    });

    render(
      <ParticipantsList
        participants={[{ name: 'Mario Rossi', role: 'RQ' }]}
        onChange={onChange}
        companyId={7}
      />
    );

    fireEvent.click(screen.getByText(/Importa da anagrafica/));

    await waitFor(() => expect(screen.getByText(/gi.* in lista/)).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('degrada con messaggio di errore se la chiamata fallisce', async () => {
    const onChange = vi.fn();
    apiService.getCompanyPersonnel.mockRejectedValue(new Error('Network Error'));

    render(<ParticipantsList participants={[]} onChange={onChange} companyId={7} />);

    fireEvent.click(screen.getByText(/Importa da anagrafica/));

    await waitFor(() => expect(screen.getByText('Network Error')).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});
