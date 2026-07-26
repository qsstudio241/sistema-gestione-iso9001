#!/usr/bin/env python3
"""
Test unittest per la pipeline pdf_to_json (ProgettoISO).

Eseguire con:
    & "C:\\Users\\AI.Project\\AppData\\Local\\Python\\bin\\python.exe" -m unittest discover -s backend/scripts/pdf_to_json/tests -v

I test su clean/markdown/structure usano fixture testuali (nessuna
dipendenza da PDF reali). I test end-to-end (classe `EndToEndCliTests`)
generano PDF sintetici al volo con reportlab in una cartella temporanea
(nessun binario viene committato nel repository).
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

# Rende importabile il pacchetto `pdf_to_json` indipendentemente da come
# viene lanciato il discovery di unittest (che non lo tratta come parte
# di un package se la cartella tests/ non e' sul sys.path di partenza).
_BACKEND_SCRIPTS_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SCRIPTS_DIR))

from pdf_to_json import cli, clean, extract, markdown_convert, structure  # noqa: E402
from pdf_to_json.tests import pdf_fixtures  # noqa: E402


class CleanTests(unittest.TestCase):
    def test_fix_mojibake_replaces_common_sequences(self):
        broken = "La qualitÃ  Ã¨ importante â€“ nota â€™ finale"
        fixed = clean.fix_mojibake(broken)
        self.assertIn("qualità", fixed)
        self.assertIn("è importante", fixed)
        self.assertIn("-", fixed)
        self.assertNotIn("Ã", fixed)

    def test_dehyphenate_joins_split_word(self):
        text = "Il processo di svilup-\npo del prodotto e' definito."
        result = clean.dehyphenate(text)
        self.assertIn("sviluppo", result)
        self.assertNotIn("svilup-", result)

    def test_dehyphenate_preserves_uppercase_acronym(self):
        text = "Riferimento ISO-\n9001 non va unito"
        result = clean.dehyphenate(text)
        # I lati maiuscoli non vengono uniti: euristica conservativa.
        self.assertIn("ISO-\n9001", result)

    def test_strip_edge_page_numbers_removes_only_near_edges(self):
        text = "Titolo documento\n3\nCorpo del testo con numero 3 non a bordo pagina\n3"
        result = clean.strip_edge_page_numbers(text, edge=1)
        lines = result.split("\n")
        self.assertNotIn("3", lines[:1] + lines[-1:])
        self.assertIn("Corpo del testo con numero 3 non a bordo pagina", result)

    def test_normalize_whitespace_collapses_blank_lines_and_spaces(self):
        text = "Riga1   con   spazi\n\n\n\nRiga2\t con tab\n"
        result = clean.normalize_whitespace(text)
        self.assertNotIn("\n\n\n", result)
        self.assertIn("Riga1 con spazi", result)
        self.assertIn("Riga2 con tab", result)

    def test_detect_repeated_lines_finds_header_footer(self):
        pages = [
            "Tecnove Spa\nTitolo pagina 1\nCorpo testo pagina 1\n1",
            "Tecnove Spa\nTitolo pagina 2\nCorpo testo pagina 2\n2",
            "Tecnove Spa\nTitolo pagina 3\nCorpo testo pagina 3\n3",
        ]
        repeated = clean.detect_repeated_lines(pages, min_pages=3)
        self.assertIn("Tecnove Spa", repeated)
        self.assertNotIn("Corpo testo pagina 1", repeated)

    def test_clean_pages_removes_repeated_header(self):
        pages = [
            {"page_number": 1, "text": "Azienda XYZ\nContenuto unico pagina 1", "tables": [], "heading_hints": set(), "engine": "test"},
            {"page_number": 2, "text": "Azienda XYZ\nContenuto unico pagina 2", "tables": [], "heading_hints": set(), "engine": "test"},
            {"page_number": 3, "text": "Azienda XYZ\nContenuto unico pagina 3", "tables": [], "heading_hints": set(), "engine": "test"},
        ]
        cleaned = clean.clean_pages(pages)
        for page in cleaned:
            self.assertNotIn("Azienda XYZ", page["text"])
        self.assertIn("Contenuto unico pagina 1", cleaned[0]["text"])


class MarkdownConvertTests(unittest.TestCase):
    def test_detect_clause_heading_numeric_pattern(self):
        result = markdown_convert.detect_clause_heading("4.1 Comprensione dell'organizzazione")
        self.assertIsNotNone(result)
        level, clause_ref, title = result
        self.assertEqual(level, 2)
        self.assertEqual(clause_ref, "4.1")
        self.assertEqual(title, "Comprensione dell'organizzazione")

    def test_detect_clause_heading_top_level(self):
        result = markdown_convert.detect_clause_heading("4 Contesto dell'organizzazione")
        self.assertIsNotNone(result)
        level, clause_ref, _ = result
        self.assertEqual(level, 1)
        self.assertEqual(clause_ref, "4")

    def test_detect_clause_heading_rejects_plain_sentence(self):
        self.assertIsNone(markdown_convert.detect_clause_heading("Questa e' una frase qualsiasi senza numero."))

    def test_is_all_caps_heading(self):
        self.assertTrue(markdown_convert.is_all_caps_heading("POLITICA PER LA QUALITA"))
        self.assertFalse(markdown_convert.is_all_caps_heading("Questo non e' maiuscolo"))
        self.assertFalse(markdown_convert.is_all_caps_heading("FRASE URLATA CHE TERMINA COL PUNTO."))

    def test_table_to_markdown_basic(self):
        rows = [["Colonna A", "Colonna B"], ["1", "2"]]
        md = markdown_convert.table_to_markdown(rows)
        self.assertIn("| Colonna A | Colonna B |", md)
        self.assertIn("| --- | --- |", md)
        self.assertIn("| 1 | 2 |", md)

    def test_table_to_markdown_escapes_pipe_and_handles_ragged_rows(self):
        rows = [["A", "B"], ["val|ore", "solo una cella"]]
        md = markdown_convert.table_to_markdown(rows)
        self.assertIn("val\\|ore", md)

    def test_table_to_markdown_empty_returns_empty_string(self):
        self.assertEqual(markdown_convert.table_to_markdown([]), "")

    def test_convert_page_text_to_markdown_headings_and_paragraphs(self):
        text = (
            "4.1 Comprensione dell'organizzazione\n"
            "Questo e' un paragrafo di corpo\n"
            "che continua su due righe.\n"
            "\n"
            "4.2 Comprensione delle parti interessate\n"
            "Altro paragrafo."
        )
        md = markdown_convert.convert_page_text_to_markdown(text)
        self.assertIn("## 4.1 Comprensione dell'organizzazione", md)
        self.assertIn("## 4.2 Comprensione delle parti interessate", md)
        self.assertIn("Questo e' un paragrafo di corpo che continua su due righe.", md)

    def test_convert_page_text_to_markdown_all_caps_heading(self):
        text = "POLITICA PER LA QUALITA\nTesto descrittivo della politica."
        md = markdown_convert.convert_page_text_to_markdown(text)
        self.assertIn("## POLITICA PER LA QUALITA", md)

    def test_convert_page_text_to_markdown_list_items_kept_separate(self):
        text = "Elenco requisiti:\n- primo punto\n- secondo punto"
        md = markdown_convert.convert_page_text_to_markdown(text)
        self.assertIn("- primo punto", md)
        self.assertIn("- secondo punto", md)

    def test_build_markdown_flags_low_quality_page(self):
        pages = [
            {
                "page_number": 4,
                "text": "(cid:52)(cid:86)(cid:83)",
                "tables": [],
                "heading_hints": set(),
                "engine": "pdfplumber",
                "text_quality_ok": False,
            }
        ]
        md = markdown_convert.build_markdown(pages)
        self.assertIn("ATTENZIONE", md)
        self.assertIn("Pagina 4", md)

    def test_build_markdown_includes_tables_and_page_markers(self):
        pages = [
            {
                "page_number": 1,
                "text": "4 Titolo Sezione\nCorpo testo.",
                "tables": [[["A", "B"], ["1", "2"]]],
                "heading_hints": set(),
                "engine": "test",
            }
        ]
        md = markdown_convert.build_markdown(pages)
        self.assertIn("<!-- Pagina 1", md)
        self.assertIn("# 4 Titolo Sezione", md)
        self.assertIn("| A | B |", md)


class StructureTests(unittest.TestCase):
    SAMPLE_MARKDOWN = (
        "# 4 Contesto dell'organizzazione\n\n"
        "## 4.1 Comprensione dell'organizzazione\n\n"
        "Testo del punto 4.1 sul contesto.\n\n"
        "## 4.2 Parti interessate\n\n"
        "Testo del punto 4.2 sulle parti interessate.\n\n"
        "# POLITICA GENERALE\n\n"
        "Testo introduttivo senza numero di clausola.\n"
    )

    def test_parse_markdown_to_tree_builds_nested_structure(self):
        tree = structure.parse_markdown_to_tree(self.SAMPLE_MARKDOWN)
        self.assertEqual(len(tree["children"]), 2)

        node_4 = tree["children"][0]
        self.assertEqual(node_4["path"], "4")
        self.assertEqual(node_4["title"], "Contesto dell'organizzazione")
        self.assertEqual(len(node_4["children"]), 2)

        node_41 = node_4["children"][0]
        self.assertEqual(node_41["path"], "4.1")
        self.assertIn("Testo del punto 4.1", node_41["content"])

        node_politica = tree["children"][1]
        self.assertIsNone(node_politica["path"])
        self.assertEqual(node_politica["title"], "POLITICA GENERALE")

    def test_tree_to_norm_clause_json_flattens_only_numbered_sections(self):
        tree = structure.parse_markdown_to_tree(self.SAMPLE_MARKDOWN)
        flat = structure.tree_to_norm_clause_json(tree, standard_code="ISO_9001_2015")

        refs = [row["clause_ref"] for row in flat]
        self.assertIn("4", refs)
        self.assertIn("4.1", refs)
        self.assertIn("4.2", refs)
        self.assertTrue(all(row["standard_code"] == "ISO_9001_2015" for row in flat))

        row_41 = next(row for row in flat if row["clause_ref"] == "4.1")
        self.assertEqual(row_41["clause_title"], "Comprensione dell'organizzazione")
        self.assertIn("Testo del punto 4.1", row_41["requirement_text"])

    def test_markdown_to_json_generic_schema(self):
        result = structure.markdown_to_json(self.SAMPLE_MARKDOWN, schema="generic")
        self.assertEqual(result["level"], 0)
        self.assertEqual(len(result["children"]), 2)

    def test_markdown_to_json_invalid_schema_raises(self):
        with self.assertRaises(ValueError):
            structure.markdown_to_json(self.SAMPLE_MARKDOWN, schema="does-not-exist")


class ExtractTextQualityTests(unittest.TestCase):
    """
    Copre un caso reale scoperto testando il tool su PDF veri del repository
    (`docs/Normative/UNI EN ISO 9712 (2012).pdf`): alcuni PDF hanno font con
    codifica/ToUnicode rotta o volutamente offuscata (protezione anti-copia)
    e producono testo "presente" ma illeggibile (placeholder "(cid:NNN)" o
    caratteri di controllo), che va trattato come non utilizzabile.
    """

    def test_normal_text_has_high_quality(self):
        text = "L'organizzazione deve determinare i fattori esterni e interni rilevanti."
        self.assertGreaterEqual(extract._text_quality_ratio(text), 0.85)
        self.assertTrue(extract._text_has_content(text))

    def test_cid_placeholder_garbage_is_rejected(self):
        text = "(cid:52)(cid:86)(cid:83)(cid:90)(cid:73)(cid:4)(cid:82)(cid:69)(cid:81)(cid:69)(cid:74)(cid:78)(cid:73)"
        self.assertLess(extract._text_quality_ratio(text), 0.85)
        self.assertFalse(extract._text_has_content(text))

    def test_control_character_soup_is_rejected(self):
        text = "\x04\x1d\x1b\x15\x16\x1e\x16\x14\x15\x16\x04\x0c\x12\x12\x12\x12\x12\x12\x12\x12\x12\x12"
        self.assertLess(extract._text_quality_ratio(text), 0.85)
        self.assertFalse(extract._text_has_content(text))

    def test_mostly_clean_text_with_few_control_chars_still_accepted(self):
        text = "Testo normale di una pagina PDF ben formata, senza problemi di codifica del font.\x0b"
        self.assertTrue(extract._text_has_content(text))


class ExtractDefensiveTests(unittest.TestCase):
    def test_extract_pdf_raises_clear_error_for_scanned_document(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            pdf_path = Path(tmp_dir) / "scansione.pdf"
            pdf_fixtures.build_scanned_like_pdf(pdf_path)

            with self.assertRaises(extract.PdfExtractionError) as ctx:
                extract.extract_pdf(pdf_path, allow_ocr=False)

            message = str(ctx.exception)
            self.assertIn("Nessun testo utilizzabile", message)
            self.assertIn("OCR disabilitato", message)

    def test_extract_pdf_missing_file_raises(self):
        with self.assertRaises(extract.PdfExtractionError):
            extract.extract_pdf("questo/file/non/esiste.pdf")

    def test_is_ocr_available_does_not_raise(self):
        # Non asseriamo un valore fisso: dipende dal binario tesseract
        # eventualmente installato sulla macchina che esegue i test.
        self.assertIn(extract.is_ocr_available(), (True, False))


class ExtractReorderedTextTests(unittest.TestCase):
    """
    Copre il caso reale scoperto su ISO 14341 (luglio 2026): pdfplumber apre
    correttamente il PDF e produce testo che supera il controllo cid/qualita'
    di base, ma su alcune pagine con tabelle multi-colonna i caratteri
    risultano riordinati/scambiati dentro le parole (es. "Table" -> "elbaT").
    pymupdf sulla stessa pagina produce testo corretto: `extract_pdf` deve
    rilevare l'anomalia (vedi `quality.py`) e sostituire automaticamente il
    testo con quello di pymupdf, senza bisogno di flag aggiuntivi.
    """

    _GARBLED_TEXT = "A3 elbaT wohs eht lacimehc noitisopmoc stnemeriuqer rof eht gnidlew eriw dna edortcele"
    _CLEAN_TEXT = "Table 3A shows the chemical composition requirements for the welding wire and electrode"

    def test_extract_pdf_swaps_to_pymupdf_when_pdfplumber_text_reordered(self):
        pdfplumber_pages = [
            {
                "page_number": 1,
                "text": self._GARBLED_TEXT,
                "tables": [],
                "heading_hints": set(),
                "engine": "pdfplumber",
            }
        ]
        pymupdf_pages = [
            {
                "page_number": 1,
                "text": self._CLEAN_TEXT,
                "tables": [],
                "heading_hints": set(),
                "engine": "pymupdf",
            }
        ]

        with mock.patch.object(extract, "_extract_with_pdfplumber", return_value=pdfplumber_pages), \
             mock.patch.object(extract, "_extract_with_pymupdf", return_value=pymupdf_pages), \
             mock.patch.object(extract, "is_ocr_available", return_value=False):
            result = extract.extract_pdf("documento_finto.pdf", allow_ocr=False)

        page = result["pages"][0]
        self.assertEqual(page["text"], self._CLEAN_TEXT)
        self.assertEqual(page["engine"], "pymupdf")
        self.assertTrue(page.get("readability_fixed"))
        self.assertIn(1, result.get("reordering_fixed_pages", []))

    def test_extract_pdf_leaves_normal_text_untouched(self):
        pdfplumber_pages = [
            {
                "page_number": 1,
                "text": self._CLEAN_TEXT,
                "tables": [],
                "heading_hints": set(),
                "engine": "pdfplumber",
            }
        ]

        with mock.patch.object(extract, "_extract_with_pdfplumber", return_value=pdfplumber_pages), \
             mock.patch.object(extract, "_extract_with_pymupdf") as mocked_pymupdf, \
             mock.patch.object(extract, "is_ocr_available", return_value=False):
            result = extract.extract_pdf("documento_finto.pdf", allow_ocr=False)

        page = result["pages"][0]
        self.assertEqual(page["text"], self._CLEAN_TEXT)
        self.assertEqual(page["engine"], "pdfplumber")
        self.assertFalse(page.get("readability_fixed", False))
        self.assertEqual(result.get("reordering_fixed_pages"), [])
        mocked_pymupdf.assert_not_called()

    def test_build_markdown_shows_technical_note_for_readability_fixed_page(self):
        pages = [
            {
                "page_number": 1,
                "text": self._CLEAN_TEXT,
                "tables": [],
                "heading_hints": set(),
                "engine": "pymupdf",
                "readability_fixed": True,
            }
        ]
        md = markdown_convert.build_markdown(pages)
        self.assertIn("**Nota tecnica:**", md)
        self.assertIn("ordinamento caratteri", md)


class EndToEndCliTests(unittest.TestCase):
    """
    Test di integrazione reale: genera un PDF sintetico con reportlab,
    lo elabora con la pipeline completa (extract -> clean -> markdown ->
    json) tramite la CLI, e verifica gli output su disco.
    """

    def test_cli_end_to_end_norm_clause_schema(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pdf_path = tmp_path / "Norma di Test.pdf"
            output_dir = tmp_path / "out"
            pdf_fixtures.build_sample_norm_pdf(pdf_path)

            exit_code = cli.main([
                "--input", str(pdf_path),
                "--output-dir", str(output_dir),
                "--schema", "norm-clause",
                "--standard-code", "TEST_STANDARD",
            ])
            self.assertEqual(exit_code, 0)

            md_path = output_dir / "Norma di Test.md"
            json_path = output_dir / "Norma di Test.json"
            self.assertTrue(md_path.exists(), "Il markdown intermedio deve essere sempre salvato")
            self.assertTrue(json_path.exists())

            markdown_text = md_path.read_text(encoding="utf-8")
            self.assertIn("4.1", markdown_text)
            self.assertIn("Colonna A", markdown_text)

            data = json.loads(json_path.read_text(encoding="utf-8"))
            refs = [row["clause_ref"] for row in data]
            self.assertIn("4.1", refs)
            self.assertIn("4.2", refs)
            row_41 = next(row for row in data if row["clause_ref"] == "4.1")
            self.assertEqual(row_41["standard_code"], "TEST_STANDARD")
            self.assertIn("organizzazione", row_41["requirement_text"])

    def test_cli_end_to_end_generic_schema_batch_folder(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            input_dir = tmp_path / "input_pdfs"
            input_dir.mkdir()
            output_dir = tmp_path / "out"

            pdf_fixtures.build_sample_norm_pdf(input_dir / "Documento1.pdf")
            pdf_fixtures.build_sample_norm_pdf(input_dir / "Documento2.pdf")

            exit_code = cli.main(["--input", str(input_dir), "--output-dir", str(output_dir)])
            self.assertEqual(exit_code, 0)

            self.assertTrue((output_dir / "Documento1.json").exists())
            self.assertTrue((output_dir / "Documento2.json").exists())

            data = json.loads((output_dir / "Documento1.json").read_text(encoding="utf-8"))
            self.assertEqual(data["level"], 0)
            self.assertGreaterEqual(len(data["children"]), 1)

    def test_cli_reports_failure_for_scanned_pdf_without_crashing(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pdf_path = tmp_path / "scansione.pdf"
            output_dir = tmp_path / "out"
            pdf_fixtures.build_scanned_like_pdf(pdf_path)

            exit_code = cli.main([
                "--input", str(pdf_path),
                "--output-dir", str(output_dir),
                "--no-ocr",
            ])
            self.assertEqual(exit_code, 1)
            self.assertFalse((output_dir / "scansione.json").exists())


if __name__ == "__main__":
    unittest.main()
