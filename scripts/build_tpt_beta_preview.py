#!/usr/bin/env python3
"""Build the buyer-facing ScanGrade Grade 1 beta sampler preview."""

from __future__ import annotations

import subprocess
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = (
    ROOT
    / "public/worksheets/grade1-last-week-test-20260617/printables"
    / "ScanGrade-Grade1-Last-Week-Test-Packet.pdf"
)
LOGO = ROOT / "public/scangrade-logo-transparent.png"
TMP = ROOT / "tmp/pdfs/scangrade-tpt-preview"
OUTPUT = ROOT / "output/pdf/ScanGrade-Grade1-Beta-Sampler-TPT-Preview.pdf"
PDFTOPPM = (
    Path("/Users/openclaw/.cache/codex-runtimes/codex-primary-runtime/dependencies")
    / "bin/override/pdftoppm"
)

PAGE_W, PAGE_H = letter
INK = HexColor("#1d1d1f")
MUTED = HexColor("#5f6368")
GREEN = HexColor("#12824c")
PALE_GREEN = HexColor("#eef8f1")
YELLOW = HexColor("#eaff35")
PALE_YELLOW = HexColor("#fbffe2")
BLUE = HexColor("#245aa4")
LIGHT = HexColor("#f4f5f7")
LINE = HexColor("#d8dadd")


def ensure_thumbnails() -> list[Path]:
    TMP.mkdir(parents=True, exist_ok=True)
    paths = [TMP / f"worksheet-{index:02d}.jpg" for index in range(1, 11)]
    if not all(path.exists() for path in paths):
        executable = PDFTOPPM if PDFTOPPM.exists() else "pdftoppm"
        subprocess.run(
            [
                str(executable),
                "-f",
                "1",
                "-l",
                "10",
                "-jpeg",
                "-r",
                "90",
                str(SOURCE_PDF),
                str(TMP / "worksheet"),
            ],
            check=True,
        )
    return paths


def paragraph(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y_top: float,
    width: float,
    font_size: float = 12,
    leading: float | None = None,
    color=INK,
    align=TA_LEFT,
    bold: bool = False,
) -> float:
    style = ParagraphStyle(
        name="preview",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=font_size,
        leading=leading or font_size * 1.35,
        textColor=color,
        alignment=align,
        spaceAfter=0,
    )
    block = Paragraph(text, style)
    _, height = block.wrap(width, PAGE_H)
    block.drawOn(pdf, x, y_top - height)
    return height


def header(pdf: canvas.Canvas, title: str, page_number: int) -> None:
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(42, PAGE_H - 52, title)
    pdf.setStrokeColor(LINE)
    pdf.line(42, PAGE_H - 64, PAGE_W - 42, PAGE_H - 64)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(PAGE_W - 42, 25, f"ScanGrade beta preview  |  {page_number}")


def rounded_card(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    fill=white,
    stroke=LINE,
    radius: float = 12,
) -> None:
    pdf.setFillColor(fill)
    pdf.setStrokeColor(stroke)
    pdf.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def draw_cover(pdf: canvas.Canvas, thumbs: list[Path]) -> None:
    pdf.setFillColor(PALE_GREEN)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    if LOGO.exists():
        pdf.drawImage(ImageReader(str(LOGO)), 252, 682, 108, 70, preserveAspectRatio=True, mask="auto")
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 31)
    pdf.drawCentredString(PAGE_W / 2, 642, "Grade 1 Math")
    pdf.setFont("Helvetica-Bold", 27)
    pdf.drawCentredString(PAGE_W / 2, 606, "Auto-Grading Sampler")
    paragraph(
        pdf,
        "10 printable practice pages + answer key + free scan-and-grade companion",
        88,
        565,
        PAGE_W - 176,
        15,
        20,
        MUTED,
        TA_CENTER,
    )

    card_x, card_y, card_w, card_h = 91, 146, 430, 360
    rounded_card(pdf, card_x, card_y, card_w, card_h, white, LINE, 18)
    pdf.saveState()
    pdf.translate(card_x + 58, card_y + 26)
    pdf.rotate(-4)
    pdf.drawImage(ImageReader(str(thumbs[0])), 0, 0, 210, 286, preserveAspectRatio=True)
    pdf.restoreState()
    pdf.saveState()
    pdf.translate(card_x + 196, card_y + 44)
    pdf.rotate(5)
    pdf.drawImage(ImageReader(str(thumbs[6])), 0, 0, 205, 276, preserveAspectRatio=True)
    pdf.restoreState()
    pdf.setFillColor(GREEN)
    pdf.roundRect(118, 103, PAGE_W - 236, 35, 17, fill=1, stroke=0)
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(PAGE_W / 2, 115, "Print. Solve. Scan. Review.")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(PAGE_W / 2, 48, "Limited classroom beta - teacher review remains part of the workflow")
    pdf.showPage()


