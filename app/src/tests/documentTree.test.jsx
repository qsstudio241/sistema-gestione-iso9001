/**
 * Test L1 — DocumentTree component
 *
 * Copre: rendering nodi, espansione/collasso, icone (folder/system/document),
 * badge conteggio figli, creazione cartella inline.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentTree from '../components/DocumentTree';

const sampleNodes = [
  {
    id: 1,
    title: 'Procedure',
    doc_type: 'folder',
    children_count: 3,
    children: [
      { id: 2, title: 'PG-001', doc_type: 'procedura', children_count: 0 },
      { id: 3, title: 'PG-002', doc_type: 'procedura', children_count: 0 },
    ],
  },
  {
    id: 4,
    title: 'Sistema',
    is_system_folder: true,
    is_folder: true,
    children_count: 2,
  },
  {
    id: 5,
    title: 'Documento solitario',
    doc_type: 'manuale',
    children_count: 0,
  },
];

// ??? Rendering base ?????????????????????????????????????????????????????????

describe('DocumentTree — Rendering', () => {
  it('renderizza tutti i nodi radice', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    expect(screen.getByText('Procedure')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('Documento solitario')).toBeInTheDocument();
  });

  it('mostra "Nessun documento" se nodes è vuoto', () => {
    render(
      <DocumentTree
        nodes={[]}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    expect(screen.getByText('Nessun documento')).toBeInTheDocument();
  });

  it('mostra badge con conteggio figli per cartelle', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('NON mostra badge stato Vigente sulle cartelle (solo conteggio figli)', () => {
    const nodesWithFolderStatus = [
      {
        id: 10,
        title: 'Cartella vigente',
        doc_type: 'folder',
        status: 'vigente',
        children_count: 1,
      },
    ];
    render(
      <DocumentTree
        nodes={nodesWithFolderStatus}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    expect(screen.getByText('Cartella vigente')).toBeInTheDocument();
    expect(screen.queryByText('Vigente')).toBeNull();
    expect(screen.queryByText('Rilasciato')).toBeNull();
  });

  it('mostra pulsante nuova cartella (root)', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
      />
    );
    expect(screen.getByText('+ Nuova cartella')).toBeInTheDocument();
  });

  it('label cartella ha attributo title (tooltip nome completo)', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    const label = screen.getByText('Procedure');
    expect(label).toHaveAttribute('title', 'Procedure');
  });
});

describe('DocumentTree — Azioni cartella', () => {
  const customFolder = {
    id: 99,
    title: 'Mia cartella',
    doc_type: 'folder',
    is_system_folder: false,
    children_count: 0,
  };

  it('disabilita Elimina su cartella di sistema', () => {
    render(
      <DocumentTree
        nodes={[customFolder, sampleNodes[1]]}
        expandedIds={new Set()}
        selectedNodeId={4}
        selectedNode={sampleNodes[1]}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Elimina' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rinomina' })).toBeDisabled();
  });

  it('offre Sottocartella quando è selezionata una cartella custom', () => {
    render(
      <DocumentTree
        nodes={[customFolder]}
        expandedIds={new Set()}
        selectedNodeId={99}
        selectedNode={customFolder}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
      />
    );
    expect(screen.getByText('+ Sottocartella')).toBeInTheDocument();
  });
});

// ??? Espansione / collasso ??????????????????????????????????????????????????

describe('DocumentTree — Espansione', () => {
  it('mostra figli se nodo è espanso', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set([1])}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    expect(screen.getByText('PG-001')).toBeInTheDocument();
    expect(screen.getByText('PG-002')).toBeInTheDocument();
  });

  it('NON mostra figli se nodo NON è espanso', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    expect(screen.queryByText('PG-001')).toBeNull();
  });
});

// ??? Selezione ??????????????????????????????????????????????????????????????

describe('DocumentTree — Selezione', () => {
  it('chiama onSelect al click su un nodo', () => {
    const onSelect = vi.fn();
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={onSelect}
        onCreateFolder={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Procedure'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

// ??? Creazione cartella ?????????????????????????????????????????????????????

describe('DocumentTree — Creazione cartella', () => {
  it('mostra input dopo click "Nuova cartella"', () => {
    render(
      <DocumentTree
        nodes={sampleNodes}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('+ Nuova cartella'));
    expect(screen.getByPlaceholderText(/nome cartella/i)).toBeInTheDocument();
  });
});

// ??? Loading / Error ????????????????????????????????????????????????????????

describe('DocumentTree — Loading / Error', () => {
  it('mostra spinner durante caricamento', () => {
    render(
      <DocumentTree
        nodes={[]}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
        loading={true}
      />
    );
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });

  it('mostra messaggio di errore', () => {
    render(
      <DocumentTree
        nodes={[]}
        expandedIds={new Set()}
        selectedNodeId={null}
        onToggle={vi.fn()}
        onSelect={vi.fn()}
        onCreateFolder={vi.fn()}
        error="Errore di rete"
      />
    );
    expect(screen.getByText('Errore di rete')).toBeInTheDocument();
  });
});
