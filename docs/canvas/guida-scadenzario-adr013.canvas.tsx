import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleSection,
  computeDAGLayout,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Link,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

type Section =
  | "overview"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "step5"
  | "semaforo";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Panoramica" },
  { id: "step1", label: "1. Dove andare" },
  { id: "step2", label: "2. Carica Excel" },
  { id: "step3", label: "3. Conferma import" },
  { id: "step4", label: "4. Scadenzari" },
  { id: "step5", label: "5. Priorit\u00E0" },
  { id: "semaforo", label: "Semaforo" },
];

const STEPS = [
  {
    id: "step1" as Section,
    title: "Passo 1 \u2014 Apri il registro o la pagina Scadenzari",
    where: "Menu laterale, gruppo SGQ",
    clicks: [
      "Clicca Documenti per aprire il Registro Documenti",
      "Oppure clicca Scadenzari (icona calendario) per vedere subito le scadenze gi\u00E0 importate",
    ],
    expect:
      "Il Registro Documenti mostra il titolo Registro Documenti con tab Priorit\u00E0, Catalogo e Albero. La pagina Scadenzari mostra Scadenzari da file.",
  },
  {
    id: "step2" as Section,
    title: "Passo 2 \u2014 Carica il file Excel nel documento scadenzario",
    where: "Registro Documenti, tab Albero",
    clicks: [
      "Nel tab Albero apri la cartella o il documento che contiene lo scadenzario (es. cartella Scadenziario, codice 99)",
      "Sulla riga del documento clicca l'icona graffetta con tooltip File allegato",
      "Si apre il dialog File allegato con titolo del documento",
      "In basso, sezione Carica file o Carica nuova revisione: scegli il file .xlsx, .xls o .csv",
      "Clicca il pulsante Carica file",
    ],
    expect:
      "Messaggio verde di conferma upload. Se il file \u00E8 un foglio di calcolo riconosciuto come scadenzario, parte il rilevamento automatico.",
  },
  {
    id: "step3" as Section,
    title: "Passo 3 \u2014 Conferma l'import nel dialog",
    where: "Dialog File scadenzario rilevato",
    clicks: [
      "Verifica foglio Excel, Colonna data scadenza e Colonna descrizione (gi\u00E0 suggeriti dal sistema)",
      "Opzionale: compila Etichetta scadenzario, Colonna tipo/categoria, Colonna codice/riferimento",
      "Opzionale: attiva Ri-importa automaticamente quando il file viene aggiornato",
      "Clicca Importa scadenze (oppure Annulla per chiudere senza importare)",
    ],
    expect:
      "Il dialog si chiude e compare un messaggio con il numero di scadenze importate. In importazione il pulsante mostra Importazione...",
  },
  {
    id: "step4" as Section,
    title: "Passo 4 \u2014 Consulta la griglia Scadenzari",
    where: "Menu laterale Scadenzari oppure percorso /deadlines",
    clicks: [
      "Leggi le statistiche in alto: Attive, Scadute, In scadenza 30gg, Completate",
      "Usa i filtri Stato, Azienda e File origine per restringere l'elenco",
      "Ordina per colonna cliccando l'intestazione (Oggetto, Scadenza, Giorni, ecc.)",
      "Per segnare una scadenza conclusa clicca il pulsante OK sulla riga (solo stato Attivo)",
    ],
    expect:
      "Griglia con semaforo colorato, date e giorni residui. Se non ci sono dati: Nessuna scadenza trovata. Importa un file Excel dal Registro Documenti.",
  },
  {
    id: "step5" as Section,
    title: "Passo 5 \u2014 Controlla le urgenze nel tab Priorit\u00E0",
    where: "Registro Documenti, tab Priorit\u00E0 (aperto di default)",
    clicks: [
      "Clicca il tab Priorit\u00E0 se non \u00E8 gi\u00E0 attivo",
      "Scorri fino alla sezione Scadenze da file",
      "Leggi oggetto, file origine, azienda e data per ogni voce urgente",
    ],
    expect:
      "Le scadenze importate compaiono accanto a documenti scaduti e in scadenza. Hint: Importate da scadenzari Excel.",
  },
];

