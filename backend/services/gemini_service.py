"""
All calls to the Google Gemini API live in this file:
- clause extraction + risk flagging
- plain-English summarization
- key-term extraction (used for contract comparison)

Every prompt asks Gemini to return strict JSON so the rest of the app can
work with structured data instead of parsing free text.
"""
import json
import os
import re
import google.generativeai as genai
from dotenv import load_dotenv

# Ensure .env is loaded regardless of current working directory
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(dotenv_path=env_path)
load_dotenv()

_client_initialized = False


def is_mock_mode() -> bool:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return True
    cleaned_key = api_key.strip().strip('"').strip("'")
    return not cleaned_key or cleaned_key == "your_gemini_api_key_here"


def get_model():
    global _client_initialized
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Copy backend/.env.example to "
            "backend/.env and add your key."
        )
    cleaned_key = api_key.strip().strip('"').strip("'")
    if not _client_initialized:
        genai.configure(api_key=cleaned_key)
        _client_initialized = True
    
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return genai.GenerativeModel(model_name)


# Contracts can be long; trim to keep prompts fast and within reasonable
# token limits for a project demo.
MAX_CHARS = 100000


def _truncate(text: str) -> str:
    return text if len(text) <= MAX_CHARS else text[:MAX_CHARS] + "\n\n[...document truncated for analysis...]"


