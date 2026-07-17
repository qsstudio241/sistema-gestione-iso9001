#!/usr/bin/env python3
"""
Parsing Markdown -> JSON strutturato - pdf_to_json toolkit.

Due modalita' di output:
- **generic** (default): albero annidato di sezioni, una per ogni heading
  Markdown incontrato, con `title`, `level`, `path` (numero di clausola se
  rilevabile dal testo del titolo, altrimenti None), `content` (testo
  proprio della sezione, esclusi i figli) e `children` (sotto-sezioni).
- **flat / norm-clause**: lista piatta compatibile con lo schema gia' usato
  da `backend/scripts/import-norms-from-markdown.js`
  (`standard_code`, `clause_ref`, `clause_title`, `requirement_text`),
  ottenuta appiattendo l'albero e mantenendo solo le sezioni con un
  numero di clausola riconosciuto nel titolo.

Il parser e' generico: si basa solo sulla struttura Markdown (heading `#`
e numerazione tipo "4.1"), non contiene regex specifiche per un singolo
file/norma (a differenza di `import-norms-from-markdown.js`, che resta
lo script legacy da poter eventualmente sostituire in futuro).
"""

import re

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")

# Riconosce un numero di clausola in testa al titolo dell'heading, es.
# "4.1 Contesto dell'organizzazione" -> path "4.1".
_CLAUSE_IN_TITLE_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){0,5})\s+(.+)$")


def _new_node(title, level, path=None):
    return {
        "title": title,
        "level": level,
        "path": path,
        "content": "",
        "children": [],
    }


def parse_markdown_to_tree(markdown_text, document_title="Documento"):
    """
    Costruisce un albero di sezioni a partire dal testo Markdown.

    La radice ha sempre `level = 0` e raccoglie l'eventuale testo che
    precede il primo heading (preambolo/copertina). Righi HTML di commento
    (es. "<!-- Pagina 3 -->", usati come marcatori di pagina da
    `markdown_convert.py`) vengono ignorati ai fini della struttura.
    """
    root = _new_node(document_title, 0, None)
    stack = [root]
    content_buffer = []

    def current_node():
        return stack[-1]

    def flush_content():
        node = current_node()
        text = "\n".join(content_buffer).strip()
        if text:
            node["content"] = (node["content"] + "\n\n" + text).strip() if node["content"] else text
        content_buffer.clear()

    for raw_line in markdown_text.split("\n"):
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped.startswith("<!--") and stripped.endswith("-->"):
            continue

        heading_match = _HEADING_RE.match(stripped)
        if heading_match:
            flush_content()
            level = len(heading_match.group(1))
            title_text = heading_match.group(2).strip()

            clause_match = _CLAUSE_IN_TITLE_RE.match(title_text)
            path = clause_match.group(1) if clause_match else None
            display_title = clause_match.group(2).strip() if clause_match else title_text

            node = _new_node(display_title, level, path)

            while len(stack) > 1 and stack[-1]["level"] >= level:
                stack.pop()

            stack[-1]["children"].append(node)
            stack.append(node)
            continue

        content_buffer.append(line)

    flush_content()
    return root


def tree_to_generic_json(root):
    """
    Serializza l'albero in un dict JSON-friendly. Se la radice non ha
    contenuto proprio ne' titolo significativo puo' comunque essere
    serializzata cosi' com'e': il chiamante decide se includerla o
    esporre direttamente `children`.
    """
    return root


def _flatten(node, standard_code, results):
    if node.get("path"):
        results.append(
            {
                "standard_code": standard_code,
                "clause_ref": node["path"],
                "clause_title": node["title"],
                "requirement_text": node.get("content", ""),
            }
        )
    for child in node.get("children", []):
        _flatten(child, standard_code, results)


def tree_to_norm_clause_json(root, standard_code):
    """
    Appiattisce l'albero in una lista di record norm-clause (solo le
    sezioni con numero di clausola riconosciuto nel titolo), ordinata
    secondo l'ordine di comparsa nel documento (che rispecchia l'ordine
    delle pagine/heading originali).
    """
    results = []
    _flatten(root, standard_code, results)
    return results


def markdown_to_json(markdown_text, schema="generic", standard_code=None, document_title="Documento"):
    """
    Funzione di alto livello: Markdown -> struttura JSON-friendly (dict o
    lista, a seconda dello schema richiesto).

    schema: "generic" (albero) oppure "norm-clause" (lista piatta).
    """
    tree = parse_markdown_to_tree(markdown_text, document_title=document_title)

    if schema == "norm-clause":
        return tree_to_norm_clause_json(tree, standard_code)
    if schema == "generic":
        return tree_to_generic_json(tree)

    raise ValueError(f"Schema non supportato: '{schema}' (valori ammessi: 'generic', 'norm-clause')")