function FlowDiagram() {
  const theme = useHostTheme();

  const layout = computeDAGLayout({
    nodes: [
      { id: "docs" },
      { id: "upload" },
      { id: "dialog" },
      { id: "grid" },
      { id: "priority" },
    ],
    edges: [
      { from: "docs", to: "upload" },
      { from: "upload", to: "dialog" },
      { from: "dialog", to: "grid" },
      { from: "dialog", to: "priority" },
    ],
    nodeWidth: 132,
    nodeHeight: 52,
    rankGap: 64,
    nodeGap: 28,
    padding: 16,
  });

  const labels: Record<string, string> = {
    docs: "Documenti",
    upload: "Carica file",
    dialog: "Importa scadenze",
    grid: "Scadenzari",
    priority: "Tab Priorit\u00E0",
  };

  const nodeW = 132;
  const nodeH = 52;

  return (
    <Stack gap={12}>
      <Text tone="secondary" size="small">
        Flusso principale ADR-013: un unico Excel nel registro alimenta sia la griglia Scadenzari sia il tab Priorit\u00E0.
      </Text>
      <div style={{ overflowX: "auto" }}>
        <svg
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label="Diagramma flusso import scadenzario"
        >
          {layout.edges.map((e) => (
            <line
              key={`${e.from}-${e.to}`}
              x1={e.sourceX}
              y1={e.sourceY}
              x2={e.targetX}
              y2={e.targetY}
              stroke={theme.stroke.secondary}
              strokeWidth={1.5}
            />
          ))}
          {layout.nodes.map((n) => (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={nodeW}
                height={nodeH}
                rx={6}
                fill={theme.fill.secondary}
                stroke={theme.stroke.primary}
                strokeWidth={1}
              />
              <text
                x={n.x + nodeW / 2}
                y={n.y + nodeH / 2 + 5}
                textAnchor="middle"
                fill={theme.text.primary}
                fontSize={12}
                fontFamily="system-ui, sans-serif"
              >
                {labels[n.id] || n.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Stack>
  );
}

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <Card variant="default">
      <CardHeader>{step.title}</CardHeader>
      <CardBody>
        <Stack gap={14}>
          <Row gap={8} align="center">
            <Text weight="semibold" size="small">
              Dove
            </Text>
            <Text size="small" tone="secondary">
              {step.where}
            </Text>
          </Row>
          <Stack gap={6}>
            <Text weight="semibold" size="small">
              Cosa cliccare
            </Text>
            {step.clicks.map((click, i) => (
              <div key={i}>
                <Text size="small" tone="secondary">
                  {i + 1}. {click}
                </Text>
              </div>
            ))}
          </Stack>
          <Callout tone="info" title="Cosa aspettarsi">
            {step.expect}
          </Callout>
        </Stack>
      </CardBody>
    </Card>
  );
}

function OverviewSection() {
  return (
    <Stack gap={20}>
      <Text>
        La funzione Scadenzari (ADR-013) importa automaticamente le date da un file Excel o CSV
        caricato nel Registro Documenti. Non serve digitare le scadenze a mano: il sistema le
        rileva, chiede conferma e le mostra in griglia e nel tab Priorit\u00E0.
      </Text>
      <FlowDiagram />
      <Grid columns={3} gap={14}>
        <Stat value="Documenti" label="Carica il file Excel" />
        <Stat value="Import" label="Conferma colonne" tone="info" />
        <Stat value="Scadenzari" label="Monitora e filtra" tone="success" />
      </Grid>
      <Callout tone="info" title="Prerequisito">
        Serve il modulo Documenti attivo sulla licenza. I formati supportati per il rilevamento
        sono .xlsx, .xls, .xlsm e .csv (foglio di calcolo allegato a un documento del registro).
      </Callout>
    </Stack>
  );
}

function SemaforoSection() {
  return (
    <Stack gap={16}>
      <Text tone="secondary">
        Nella griglia Scadenzari ogni riga ha un indicatore colorato e colonne Giorni e Scadenza
        con lo stesso codice colore.
      </Text>
      <Table
        headers={["Colore", "Significato", "Regola"]}
        rows={[
          ["Rosso", "Urgente o scaduto", "Scadenza passata oppure entro 7 giorni"],
          ["Arancione", "Attenzione", "Scadenza entro 30 giorni"],
          ["Verde", "Tranquillo", "Pi\u00F9 di 30 giorni alla scadenza"],
        ]}
        striped
      />
      <H3>Stati delle scadenze</H3>
      <Table
        headers={["Stato in griglia", "Significato"]}
        rows={[
          ["Attivo", "Scadenza ancora da gestire"],
          ["Completato", "Segnata conclusa con pulsante OK"],
          ["Archiviato", "Non pi\u00F9 in elenco operativo"],
          ["Preso in carico", "Scaduta ma gi\u00E0 presa in gestione"],
        ]}
        striped
      />
      <Callout tone="warning" title="Aggiornare lo scadenzario">
        Modifica il file Excel sul PC, poi ricaricalo con Carica nuova revisione nel dialog File
        allegato. Se hai attivato Ri-importa automaticamente, le scadenze si aggiornano al
        prossimo upload.
      </Callout>
    </Stack>
  );
}

export default function GuidaScadenzarioAdr013() {
  const [active, setActive] = useCanvasState<Section>("section", "overview");
  const section = active ?? "overview";

  const currentStep = STEPS.find((s) => s.id === section);

  return (
    <Stack gap={24} style={{ padding: 24, maxWidth: 920, margin: "0 auto" }}>
      <Stack gap={4}>
        <H1>{"Guida Scadenzari \u2014 import automatico da Excel"}</H1>
        <Text tone="secondary">
          {"Procedura operativa ADR-013 \u00B7 etichette reali dall'interfaccia SGQ"}
        </Text>
      </Stack>

      <Stack gap={8}>
        <Text weight="semibold" size="small" tone="secondary">
          Indice
        </Text>
        <Row gap={8} wrap>
          {SECTIONS.map((s) => (
            <div key={s.id}>
              <Pill active={section === s.id} onClick={() => setActive(s.id)}>
                {s.label}
              </Pill>
            </div>
          ))}
        </Row>
      </Stack>

      <Divider />

      {section === "overview" && (
        <>
          <H2>Panoramica</H2>
          <OverviewSection />
        </>
      )}

      {currentStep && (
        <>
          <H2>{currentStep.title}</H2>
          <StepCard step={currentStep} />
          <Row gap={8} wrap>
            {STEPS.map((s, idx) => {
              const curIdx = STEPS.indexOf(currentStep);
              if (s.id === section) return null;
              const stepLabel = SECTIONS.find((sec) => sec.id === s.id)?.label ?? s.title;
              return (
                <div key={s.id}>
                  <Button
                    variant={idx === curIdx + 1 ? "primary" : "ghost"}
                    onClick={() => setActive(s.id)}
                  >
                    {idx < curIdx ? "Indietro: " : idx > curIdx ? "Avanti: " : ""}
                    {stepLabel.replace(/^\d+\.\s*/, "")}
                  </Button>
                </div>
              );
            })}
          </Row>
        </>
      )}

      {section === "semaforo" && (
        <>
          <H2>Legenda semaforo e stati</H2>
          <SemaforoSection />
        </>
      )}

      <Divider />

      <Card variant="default">
        <CardHeader>Riferimenti rapidi</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <CollapsibleSection title="Pulsanti e voci menu citati">
              <Table
                headers={["Etichetta UI", "Dove si trova"]}
                rows={[
                  ["Documenti", "Sidebar SGQ, voce Registro Documenti"],
                  ["Scadenzari", "Sidebar SGQ, pagina /deadlines"],
                  ["File allegato", "Tooltip icona graffetta nel tab Albero"],
                  ["Carica file", "Dialog File allegato, sezione upload"],
                  ["File scadenzario rilevato", "Titolo dialog import automatico"],
                  ["Importa scadenze", "Pulsante conferma nel dialog import"],
                  ["Priorit\u00E0", "Primo tab del Registro Documenti"],
                  ["Scadenze da file", "Sezione nel tab Priorit\u00E0"],
                ]}
                striped
              />
            </CollapsibleSection>
            <Text size="small" tone="secondary">
              App:{" "}
              <Link href="https://systemgest.netlify.app/documents">Registro Documenti</Link>
              {" \u00B7 "}
              <Link href="https://systemgest.netlify.app/deadlines">Scadenzari</Link>
            </Text>
          </Stack>
        </CardBody>
      </Card>
    </Stack>
  );
}
