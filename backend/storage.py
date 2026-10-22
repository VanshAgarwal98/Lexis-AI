"""
Lightweight JSON-file based storage layer.

For an MCA major project this avoids the overhead of installing/configuring
MongoDB or PostgreSQL just to run a demo. Every document and its analysis
result is stored as a JSON file under data/. Swapping this for a real
database later only requires rewriting the functions in this file - nothing
else in the app needs to change, since routes only ever call these functions.
"""
import json
import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

DATA_DIR = os.getenv("DATA_DIR") or ("/tmp/data" if os.getenv("VERCEL") else os.path.join(os.path.dirname(__file__), "data"))
DOCS_DIR = os.path.join(DATA_DIR, "documents")
FILES_DIR = os.path.join(DATA_DIR, "uploads")

os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(FILES_DIR, exist_ok=True)

# If running on Vercel (/tmp/data), seed existing sample data from bundled repository data
bundled_data = os.path.join(os.path.dirname(__file__), "data")
if DATA_DIR != bundled_data and os.path.exists(bundled_data):
    for sub in ["documents", "uploads"]:
        src_sub = os.path.join(bundled_data, sub)
        dst_sub = os.path.join(DATA_DIR, sub)
        if os.path.exists(src_sub):
            for item in os.listdir(src_sub):
                src_file = os.path.join(src_sub, item)
                dst_file = os.path.join(dst_sub, item)
                if os.path.isfile(src_file) and not os.path.exists(dst_file):
                    shutil.copy2(src_file, dst_file)



def _doc_path(doc_id: str) -> str:
    return os.path.join(DOCS_DIR, f"{doc_id}.json")


def save_document(filename: str, doc_type: str, raw_text: str, file_bytes: bytes, ext: str) -> Dict[str, Any]:
    doc_id = str(uuid.uuid4())
    safe_filename = os.path.basename(filename) if filename else "document.txt"
    if not ext.startswith("."):
        ext = f".{ext}" if ext else ".txt"

    stored_filename = f"{doc_id}{ext}"
    file_path = os.path.join(FILES_DIR, stored_filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    record = {
        "id": doc_id,
        "filename": safe_filename,
        "doc_type": doc_type or "Other",
        "stored_file": stored_filename,
        "text": raw_text,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "analysis": None,
    }
    with open(_doc_path(doc_id), "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return record


def list_documents() -> List[Dict[str, Any]]:
    docs = []
    if not os.path.exists(DOCS_DIR):
        return docs

    for fname in os.listdir(DOCS_DIR):
        if fname.endswith(".json"):
            file_path = os.path.join(DOCS_DIR, fname)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    analysis = d.get("analysis")
                    risk_counts = None
                    if analysis and "clauses" in analysis:
                        clauses = analysis.get("clauses") or []
                        risk_counts = {
                            "red": sum(1 for c in clauses if c.get("risk_level") == "red"),
                            "yellow": sum(1 for c in clauses if c.get("risk_level") == "yellow"),
                            "green": sum(1 for c in clauses if c.get("risk_level") == "green"),
                            "total": len(clauses)
                        }
                    docs.append({
                        "id": d.get("id", fname[:-5]),
                        "filename": d.get("filename", "Untitled Document"),
                        "doc_type": d.get("doc_type", "Other"),
                        "uploaded_at": d.get("uploaded_at", ""),
                        "analyzed": analysis is not None,
                        "risk_counts": risk_counts,
                    })
            except Exception as e:
                # Ignore corrupt or unreadable file
                continue

    docs.sort(key=lambda x: x.get("uploaded_at", ""), reverse=True)
    return docs


def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    path = _doc_path(doc_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save_analysis(doc_id: str, analysis: dict) -> Optional[Dict[str, Any]]:
    doc = get_document(doc_id)
    if doc is None:
        return None
    doc["analysis"] = analysis
    try:
        with open(_doc_path(doc_id), "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        return doc
    except Exception:
        return None


def delete_document(doc_id: str) -> bool:
    doc = get_document(doc_id)
    if doc is None:
        return False

    stored_file = doc.get("stored_file")
    if stored_file:
        file_path = os.path.join(FILES_DIR, stored_file)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

    doc_file = _doc_path(doc_id)
    if os.path.exists(doc_file):
        try:
            os.remove(doc_file)
            return True
        except OSError:
            return False

    return True
