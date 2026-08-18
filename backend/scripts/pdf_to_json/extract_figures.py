#!/usr/bin/env python3
"""
Estrazione figure (raster + vettoriali) da PDF - pdf_to_json toolkit.

Estende il tool locale: ritaglia tavole con bounding box in punti pagina e
le scrive come PNG. Nessuna chiamata cloud/API esterna; nessun embedding.

Strategia (pymupdf / fitz, gia' in requirements):
1. Raster: `page.get_images()` + bbox reale di pagina (`get_image_rects`),
   non solo xref. Il PNG e' il ritaglio della regione di pagina.
2. Vettoriale: `page.get_drawings()` raggruppati per vicinanza; rumore
   (linee isolate, footer/header, cornici a pagina intera) scartato;
   ogni cluster viene rasterizzato in PNG.

Attivazione: flag CLI `--extract-figures` (default off).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger("pdf_to_json.extract_figures")

FIGURES_SUBDIR = "figures"
RENDER_SCALE = 2.0
CLUSTER_GAP = 16.0
RENDER_PAD = 4.0
HAIRLINE = 1.5
MIN_CLUSTER_AREA = 180.0
MIN_CLUSTER_SPAN = 16.0
MIN_RASTER_AREA = 64.0
PAGE_COVER_RATIO = 0.55
FOOTER_Y_RATIO = 0.92
HEADER_Y_RATIO = 0.05
CAPTION_MAX_GAP = 72.0
CAPTION_X_PAD = 24.0


class FigureExtractionError(Exception):
    """Sollevata quando l'estrazione figure non puo' partire (es. pymupdf assente)."""


def _try_import_fitz():
    try:
        import fitz

        return fitz
    except Exception as exc:  # pragma: no cover - dipende dall'ambiente
        logger.debug("PyMuPDF (fitz) non disponibile: %s", exc)
        return None


def _rect_tuple(rect):
    return (float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1))


def _area(bbox):
    x0, y0, x1, y1 = bbox
    return max(0.0, x1 - x0) * max(0.0, y1 - y0)


def _width(bbox):
    return max(0.0, bbox[2] - bbox[0])


def _height(bbox):
    return max(0.0, bbox[3] - bbox[1])


def _expand(bbox, pad):
    return (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad)


def _intersects(a, b):
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


def _union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def _is_degenerate(bbox, min_span=1.0):
    return _width(bbox) < min_span or _height(bbox) < min_span


def _in_footer_or_header(bbox, page_height):
    if page_height <= 0:
        return False
    y0, y1 = bbox[1], bbox[3]
    if y0 >= page_height * FOOTER_Y_RATIO:
        return True
    if y1 <= page_height * HEADER_Y_RATIO:
        return True
    return False


def _is_page_frame(bbox, page_bbox):
    page_area = _area(page_bbox)
    if page_area <= 0:
        return False
    return (_area(bbox) / page_area) >= PAGE_COVER_RATIO


def _is_noise_drawing(bbox, page_bbox):
    """
    Linee isolate da header/footer, cornici a tutta pagina, tratti
    infinitesimali: rumore tipico delle tavole ISO, non una figura.
    """
    if _is_page_frame(bbox, page_bbox):
        return True
    page_h = _height(page_bbox)
    page_w = _width(page_bbox)
    w, h = _width(bbox), _height(bbox)
    thin = min(w, h) < HAIRLINE
    longish = max(w, h) >= max(40.0, page_w * 0.25)
    if thin and longish and _in_footer_or_header(bbox, page_h):
        return True
    return False


def _cluster_rects(rects, gap):
    if not rects:
        return []
    n = len(rects)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    expanded = [_expand(r, gap / 2.0) for r in rects]
    for i in range(n):
        for j in range(i + 1, n):
            if _intersects(expanded[i], expanded[j]):
                union(i, j)

    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(rects[i])

    clustered = []
    for members in groups.values():
        acc = members[0]
        for extra in members[1:]:
            acc = _union(acc, extra)
        clustered.append(acc)
    return clustered


def _keep_vector_cluster(bbox, page_bbox):
    if _is_page_frame(bbox, page_bbox):
        return False
    if _is_degenerate(bbox, min_span=HAIRLINE):
        return False
    if _area(bbox) < MIN_CLUSTER_AREA:
        return False
    if max(_width(bbox), _height(bbox)) < MIN_CLUSTER_SPAN:
        return False
    if _in_footer_or_header(bbox, _height(page_bbox)) and min(_width(bbox), _height(bbox)) < 8:
        return False
    return True


def _caption_near(page, bbox):
    """Best-effort: rigo di testo sopra/sotto la figura, orizzontalmente allineato."""
    x0, y0, x1, y1 = bbox
    best = None
    best_dist = CAPTION_MAX_GAP + 1
    try:
        blocks = page.get_text("blocks") or []
    except Exception as exc:
        logger.debug("Impossibile leggere blocchi testo per caption: %s", exc)
        return None

    for block in blocks:
        bx0, by0, bx1, by1, text = block[:5]
        text = (text or "").strip()
        if not text or len(text) > 220:
            continue
        compact = " ".join(text.split())
        if compact.isdigit() and len(compact) <= 4:
            continue
        if bx1 < x0 - CAPTION_X_PAD or bx0 > x1 + CAPTION_X_PAD:
            continue
        if by1 <= y0 + 6:
            dist = y0 - by1
        elif by0 >= y1 - 6:
            dist = by0 - y1
        else:
            continue
        if 0 <= dist <= CAPTION_MAX_GAP and dist < best_dist:
            best_dist = dist
            best = compact
    return best


def _safe_clip(fitz, page, bbox):
    padded = _expand(bbox, RENDER_PAD)
    clip = fitz.Rect(*padded) & page.rect
    if clip.is_empty or clip.width < 1 or clip.height < 1:
        return None
    return clip


def _save_clip_png(fitz, page, bbox, dest_path):
    clip = _safe_clip(fitz, page, bbox)
    if clip is None:
        return False
    try:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(RENDER_SCALE, RENDER_SCALE), clip=clip, alpha=False)
    except Exception as exc:
        logger.warning("Rasterizzazione clip fallita (%s): %s", dest_path.name, exc)
        return False
    if pixmap is None or pixmap.width < 1 or pixmap.height < 1:
        return False
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    pixmap.save(str(dest_path))
    return dest_path.exists() and dest_path.stat().st_size > 0


def _round_bbox(bbox):
    return [round(v, 2) for v in bbox]


def extract_figures(pdf_path):
    """
    Trova figure raster e cluster vettoriali. Non scrive su disco.

    Ritorna una lista di dict con: page, bbox, kind ('raster'|'vector'),
    caption (str|None). L'`id` e il `path` li assegna `save_figures`.
    """
    fitz = _try_import_fitz()
    if fitz is None:
        raise FigureExtractionError(
            "PyMuPDF (fitz) non e' disponibile: serve per --extract-figures. "
            "Installare le dipendenze in backend/scripts/pdf_to_json/requirements.txt."
        )

    pdf_path = Path(pdf_path)
    doc = fitz.open(str(pdf_path))
    figures = []
    try:
        for page_index, page in enumerate(doc, start=1):
            page_bbox = _rect_tuple(page.rect)

            raster_bboxes = []
            try:
                images = page.get_images(full=True) or []
            except Exception as exc:
                logger.warning("get_images fallito pagina %s: %s", page_index, exc)
                images = []

            seen_rects = set()
            for image_info in images:
                xref = image_info[0]
                try:
                    rects = page.get_image_rects(xref) or []
                except Exception as exc:
                    logger.debug("get_image_rects xref %s pagina %s: %s", xref, page_index, exc)
                    rects = []
                if not rects:
                    continue
                for rect in rects:
                    bbox = _rect_tuple(rect)
                    key = tuple(_round_bbox(bbox))
                    if key in seen_rects:
                        continue
                    seen_rects.add(key)
                    if _area(bbox) < MIN_RASTER_AREA or _is_degenerate(bbox):
                        continue
                    raster_bboxes.append(bbox)
                    figures.append(
                        {
                            "page": page_index,
                            "bbox": bbox,
                            "kind": "raster",
                            "caption": _caption_near(page, bbox),
                        }
                    )

            try:
                drawings = page.get_drawings() or []
            except Exception as exc:
                logger.warning("get_drawings fallito pagina %s: %s", page_index, exc)
                drawings = []

            drawing_rects = []
            for drawing in drawings:
                rect = drawing.get("rect")
                if rect is None:
                    continue
                bbox = _rect_tuple(rect)
                if _is_noise_drawing(bbox, page_bbox):
                    continue
                drawing_rects.append(bbox)

            for cluster in _cluster_rects(drawing_rects, CLUSTER_GAP):
                if not _keep_vector_cluster(cluster, page_bbox):
                    continue
                overlaps_raster = any(
                    _intersects(cluster, rb) and (_area(cluster) > 0)
                    and (_area(_expand(rb, 2)) > 0)
                    and (
                        _area(
                            (
                                max(cluster[0], rb[0]),
                                max(cluster[1], rb[1]),
                                min(cluster[2], rb[2]),
                                min(cluster[3], rb[3]),
                            )
                        )
                        / max(_area(cluster), 1.0)
                        > 0.6
                    )
                    for rb in raster_bboxes
                )
                if overlaps_raster:
                    continue
                figures.append(
                    {
                        "page": page_index,
                        "bbox": cluster,
                        "kind": "vector",
                        "caption": _caption_near(page, cluster),
                    }
                )
    finally:
        doc.close()

    logger.info("Figure trovate: %s in %s", len(figures), pdf_path.name)
    return figures


def save_figures(pdf_path, output_dir, figures, base_name=None):
    """
    Rasterizza le figure su `output_dir/figures/` e ritorna la lista
    arricchita con id, bbox arrotondato, path relativo, caption.
    """
    fitz = _try_import_fitz()
    if fitz is None:
        raise FigureExtractionError(
            "PyMuPDF (fitz) non e' disponibile: serve per --extract-figures."
        )

    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    figures_dir = output_dir / FIGURES_SUBDIR
    stem = base_name or pdf_path.stem

    saved = []
    counters = {"raster": 0, "vector": 0}
    doc = fitz.open(str(pdf_path))
    try:
        for figure in figures:
            kind = figure["kind"]
            page_number = figure["page"]
            bbox = figure["bbox"]
            counters[kind] = counters.get(kind, 0) + 1
            seq = counters[kind]
            fig_id = f"fig-p{page_number}-{kind}-{seq}"
            filename = f"{stem}_p{page_number}_{kind}_{seq:03d}.png"
            dest = figures_dir / filename
            page = doc[page_number - 1]
            if not _save_clip_png(fitz, page, bbox, dest):
                logger.warning("PNG non scritto per %s, figura saltata", fig_id)
                continue
            relative = f"{FIGURES_SUBDIR}/{filename}"
            saved.append(
                {
                    "id": fig_id,
                    "page": page_number,
                    "bbox": _round_bbox(bbox),
                    "kind": kind,
                    "path": relative,
                    "caption": figure.get("caption"),
                }
            )
    finally:
        doc.close()
    return saved


def write_figures_json(output_dir, base_name, source_pdf, figures):
    output_dir = Path(output_dir)
    json_path = output_dir / f"{base_name}.figures.json"
    payload = {
        "source": str(source_pdf),
        "figures": figures,
    }
    json_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return json_path


def extract_and_save_figures(pdf_path, output_dir, base_name=None):
    """
    Pipeline completa: trova, rasterizza, scrive `*.figures.json`.
    Se non ci sono figure, scrive comunque JSON con `"figures": []`.
    """
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = base_name or pdf_path.stem

    found = extract_figures(pdf_path)
    saved = save_figures(pdf_path, output_dir, found, base_name=stem)
    json_path = write_figures_json(output_dir, stem, pdf_path, saved)
    logger.info("JSON figure salvato: %s (%s figure)", json_path, len(saved))
    return {"json_path": json_path, "figures": saved}
