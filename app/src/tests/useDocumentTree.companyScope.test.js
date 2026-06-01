import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDocumentTree from '../hooks/useDocumentTree';

vi.mock('../services/apiService', () => ({
  default: {
    getDocumentTree: vi.fn(),
    getDocumentTreeChildren: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getDocumentBreadcrumb: vi.fn(),
    getDocument: vi.fn(),
  },
}));

import apiService from '../services/apiService';

describe('useDocumentTree company scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getDocumentTree.mockResolvedValue({ data: [] });
    apiService.getDocumentTreeChildren.mockResolvedValue({ data: [] });
  });

  it('loadTree senza company_id chiama API studio-wide', async () => {
    const { result } = renderHook(() => useDocumentTree(null));
    await act(async () => {
      await result.current.loadTree();
    });
    expect(apiService.getDocumentTree).toHaveBeenCalledWith(2, null);
  });

  it('loadTree con company_id passa il filtro', async () => {
    const { result } = renderHook(() => useDocumentTree('42'));
    await act(async () => {
      await result.current.loadTree();
    });
    expect(apiService.getDocumentTree).toHaveBeenCalledWith(2, 42);
  });

  it('loadChildren propaga company_id', async () => {
    const { result } = renderHook(() => useDocumentTree(5));
    await act(async () => {
      await result.current.loadChildren(100);
    });
    expect(apiService.getDocumentTreeChildren).toHaveBeenCalledWith(100, 5);
  });

  it('createFolder include company_id nello scope azienda', async () => {
    apiService.post.mockResolvedValue({ data: { id: 1 } });
    const { result } = renderHook(() => useDocumentTree(8));
    await act(async () => {
      await result.current.createFolder('Cartella test', null);
    });
    expect(apiService.post).toHaveBeenCalledWith('/documents/folder', {
      title: 'Cartella test',
      parent_id: null,
      company_id: 8,
    });
  });
});