def draw_contents(pdf: canvas.Canvas, thumbs: list[Path]) -> None:
    header(pdf, "What is included", 2)
    labels = [
        "Addition: 1-digit answers",
        "Addition: 2-digit answers",
        "Subtraction: 1-digit answers",
        "Subtraction: 2-digit answers",
        "Mixed facts within 20",
        "Ten frames",
        "Dot collections",
        "Number bonds",
        "Number patterns",
        "Place value to 50",
    ]
    thumb_w, thumb_h = 78, 101
    start_x, start_y = 55, 590
    gap_x, gap_y = 32, 42
    for index, (image_path, label) in enumerate(zip(thumbs, labels)):
        col = index % 5
        row = index // 5
        x = start_x + col * (thumb_w + gap_x)
        y = start_y - row * (thumb_h + gap_y + 40)
        rounded_card(pdf, x - 5, y - 5, thumb_w + 10, thumb_h + 10, white, LINE, 5)
        pdf.drawImage(ImageReader(str(image_path)), x, y, thumb_w, thumb_h, preserveAspectRatio=True)
        paragraph(pdf, label, x - 6, y - 12, thumb_w + 12, 8.5, 10, INK, TA_CENTER, True)
    rounded_card(pdf, 54, 104, PAGE_W - 108, 78, PALE_YELLOW, YELLOW, 12)
    paragraph(
        pdf,
        "<b>Also included:</b> teacher answer key, QR-linked ScanGrade layouts, and one-page teacher instructions.",
        74,
        157,
        PAGE_W - 148,
        12,
        17,
        INK,
        TA_CENTER,
    )
    pdf.showPage()


def draw_workflow(pdf: canvas.Canvas) -> None:
    header(pdf, "Familiar paper, faster feedback", 3)
    steps = [
        ("1", "Print", "Use the worksheet like any other classroom printable."),
        ("2", "Solve", "Students write answers in pencil - no student device required."),
        ("3", "Scan", "Open scangrade.io and capture the whole page."),
        ("4", "Review", "Tap any yellow answer and confirm what the student wrote."),
        ("5", "Check", "Review the final marked page before using the result."),
    ]
    y = 632
    for number, title, copy in steps:
        rounded_card(pdf, 65, y - 72, PAGE_W - 130, 72, white, LINE, 12)
        pdf.setFillColor(GREEN)
        pdf.circle(102, y - 36, 20, fill=1, stroke=0)
        pdf.setFillColor(white)
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawCentredString(102, y - 41, number)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 15)
        pdf.drawString(139, y - 27, title)
        paragraph(pdf, copy, 139, y - 37, PAGE_W - 225, 11, 15, MUTED)
        y -= 96
    paragraph(
        pdf,
        "The worksheet remains useful even when you choose to grade it by hand.",
        75,
        120,
        PAGE_W - 150,
        12,
        17,
        GREEN,
        TA_CENTER,
        True,
    )
    pdf.showPage()


def draw_review(pdf: canvas.Canvas) -> None:
    header(pdf, "Teacher review stays in control", 4)
    paragraph(
        pdf,
        "Yellow means <b>please confirm the handwriting</b> - not that the math is wrong.",
        62,
        690,
        PAGE_W - 124,
        17,
        24,
        INK,
        TA_CENTER,
    )

    rounded_card(pdf, 94, 300, PAGE_W - 188, 300, LIGHT, LINE, 20)
    pdf.setFillColor(white)
    pdf.roundRect(153, 465, 160, 86, 4, fill=1, stroke=0)
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(2)
    pdf.rect(172, 480, 122, 54, fill=0, stroke=1)
    pdf.line(233, 480, 233, 534)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica", 30)
    pdf.drawCentredString(203, 493, "1")
    pdf.drawCentredString(264, 493, "3")
    pdf.setFillColor(YELLOW)
    pdf.setFillAlpha(0.38)
    pdf.roundRect(229, 478, 70, 58, 6, fill=1, stroke=0)
    pdf.setFillAlpha(1)

    rounded_card(pdf, 292, 362, 210, 173, HexColor("#fffdf4"), HexColor("#e5c746"), 12)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(308, 512, "Confirm answer")
    choices = ["3", "8", "9"]
    for index, choice in enumerate(choices):
        x = 309 + index * 56
        pdf.setFillColor(white)
        pdf.roundRect(x, 459, 46, 38, 7, fill=1, stroke=0)
        pdf.setFillColor(INK)
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawCentredString(x + 23, 471, choice)
    pdf.setStrokeColor(LINE)
    pdf.setFillColor(white)
    pdf.roundRect(309, 403, 78, 42, 7, fill=1, stroke=1)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 12)
    pdf.drawCentredString(348, 418, "type digit")
    pdf.setFillColor(BLUE)
    pdf.roundRect(396, 403, 89, 42, 7, fill=1, stroke=0)
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawCentredString(440.5, 418, "Save")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(309, 378, "Empty + Save records a blank")

    bullets = [
        "Choose a suggestion with one tap.",
        "Type what the student actually wrote.",
        "Save an empty answer as blank.",
        "ScanGrade never uses the answer key as handwriting truth.",
    ]
    y = 246
    for bullet in bullets:
        pdf.setFillColor(GREEN)
        pdf.circle(92, y + 3, 3.2, fill=1, stroke=0)
        paragraph(pdf, bullet, 108, y + 12, PAGE_W - 180, 11.5, 16, INK)
        y -= 34
    pdf.showPage()


