#!/usr/bin/env python3
"""
Estrazione testo e tabelle da PDF - pdf_to_json toolkit (ProgettoISO).

Strategia a livelli (dal piu' preciso al piu' tollerante):
1. **pdfplumber** (motore primario): testo, tabelle e metadata font per
   pagina. E' il motore piu' affidabile per individuare tabelle e
   dimensione carattere (utile per riconoscere i titoli). Su alcune
   pagine con tabelle multi-colonna, pero', pdfplumber puo' ricostruire
   l'ordine dei caratteri in modo sbagliato (testo "presente" e apparen-
   temente pulito, ma con i caratteri scambiati dentro le celle, es.
   "Table" -> "elbaT"): dopo l'estrazione, ogni pagina viene passata al
   controllo di leggibilita' di `quality.py`; se il punteggio e' basso,
   la stessa pagina viene ri-estratta con PyMuPDF e si tiene il testo
   con punteggio migliore (vedi `_fix_reordered_pages` piu' sotto).
   Attivo di default, nessun flag richiesto.
2. **PyMuPDF / fitz** (fallback 1): usato per le pagine dove pdfplumber
   non produce testo utile (impaginazioni particolari). E' generalmente
   piu' tollerante di pypdf su PDF "difficili" e viene anche usato per
   il rendering pagina -> immagine richiesto dall'OCR (vedi punto 4),
   evitando cosi' la dipendenza dal binario esterno poppler.
3. **pypdf** (fallback 2): ultima rete per l'estrazione testo pura,
   usato se anche PyMuPDF non e' disponibile o non produce testo.
4. **OCR locale opzionale** (pytesseract, solo se il binario `tesseract`
   e' installato sul sistema): tentato SOLO come ultima risorsa sulle
   pagine ancora prive di testo dopo i tre motori sopra. Se il binario
   tesseract non e' presente, l'OCR viene semplicemente saltato (nessun
   errore bloccante) e si procede alla segnalazione finale.

Se dopo tutti i tentativi nessuna pagina produce testo utile, il PDF e'
quasi certamente una scansione priva di livello testo: viene sollevata
`PdfExtractionError` con un messaggio chiaro (che indica anche se l'OCR
e' stato tentato o e' stato saltato per assenza del binario tesseract),
invece di restituire silenziosamente un risultato vuoto.

Nessuna fase di questo modulo chiama servizi cloud/API esterne: tutte le
librerie usate (pdfplumber, pypdf, pymupdf, pytesseract) elaborano il PDF
localmente. L'OCR richiede comunque il binario `tesseract` installato a
parte sul sistema operativo (non e' un pacchetto pip): se assente, il
tool lo segnala e prosegue con l'errore normale invece di bloccarsi.
"""

import logging
import re
import shutil
import statistics
import unicodedata

from .quality import is_probably_corrupted, text_readability_score

logger = logging.getLogger("pdf_to_json.extract")

# Soglia minima di caratteri "utili" (non whitespace) perche' una pagina
# sia considerata testo estratto correttamente.
MIN_USEFUL_CHARS = 3

# Alcuni PDF hanno font con codifica/ToUnicode mancante o rotta (es. subset
# font "anti-copia" usati in alcune edizioni commerciali di norme UNI/ISO):
# pdfminer/pdfplumber in questi casi non falliscono e non restituiscono
# testo vuoto, ma un testo apparentemente "presente" e pero' illeggibile,
# con placeholder letterali tipo "(cid:52)(cid:86)..." al posto dei
# caratteri veri. Va trattato come "nessun testo utile", non come successo.
_CID_PLACEHOLDER_RE = re.compile(r"\(cid:\d+\)")

# Soglia minima di "qualita'" del testo (frazione di caratteri plausibili:
# lettere, cifre, punteggiatura, spazi) sotto la quale il testo e'
# considerato spazzatura/non decodificato correttamente.
MIN_TEXT_QUALITY_RATIO = 0.85

# Un rigo e' considerato "titolo" (candidato heading) se la sua dimensione
# carattere massima supera la mediana della pagina di questo fattore.
FONT_SIZE_HEADING_RATIO = 1.15

