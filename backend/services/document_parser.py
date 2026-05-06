import fitz
import docx
import markdown
from bs4 import BeautifulSoup
from io import BytesIO

DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 50
DEFAULT_QA_DETECT_LINES = 20
DEFAULT_QA_MIN_MARKERS = 2

QA_QUESTION_MARKERS = ("Q:", "问：", "问题：")
QA_ANSWER_MARKERS = ("A:", "答：", "答案：")
QA_ALL_MARKERS = QA_QUESTION_MARKERS + QA_ANSWER_MARKERS


def parse_document(filename: str, content: bytes,
                   chunk_size: int = DEFAULT_CHUNK_SIZE,
                   chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
                   qa_detect_lines: int = DEFAULT_QA_DETECT_LINES,
                   qa_min_markers: int = DEFAULT_QA_MIN_MARKERS) -> list:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        text = _parse_pdf(content)
    elif ext in ("docx", "doc"):
        text = _parse_docx(content)
    elif ext in ("md", "markdown"):
        text = _parse_markdown(content)
    elif ext in ("txt", "text"):
        text = content.decode("utf-8", errors="ignore")
    else:
        text = content.decode("utf-8", errors="ignore")

    text = text.strip()
    if not text:
        return []

    if _looks_like_qa(text, qa_detect_lines, qa_min_markers):
        return _parse_qa_pairs(text, filename)

    return _chunk_text(text, filename, chunk_size, chunk_overlap)


def _parse_pdf(content: bytes) -> str:
    doc = fitz.open(stream=content, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n".join(pages)


def _parse_docx(content: bytes) -> str:
    doc = docx.Document(BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def _parse_markdown(content: bytes) -> str:
    md_text = content.decode("utf-8", errors="ignore")
    html = markdown.markdown(md_text)
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator="\n")


def _looks_like_qa(text: str, detect_lines: int = DEFAULT_QA_DETECT_LINES,
                    min_markers: int = DEFAULT_QA_MIN_MARKERS) -> bool:
    lines = text.strip().split("\n")
    qa_markers = 0
    for line in lines[:detect_lines]:
        stripped = line.strip()
        if stripped.startswith(QA_ALL_MARKERS):
            qa_markers += 1
    return qa_markers >= min_markers


def _extract_marker_content(stripped: str, markers: tuple) -> str:
    for marker in markers:
        if stripped.startswith(marker):
            return stripped[len(marker):].strip()
    return stripped.strip()


def _parse_qa_pairs(text: str, filename: str) -> list:
    entries = []
    lines = text.strip().split("\n")
    current_q = None
    current_a_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith(QA_QUESTION_MARKERS):
            if current_q and current_a_lines:
                entries.append({
                    "type": "q_a",
                    "question": current_q,
                    "content": "\n".join(current_a_lines).strip(),
                })
            current_q = _extract_marker_content(stripped, QA_QUESTION_MARKERS)
            current_a_lines = []
        elif stripped.startswith(QA_ANSWER_MARKERS):
            answer_text = _extract_marker_content(stripped, QA_ANSWER_MARKERS)
            current_a_lines = [answer_text] if answer_text else []
        else:
            if current_q:
                current_a_lines.append(stripped)

    if current_q and current_a_lines:
        entries.append({
            "type": "q_a",
            "question": current_q,
            "content": "\n".join(current_a_lines).strip(),
        })

    return entries


def _chunk_text(text: str, filename: str,
                chunk_size: int = DEFAULT_CHUNK_SIZE,
                chunk_overlap: int = DEFAULT_CHUNK_OVERLAP) -> list:
    entries = []
    chars = list(text)
    total = len(chars)
    start = 0
    doc_name = filename.rsplit(".", 1)[0] if "." in filename else filename

    while start < total:
        end = min(start + chunk_size, total)
        chunk = "".join(chars[start:end]).strip()
        if chunk:
            entries.append({
                "type": "chunk",
                "question": doc_name,
                "content": chunk,
            })
        if end >= total:
            break
        start = max(start + 1, end - chunk_overlap)

    return entries
