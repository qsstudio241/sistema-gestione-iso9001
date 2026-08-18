#!/usr/bin/env python3
"""
Test L1 per l'estrazione figure (MR-0, pdf_to_json).

Eseguire con lo stesso runner del package:
    python3 -m unittest discover -s backend/scripts/pdf_to_json/tests -v

Nessuna rete, nessun PDF normativo reale: fixture ReportLab in-process.
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

_BACKEND_SCRIPTS_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SCRIPTS_DIR))

from pdf_to_json import cli, extract_figures  # noqa: E402
from pdf_to_json.tests import pdf_fixtures  # noqa: E402


def _bbox_ok(bbox):
    return (
        isinstance(bbox, list)
        and len(bbox) == 4
        and all(isinstance(v, (int, float)) for v in bbox)
        and bbox[2] > bbox[0]
        and bbox[3] > bbox[1]
    )


class ExtractFiguresTests(unittest.TestCase):
    def test_fixture_yields_raster_and_vector_with_real_bbox(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pdf_path = tmp_path / "simboli.pdf"
            output_dir = tmp_path / "out"
            pdf_fixtures.build_figures_sample_pdf(pdf_path)

            result = extract_figures.extract_and_save_figures(pdf_path, output_dir)
            figures = result["figures"]
            kinds = {item["kind"] for item in figures}
            self.assertIn("raster", kinds)
            self.assertIn("vector", kinds)

            rasters = [item for item in figures if item["kind"] == "raster"]
            vectors = [item for item in figures if item["kind"] == "vector"]
            self.assertGreaterEqual(len(rasters), 1)
            self.assertGreaterEqual(len(vectors), 1)

            for item in figures:
                self.assertIn("id", item)
                self.assertIn(item["kind"], ("raster", "vector"))
                self.assertTrue(_bbox_ok(item["bbox"]), item["bbox"])
                self.assertGreaterEqual(item["page"], 1)
                png_path = output_dir / item["path"]
                self.assertTrue(png_path.exists(), item["path"])
                self.assertGreater(png_path.stat().st_size, 0)
                self.assertTrue(item["path"].startswith("figures/"))
                self.assertTrue(item["path"].endswith(".png"))
                self.assertTrue(item["caption"] is None or isinstance(item["caption"], str))

            # La pagina 2 e' solo testo: nessuna figura con page == 2.
            self.assertFalse(any(item["page"] == 2 for item in figures))

            # Footer isolato non deve diventare una figura a se' (bbox schiacciata in basso).
            page_height = 841.89
            for item in figures:
                y0, y1 = item["bbox"][1], item["bbox"][3]
                self.assertLess(y0, page_height * 0.9)

            payload = json.loads(result["json_path"].read_text(encoding="utf-8"))
            self.assertEqual(len(payload["figures"]), len(figures))

    def test_text_only_pdf_writes_empty_figures_and_exit_0(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pdf_path = tmp_path / "solo_testo.pdf"
            output_dir = tmp_path / "out"
            pdf_fixtures.build_text_only_pdf(pdf_path)

            exit_code = cli.main([
                "--input", str(pdf_path),
                "--output-dir", str(output_dir),
                "--extract-figures",
                "--no-ocr",
            ])
            self.assertEqual(exit_code, 0)

            figures_json = output_dir / "solo_testo.figures.json"
            self.assertTrue(figures_json.exists())
            payload = json.loads(figures_json.read_text(encoding="utf-8"))
            self.assertEqual(payload["figures"], [])
            self.assertFalse((output_dir / "figures").exists() or any(
                (output_dir / "figures").glob("*.png") if (output_dir / "figures").exists() else []
            ))

    def test_cli_extract_figures_writes_sidecar_next_to_md_json(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pdf_path = tmp_path / "tavole.pdf"
            output_dir = tmp_path / "out"
            pdf_fixtures.build_figures_sample_pdf(pdf_path)

            exit_code = cli.main([
                "--input", str(pdf_path),
                "--output-dir", str(output_dir),
                "--extract-figures",
            ])
            self.assertEqual(exit_code, 0)
            self.assertTrue((output_dir / "tavole.md").exists())
            self.assertTrue((output_dir / "tavole.json").exists())
            self.assertTrue((output_dir / "tavole.figures.json").exists())

            payload = json.loads((output_dir / "tavole.figures.json").read_text(encoding="utf-8"))
            kinds = {item["kind"] for item in payload["figures"]}
            self.assertIn("raster", kinds)
            self.assertIn("vector", kinds)
            for item in payload["figures"]:
                png = output_dir / item["path"]
                self.assertTrue(png.exists())
                self.assertGreater(png.stat().st_size, 0)

    def test_cli_without_flag_does_not_write_figures(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            pdf_path = tmp_path / "tavole.pdf"
            output_dir = tmp_path / "out"
            pdf_fixtures.build_figures_sample_pdf(pdf_path)

            exit_code = cli.main([
                "--input", str(pdf_path),
                "--output-dir", str(output_dir),
            ])
            self.assertEqual(exit_code, 0)
            self.assertFalse((output_dir / "tavole.figures.json").exists())
            self.assertFalse((output_dir / "figures").exists())


if __name__ == "__main__":
    unittest.main()