# Risoluzione di rendering per l'OCR (DPI): compromesso qualita'/velocita'.
OCR_RENDER_DPI = 300


class PdfExtractionError(Exception):
    """Sollevata quando un PDF non produce testo estraibile utilizzabile."""


def _text_quality_ratio(text):
    """
    Stima quanto del testo estratto e' plausibilmente "vero testo" (lettere
    di qualsiasi alfabeto, cifre, punteggiatura comune, spazi) rispetto a
    placeholder di glifi non mappati (`(cid:NNN)`) o caratteri di controllo
    non stampabili, tipici di font con codifica/ToUnicode rotta o assente.

    Ritorna un valore fra 0.0 (tutto spazzatura) e 1.0 (tutto plausibile).
    """
    if not text:
        return 0.0

    cid_matches = _CID_PLACEHOLDER_RE.findall(text)
    cid_char_count = sum(len(match) for match in cid_matches)
    remaining = _CID_PLACEHOLDER_RE.sub("", text)

    if not remaining and cid_char_count == 0:
        return 0.0

    bad_in_remaining = sum(
        1
        for char in remaining
        if char not in "\n\t\r" and unicodedata.category(char) in ("Cc", "Co", "Cn")
    )

    total = len(text)
    bad = cid_char_count + bad_in_remaining
    return max(0.0, 1 - (bad / total))


def _text_has_content(text):
    if not text:
        return False
    stripped = text.strip()
    if len(stripped) < MIN_USEFUL_CHARS:
        return False
    return _text_quality_ratio(text) >= MIN_TEXT_QUALITY_RATIO


def _try_import_fitz():
    try:
        import fitz  # PyMuPDF

        return fitz
    except Exception as exc:  # pragma: no cover - dipende dall'ambiente
        logger.debug("PyMuPDF (fitz) non disponibile: %s", exc)
        return None


def _try_import_pytesseract():
    try:
        import pytesseract

        return pytesseract
    except Exception as exc:  # pragma: no cover - dipende dall'ambiente
        logger.debug("pytesseract non disponibile: %s", exc)
        return None


def is_ocr_available():
    """
    Vero solo se sia la libreria pytesseract sia il binario di sistema
    `tesseract` sono presenti. L'OCR e' un pacchetto pip "wrapper": senza
    il binario installato a parte (non distribuibile via pip) non puo'
    funzionare, quindi verifichiamo entrambi prima di proporlo come opzione.
    """
    if shutil.which("tesseract") is None:
        return False
    pytesseract = _try_import_pytesseract()
    if pytesseract is None:
        return False
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception as exc:
        logger.debug("Binario tesseract trovato ma non utilizzabile: %s", exc)
        return False


def _extract_heading_font_hints(page):
    """
    Individua, tramite i metadata font di pdfplumber, i righi che appaiono
    scritti con un carattere significativamente piu' grande della media
    della pagina (probabili titoli/heading).

    Ritorna un set di stringhe (righi normalizzati: strip + spazi collassati)
    da usare come suggerimento in fase di conversione Markdown. In caso di
    errore o mancanza di dati (pagina scansionata, font non incorporati),
    ritorna un set vuoto: questa euristica e' solo un supporto opzionale,
    mai un requisito bloccante.
    """
    try:
        words = page.extract_words(extra_attrs=["size"], use_text_flow=False, keep_blank_chars=False)
    except Exception as exc:  # difensivo: pdfplumber puo' fallire su PDF anomali
        logger.debug("Impossibile leggere metadata font pagina %s: %s", page.page_number, exc)
        return set()

    return _hints_from_line_sizes(_group_words_into_lines(words))


def _group_words_into_lines(words):
    if not words:
        return []
    lines = {}
    for word in words:
        top_key = round(word.get("top", 0))
        lines.setdefault(top_key, []).append(word)

    line_entries = []
    for line_words in lines.values():
        line_words.sort(key=lambda w: w.get("x0", 0))
        text = " ".join(w.get("text", "") for w in line_words).strip()
        if not text:
            continue
        max_size = max((w.get("size") or 0) for w in line_words)
        line_entries.append((text, max_size))
    return line_entries


