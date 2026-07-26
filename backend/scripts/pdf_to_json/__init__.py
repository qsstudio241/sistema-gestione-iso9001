"""
pdf_to_json - toolkit generico e riutilizzabile per convertire PDF in
Markdown revisionabile e poi in JSON strutturato, per ProgettoISO.

Pipeline in 3 fasi (vedi README.md nella cartella per i dettagli d'uso):
    1. extract.py            -> estrazione testo/tabelle da PDF (pdfplumber + fallback)
    2. clean.py               -> pulizia e normalizzazione testo
    3. markdown_convert.py    -> conversione in Markdown (heading, liste, tabelle)
    structure.py              -> conversione Markdown -> JSON strutturato
    quality.py                -> punteggio di leggibilita' per rilevare testo con
                                  caratteri riordinati (usato internamente da extract.py)

Uso rapido da riga di comando:
    python -m backend.scripts.pdf_to_json.cli --input documento.pdf --output-dir out/

Uso come libreria:
    from backend.scripts.pdf_to_json.extract import extract_pdf
    from backend.scripts.pdf_to_json.clean import clean_pages
    from backend.scripts.pdf_to_json.markdown_convert import build_markdown
    from backend.scripts.pdf_to_json.structure import markdown_to_json
"""

from .extract import PdfExtractionError, extract_pdf, is_ocr_available
from .clean import clean_pages, clean_text
from .markdown_convert import build_markdown, convert_page_to_markdown, table_to_markdown
from .structure import markdown_to_json, parse_markdown_to_tree
from .quality import is_probably_corrupted, text_readability_score

__all__ = [
    "PdfExtractionError",
    "extract_pdf",
    "is_ocr_available",
    "clean_pages",
    "clean_text",
    "build_markdown",
    "convert_page_to_markdown",
    "table_to_markdown",
    "markdown_to_json",
    "parse_markdown_to_tree",
    "is_probably_corrupted",
    "text_readability_score",
]