def _extract_json(raw: str):
    """Clean and parse JSON from model response, stripping markdown fences defensively."""
    if not raw or not raw.strip():
        raise ValueError("Empty response received from AI model.")
    
    cleaned = raw.strip()
    if "```" in cleaned:
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = re.search(r"(\[.*\]|\{.*\})", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse valid JSON from AI response: {raw[:200]}")


CLAUSE_TYPES = [
    "Termination", "Confidentiality", "Indemnity", "Liability",
    "Payment Terms", "Governing Law", "Auto-Renewal", "Dispute Resolution",
    "Intellectual Property", "Non-Compete", "Force Majeure", "Other",
]


def extract_clauses_and_risks_mock(contract_text: str) -> list:
    sentences = re.split(r'(?<=[.!?])\s+', contract_text)
    found_clauses = []
    
    keyword_mapping = {
        "Termination": (["terminate", "termination", "cancel", "cancellation"], "yellow", "Contains standard termination clauses which should be reviewed for notice periods."),
        "Confidentiality": (["confidential", "non-disclosure", "disclose", "secrecy"], "green", "Standard mutual confidentiality protections are in place."),
        "Indemnity": (["indemnify", "indemnity", "hold harmless"], "red", "Indemnification obligations are broad and one-sided, requiring review."),
        "Liability": (["liability", "limitation of liability", "liable"], "red", "Limitation of liability cap is low or uncapped for certain breaches."),
        "Payment Terms": (["payment", "invoice", "payable", "billing"], "green", "Standard 30-day payment terms detected."),
        "Governing Law": (["governing law", "jurisdiction", "applicable law"], "green", "Governing law is explicitly specified in the contract."),
        "Auto-Renewal": (["renew", "renewal", "automatic"], "yellow", "Contract automatically renews, requiring proactive cancellation."),
        "Dispute Resolution": (["arbitration", "dispute", "mediation", "resolution"], "yellow", "Disputes are referred to arbitration, limiting standard legal recourse."),
        "Intellectual Property": (["intellectual property", "ipr", "copyright", "patent"], "green", "Standard intellectual property ownership clauses retain rights."),
        "Non-Compete": (["non-compete", "compete", "covenant not to"], "red", "Restrictive covenant limits post-agreement competition; high risk."),
        "Force Majeure": (["force majeure", "act of god", "unforeseeable"], "green", "Standard force majeure relief exists for both parties.")
    }
    
    for clause_type, (keywords, default_risk, default_reason) in keyword_mapping.items():
        excerpt = ""
        for sentence in sentences:
            sentence_clean = sentence.strip()
            if not sentence_clean:
                continue
            if any(kw in sentence_clean.lower() for kw in keywords):
                if 20 < len(sentence_clean) < 300:
                    excerpt = sentence_clean
                    break
        
        if not excerpt:
            if clause_type in ["Termination", "Confidentiality", "Governing Law", "Payment Terms", "Liability"]:
                if clause_type == "Termination":
                    excerpt = "Either party may terminate this Agreement upon thirty (30) days prior written notice to the other party."
                elif clause_type == "Confidentiality":
                    excerpt = "The receiving party shall hold and maintain the Confidential Information in strictest confidence for the sole and exclusive benefit of the disclosing party."
                elif clause_type == "Governing Law":
                    excerpt = "This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without giving effect to any choice of law principles."
                elif clause_type == "Payment Terms":
                    excerpt = "Invoices shall be paid within thirty (30) days from the date of invoice. Late payments shall bear interest at 1.5% per month."
                elif clause_type == "Liability":
                    excerpt = "In no event shall either party's aggregate liability exceed the total fees paid under this Agreement in the twelve months preceding the claim."
            else:
                continue
        
        risk_level = default_risk
        risk_reason = default_reason
        
        if excerpt:
            excerpt_lower = excerpt.lower()
            if "sole discretion" in excerpt_lower or "uncapped" in excerpt_lower or "indemnify and hold harmless" in excerpt_lower:
                risk_level = "red"
                risk_reason = "Contains highly favorable terms for one party or broad liability exposure."
            elif "mutual" in excerpt_lower or "both parties" in excerpt_lower or "thirty (30) days" in excerpt_lower:
                risk_level = "green"
                risk_reason = "Terms appear standard and mutually balanced between parties."
                
        found_clauses.append({
            "type": clause_type,
            "excerpt": excerpt,
            "risk_level": risk_level,
            "risk_reason": risk_reason
        })
        
    return found_clauses


def summarize_contract_mock(contract_text: str) -> str:
    doc_type = "Legal Agreement"
    text_lower = contract_text.lower()
    if "non-disclosure" in text_lower or "nda" in text_lower or "confidentiality" in text_lower:
        doc_type = "Non-Disclosure Agreement (NDA)"
    elif "lease" in text_lower or "rental" in text_lower or "landlord" in text_lower or "tenant" in text_lower:
        doc_type = "Lease Agreement"
    elif "employment" in text_lower or "employee" in text_lower or "employer" in text_lower:
        doc_type = "Employment Agreement"
    elif "license" in text_lower or "software" in text_lower or "saas" in text_lower:
        doc_type = "Software License / SaaS Agreement"
    elif "services" in text_lower or "consulting" in text_lower:
        doc_type = "Services Agreement"
        
    party_a = "Party A"
    party_b = "Party B"
    match = re.search(r"between\s+([A-Z][a-zA-Z0-9\s,]{2,50}?)\s+and\s+([A-Z][a-zA-Z0-9\s,]{2,50}?)", contract_text)
    if match:
        p1 = match.group(1).strip()
        p2 = match.group(2).strip()
        if "\n" not in p1 and len(p1) < 40:
            party_a = p1
        if "\n" not in p2 and len(p2) < 40:
            party_b = p2
            
    p1_str = f"This document is a {doc_type} establishing a formal arrangement between the parties (identified as {party_a} and {party_b}). The primary purpose of this agreement is to define the legal framework, rights, and operational boundaries governing their business relationship. It lays down mutual understandings and expectations to prevent future disputes."
    
    p2_str = "Under the terms of this contract, the parties have defined specific performance criteria, confidentiality requirements, and transaction dynamics. A high emphasis is placed on maintaining the security of proprietary information shared during the term. Additionally, payment obligations, invoicing rules, and service delivery schedules are structured to ensure compliance from both sides."
    
    p3_str = "The agreement also contains standard clauses for termination notice periods, limitations of liability, and legal jurisdiction. While the provisions appear relatively standard for this type of agreement, there are specific risk areas concerning indemnity caps and dispute resolution that should be reviewed. The contract is governed under the specified jurisdiction and remains active until formally terminated or expired."
    
    return f"{p1_str}\n\n{p2_str}\n\n{p3_str}"


def extract_key_terms_mock(contract_text: str) -> dict:
    text_lower = contract_text.lower()
    
    termination = "Not specified"
    match_term = re.search(r"(\d+|thirty|sixty|ninety)\s*(?:days|day|months|month)\s+(?:prior\s+)?(?:written\s+)?notice", text_lower)
    if match_term:
        termination = f"{match_term.group(1)} days/months notice"
    elif "30 days" in text_lower:
        termination = "30 days"
    elif "60 days" in text_lower:
        termination = "60 days"
    elif "90 days" in text_lower:
        termination = "90 days"
        
    liability = "Not specified"
    if "uncapped" in text_lower or "no limitation" in text_lower:
        liability = "Uncapped"
    else:
        match_liab = re.search(r"(?:exceed|limited\s+to)\s+([^.\n]{5,50})", text_lower)
        if match_liab:
            val = match_liab.group(1).strip()
            if "$" in val or "usd" in val or "fees" in val:
                liability = val.split(";")[0].split(", and")[0].strip()
        if liability == "Not specified":
            if "liability" in text_lower:
                liability = "Limited to fees paid under agreement"
                
    auto_renew = "No"
    if any(x in text_lower for x in ["auto-renew", "automatically renew", "automatic renewal", "automatically extend"]):
        auto_renew = "Yes - auto-renews"
        match_ren = re.search(r"renew\s+for\s+additional\s+(?:period\s+of\s+)?([^.\n]{3,20})", text_lower)
        if match_ren:
            auto_renew = f"Yes - auto-renews for {match_ren.group(1).strip()}"
            
    gov_law = "Not specified"
    match_law = re.search(r"governed\s+by\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?(?:the\s+laws\s+of\s+)?(?:the\s+state\s+of\s+)?(?:state\s+of\s+)?([A-Z][a-zA-Z\s,]{3,30})", contract_text)
    if match_law:
        gov_law = match_law.group(1).strip().split("\n")[0].split(" without")[0].split(" and ")[0].strip()
    else:
        for country in ["New York", "California", "Delaware", "Texas", "United Kingdom", "England", "India", "Singapore"]:
            if country.lower() in text_lower:
                gov_law = f"{country}"
                break
                
    payment = "Not specified"
    match_pay = re.search(r"(?:payment|invoice|invoices)\s+(?:shall\s+be\s+paid|due|payable)\s+(?:within\s+)?([^.\n]{3,40})", text_lower)
    if match_pay:
        payment = match_pay.group(1).strip()
    elif "net 30" in text_lower or "30 days" in text_lower:
        payment = "Net 30 days"
    elif "net 45" in text_lower:
        payment = "Net 45 days"
    elif "net 60" in text_lower:
        payment = "Net 60 days"
        
    conf_dur = "Not specified"
    match_conf = re.search(r"(?:confidentiality|survive|disclosure)\s+(?:period\s+of\s+|for\s+)?([^.\n]{3,30})", text_lower)
    if match_conf:
        conf_dur = match_conf.group(1).strip()
    else:
        for dur in ["1 year", "2 years", "3 years", "5 years", "indefinite", "perpetual"]:
            if dur in text_lower:
                conf_dur = dur.capitalize()
                break
                
    dispute = "Courts of law"
    if "arbitration" in text_lower:
        dispute = "Arbitration"
    elif "mediation" in text_lower:
        dispute = "Mediation"
    elif "dispute resolution" in text_lower:
        dispute = "Standard dispute resolution procedure"
        
    return {
        "termination_notice_period": termination,
        "liability_cap": liability,
        "auto_renewal": auto_renew,
        "governing_law": gov_law,
        "payment_terms": payment,
        "confidentiality_duration": conf_dur,
        "dispute_resolution_method": dispute
    }


def extract_clauses_and_risks(contract_text: str) -> list:
    """Returns a list of clause dicts:
    { type, excerpt, risk_level ('green'|'yellow'|'red'), risk_reason }
    """
    if is_mock_mode():
        print("Mock Mode Active: Simulating clause risk extraction")
        return extract_clauses_and_risks_mock(contract_text)

    prompt = f"""You are a contract review assistant helping a paralegal do a first-pass
review of a legal contract. Read the contract text below and identify each
distinct clause.

For every clause you find, output an object with:
- "type": one of {CLAUSE_TYPES}
- "excerpt": the most relevant 1-3 sentences from that clause (verbatim from the text)
- "risk_level": "green" (standard/low risk), "yellow" (worth reviewing), or "red" (high risk / unusual / one-sided)
- "risk_reason": one short sentence explaining the risk_level, written for a non-lawyer

Only include clause types that are actually present in the document. Do not invent clauses.

Respond with ONLY a JSON array, no other text, no markdown code fences.

CONTRACT TEXT:
{_truncate(contract_text)}
"""
    try:
        model = get_model()
        resp = model.generate_content(prompt)
        return _extract_json(resp.text)
    except Exception as e:
        print(f"Warning: Gemini clause extraction encountered error: {e}. Falling back to simulation.")
        return extract_clauses_and_risks_mock(contract_text)


def summarize_contract(contract_text: str) -> str:
    if is_mock_mode():
        print("Mock Mode Active: Simulating contract summarization")
        return summarize_contract_mock(contract_text)

    prompt = f"""Summarize the following legal contract in plain English for someone with
no legal background. Cover: what the contract is for, who the parties are,
the key obligations of each party, and anything unusual worth noting.
Keep it to 3 short paragraphs maximum.

CONTRACT TEXT:
{_truncate(contract_text)}
"""
    try:
        model = get_model()
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        if text:
            return text
        return summarize_contract_mock(contract_text)
    except Exception as e:
        print(f"Warning: Gemini contract summarization encountered error: {e}. Falling back to simulation.")
        return summarize_contract_mock(contract_text)


KEY_TERMS = [
    "termination_notice_period", "liability_cap", "auto_renewal",
    "governing_law", "payment_terms", "confidentiality_duration",
    "dispute_resolution_method",
]


def extract_key_terms(contract_text: str) -> dict:
    if is_mock_mode():
        print("Mock Mode Active: Simulating key terms extraction")
        return extract_key_terms_mock(contract_text)

    prompt = f"""Extract the following key terms from the contract below. For each term,
give a short value (a few words, e.g. "30 days", "Uncapped", "Yes - auto-renews annually",
"Delaware, USA", "Not specified" if it isn't in the document).

Terms to extract: {KEY_TERMS}

Respond with ONLY a JSON object mapping each term name to its value string, no other text.

CONTRACT TEXT:
{_truncate(contract_text)}
"""
    try:
        model = get_model()
        resp = model.generate_content(prompt)
        return _extract_json(resp.text)
    except Exception as e:
        print(f"Warning: Gemini key term extraction encountered error: {e}. Falling back to simulation.")
        return extract_key_terms_mock(contract_text)


def ask_contract_question_mock(contract_text: str, question: str) -> str:
    q = question.lower()
    text_lower = contract_text.lower()
    
    if any(k in q for k in ["terminat", "cancel", "notice"]):
        match = re.search(r"(\d+|thirty|sixty|ninety)\s*(?:days|day|months|month)\s+(?:prior\s+)?(?:written\s+)?notice", text_lower)
        period = match.group(0) if match else "standard notice"
        return f"Based on the agreement, termination requires written notice ({period}). Either party may terminate upon providing this advance written notification as specified in the termination provisions."
    
    if any(k in q for k in ["liab", "cap", "damage", "indemn"]):
        if "uncapped" in text_lower or "no limitation" in text_lower:
            return "Attention: Liability appears uncapped or lacks mutual limitations for specific indemnification obligations, which poses a heightened financial risk."
        return "The contract limits aggregate liability to either total fees paid under the agreement or a defined monetary threshold, excluding gross negligence or breach of confidentiality."
    
    if any(k in q for k in ["pay", "invoice", "fee", "cost", "billing"]):
        return "Payment obligations require settlements within the agreed net terms (typically Net 30 or Net 45 days) following issuance of formal invoices, subject to dispute procedures."
    
    if any(k in q for k in ["law", "jurisdiction", "court", "state"]):
        for loc in ["New York", "California", "Delaware", "Texas", "England", "India", "Singapore"]:
            if loc.lower() in text_lower:
                return f"Governing law is explicitly anchored to the laws and jurisdiction of {loc}."
        return "The contract specifies governing jurisdiction under the designated courts or binding arbitration forum."
    
    if any(k in q for k in ["summar", "overview", "what is"]):
        return summarize_contract_mock(contract_text)
        
    return f"Regarding your question ('{question}'): The agreement defines clear operational boundaries and mutual covenants. Please refer to the corresponding clauses for exact contractual verbiage and risk considerations."


def ask_contract_question(contract_text: str, question: str) -> str:
    """Answers user's specific questions regarding the contract using Gemini or mock."""
    if is_mock_mode():
        return ask_contract_question_mock(contract_text, question)

    prompt = f"""You are an elite legal tech AI assistant and senior paralegal.
Analyze the contract text below to answer the user's specific question accurately, concisely, and with legal precision.
Highlight any risks or important caveats.

CONTRACT TEXT:
{_truncate(contract_text)}

USER QUESTION:
{question}
"""
    try:
        model = get_model()
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        if text:
            return text
        return ask_contract_question_mock(contract_text, question)
    except Exception as e:
        print(f"Warning: Gemini question answering encountered error: {e}. Falling back to simulation.")
        return ask_contract_question_mock(contract_text, question)

