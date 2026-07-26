#!/usr/bin/env python3
"""
Rilevamento euristico di testo "corrotto" o invertito - pdf_to_json toolkit.

Contesto (luglio 2026, ISO 14341): pdfplumber puo' aprire correttamente un
PDF e restituire testo che supera il controllo di qualita' di `extract.py`
(niente placeholder `(cid:NNN)`, niente caratteri di controllo: quello e' un
problema DIVERSO, gia' gestito), ma che e' comunque **illeggibile perche'
capovolto/invertito carattere per carattere** su alcune pagine/tabelle
multi-colonna con testo tecnico. Esempio reale (Tabella 3A/3B, pag. 11-13):

    "A3 elbaT" invece di "Table 3A"
    "1iS3" invece di "3Si1"
    "41,0 ot 60,0" invece di "0,06 to 0,14"

Questo modulo calcola un punteggio di "leggibilita'" (0.0 = quasi certamente
invertito/spazzatura, 1.0 = testo naturale plausibile) usando SOLO euristiche
locali, nessuna chiamata cloud/AI:

1. **Dizionario di parole comuni** (italiano + inglese + termini tecnici
   normativi, vedi `_COMMON_WORDS`): confronta quante parole del testo sono
   nel dizionario "in avanti" rispetto a quante lo sono solo "al contrario"
   (parola scritta a rovescio). Il testo invertito e' pieno di parole come
   "ot" (= "to" al contrario), "yb" (= "by"), "fo" (= "of"), "elbaT"
   (= "Table"): nessuna di queste e' una parola vera, ma la loro versione
   invertita si'.
2. **Frequenza bigram** (coppie di lettere consecutive all'interno di ogni
   parola): l'inglese/italiano naturale usa in modo sproporzionato un
   insieme relativamente piccolo di bigrammi comuni ("th", "he", "in", "an",
   "re", "on", ecc. / "on", "er", "an", "di", "la", ecc.). Il testo invertito
   capovolge questa distribuzione (bigrammi comuni diventano rari e
   viceversa), quindi la copertura di bigrammi "noti" crolla.

Le due euristiche sono combinate in `text_readability_score`. Nessuna
richiede download di risorse esterne: le liste sono incorporate qui sotto.
"""

import re

# --- Dizionario di parole comuni (italiano + inglese + termini tecnici) ---
#
# Include deliberatamente anche le parole funzionali molto brevi (to, by, of,
# is, and, che, per, con, ...): sono il segnale piu' forte, perche' la loro
# forma invertita (ot, yb, fo, si, dna, ehc, rep, noc, ...) non e' quasi mai
# una parola valida per coincidenza, a differenza di parole piu' lunghe dove
# una collisione accidentale e' meno probabile ma non impossibile.
_COMMON_WORDS_EN = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can",
    "had", "her", "was", "one", "our", "out", "day", "get", "has", "him",
    "his", "how", "man", "new", "now", "old", "see", "two", "way", "who",
    "boy", "did", "its", "let", "put", "say", "she", "too", "use", "with",
    "this", "that", "have", "from", "they", "will", "would", "there",
    "their", "what", "about", "which", "when", "make", "like", "time",
    "just", "know", "take", "into", "year", "your", "good", "some",
    "could", "them", "than", "then", "look", "only", "come", "over",
    "also", "back", "after", "work", "first", "well", "even", "want",
    "because", "these", "give", "most", "shall", "should", "must",
    "used", "using", "based", "where", "each", "such", "under", "other",
    "between", "before", "during", "following", "given", "table",
    "chemical", "composition", "classification", "symbol", "welding",
    "electrode", "wire", "strength", "energy", "impact", "yield",
    "tensile", "requirement", "requirements", "designation", "material",
    "annex", "clause", "document", "standard", "committee", "technical",
    "international", "organization", "process", "quality", "copyright",
    "reserved", "published", "edition", "reference", "informative",
    "normative", "scope", "terms", "definitions", "test", "testing",
    "value", "values", "range", "shielding", "gas", "deposit", "average",
    "minimum", "maximum", "condition", "specified", "applicable",
    "temperature", "properties", "mechanical", "product", "products",
    "system", "systems", "management", "audit", "risk", "safety",
    "to", "by", "of", "is", "in", "on", "at", "or", "as", "an", "be",
    "it", "if", "no", "so", "up", "we", "he",
}