def _hints_from_line_sizes(line_entries):
    sizes = [size for _, size in line_entries if size]
    if len(sizes) < 3:
        return set()

    median_size = statistics.median(sizes)
    if not median_size:
        return set()

    hints = set()
    for text, size in line_entries:
        if size and size > median_size * FONT_SIZE_HEADING_RATIO:
            normalized = " ".join(text.split())
            if normalized:
                hints.add(normalized)
    return hints


def _extract_heading_font_hints_fitz(fitz_page):
    """
    Equivalente di `_extract_heading_font_hints` ma basato sui dati
    "span" di PyMuPDF (`get_text("dict")`), generalmente piu' affidabili
    di pdfplumber sulla dimensione carattere per PDF con font complessi.
    Usato solo per le pagine estratte via fallback PyMuPDF.
    """
    try:
        raw = fitz_page.get_text("dict")
    except Exception as exc:
        logger.debug("Impossibile leggere metadata font (fitz) pagina: %s", exc)
        return set()

    line_entries = []
    for block in raw.get("blocks", []):
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            text = "".join(span.get("text", "") for span in spans).strip()
            if not text:
                continue
            max_size = max((span.get("size") or 0) for span in spans)
            line_entries.append((text, max_size))

    return _hints_from_line_sizes(line_entries)


def _extract_with_pdfplumber(pdf_path, verbose=False):
    import pdfplumber

    pages_data = []
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                logger.warning("pdfplumber: errore estrazione testo pagina %s: %s", index, exc)
                text = ""

            try:
                raw_tables = page.extract_tables() or []
            except Exception as exc:
                logger.warning("pdfplumber: errore estrazione tabelle pagina %s: %s", index, exc)
                raw_tables = []

            tables = []
            for table in raw_tables:
                cleaned_table = [
                    [cell if cell is not None else "" for cell in row]
                    for row in table
                    if row is not None
                ]
                if cleaned_table:
                    tables.append(cleaned_table)

            heading_hints = _extract_heading_font_hints(page) if _text_has_content(text) else set()

            if verbose:
                logger.info(
                    "pdfplumber pagina %s: %s caratteri, %s tabelle, %s indizi font-size",
                    index,
                    len(text.strip()),
                    len(tables),
                    len(heading_hints),
                )

            pages_data.append(
                {
                    "page_number": index,
                    "text": text,
                    "tables": tables,
                    "heading_hints": heading_hints,
                    "engine": "pdfplumber",
                }
            )
    return pages_data


def _extract_with_pymupdf(pdf_path, verbose=False):
    fitz = _try_import_fitz()
    if fitz is None:
        return None

    pages_data = []
    doc = fitz.open(pdf_path)
    try:
        for index, page in enumerate(doc, start=1):
            try:
                text = page.get_text("text") or ""
            except Exception as exc:
                logger.warning("pymupdf: errore estrazione testo pagina %s: %s", index, exc)
                text = ""

            heading_hints = _extract_heading_font_hints_fitz(page) if _text_has_content(text) else set()

            if verbose:
                logger.info(
                    "pymupdf pagina %s: %s caratteri, %s indizi font-size (fallback, nessuna tabella)",
                    index,
                    len(text.strip()),
                    len(heading_hints),
                )

            pages_data.append(
                {
                    "page_number": index,
                    "text": text,
                    "tables": [],
                    "heading_hints": heading_hints,
                    "engine": "pymupdf",
                }
            )
    finally:
        doc.close()
    return pages_data


def _extract_with_pypdf(pdf_path, verbose=False):
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    pages_data = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as exc:
            logger.warning("pypdf: errore estrazione testo pagina %s: %s", index, exc)
            text = ""

        if verbose:
            logger.info("pypdf pagina %s: %s caratteri (fallback, nessuna tabella)", index, len(text.strip()))

        pages_data.append(
            {
                "page_number": index,
                "text": text,
                "tables": [],
                "heading_hints": set(),
                "engine": "pypdf",
            }
        )
    return pages_data


