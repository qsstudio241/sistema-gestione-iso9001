/**
 * Test L1 — NcAttachmentsSection (NC Fase 1 Slice 5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const mockGetAttachments = vi.hoisted(() => vi.fn());
const mockUploadAttachment = vi.hoisted(() => vi.fn());
const mockDeleteAttachment = vi.hoisted(() => vi.fn());
const mockGetDownloadUrl = vi.hoisted(() => vi.fn());

vi.mock('../services/apiService', () => ({
  default: {
    getAttachments: (...args) => mockGetAttachments(...args),
    uploadAttachment: (...args) => mockUploadAttachment(...args),
    deleteAttachment: (...args) => mockDeleteAttachment(...args),
    getAttachmentDownloadUrl: (...args) => mockGetDownloadUrl(...args),
  },
}));

vi.mock('../components/AttachmentSection.css', () => ({}));

import NcAttachmentsSection from '../components/NcAttachmentsSection';

describe('NcAttachmentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAttachments.mockResolvedValue({
      data: [
        { attachment_id: 1, file_name: 'foto.jpg', file_size: 2048, category: 'evidence' },
      ],
    });
    mockGetDownloadUrl.mockReturnValue('https://example.test/download/1');
    window.open = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  it('carica allegati per nc_id', async () => {
    render(React.createElement(NcAttachmentsSection, { ncId: 42 }));

    await waitFor(() => {
      expect(mockGetAttachments).toHaveBeenCalledWith(null, 42);
    });

    expect(screen.getByText('foto.jpg')).toBeInTheDocument();
  });

  it('readOnly: nasconde pulsante aggiungi', async () => {
    render(React.createElement(NcAttachmentsSection, { ncId: 42, readOnly: true }));

    await waitFor(() => {
      expect(screen.getByText('foto.jpg')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Aggiungi allegato/i })).not.toBeInTheDocument();
  });

  it('upload chiama apiService con ncId', async () => {
    mockUploadAttachment.mockResolvedValue({ success: true });

    render(React.createElement(NcAttachmentsSection, { ncId: 7 }));

    await waitFor(() => {
      expect(screen.getByText('foto.jpg')).toBeInTheDocument();
    });

    const file = new File(['x'], 'evidenza.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadAttachment).toHaveBeenCalledWith(file, {
        ncId: 7,
        category: 'evidence',
        description: 'Evidenza NC',
      });
    });
  });
});
