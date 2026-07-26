#!/usr/bin/env python3
"""
CLI - pdf_to_json toolkit (ProgettoISO)

Converte uno o piu' PDF in Markdown (intermedio, sempre salvato per
revisione umana) e poi in JSON strutturato, secondo lo schema scelto.

Esempi:
    # Singolo file, schema generico (albero di sezioni)
    python cli.py --input "docs/Normative/UNI EN ISO 9001_2015 Rev. 0.pdf" --output-dir out/

    # Singolo file, schema norm-clause (compatibile import-norms-from-markdown.js)
    python cli.py --input norma.pdf --output-dir out/ --schema norm-clause --standard-code ISO_9001_2015

    # Cartella intera (batch), con log dettagliato
    python cli.py --input docs/Normative/ --output-dir out/ --verbose

Vedi README.md nella stessa cartella per la documentazione completa.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

from .clean import clean_pages
from .extract import PdfExtractionError, extract_pdf
from .markdown_convert import build_markdown
from .structure import markdown_to_json

logger = logging.getLogger("pdf_to_json.cli")


def _configure_logging(verbose):
    # Il logging di root resta a INFO anche con --verbose: alzare il root
    # a DEBUG farebbe traboccare i log DEBUG interni di pdfminer/pdfplumber
    # (usati da extract.py), inutili per l'utente finale di questo tool.
    # --verbose alza solo il livello dei logger propri di pdf_to_json.
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
    if verbose:
        logging.getLogger("pdf_to_json").setLevel(logging.DEBUG)


def process_pdf(pdf_path, output_dir, schema="generic", standard_code=None,
                 keep_markdown=True, verbose=False, allow_ocr=True):
    """
    Esegue la pipeline completa su un singolo PDF.

    Ritorna un dict {"markdown_path": Path|None, "json_path": Path, "warnings": [str, ...]}.
    Solleva `PdfExtractionError` se il PDF non produce testo utilizzabile
    (nessun file viene scritto in questo caso, per evitare JSON vuoti fuorvianti).
    """
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=== Elaborazione: %s ===", pdf_path.name)

    extraction = extract_pdf(pdf_path, verbose=verbose, allow_ocr=allow_ocr)
    cleaned_pages = clean_pages(extraction["pages"])
    markdown_text = build_markdown(cleaned_pages)

    base_name = pdf_path.stem
    markdown_path = None
    if keep_markdown:
        markdown_path = output_dir / f"{base_name}.md"
        markdown_path.write_text(markdown_text, encoding="utf-8", newline="\n")
        logger.info("Markdown intermedio salvato: %s (revisionare prima di fidarsi del JSON)", markdown_path)

    structured = markdown_to_json(
        markdown_text,
        schema=schema,
        standard_code=standard_code,
        document_title=base_name,
    )

    json_path = output_dir / f"{base_name}.json"
    json_path.write_text(
        json.dumps(structured, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    logger.info("JSON strutturato salvato: %s", json_path)

    warnings = []
    if schema == "norm-clause" and not standard_code:
        warnings.append(
            "Schema 'norm-clause' usato senza --standard-code: il campo 'standard_code' e' None nel JSON."
        )
    if extraction.get("ocr_used"):
        warnings.append("Una o piu' pagine sono state lette con OCR locale (tesseract): rivedere il .md con attenzione.")
    low_quality_pages = extraction.get("low_quality_pages") or []
    if low_quality_pages:
        pages_list = ", ".join(str(n) for n in low_quality_pages)
        warnings.append(
            f"Pagine con testo di bassa qualita' (probabile font non standard, non scansione): {pages_list}. "
            "Cercare 'ATTENZIONE' nel markdown intermedio e revisionare quelle sezioni prima di fidarsi del JSON."
        )
    reordering_fixed_pages = extraction.get("reordering_fixed_pages") or []
    if reordering_fixed_pages:
        pages_list = ", ".join(str(n) for n in reordering_fixed_pages)
        warnings.append(
            f"Pagine con caratteri riordinati da pdfplumber (tabelle multi-colonna) corrette automaticamente "
            f"con pymupdf: {pages_list}. Cercare 'Nota tecnica' nel markdown intermedio e verificare il risultato."
        )

    return {"markdown_path": markdown_path, "json_path": json_path, "warnings": warnings}


def _collect_pdf_inputs(input_path):
    input_path = Path(input_path)
    if input_path.is_dir():
        # Su Windows il filesystem e' case-insensitive: "*.pdf" e "*.PDF"
        # matcherebbero due volte lo stesso file. Deduplica per path
        # risolto assoluto cosi' da funzionare in modo identico anche
        # su filesystem case-sensitive (Linux/macOS).
        candidates = list(input_path.glob("*.pdf")) + list(input_path.glob("*.PDF"))
        unique_by_resolved = {path.resolve(): path for path in candidates}
        return sorted(unique_by_resolved.values(), key=lambda path: path.name.lower())
    return [input_path]


def build_arg_parser():
    parser = argparse.ArgumentParser(
        prog="pdf_to_json",
        description="Converte PDF in Markdown revisionabile e JSON strutturato (ProgettoISO).",
    )
    parser.add_argument(
        "--input", required=True,
        help="File PDF singolo oppure cartella contenente piu' PDF (elaborazione batch, non ricorsiva).",
    )
    parser.add_argument(
        "--output-dir", required=True,
        help="Cartella di output per i file .md e .json generati (creata se non esiste).",
    )
    parser.add_argument(
        "--schema", choices=["generic", "norm-clause"], default="generic",
        help="Schema del JSON di output: 'generic' (albero sezioni, default) o 'norm-clause' "
             "(lista piatta compatibile con import-norms-from-markdown.js).",
    )
    parser.add_argument(
        "--standard-code", default=None,
        help="Codice standard (es. ISO_9001_2015) da inserire in ogni record, usato solo con --schema norm-clause.",
    )
    parser.add_argument(
        "--keep-markdown", dest="keep_markdown", action="store_true", default=True,
        help="Salva il file .md intermedio (default: attivo).",
    )
    parser.add_argument(
        "--no-keep-markdown", dest="keep_markdown", action="store_false",
        help="Non salvare il file .md intermedio (sconsigliato: impedisce la revisione umana pre-JSON).",
    )
    parser.add_argument(
        "--ocr", dest="allow_ocr", action="store_true", default=True,
        help="Tenta l'OCR locale (tesseract) sulle pagine senza testo estraibile, se il binario e' disponibile (default: attivo).",
    )
    parser.add_argument(
        "--no-ocr", dest="allow_ocr", action="store_false",
        help="Disabilita il tentativo di OCR anche se tesseract e' disponibile.",
    )
    parser.add_argument(
        "--verbose", action="store_true", default=False,
        help="Log dettagliato per pagina (motore usato, caratteri estratti, tabelle, indizi heading).",
    )
    return parser


def main(argv=None):
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    _configure_logging(args.verbose)

    pdf_inputs = _collect_pdf_inputs(args.input)
    if not pdf_inputs:
        logger.error("Nessun file PDF trovato in: %s", args.input)
        return 1

    exit_code = 0
    for pdf_path in pdf_inputs:
        try:
            result = process_pdf(
                pdf_path,
                args.output_dir,
                schema=args.schema,
                standard_code=args.standard_code,
                keep_markdown=args.keep_markdown,
                verbose=args.verbose,
                allow_ocr=args.allow_ocr,
            )
            for warning in result["warnings"]:
                logger.warning(warning)
        except PdfExtractionError as exc:
            logger.error("FALLITO '%s': %s", pdf_path, exc)
            exit_code = 1
        except Exception as exc:  # difensivo: un PDF malformato non deve bloccare l'intero batch
            logger.error("ERRORE INATTESO su '%s': %s", pdf_path, exc)
            exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