def _ocr_page(pdf_path, page_number, verbose=False):
    """
    Ultima risorsa: rasterizza la pagina con PyMuPDF (nessuna dipendenza da
    poppler) e ne esegue l'OCR con pytesseract. Ritorna stringa vuota se
    l'OCR non e' disponibile o fallisce: e' un tentativo best-effort, mai
    un requisito per il funzionamento del tool.
    """
    fitz = _try_import_fitz()
    pytesseract = _try_import_pytesseract()
    if fitz is None or pytesseract is None:
        return ""

    try:
        from PIL import Image

        doc = fitz.open(pdf_path)
        try:
            page = doc[page_number - 1]
            zoom = OCR_RENDER_DPI / 72
            pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        finally:
            doc.close()

        try:
            text = pytesseract.image_to_string(image, lang="ita+eng")
        except Exception:
            # Language pack ita/eng eventualmente non installato: riprova
            # con la lingua di default di tesseract.
            text = pytesseract.image_to_string(image)

        if verbose:
            logger.info("OCR pagina %s: %s caratteri riconosciuti", page_number, len(text.strip()))
        return text
    except Exception as exc:
        logger.warning("OCR fallito sulla pagina %s: %s", page_number, exc)
        return ""


def _fix_reordered_pages(pdf_path, pages_data, verbose=False):
    """
    Individua le pagine il cui testo e' "presente" (supera `_text_has_content`)
    ma probabilmente illeggibile perche' pdfplumber ne ha riordinato/scambiato
    i caratteri (frequente su tabelle multi-colonna, es. "Table" -> "elbaT",
    vedi `quality.py`). Per ciascuna pagina candidata, ri-estrae la stessa
    pagina con PyMuPDF e tiene il testo con punteggio di leggibilita'
    migliore fra i due.

    Modifica `pages_data` in place (aggiorna "text", "engine", "heading_hints"
    e imposta "readability_fixed" = True sulle pagine corrette). Ritorna la
    lista dei numeri di pagina corretti (lista vuota se nessuna correzione).

    Nessun errore e' bloccante: se PyMuPDF non e' disponibile o fallisce,
    la pagina resta invariata (il tool non deve mai fallire per questo
    controllo aggiuntivo, solo migliorare il risultato quando possibile).
    """
    candidates = [
        page for page in pages_data
        if _text_has_content(page["text"]) and is_probably_corrupted(page["text"])
    ]
    if not candidates:
        return []

    try:
        alt_pages = _extract_with_pymupdf(pdf_path, verbose=verbose)
    except Exception as exc:
        logger.debug("Controllo leggibilita': fallback pymupdf non disponibile/fallito: %s", exc)
        alt_pages = None

    alt_by_number = {p["page_number"]: p for p in (alt_pages or [])}
    if not alt_by_number:
        return []

    fixed_pages = []
    for page in candidates:
        alt = alt_by_number.get(page["page_number"])
        if not alt or not _text_has_content(alt["text"]):
            continue

        original_score = text_readability_score(page["text"])
        alt_score = text_readability_score(alt["text"])
        if alt_score is None:
            continue
        if original_score is not None and alt_score <= original_score:
            continue

        logger.info(
            "Pagina %s: testo pdfplumber probabilmente con caratteri riordinati "
            "(punteggio %.2f), sostituito con testo pymupdf (punteggio %.2f)",
            page["page_number"],
            original_score if original_score is not None else -1.0,
            alt_score,
        )
        page["text"] = alt["text"]
        page["engine"] = "pymupdf"
        page["readability_fixed"] = True
        if alt["heading_hints"]:
            page["heading_hints"] = alt["heading_hints"]
        fixed_pages.append(page["page_number"])

    return fixed_pages