_COMMON_WORDS_IT = {
    "che", "per", "con", "del", "della", "dello", "delle", "dei", "degli",
    "una", "uno", "gli", "sono", "essere", "questo", "questa", "questi",
    "queste", "come", "anche", "loro", "suo", "sua", "suoi", "sue", "piu",
    "meno", "molto", "poco", "tutto", "tutti", "tutte", "quale", "quali",
    "cui", "sul", "sulla", "sullo", "sulle", "sugli", "nel", "nella",
    "nello", "nelle", "negli", "dal", "dalla", "dallo", "dalle", "dagli",
    "al", "allo", "alla", "alle", "agli", "requisiti", "requisito",
    "documento", "processo", "processi", "organizzazione", "qualita",
    "norma", "norme", "sistema", "sistemi", "gestione", "tabella",
    "classificazione", "simbolo", "saldatura", "filo", "elettrodo",
    "resistenza", "energia", "materiale", "materiali", "condizione",
    "condizioni", "prodotto", "prodotti", "riferimento", "termini",
    "definizioni", "scopo", "campo", "applicazione", "clausola",
    "internazionale", "tecnico", "comitato", "sicurezza", "rischio",
    "audit", "verifica", "controllo", "valutazione", "azione", "azioni",
    "non", "sono", "deve", "devono", "essere", "puo", "possono",
    "e", "di", "la", "il", "un", "in", "su", "se", "ne",
}

_COMMON_WORDS = _COMMON_WORDS_EN | _COMMON_WORDS_IT

# Lunghezza minima di una "parola" perche' venga considerata nel conteggio:
# sotto questa soglia il segnale e' troppo rumoroso (1-2 lettere formano
# troppe combinazioni valide per caso in entrambe le direzioni).
_MIN_WORD_LEN_FOR_DICT = 2

# --- Bigrammi comuni (italiano + inglese) ---
#
# Elenco NON esaustivo dei bigrammi piu' frequenti nelle due lingue (fonti:
# statistiche linguistiche standard di dominio pubblico, incorporate qui
# come costante per evitare qualsiasi download esterno). Non serve che sia
# perfetto: basta che separi nettamente testo naturale da testo invertito.
_COMMON_BIGRAMS = {
    # inglese
    "th", "he", "in", "er", "an", "re", "on", "at", "en", "nd", "ti", "es",
    "or", "te", "of", "ed", "is", "it", "al", "ar", "st", "to", "nt", "ng",
    "se", "ha", "as", "ou", "io", "le", "ve", "co", "me", "de", "hi", "ri",
    "ro", "ic", "ne", "ea", "ra", "ce", "li", "ch", "ll", "be", "ma", "si",
    "om", "ur", "ca", "el", "ta", "la", "ns", "di", "fo", "ho", "pe", "ec",
    "pr", "no", "ct", "us", "ac", "il", "tr", "ly", "nc", "et", "ee", "oc",
    "sa", "ut", "id", "im", "gh", "os", "ug", "wi", "wa", "am", "ol", "ig",
    "iv", "ia", "ci", "op", "ss", "ap", "ei", "ag", "sh", "un",
    # italiano
    "on", "er", "an", "re", "en", "es", "ti", "in", "al", "la", "ta", "to",
    "di", "co", "ri", "ra", "ch", "no", "se", "ne", "io", "ci", "na", "sa",
    "si", "un", "le", "li", "te", "el", "ma", "ni", "tt", "po", "or", "so",
    "gi", "va", "tu", "ss", "oi", "ez", "zi", "nt", "ll", "ge", "pr", "ar",
    "ca", "ve", "de", "mo", "ce", "az", "ot", "ol", "et", "ne", "ni", "qu",
}

_MIN_LETTERS_FOR_BIGRAM_SIGNAL = 12

_WORD_RE = re.compile(r"[A-Za-zàèéìòùÀÈÉÌÒÙ]+")