def draw_expectations(pdf: canvas.Canvas) -> None:
    header(pdf, "Honest beta expectations", 5)
    rounded_card(pdf, 58, 455, PAGE_W - 116, 205, PALE_YELLOW, YELLOW, 16)
    paragraph(
        pdf,
        "<b>ScanGrade marks clear answers and asks for help with uncertain handwriting.</b><br/><br/>"
        "Handwriting, lighting, page angle, erasures, and device quality can affect results. "
        "Review the marked page before using it for feedback or records.",
        82,
        625,
        PAGE_W - 164,
        14,
        20,
        INK,
    )
    rounded_card(pdf, 58, 205, PAGE_W - 116, 205, white, LINE, 16)
    paragraph(
        pdf,
        "<b>The beta supports:</b><br/>"
        "- the included ScanGrade-authored Grade 1 worksheets<br/>"
        "- phones and tablets with a current browser<br/>"
        "- handwritten numerical answers inside the printed answer areas<br/><br/>"
        "<b>It does not promise:</b><br/>"
        "- perfect recognition of every handwriting style<br/>"
        "- arbitrary third-party worksheet grading<br/>"
        "- a replacement for teacher judgment",
        82,
        382,
        PAGE_W - 164,
        12,
        17,
        INK,
    )
    paragraph(
        pdf,
        "If a result looks wrong, correct it, rescan it, or grade the page manually.",
        75,
        155,
        PAGE_W - 150,
        13,
        18,
        GREEN,
        TA_CENTER,
        True,
    )
    pdf.showPage()


def draw_close(pdf: canvas.Canvas, thumbs: list[Path]) -> None:
    pdf.setFillColor(PALE_GREEN)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    header(pdf, "Try the classroom beta", 6)
    pdf.drawImage(ImageReader(str(thumbs[4])), 70, 244, 220, 285, preserveAspectRatio=True)
    rounded_card(pdf, 320, 284, 220, 245, white, LINE, 16)
    paragraph(pdf, "<b>What you need</b>", 345, 497, 170, 15, 20, INK, TA_CENTER)
    paragraph(
        pdf,
        "A printer<br/><br/>A phone or tablet with a camera<br/><br/>Internet access to scangrade.io"
        "<br/><br/>A teacher checking the final result",
        345,
        458,
        170,
        11.5,
        16,
        INK,
        TA_CENTER,
    )
    pdf.setFillColor(GREEN)
    pdf.roundRect(155, 155, PAGE_W - 310, 48, 24, fill=1, stroke=0)
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawCentredString(PAGE_W / 2, 172, "scangrade.io")
    paragraph(
        pdf,
        "Suggested uses: independent practice, homework review, centers, intervention, and formative feedback.",
        78,
        116,
        PAGE_W - 156,
        11.5,
        16,
        MUTED,
        TA_CENTER,
    )
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(PAGE_W / 2, 48, "The printable works with or without the ScanGrade website.")
    pdf.showPage()


def build() -> None:
    thumbs = ensure_thumbnails()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=letter)
    pdf.setTitle("ScanGrade Grade 1 Beta Sampler - TPT Preview")
    pdf.setAuthor("ScanGrade")
    draw_cover(pdf, thumbs)
    draw_contents(pdf, thumbs)
    draw_workflow(pdf)
    draw_review(pdf)
    draw_expectations(pdf)
    draw_close(pdf, thumbs)
    pdf.save()
    print(OUTPUT.relative_to(ROOT))


if __name__ == "__main__":
    build()
