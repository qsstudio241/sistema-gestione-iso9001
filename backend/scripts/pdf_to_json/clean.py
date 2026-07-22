#!/usr/bin/env python3
"""
Pulizia e normalizzazione testo estratto da PDF - pdf_to_json toolkit.

Funzioni pure (stringa in, stringa out) cosi' da poter essere testate con
semplici fixture testuali, senza dipendere da un PDF reale.
"""

import logging
import re

logger = logging.getLogger("pdf_to_json.clean")

# Sequenze tipiche di "mojibake" UTF-8 letto come Latin-1/Windows-1252,
# frequenti in PDF esportati da sistemi con encoding non coerente.
_MOJIBAKE_MAP = {
    "Ã ": "à", "Ã¨": "è", "Ã©": "é", "Ã¬": "ì", "Ã²": "ò", "Ã¹": "ù",
    "Ã€": "À", "Ã‰": "É", "Ã’": "Ò", "Ã™": "Ù",
    "â€™": "'", "â€˜": "'", "â€œ": '"', "â€\x9d": '"', "â€\x9c": '"',
    "â€“": "-", "â€”": "-", "â€¦": "...", "Â°": "°", "Â»": "»", "Â«": "«",
    "\u00a0": " ", "\ufeff": "",
}

# Rigo composto solo da numero di pagina (con eventuale prefisso "Pagina"/"Pag.")
_PAGE_NUMBER_RE = re.compile(r"^(pag(?:ina)?\.?\s*)?\d{1,4}(\s*[/\-]\s*\d{1,4})?$", re.IGNORECASE)

# Coppia di lettere minuscole separate da trattino di fine riga: "svilup-\npo"
_DEHYPHEN_RE = re.compile(r"([a-zàèéìòù])-\n\s*([a-zàèéìòù])")

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def fix_mojibake(text):
    """Sostituisce le sequenze di mojibake piu' comuni con il carattere corretto."""
    if not text:
        return text
    for broken, fixed in _MOJIBAKE_MAP.items():
        if broken in text:
            text = text.replace(broken, fixed)
    return text


def strip_control_chars(text):
    """Rimuove caratteri di controllo non stampabili (tranne newline/tab)."""
    if not text:
        return text
    return _CONTROL_CHARS_RE.sub("", text)


def dehyphenate(text):
    """
    Ricongiunge le parole spezzate a fine riga da un trattino (sillabazione
    da giustificazione PDF), es. "svilup-\\npo" -> "sviluppo".

    Applica la ricongiunzione solo quando entrambi i lati sono lettere
    minuscole (accentate incluse): evita di toccare acronimi, elenchi
    puntati con trattino o numeri di telefono.
    """
    if not text:
        return text
    previous = None
    while previous != text:
        previous = text
        text = _DEHYPHEN_RE.sub(r"\1\2", text)
    return text


def is_page_number_line(line):
    """Vero se il rigo contiene solo un numero di pagina (con prefisso opzionale)."""
    return bool(_PAGE_NUMBER_RE.match(line.strip()))


def strip_edge_page_numbers(text, edge=2):
    """
    Rimuove righi che sono solo un numero di pagina, ma solo se si trovano
    nelle prime/ultime `edge` righe non vuote del testo: evita di rimuovere
    per errore numeri che fanno parte del corpo del testo (es. elenchi).
    """
    if not text:
        return text
    lines = text.split("\n")
    n = len(lines)
    kept = []
    for index, line in enumerate(lines):
        near_edge = index < edge or index >= n - edge
        if near_edge and is_page_number_line(line):
            continue
        kept.append(line)
    return "\n".join(kept)


def normalize_whitespace(text):
    """
    Normalizza whitespace: tab -> spazio singolo, spazi multipli collassati,
    fine riga senza spazi finali, massimo una riga vuota consecutiva.
    """
    if not text:
        return ""
    text = text.replace("\t", " ")
    text = re.sub(r"[ \u00a0]{2,}", " ", text)
    lines = [line.rstrip() for line in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip("\n")


def clean_text(text):
    """Pipeline di pulizia di base applicata al testo di una singola pagina."""
    text = fix_mojibake(text)
    text = strip_control_chars(text)
    text = dehyphenate(text)
    text = strip_edge_page_numbers(text)
    text = normalize_whitespace(text)
    return text


def detect_repeated_lines(page_texts, min_ratio=0.6, min_pages=3, edge_window=5, max_line_length=100):
    """
    Individua righi (header/footer, es. nome azienda, watermark, "Pagina N
    di M") che si ripetono identici in prossimita' dei margini di piu'
    pagine, per poterli rimuovere in fase di pulizia.

    Confronta solo le prime/ultime `edge_window` righe non vuote di ogni
    pagina (dove tipicamente stanno header/footer), cosi' da non scartare
    per errore frasi ripetute nel corpo del documento (es. formule fisse).

    Ritorna un set di stringhe (righi esatti, gia' "strip") da rimuovere.
    """
    total_pages = len(page_texts)
    if total_pages < min_pages:
        return set()

    frequency = {}
    for text in page_texts:
        lines = [line.strip() for line in (text or "").split("\n") if line.strip()]
        if not lines:
            continue
        edge_lines = set(lines[:edge_window]) | set(lines[-edge_window:])
        for line in edge_lines:
            if len(line) > max_line_length:
                continue
            frequency[line] = frequency.get(line, 0) + 1

    threshold = max(min_pages, int(round(total_pages * min_ratio)))
    repeated = {line for line, count in frequency.items() if count >= threshold}
    if repeated:
        logger.info("Righi ripetuti rilevati (header/footer): %s", sorted(repeated))
    return repeated


def remove_lines(text, lines_to_remove):
    """Rimuove dal testo tutti i righi il cui contenuto (strip) e' in `lines_to_remove`."""
    if not text or not lines_to_remove:
        return text
    kept = [line for line in text.split("\n") if line.strip() not in lines_to_remove]
    return "\n".join(kept)


def clean_pages(pages, min_ratio=0.6, min_pages=3):
    """
    Pulisce una lista di pagine (dict con almeno la chiave "text"), rimuovendo
    anche header/footer ripetuti individuati tra le pagine.

    Ritorna una nuova lista di dict con "text" sostituito dal testo pulito;
    le altre chiavi (tables, heading_hints, engine, page_number) sono
    preservate invariate.
    """
    raw_texts = [page.get("text", "") for page in pages]
    repeated_lines = detect_repeated_lines(raw_texts, min_ratio=min_ratio, min_pages=min_pages)

    cleaned_pages = []
    for page in pages:
        text = page.get("text", "")
        text = remove_lines(text, repeated_lines)
        text = clean_text(text)
        cleaned_page = dict(page)
        cleaned_page["text"] = text
        cleaned_pages.append(cleaned_page)
    return cleaned_pages
