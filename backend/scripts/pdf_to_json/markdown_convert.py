#!/usr/bin/env python3
"""
Conversione testo pulito -> Markdown - pdf_to_json toolkit.

Rilevamento euristico dei titoli (heading) basato su tre segnali,
in ordine di affidabilita':
1. Pattern numerico di clausola normativa: "4.1 Titolo", "10.2.3 Titolo".
2. Indizio font-size (se fornito da `extract.py` tramite metadata pdfplumber
   o PyMuPDF): righi scritti con un carattere piu' grande della media pagina.
3. Rigo interamente in MAIUSCOLO (tipico dei titoli di sezione in molti
   documenti tecnici/normativi).

Le tabelle estratte da `extract.py` (liste di righe di celle) vengono
convertite in tabelle Markdown standard.
"""

import re

# "4.1 Titolo", "10.2.3 Titolo del punto" (con punto finale opzionale dopo il numero)
_CLAUSE_HEADING_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,5})\.?\s+(\S.{1,150})$")

_LIST_ITEM_RE = re.compile(r"^([-*\u2022]\s+|[a-z]\)\s+|\d+\)\s+)")

_MAX_HEADING_LEVEL = 6


def table_to_markdown(rows):
    """
    Converte una tabella (lista di righe, ognuna lista di celle stringa)
    in una tabella Markdown standard (prima riga = intestazione).

    Ritorna stringa vuota se `rows` e' vuoto.
    """
    if not rows:
        return ""

    def escape_cell(cell):
        cell = "" if cell is None else str(cell)
        cell = cell.replace("\n", " ").replace("|", "\\|").strip()
        return cell

    header = [escape_cell(cell) for cell in rows[0]]
    n_cols = len(header) or 1
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * n_cols) + " |"]

    for row in rows[1:]:
        cells = [escape_cell(cell) for cell in row]
        if len(cells) < n_cols:
            cells = cells + [""] * (n_cols - len(cells))
        elif len(cells) > n_cols:
            cells = cells[:n_cols]
        lines.append("| " + " | ".join(cells) + " |")

    return "\n".join(lines)


def is_list_item(line):
    """Vero se il rigo sembra un elemento di elenco puntato/numerato/alfabetico."""
    return bool(_LIST_ITEM_RE.match(line.strip()))


def is_all_caps_heading(line):
    """
    Vero se il rigo e' plausibilmente un titolo in maiuscolo: contiene
    lettere (accentate incluse), sono tutte maiuscole, lunghezza ragionevole
    e non termina come una frase (evita falsi positivi su frasi urlate).
    """
    text = line.strip()
    if not (3 <= len(text) <= 120):
        return False
    letters = [char for char in text if char.isalpha()]
    if len(letters) < 3:
        return False
    if not all(char.isupper() for char in letters):
        return False
    if text.endswith((".", ";", ",")):
        return False
    return True


def detect_clause_heading(line):
    """
    Riconosce un heading con numerazione di clausola tipo "4.1 Titolo".

    Ritorna (level, clause_ref, title) oppure None.
    """
    match = _CLAUSE_HEADING_RE.match(line.strip())
    if not match:
        return None
    clause_ref, title = match.groups()
    title = title.strip()
    if not title:
        return None
    level = min(clause_ref.count(".") + 1, _MAX_HEADING_LEVEL)
    return level, clause_ref, title


def detect_heading(line, heading_hints=None):
    """
    Applica in ordine le euristiche di rilevamento titolo.

    Ritorna (level, clause_ref_o_None, title) oppure None se il rigo
    non sembra un titolo.
    """
    line = line.strip()
    if not line:
        return None

    clause_heading = detect_clause_heading(line)
    if clause_heading:
        return clause_heading

    if heading_hints:
        normalized = " ".join(line.split())
        if normalized in heading_hints:
            return 2, None, line

    if is_all_caps_heading(line):
        return 2, None, line

    return None


def heading_to_markdown(level, clause_ref, title):
    prefix = "#" * max(1, min(level, _MAX_HEADING_LEVEL))
    text = f"{clause_ref} {title}" if clause_ref else title
    return f"{prefix} {text}"


def convert_page_text_to_markdown(text, heading_hints=None):
    """
    Converte il testo pulito di una pagina in blocchi Markdown: titoli,
    elementi di elenco su rigo singolo, paragrafi (righi consecutivi senza
    riga vuota tra loro vengono uniti in un unico paragrafo).
    """
    if not text:
        return ""

    heading_hints = heading_hints or set()
    blocks = []
    paragraph_buffer = []

    def flush_paragraph():
        if paragraph_buffer:
            blocks.append(" ".join(paragraph_buffer).strip())
            paragraph_buffer.clear()

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line:
            flush_paragraph()
            continue

        heading = detect_heading(line, heading_hints)
        if heading:
            flush_paragraph()
            level, clause_ref, title = heading
            blocks.append(heading_to_markdown(level, clause_ref, title))
            continue

        if is_list_item(line):
            flush_paragraph()
            blocks.append(line)
            continue

        paragraph_buffer.append(line)

    flush_paragraph()
    return "\n\n".join(blocks)


def convert_page_to_markdown(page, include_page_marker=True):
    """
    Converte una pagina (dict con "text" gia' pulito, "tables", "heading_hints",
    "page_number") nel suo blocco Markdown completo, tabelle incluse.

    Le tabelle vengono aggiunte in coda al testo della pagina: pdfplumber
    non garantisce la posizione esatta della tabella nel flusso testuale,
    quindi appenderle e' la scelta piu' robusta e prevedibile (limite noto,
    documentato nel README).
    """
    parts = []
    if include_page_marker:
        quality_note = ""
        if page.get("text_quality_ok") is False:
            quality_note = " -- ATTENZIONE: testo di bassa qualita' (probabile font non standard), revisionare"
        parts.append(f"<!-- Pagina {page.get('page_number', '?')} (motore: {page.get('engine', '?')}){quality_note} -->")

    body = convert_page_text_to_markdown(page.get("text", ""), page.get("heading_hints"))
    if body:
        parts.append(body)

    for table in page.get("tables", []) or []:
        table_md = table_to_markdown(table)
        if table_md:
            parts.append(table_md)

    return "\n\n".join(part for part in parts if part)


def build_markdown(pages, include_page_markers=True):
    """
    Costruisce il documento Markdown completo a partire dalla lista di
    pagine pulite (vedi `clean.clean_pages`).
    """
    page_blocks = [convert_page_to_markdown(page, include_page_marker=include_page_markers) for page in pages]
    return "\n\n".join(block for block in page_blocks if block).strip() + "\n"
