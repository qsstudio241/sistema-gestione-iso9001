#!/usr/bin/env python3
"""
Test unittest per il modulo quality.py (pdf_to_json toolkit, ProgettoISO).

Eseguire con:
    & "C:\\Users\\AI.Project\\AppData\\Local\\Python\\bin\\python.exe" -m unittest discover -s backend/scripts/pdf_to_json/tests -v
"""

import sys
import unittest
from pathlib import Path

_BACKEND_SCRIPTS_DIR = Path(__file__).resolve().parents[2]
if str(_BACKEND_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SCRIPTS_DIR))

from pdf_to_json import quality  # noqa: E402


class TextReadabilityScoreTests(unittest.TestCase):
    def test_normal_italian_text_scores_high(self):
        text = (
            "L'organizzazione deve determinare i fattori esterni e interni "
            "rilevanti per le sue finalita' e per la gestione della qualita', "
            "in conformita' ai requisiti applicabili del sistema."
        )
        score = quality.text_readability_score(text)
        self.assertIsNotNone(score)
        self.assertGreaterEqual(score, 0.7)
        self.assertFalse(quality.is_probably_corrupted(text))

    def test_normal_english_technical_text_scores_high(self):
        text = (
            "Table 3A shows the chemical composition requirements for the "
            "welding wire and electrode, including the classification symbol "
            "and the minimum tensile strength values."
        )
        score = quality.text_readability_score(text)
        self.assertIsNotNone(score)
        self.assertGreaterEqual(score, 0.7)
        self.assertFalse(quality.is_probably_corrupted(text))

    def test_reversed_word_order_text_scores_low(self):
        # Stesso contenuto della normativa citata nel docstring di quality.py,
        # ma con i caratteri di ogni parola riordinati (invertiti): e' il
        # difetto reale osservato con pdfplumber su tabelle multi-colonna
        # (es. ISO 14341, tabelle 3A/3B).
        text = "A3 elbaT wohs eht lacimehc noitisopmoc stnemeriuqer rof eht gnidlew eriw dna edortcele"
        score = quality.text_readability_score(text)
        self.assertIsNotNone(score)
        self.assertLess(score, quality.DEFAULT_CORRUPTION_THRESHOLD)
        self.assertTrue(quality.is_probably_corrupted(text))

    def test_permuted_characters_inside_words_score_low(self):
        # Permutazione interna (non solo inversione semplice) di alcune
        # parole tecniche comuni: il segnale a bigrammi deve comunque
        # rilevare l'anomalia rispetto a testo naturale.
        text = "1iS3 41,0 ot 60,0 rebmun noitangised lairetam ecnereffer dradnats"
        score = quality.text_readability_score(text)
        self.assertIsNotNone(score)
        self.assertLess(score, quality.DEFAULT_CORRUPTION_THRESHOLD)
        self.assertTrue(quality.is_probably_corrupted(text))

    def test_sparse_numeric_table_returns_none_not_low_score(self):
        # Pagina legittimamente povera di testo alfabetico (solo codici/numeri):
        # deve restituire None (nessun segnale), non un punteggio basso, per
        # evitare falsi positivi che romperebbero pagine di tabelle numeriche.
        text = "3.1 3.2 3.3\n0,06 0,14 1,00\n12 34 56"
        score = quality.text_readability_score(text)
        self.assertIsNone(score)
        self.assertFalse(quality.is_probably_corrupted(text))

    def test_empty_text_returns_none(self):
        self.assertIsNone(quality.text_readability_score(""))
        self.assertIsNone(quality.text_readability_score(None))
        self.assertFalse(quality.is_probably_corrupted(""))


if __name__ == "__main__":
    unittest.main()