# Pesi di combinazione dei due segnali (dizionario + bigrammi) quando
# entrambi sono disponibili. Il dizionario e' un segnale piu' forte e
# diretto (parole vere note), i bigrammi confermano su testo dove il
# dizionario da solo avrebbe pochi campioni.
_WEIGHT_DICTIONARY = 0.6
_WEIGHT_BIGRAM = 0.4

# Sotto questa soglia il testo e' considerato probabilmente
# corrotto/invertito (vedi `is_probably_corrupted`).
DEFAULT_CORRUPTION_THRESHOLD = 0.40


def _extract_words(text):
    return _WORD_RE.findall(text or "")


def _dictionary_score(words):
    """
    Confronta, fra le parole di lunghezza utile, quante sono nel dizionario
    "in avanti" rispetto a quante lo sono solo "al contrario".

    Ritorna (score, sample_size). `score` e' in [0.0, 1.0] (1.0 = tutte le
    corrispondenze sono in avanti, nessuna al contrario). Se non ci sono
    abbastanza parole con una corrispondenza (in un verso o nell'altro),
    ritorna (None, 0): segnale non disponibile, non "testo cattivo".
    """
    forward_hits = 0
    reversed_hits = 0
    for word in words:
        if len(word) < _MIN_WORD_LEN_FOR_DICT:
            continue
        lower = word.lower()
        is_forward = lower in _COMMON_WORDS
        is_reversed = not is_forward and lower[::-1] in _COMMON_WORDS
        if is_forward:
            forward_hits += 1
        elif is_reversed:
            reversed_hits += 1

    total = forward_hits + reversed_hits
    if total == 0:
        return None, 0
    return forward_hits / total, total


def _bigram_score(words):
    """
    Calcola la frazione di bigrammi (coppie di lettere consecutive dentro
    ogni singola parola, non a cavallo di spazi) presenti nell'insieme di
    bigrammi comuni italiani/inglesi.

    Ritorna (score, sample_size); (None, 0) se il testo ha troppe poche
    lettere per un campione affidabile.
    """
    total_bigrams = 0
    matched_bigrams = 0
    total_letters = 0
    for word in words:
        lower = word.lower()
        total_letters += len(lower)
        for i in range(len(lower) - 1):
            bigram = lower[i:i + 2]
            total_bigrams += 1
            if bigram in _COMMON_BIGRAMS:
                matched_bigrams += 1

    if total_letters < _MIN_LETTERS_FOR_BIGRAM_SIGNAL or total_bigrams == 0:
        return None, 0
    return matched_bigrams / total_bigrams, total_bigrams


def text_readability_score(text):
    """
    Ritorna un punteggio di leggibilita' in [0.0, 1.0] (piu' alto = testo
    plausibilmente in italiano/inglese corretto, non invertito/corrotto).

    Se il testo non contiene abbastanza materiale alfabetico per esprimere
    un giudizio (es. pagina quasi solo numerica, tabella di soli codici),
    ritorna `None`: il chiamante deve trattarlo come "nessun segnale",
    NON come "testo cattivo" (altrimenti si rischiano falsi positivi su
    pagine legittimamente povere di testo).
    """
    words = _extract_words(text)
    dict_score, dict_n = _dictionary_score(words)
    bigram_score, bigram_n = _bigram_score(words)

    if dict_score is None and bigram_score is None:
        return None

    if dict_score is None:
        return bigram_score
    if bigram_score is None:
        return dict_score

    return (dict_score * _WEIGHT_DICTIONARY) + (bigram_score * _WEIGHT_BIGRAM)


def is_probably_corrupted(text, threshold=DEFAULT_CORRUPTION_THRESHOLD):
    """
    Vero se `text_readability_score` e' disponibile ed e' sotto soglia.

    Se il punteggio non e' disponibile (testo troppo povero di lettere per
    giudicare), ritorna False: si presume corretto per non generare falsi
    allarmi su pagine legittimamente numeriche/tabellari.
    """
    score = text_readability_score(text)
    if score is None:
        return False
    return score < threshold
