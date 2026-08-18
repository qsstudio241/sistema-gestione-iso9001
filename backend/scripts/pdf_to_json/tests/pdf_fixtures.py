"""
Generazione di PDF sintetici minimi per i test di integrazione della
pipeline pdf_to_json, senza usare documenti reali (coperti da copyright
UNI/ISO) e senza committare file binari nel repository.

Usa `reportlab` (installato solo per i test/sviluppo di questo tool,
vedi requirements.txt) per costruire PDF "veri" al volo in una cartella
temporanea, cancellati automaticamente a fine test.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_sample_norm_pdf(path):
    """
    Costruisce un PDF sintetico che imita la struttura di una norma ISO:
    heading numerati ("4", "4.1", "4.2"), paragrafi di corpo e una tabella
    con griglia (rilevabile da pdfplumber come tabella vera).
    """
    styles = getSampleStyleSheet()
    heading1 = ParagraphStyle("H1Sample", parent=styles["Heading1"], fontSize=16)
    heading2 = ParagraphStyle("H2Sample", parent=styles["Heading2"], fontSize=13)
    body = styles["BodyText"]

    story = [
        Paragraph("4 Contesto dell'organizzazione", heading1),
        Paragraph("4.1 Comprensione dell'organizzazione e del suo contesto", heading2),
        Paragraph(
            "L'organizzazione deve determinare i fattori esterni e interni rilevanti "
            "per le sue finalita' e che influenzano la sua capacita' di conseguire i "
            "risultati attesi del proprio sistema di gestione per la qualita'.",
            body,
        ),
        Spacer(1, 0.3 * cm),
        Paragraph("4.2 Comprensione delle esigenze e delle aspettative delle parti interessate", heading2),
        Paragraph(
            "L'organizzazione deve individuare le parti interessate rilevanti per il "
            "sistema di gestione per la qualita' e i relativi requisiti.",
            body,
        ),
        Spacer(1, 0.5 * cm),
        Table(
            [
                ["Colonna A", "Colonna B"],
                ["Valore 1", "Valore 2"],
                ["Valore 3", "Valore 4"],
            ],
            style=TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            ),
        ),
    ]

    doc = SimpleDocTemplate(str(path), pagesize=A4)
    doc.build(story)


def build_text_only_pdf(path):
    """
    PDF con una pagina di solo testo (nessuna immagine XObject, nessun
    disegno): usato per verificare che `--extract-figures` esca 0 con
    `figures: []`.
    """
    canvas_obj = pdf_canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    canvas_obj.setFont("Helvetica", 12)
    canvas_obj.drawString(72, height - 80, "Pagina solo testo, nessuna tavola.")
    canvas_obj.drawString(
        72,
        height - 110,
        "L'organizzazione deve determinare i fattori esterni e interni rilevanti.",
    )
    canvas_obj.showPage()
    canvas_obj.save()


def build_figures_sample_pdf(path):
    """
    PDF sintetico per MR-0: una pagina con tavola vettoriale (linee/rettangolo
    tipo simbolo) + un'immagine raster minima + caption, e una seconda pagina
    solo testo (nessuna figura). Nessun PDF normativo reale.
    """
    from PIL import Image

    raster = Image.new("RGB", (48, 48), (200, 30, 30))
    width, height = A4
    canvas_obj = pdf_canvas.Canvas(str(path), pagesize=A4)
    canvas_obj.setFont("Helvetica", 14)
    canvas_obj.drawString(72, height - 56, "Pagina di prova simboli")

    symbol_y = height - 280
    canvas_obj.setFont("Helvetica", 11)
    canvas_obj.drawString(120, symbol_y + 70, "Figura 1 - Simbolo di prova")

    canvas_obj.setStrokeColorRGB(0, 0, 0)
    canvas_obj.setLineWidth(2)
    x = 120
    canvas_obj.line(x, symbol_y, x + 180, symbol_y)
    canvas_obj.line(x + 60, symbol_y, x + 90, symbol_y - 40)
    canvas_obj.line(x + 90, symbol_y - 40, x + 120, symbol_y)
    canvas_obj.line(x + 60, symbol_y, x + 120, symbol_y)
    canvas_obj.rect(x + 40, symbol_y + 10, 100, 50, stroke=1, fill=0)

    canvas_obj.setFont("Helvetica", 11)
    canvas_obj.drawString(360, height - 120, "Figura 2 - Ritaglio raster")
    canvas_obj.drawImage(ImageReader(raster), 360, height - 220, width=80, height=80)

    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(50, 30, width - 50, 30)
    canvas_obj.setFont("Helvetica", 9)
    canvas_obj.drawString(width / 2 - 4, 18, "1")
    canvas_obj.showPage()

    canvas_obj.setFont("Helvetica", 12)
    canvas_obj.drawString(72, height - 80, "Pagina solo testo, nessuna tavola.")
    canvas_obj.drawString(72, height - 110, "Nessun disegno e nessuna immagine su questa pagina.")
    canvas_obj.showPage()
    canvas_obj.save()


def build_scanned_like_pdf(path, text="Documento acquisito via scanner, nessun livello testo reale"):
    """
    Costruisce un PDF "come se fosse" una scansione: il contenuto e' solo
    un'immagine rasterizzata (nessun livello testo selezionabile), cosi'
    da poter testare in modo deterministico il comportamento difensivo
    di `extract_pdf` quando il testo non e' estraibile.
    """
    from PIL import Image, ImageDraw

    image = Image.new("RGB", (800, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.text((20, 130), text, fill="black")

    canvas_obj = pdf_canvas.Canvas(str(path), pagesize=(800, 300))
    canvas_obj.drawImage(ImageReader(image), 0, 0, width=800, height=300)
    canvas_obj.showPage()
    canvas_obj.save()
