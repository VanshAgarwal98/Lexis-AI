"""
AI-powered Legal/Contract Document Analyzer - Backend API
Run with: uvicorn main:app --reload --port 8000
"""
import difflib
import os
import re
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

import storage
from services.extract import extract_text
from services.gemini_service import (
    extract_clauses_and_risks,
    summarize_contract,
    extract_key_terms,
    ask_contract_question,
    is_mock_mode,
)
from services.report import build_report_pdf, build_comparison_report_pdf

app = FastAPI(title="Legal Contract Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local dev / demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mock_mode": is_mock_mode(),
        "model": os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
    }


@app.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), doc_type: str = Form("Other")):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No valid file uploaded.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    safe_filename = os.path.basename(file.filename)
    try:
        text = extract_text(file_bytes, safe_filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract text: {e}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any readable text from this file.")

    ext = os.path.splitext(safe_filename)[1].lower() or ".txt"
    record = storage.save_document(safe_filename, doc_type, text, file_bytes, ext)
    return {"id": record["id"], "filename": record["filename"], "doc_type": record["doc_type"]}


@app.get("/documents")
def list_documents():
    return storage.list_documents()


@app.get("/documents/{doc_id}")
def get_document(doc_id: str):
    doc = storage.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    ok = storage.delete_document(doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True}


@app.post("/documents/{doc_id}/analyze")
def analyze_document(doc_id: str):
    doc = storage.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    text = doc.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Document has no text to analyze.")

    try:
        clauses = extract_clauses_and_risks(text)
        summary = summarize_contract(text)
        key_terms = extract_key_terms(text)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    analysis = {"clauses": clauses, "summary": summary, "key_terms": key_terms}
    updated = storage.save_analysis(doc_id, analysis)
    return updated


class ChatRequest(BaseModel):
    question: str


@app.post("/documents/{doc_id}/chat")
def chat_with_document(doc_id: str, req: ChatRequest):
    doc = storage.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    text = doc.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Document text is empty")
    
    answer = ask_contract_question(text, req.question.strip())
    return {"answer": answer}


class CompareRequest(BaseModel):
    doc_id_a: str
    doc_id_b: str


@app.post("/documents/compare")
def compare_documents(req: CompareRequest):
    doc_a = storage.get_document(req.doc_id_a)
    doc_b = storage.get_document(req.doc_id_b)
    if doc_a is None or doc_b is None:
        raise HTTPException(status_code=404, detail="One or both documents not found")

    # Line-level diff for the redline UI
    lines_a = (doc_a.get("text") or "").splitlines()
    lines_b = (doc_b.get("text") or "").splitlines()
    diff = list(difflib.ndiff(lines_a, lines_b))

    diff_output = []
    for line in diff:
        if line.startswith("+ "):
            diff_output.append({"type": "added", "text": line[2:]})
        elif line.startswith("- "):
            diff_output.append({"type": "removed", "text": line[2:]})
        elif line.startswith("? "):
            continue
        else:
            diff_output.append({"type": "same", "text": line[2:]})

    key_terms_a = (doc_a.get("analysis") or {}).get("key_terms", {})
    key_terms_b = (doc_b.get("analysis") or {}).get("key_terms", {})

    return {
        "doc_a": {"id": doc_a["id"], "filename": doc_a["filename"]},
        "doc_b": {"id": doc_b["id"], "filename": doc_b["filename"]},
        "diff": diff_output,
        "key_terms_a": key_terms_a,
        "key_terms_b": key_terms_b,
    }


@app.get("/documents/{doc_id}/report")
def get_report(doc_id: str):
    doc = storage.get_document(doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("analysis") is None:
        raise HTTPException(status_code=400, detail="Analyze the document before generating a report")

    pdf_bytes = build_report_pdf(doc)
    base_name = os.path.splitext(doc.get("filename", "contract"))[0]
    safe_base = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', base_name)
    filename = f"{safe_base}_analysis_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/documents/compare/report")
def get_comparison_report(req: CompareRequest):
    doc_a = storage.get_document(req.doc_id_a)
    doc_b = storage.get_document(req.doc_id_b)
    if doc_a is None or doc_b is None:
        raise HTTPException(status_code=404, detail="One or both documents not found")

    comparison = compare_documents(req)
    pdf_bytes = build_comparison_report_pdf(doc_a, doc_b, comparison)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="comparison_report.pdf"'},
    )
