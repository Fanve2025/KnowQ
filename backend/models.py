import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, Float, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from database import Base


def gen_id():
    return str(uuid.uuid4())


def now():
    return datetime.utcnow()


def to_iso(dt):
    if dt is None:
        return None
    s = dt.isoformat()
    if s and not s.endswith(("Z", "+00:00")):
        s += "Z"
    return s


class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=gen_id)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=now)


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="active")
    doc_count = Column(Integer, default=0)
    entry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)
    entries = relationship("KnowledgeEntry", back_populates="knowledge_base", cascade="all, delete-orphan")


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"
    id = Column(String(36), primary_key=True, default=gen_id)
    kb_id = Column(String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(10), nullable=False, default="q_a")
    question = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    source_doc = Column(String(500), nullable=True)
    chunk_index = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=now)
    knowledge_base = relationship("KnowledgeBase", back_populates="entries")


class QASystem(Base):
    __tablename__ = "qa_systems"
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    kb_ids = Column(Text, default="[]")
    mode = Column(String(10), nullable=False, default="ai")
    llm_config_id = Column(String(36), ForeignKey("llm_configs.id"), nullable=True)
    search_config_id = Column(String(36), ForeignKey("search_configs.id"), nullable=True)
    enable_web_search = Column(Boolean, default=False)
    frontend_url = Column(String(500), nullable=True)
    status = Column(String(20), default="active")
    access_password = Column(String(200), nullable=True)
    welcome_message = Column(Text, default="你好！我是AI智能助手，有什么可以帮你的吗？")
    system_prompt = Column(Text, default="")
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)
    llm_config = relationship("LLMConfig", foreign_keys=[llm_config_id])
    search_config = relationship("SearchConfig", foreign_keys=[search_config_id])


class LLMConfig(Base):
    __tablename__ = "llm_configs"
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False)
    provider = Column(String(50), nullable=False)
    model_name = Column(String(200), nullable=False)
    api_key_encrypted = Column(Text, nullable=True)
    endpoint = Column(String(500), nullable=True)
    params_json = Column(Text, default='{"temperature":0.7,"max_tokens":2048,"top_p":1}')
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class SearchConfig(Base):
    __tablename__ = "search_configs"
    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(200), nullable=False)
    provider = Column(String(50), nullable=False, default="tavily")
    api_key_encrypted = Column(Text, nullable=True)
    endpoint = Column(String(500), nullable=True)
    cx = Column(String(200), nullable=True)
    max_results = Column(Integer, default=5)
    summary_length = Column(Integer, default=500)
    is_enabled_global = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String(36), primary_key=True, default=gen_id)
    system_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    title = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)


class QASession(Base):
    __tablename__ = "qa_sessions"
    id = Column(String(36), primary_key=True, default=gen_id)
    system_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=True, index=True)
    login_at = Column(DateTime, default=now)
    logout_at = Column(DateTime, nullable=True)
    question_count = Column(Integer, default=0)


class QALog(Base):
    __tablename__ = "qa_logs"
    id = Column(String(36), primary_key=True, default=gen_id)
    session_id = Column(String(36), ForeignKey("qa_sessions.id"), nullable=True, index=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=True, index=True)
    system_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(36), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    mode = Column(String(10), nullable=True)
    source = Column(String(20), nullable=True)
    matched_kb_id = Column(String(36), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    feedback = Column(Integer, default=0)
    references = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now, index=True)


class SystemSettings(Base):
    __tablename__ = "system_settings"
    id = Column(String(36), primary_key=True, default=gen_id)
    rule_threshold = Column(Float, default=0.12)
    rule_secondary_threshold = Column(Float, default=0.05)
    rule_secondary_top_n = Column(Integer, default=3)
    bm25_k1 = Column(Float, default=1.5)
    bm25_b = Column(Float, default=0.75)
    question_bonus_weight = Column(Float, default=2.0)
    substring_full_match_score = Column(Float, default=1.0)
    substring_partial_match_score = Column(Float, default=0.8)
    substring_segment_score = Column(Float, default=0.3)
    ai_top_k = Column(Integer, default=5)
    ai_history_limit = Column(Integer, default=10)
    chunk_size = Column(Integer, default=512)
    chunk_overlap = Column(Integer, default=50)
    qa_detect_lines = Column(Integer, default=20)
    qa_min_markers = Column(Integer, default=2)
    token_expire_hours = Column(Integer, default=24)
    updated_at = Column(DateTime, default=now, onupdate=now)


class DocumentUpload(Base):
    __tablename__ = "document_uploads"
    id = Column(String(36), primary_key=True, default=gen_id)
    kb_id = Column(String(36), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(20), nullable=False)
    status = Column(String(20), default="processing")
    chunk_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now)