def extract_pdf(pdf_path, verbose=False, allow_ocr=True):
    """
    Estrae testo, tabelle e indizi di formattazione da un file PDF.

    Vedi il docstring del modulo per la strategia a livelli (pdfplumber ->
    pymupdf -> pypdf -> OCR opzionale).

    Parametri:
        pdf_path: percorso del file PDF.
        verbose: se True, logga informazioni dettagliate per pagina.
        allow_ocr: se False, disabilita il tentativo di OCR anche quando
            il binario tesseract e' disponibile (utile per batch veloci
            su documenti gia' noti come testuali).

    Ritorna un dict:
        {
            "source": str(pdf_path),
            "page_count": int,
            "pages": [ { "page_number", "text", "tables", "heading_hints", "engine" }, ... ],
            "engines_used": set di motori effettivamente usati,
            "ocr_used": bool,
        }

    Solleva `PdfExtractionError` se nessuna pagina produce testo utile
    dopo tutti i tentativi (inclusa l'eventuale OCR).
    """
    pdf_path = str(pdf_path)
    logger.info("Estrazione PDF: %s", pdf_path)

    reordering_fixed_pages = []

    try:
        pages_data = _extract_with_pdfplumber(pdf_path, verbose=verbose)
    except Exception as exc:
        logger.warning("pdfplumber non e' riuscito ad aprire il file (%s): tento fallback pymupdf/pypdf", exc)
        pages_data = None

    if pages_data is None:
        try:
            pages_data = _extract_with_pymupdf(pdf_path, verbose=verbose)
        except Exception as exc:
            logger.warning("pymupdf non e' riuscito ad aprire il file (%s): tento fallback pypdf", exc)
            pages_data = None

    if pages_data is None:
        try:
            pages_data = _extract_with_pypdf(pdf_path, verbose=verbose)
        except Exception as exc:
            raise PdfExtractionError(
                f"Impossibile aprire/estrarre il PDF '{pdf_path}' con pdfplumber, pymupdf e pypdf: {exc}. "
                "Verificare che il file non sia corrotto o protetto da password."
            ) from exc
    else:
        # Apertura riuscita con il motore primario: applica i fallback
        # testuali solo sulle pagine senza testo utile.
        pages_needing_fallback = [p for p in pages_data if not _text_has_content(p["text"])]
        if pages_needing_fallback:
            fallback_pages = {}
            try:
                pymupdf_pages = _extract_with_pymupdf(pdf_path, verbose=verbose)
                if pymupdf_pages:
                    fallback_pages = {p["page_number"]: p for p in pymupdf_pages}
            except Exception as exc:
                logger.debug("Fallback pymupdf non disponibile/fallito: %s", exc)

            still_missing = []
            for page in pages_needing_fallback:
                fallback = fallback_pages.get(page["page_number"])
                if fallback and _text_has_content(fallback["text"]):
                    logger.info("Pagina %s: motore primario vuoto, uso testo pymupdf (fallback)", page["page_number"])
                    page["text"] = fallback["text"]
                    page["engine"] = "pymupdf"
                    if fallback["heading_hints"]:
                        page["heading_hints"] = fallback["heading_hints"]
                else:
                    still_missing.append(page)

            if still_missing:
                try:
                    pypdf_pages = {p["page_number"]: p for p in _extract_with_pypdf(pdf_path, verbose=verbose)}
                except Exception as exc:
                    logger.debug("Fallback pypdf non disponibile/fallito: %s", exc)
                    pypdf_pages = {}

                for page in still_missing:
                    fallback = pypdf_pages.get(page["page_number"])
                    if fallback and _text_has_content(fallback["text"]):
                        logger.info("Pagina %s: uso testo pypdf (ultimo fallback)", page["page_number"])
                        page["text"] = fallback["text"]
                        page["engine"] = "pypdf"

        reordering_fixed_pages = _fix_reordered_pages(pdf_path, pages_data, verbose=verbose)

    ocr_used = False
    ocr_was_available = allow_ocr and is_ocr_available()
    if ocr_was_available:
        pages_still_empty = [p for p in pages_data if not _text_has_content(p["text"])]
        if pages_still_empty:
            logger.info(
                "%s pagina/e senza testo dopo pdfplumber/pymupdf/pypdf: tento OCR locale (tesseract)",
                len(pages_still_empty),
            )
        for page in pages_still_empty:
            ocr_text = _ocr_page(pdf_path, page["page_number"], verbose=verbose)
            if _text_has_content(ocr_text):
                page["text"] = ocr_text
                page["engine"] = "tesseract-ocr"
                ocr_used = True

    total_useful_chars = sum(len(p["text"].strip()) for p in pages_data)
    for page in pages_data:
        page["text_quality_ok"] = _text_has_content(page["text"])
    pages_with_text = sum(1 for p in pages_data if p["text_quality_ok"])
    low_quality_pages = [p["page_number"] for p in pages_data if not p["text_quality_ok"]]

    if not pages_data:
        raise PdfExtractionError(f"Il PDF '{pdf_path}' non contiene pagine.")

    if pages_with_text == 0:
        if allow_ocr and not ocr_was_available:
            ocr_note = (
                "OCR locale NON tentato: il binario 'tesseract' non e' installato su questo sistema "
                "(pytesseract da solo non basta, serve il programma tesseract-ocr installato a parte, "
                "es. https://github.com/UB-Mannheim/tesseract/wiki su Windows). "
            )
        elif allow_ocr and ocr_was_available:
            ocr_note = "OCR locale tentato con tesseract ma non ha prodotto testo utilizzabile. "
        else:
            ocr_note = "OCR disabilitato per questa esecuzione (--no-ocr). "

        # Distingue due cause molto diverse per il committente: pagina
        # davvero senza testo (scansione) vs testo presente ma illeggibile
        # per font con codifica/ToUnicode rotta o assente (frequente in
        # alcune edizioni PDF commerciali "anti-copia" di norme UNI/ISO).
        if total_useful_chars > 0:
            cause_note = (
                f"Sono stati estratti {total_useful_chars} caratteri grezzi, ma non superano la soglia "
                "di qualita' testo (placeholder di glifi tipo '(cid:NNN)' o caratteri di controllo non "
                "stampabili): il PDF ha probabilmente un font con codifica/ToUnicode mancante o "
                "volutamente offuscata (es. protezione anti-copia), non e' una scansione. "
            )
        else:
            cause_note = (
                "Il documento e' probabilmente una scansione/immagine priva di livello testo. "
            )

        raise PdfExtractionError(
            f"Nessun testo utilizzabile da '{pdf_path}' ({len(pages_data)} pagine analizzate, "
            f"{total_useful_chars} caratteri grezzi totali). {cause_note}{ocr_note}"
            "E' necessario un OCR di qualita' (es. Adobe Acrobat, ocrmypdf) prima di poter "
            "usare questo tool, oppure installare il binario tesseract per l'OCR automatico integrato "
            "(l'OCR legge i pixel della pagina e non risente della codifica del font)."
        )

    engines_used = {p["engine"] for p in pages_data}
    logger.info(
        "Estrazione completata: %s pagine, %s con testo utile, motori usati: %s%s",
        len(pages_data),
        pages_with_text,
        ", ".join(sorted(engines_used)),
        " (incluso OCR)" if ocr_used else "",
    )

    if low_quality_pages:
        # Successo parziale: il documento nel complesso ha testo utile, ma
        # alcune pagine restano illeggibili (font non standard su quelle
        # pagine specifiche, layout anomalo, ecc.). Non e' un errore
        # bloccante, ma va segnalato chiaramente: il .md conterra' testo
        # spazzatura per queste pagine e va corretto a mano dopo revisione.
        logger.warning(
            "%s pagina/e su %s con testo di bassa qualita' (probabile font non standard): %s. "
            "Revisionare con attenzione queste pagine nel markdown intermedio.",
            len(low_quality_pages),
            len(pages_data),
            ", ".join(str(n) for n in low_quality_pages),
        )

    if reordering_fixed_pages:
        logger.info(
            "%s pagina/e con caratteri riordinati (pdfplumber) corrette automaticamente con pymupdf: %s",
            len(reordering_fixed_pages),
            ", ".join(str(n) for n in reordering_fixed_pages),
        )

    return {
        "source": pdf_path,
        "page_count": len(pages_data),
        "low_quality_pages": low_quality_pages,
        "reordering_fixed_pages": reordering_fixed_pages,
        "pages": pages_data,
        "engines_used": engines_used,
        "ocr_used": ocr_used,
    }
