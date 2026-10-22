# AI-powered Legal/Contract Document Analyzer

An MCA major project that uses NLP/LLM techniques (via the Google Gemini API)
to automate a first-pass review of legal contracts: clause extraction, risk
flagging, plain-English summarization, and side-by-side contract comparison
with a redline view and PDF report export.

```
legal-analyzer/
├── backend/          FastAPI + Google Gemini API (Python)
│   ├── main.py       REST API routes
│   ├── storage.py    File-based JSON document & analysis persistence
│   └── services/
│       ├── extract.py         Text extraction (PDF, DOCX, TXT)
│       ├── gemini_service.py  Gemini AI integration & mock fallback
│       └── report.py          PDF report generation (ReportLab)
└── frontend/         React + Vite SPA
    ├── src/
    │   ├── api.js             API client for backend endpoints
    │   ├── App.jsx            Main layout and navigation
    │   └── components/        UI components (Upload, Library, Analysis, Compare)
    └── index.html
```

## Features

- **Upload & manage contracts** — PDF, DOCX, or TXT
- **Clause extraction & risk flagging** — Gemini reads the contract and tags
  each clause (Termination, Liability, Confidentiality, etc.) as Green /
  Yellow / Red risk, with a plain-English explanation
- **Plain-English summary** — 3-paragraph summary of the whole contract
- **Key-term extraction** — termination notice period, liability cap,
  auto-renewal, governing law, payment terms, etc.
- **Compare contracts** — line-by-line redline diff + key-term comparison
  table between any two uploaded documents
- **PDF report export** — downloadable analysis report and comparison report
- **Resilient AI fallback** — automatic mock simulator fallback if API quota or offline

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Gemini API key — get one at https://aistudio.google.com/

## 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Create .env from template
cp .env.example .env           # Windows: copy .env.example .env
# Open .env and add your GEMINI_API_KEY and GEMINI_MODEL (e.g. gemini-1.5-flash)

uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Visit `http://localhost:8000/docs`
for the interactive Swagger API docs — useful for testing endpoints independently.

## 2. Frontend Setup

Open a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. Open it in your browser.

## 3. Using the App

1. **Document Library** → upload a contract (PDF, DOCX, or TXT)
2. Click the document row → **Run AI Analysis** → Gemini extracts clauses,
   flags risk, writes a summary, and pulls out key terms
3. **Export PDF Report** to download a formatted analysis report
4. **Compare Contracts** tab → pick two documents → view the
   key-term comparison table and redline diff → export a comparison PDF

## Architecture

```
[React Frontend] --HTTP--> [FastAPI Backend] --API call--> [Google Gemini API]
                                  |
                                  v
                         [JSON File Storage]
                         (documents + analysis)
```
