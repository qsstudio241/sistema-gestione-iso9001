/**
 * Test L1 — NormUploadButton: flusso upload norme (PDF) con staging IG-N
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NormUploadButton from '../components/NormUploadButton';

vi.mock('../services/apiService', () => ({
  default: {
    uploadNorms: vi.fn(),
    confirmIngestStaging: vi.fn(),
    rejectIngestStaging: vi.fn(),
  },
}));

import apiService from '../services/apiService';

function createFile(name, size, type = 'application/pdf') {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('NormUploadButton — flusso upload norme', () => {
  let onUploadComplete;

  beforeEach(() => {
    vi.clearAllMocks();
    onUploadComplete = vi.fn();
  });

  it('renderizza il pulsante "Carica norme (batch)"', () => {
    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);
    expect(screen.getByText(/Carica norme/)).toBeTruthy();
  });

  it('mostra il pannello con file selezionati dopo la selezione', async () => {
    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('norma_9606.pdf', 1024 * 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText(/1 PDF selezionat/)).toBeTruthy();
    expect(screen.getByText('norma_9606.pdf')).toBeTruthy();
    expect(screen.getByText(/Estrai e rivedi/)).toBeTruthy();
  });

  it('mostra la dimensione file in MB', async () => {
    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('big_norm.pdf', 5 * 1024 * 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText('5.0 MB')).toBeTruthy();
  });

  it('upload con successo chiama apiService e mostra risultato', async () => {
    apiService.uploadNorms.mockResolvedValue({
      results: [{
        status: 'confirmed',
        documentId: 501,
        norm_title: 'BS EN ISO 9606-1:2017 Qualification testing of welders',
        standard_code: 'BS EN ISO 9606-1:2017',
        edition_year: 2017,
        issuing_body: 'BSI',
        text_quality: 'good',
      }],
    });

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('BS_EN_ISO_9606-1_2017.pdf', 2 * 1024 * 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    expect(apiService.uploadNorms).toHaveBeenCalledTimes(1);
    const calledFiles = apiService.uploadNorms.mock.calls[0][0];
    const calledFolderId = apiService.uploadNorms.mock.calls[0][1];
    expect(calledFolderId).toBe(42);
    expect(calledFiles).toHaveLength(1);
    expect(calledFiles[0].name).toBe('BS_EN_ISO_9606-1_2017.pdf');

    await waitFor(() => {
      expect(screen.getByText(/Risultati estrazione/)).toBeTruthy();
    });
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it('gestisce errore di rete mostrando messaggio nel pannello', async () => {
    apiService.uploadNorms.mockRejectedValue(new Error('Network Error'));

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('test.pdf', 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Network Error/)).toBeTruthy();
    });
    expect(onUploadComplete).not.toHaveBeenCalled();
  });

  it('gestisce upload multiplo (batch di file)', async () => {
    apiService.uploadNorms.mockResolvedValue({
      results: [
        { status: 'confirmed', documentId: 1, norm_title: 'Norma 1', standard_code: 'ISO 1' },
        { status: 'confirmed', documentId: 2, norm_title: 'Norma 2', standard_code: 'ISO 2' },
      ],
    });

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const files = [
      createFile('norma1.pdf', 1024 * 1024),
      createFile('norma2.pdf', 2 * 1024 * 1024),
    ];

    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });

    expect(screen.getByText(/2 PDF selezionati/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Risultati estrazione/)).toBeTruthy();
    });
    expect(apiService.uploadNorms).toHaveBeenCalledTimes(1);
    expect(apiService.uploadNorms.mock.calls[0][0]).toHaveLength(2);
  });

  it('il pulsante Annulla resetta lo stato', async () => {
    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('test.pdf', 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText(/1 PDF selezionat/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Annulla'));
    });

    expect(screen.queryByText(/1 PDF selezionat/)).toBeNull();
  });

  it('il pulsante Chiudi dopo i risultati resetta tutto (refresh già inviato a upload ok)', async () => {
    apiService.uploadNorms.mockResolvedValue({
      results: [{ status: 'confirmed', documentId: 77, norm_title: 'Norma Test' }],
    });

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('test.pdf', 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Risultati estrazione/)).toBeTruthy();
    });
    expect(onUploadComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByText('Chiudi'));
    });

    expect(screen.queryByText(/Risultati estrazione/)).toBeNull();
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it('l\'input accetta PDF (attributo accept)', () => {
    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);
    const input = document.querySelector('input[type="file"]');
    expect(input.getAttribute('accept')).toContain('.pdf');
  });

  it('l\'input supporta selezione multipla', () => {
    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);
    const input = document.querySelector('input[type="file"]');
    expect(input.hasAttribute('multiple')).toBe(true);
  });

  it('disabilita il pulsante durante l\'upload', async () => {
    let resolveUpload;
    apiService.uploadNorms.mockImplementation(() =>
      new Promise((resolve) => { resolveUpload = resolve; }),
    );

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const file = createFile('test.pdf', 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    const mainBtn = screen.getByText(/Carica norme/);
    expect(mainBtn.disabled).toBe(true);

    await act(async () => {
      resolveUpload({ results: [{ status: 'confirmed', documentId: 1 }] });
    });
  });

  it('mostra errore parziale quando un file ha errore e altri no', async () => {
    apiService.uploadNorms.mockResolvedValue({
      results: [
        { status: 'confirmed', documentId: 10, norm_title: 'Norma OK', standard_code: 'ISO 1' },
        { status: 'error', error: 'PDF danneggiato', fileName: 'broken.pdf' },
      ],
    });

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    const files = [
      createFile('good.pdf', 1024),
      createFile('broken.pdf', 1024),
    ];

    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Risultati estrazione/)).toBeTruthy();
      expect(screen.getByText('PDF danneggiato')).toBeTruthy();
      expect(screen.getByText(/Norma OK/)).toBeTruthy();
    });
  });

  it('mostra pending_review con pulsante Rivedi campi', async () => {
    apiService.uploadNorms.mockResolvedValue({
      results: [{
        status: 'pending_review',
        staging_id: 99,
        fileName: 'ambiguo.pdf',
        fields: { standard_code: 'ISO 9001:2015' },
        warnings: ['Catalogo ambiguo'],
      }],
    });

    render(<NormUploadButton folderId={42} onUploadComplete={onUploadComplete} />);

    const input = document.querySelector('input[type="file"]');
    await act(async () => {
      fireEvent.change(input, { target: { files: [createFile('ambiguo.pdf', 1024)] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Estrai e rivedi'));
    });

    await waitFor(() => {
      expect(screen.getByText(/da rivedere/)).toBeTruthy();
      expect(screen.getByText('Rivedi campi')).toBeTruthy();
    });
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });
});
