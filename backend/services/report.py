"""
Generates a downloadable PDF report from a document's stored analysis.
"""
import io
import html
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)

RISK_COLORS = {
    "red": colors.HexColor("#B3261E"),
    "yellow": colors.HexColor("#8A6D00"),
    "green": colors.HexColor("#1E6B3C"),
}


def _esc(text: str) -> str:
    if not text:
        return ""
    return html.escape(str(text))


def build_report_pdf(document: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle", parent=styles["Title"], fontSize=20, spaceAfter=4
    )
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], spaceBefore=16, spaceAfter=8)
    body = styles["BodyText"]

    story = []
    story.append(Paragraph("Contract Analysis Report", title_style))
    story.append(Paragraph(_esc(document.get("filename", "Untitled Document")), styles["Normal"]))
    story.append(Paragraph(f"Document type: {_esc(document.get('doc_type', 'N/A'))}", styles["Normal"]))
    story.append(Paragraph(f"Uploaded: {_esc(document.get('uploaded_at', 'N/A'))}", styles["Normal"]))
    story.append(Spacer(1, 12))

    analysis = document.get("analysis") or {}

    story.append(Paragraph("Summary", h2))
    summary_text = _esc(analysis.get("summary", "No summary available.")).replace("\n", "<br/>")
    story.append(Paragraph(summary_text, body))

    story.append(Paragraph("Key Terms", h2))
    key_terms = analysis.get("key_terms", {})
    if key_terms:
        data = [["Term", "Value"]]
        for k, v in key_terms.items():
            term_title = _esc(k.replace("_", " ").title())
            term_val = _esc(str(v))
            data.append([
                Paragraph(f"<b>{term_title}</b>", body),
                Paragraph(term_val, body),
            ])
        table = Table(data, colWidths=[6 * cm, 9 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2A44")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No key terms extracted.", body))

    story.append(Paragraph("Clause-by-Clause Risk Breakdown", h2))
    clauses = analysis.get("clauses", [])
    if clauses:
        data = [["Clause Type", "Risk", "Excerpt / Reason"]]
        for c in clauses:
            c_type = _esc(c.get("type", "Other"))
            c_risk = _esc(c.get("risk_level", "").upper())
            c_excerpt = _esc(c.get("excerpt", ""))
            c_reason = _esc(c.get("risk_reason", ""))
            formatted_text = f"{c_excerpt}<br/><i>{c_reason}</i>"
            data.append([
                c_type,
                c_risk,
                Paragraph(formatted_text, body),
            ])
        table = Table(data, colWidths=[3.2 * cm, 2.2 * cm, 9.6 * cm])
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2A44")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        for i, c in enumerate(clauses, start=1):
            risk_color = RISK_COLORS.get(c.get("risk_level"), colors.black)
            style_cmds.append(("TEXTCOLOR", (1, i), (1, i), risk_color))
            style_cmds.append(("FONTNAME", (1, i), (1, i), "Helvetica-Bold"))
        table.setStyle(TableStyle(style_cmds))
        story.append(table)
    else:
        story.append(Paragraph("No clauses analyzed yet.", body))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def build_comparison_report_pdf(doc_a: dict, doc_b: dict, comparison: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                             leftMargin=2 * cm, rightMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleStyle", parent=styles["Title"], fontSize=20)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], spaceBefore=16, spaceAfter=8)
    body = styles["BodyText"]

    story = [Paragraph("Contract Comparison Report", title_style), Spacer(1, 6)]
    story.append(Paragraph(f"Document A: {_esc(doc_a.get('filename', 'Doc A'))}", styles["Normal"]))
    story.append(Paragraph(f"Document B: {_esc(doc_b.get('filename', 'Doc B'))}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Key Term Comparison", h2))
    terms_a = (doc_a.get("analysis") or {}).get("key_terms", {})
    terms_b = (doc_b.get("analysis") or {}).get("key_terms", {})
    all_keys = sorted(set(terms_a.keys()) | set(terms_b.keys()))
    
    if all_keys:
        data = [["Term", "Document A", "Document B"]]
        for k in all_keys:
            val_a = terms_a.get(k, "N/A")
            val_b = terms_b.get(k, "N/A")
            term_title = _esc(k.replace("_", " ").title())
            data.append([
                Paragraph(f"<b>{term_title}</b>", body),
                Paragraph(_esc(str(val_a)), body),
                Paragraph(_esc(str(val_b)), body),
            ])
        table = Table(data, colWidths=[4.5 * cm, 5.25 * cm, 5.25 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F2A44")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No key terms available for comparison.", body))

    # Redline summary
    diff_items = comparison.get("diff", [])
    if diff_items:
        story.append(Paragraph("Redline Diff Summary", h2))
        added_count = sum(1 for d in diff_items if d.get("type") == "added")
        removed_count = sum(1 for d in diff_items if d.get("type") == "removed")
        same_count = sum(1 for d in diff_items if d.get("type") == "same")
        summary_p = f"Total lines compared: {len(diff_items)} | Added: {added_count} | Removed: {removed_count} | Unchanged: {same_count}"
        story.append(Paragraph(_esc(summary_p), body))
        story.append(Spacer(1, 8))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
