from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List
from datetime import datetime


class UTCSchema(BaseModel):
    @field_serializer('created_at', 'updated_at', check_fields=False)
    @classmethod
    def serialize_dt(cls, v):
        if v is None:
            return None
        s = v.isoformat()
        if not s.endswith(("Z", "+00:00")):
            s += "Z"
        return s


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(UTCSchema):
    id: str
    username: str
    role: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None


class KBCreate(BaseModel):
    name: str
    description: str = ""


class KBUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class KBOut(UTCSchema):
    id: str
    name: str
    description: str
    created_by: Optional[str] = None
    status: str
    doc_count: int
    entry_count: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EntryCreate(BaseModel):
    question: Optional[str] = None
    content: str
    type: str = "q_a"
    source_doc: Optional[str] = None


class EntryUpdate(BaseModel):
    question: Optional[str] = None
    content: Optional[str] = None
    source_doc: Optional[str] = None


class EntryOut(UTCSchema):
    id: str
    kb_id: str
    type: str
    question: Optional[str] = None
    content: str
    source_doc: Optional[str] = None
    chunk_index: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemCreate(BaseModel):
    name: str
    description: str = ""
    kb_ids: List[str] = []
    mode: str = "ai"
    llm_config_id: Optional[str] = None
    search_config_id: Optional[str] = None
    enable_web_search: bool = False
    access_password: Optional[str] = None
    welcome_message: str = "你好！我是AI智能助手，有什么可以帮你的吗？"
    system_prompt: str = ""


class SystemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    kb_ids: Optional[List[str]] = None
    mode: Optional[str] = None
    llm_config_id: Optional[str] = None
    search_config_id: Optional[str] = None
    enable_web_search: Optional[bool] = None
    status: Optional[str] = None
    access_password: Optional[str] = None
    welcome_message: Optional[str] = None
    system_prompt: Optional[str] = None


class SystemOut(UTCSchema):
    id: str
    name: str
    description: str
    kb_ids: str
    mode: str
    llm_config_id: Optional[str] = None
    search_config_id: Optional[str] = None
    enable_web_search: bool
    frontend_url: Optional[str] = None
    status: str
    access_password: Optional[str] = None
    welcome_message: str
    system_prompt: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LLMConfigCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: str
    provider: str
    model_name: str
    api_key: str = ""
    endpoint: Optional[str] = None
    params_json: str = '{"temperature":0.7,"max_tokens":2048,"top_p":1}'
    is_default: bool = False


class LLMConfigUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}
    name: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    params_json: Optional[str] = None
    is_default: Optional[bool] = None


class LLMConfigOut(UTCSchema):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: str
    name: str
    provider: str
    model_name: str
    api_key_encrypted: Optional[str] = None
    endpoint: Optional[str] = None
    params_json: str
    is_default: bool
    created_at: Optional[datetime] = None


class SearchConfigCreate(BaseModel):
    name: str
    provider: str = "tavily"
    api_key: str = ""
    endpoint: Optional[str] = None
    cx: Optional[str] = None
    max_results: int = 5
    summary_length: int = 500
    is_enabled_global: bool = False


class SearchConfigUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    cx: Optional[str] = None
    max_results: Optional[int] = None
    summary_length: Optional[int] = None
    is_enabled_global: Optional[bool] = None


class SearchConfigOut(UTCSchema):
    id: str
    name: str
    provider: str = "tavily"
    api_key_encrypted: Optional[str] = None
    endpoint: Optional[str] = None
    cx: Optional[str] = None
    max_results: int
    summary_length: int
    is_enabled_global: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AskRequest(BaseModel):
    question: str
    history: List[dict] = []


class AskResponse(BaseModel):
    answer: str
    source: str
    references: List[dict] = []


class FeedbackRequest(BaseModel):
    log_id: str
    feedback: int = Field(..., ge=-1, le=1)


class DashboardStats(BaseModel):
    kb_count: int = 0
    doc_count: int = 0
    system_count: int = 0
    user_count: int = 0
    question_count: int = 0
    today_questions: int = 0
    kb_hit_rate: float = 0.0
    web_search_rate: float = 0.0


class SystemStats(BaseModel):
    system_id: str
    system_name: str
    visit_count: int = 0
    question_count: int = 0
    kb_hit_count: int = 0
    web_search_count: int = 0
    kb_hit_rate: float = 0.0


class SettingsOut(UTCSchema):
    id: str
    rule_threshold: float = 0.12
    rule_secondary_threshold: float = 0.05
    rule_secondary_top_n: int = 3
    bm25_k1: float = 1.5
    bm25_b: float = 0.75
    question_bonus_weight: float = 2.0
    substring_full_match_score: float = 1.0
    substring_partial_match_score: float = 0.8
    substring_segment_score: float = 0.3
    ai_top_k: int = 5
    ai_history_limit: int = 10
    chunk_size: int = 512
    chunk_overlap: int = 50
    qa_detect_lines: int = 20
    qa_min_markers: int = 2
    token_expire_hours: int = 24
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    rule_threshold: Optional[float] = None
    rule_secondary_threshold: Optional[float] = None
    rule_secondary_top_n: Optional[int] = None
    bm25_k1: Optional[float] = None
    bm25_b: Optional[float] = None
    question_bonus_weight: Optional[float] = None
    substring_full_match_score: Optional[float] = None
    substring_partial_match_score: Optional[float] = None
    substring_segment_score: Optional[float] = None
    ai_top_k: Optional[int] = None
    ai_history_limit: Optional[int] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    qa_detect_lines: Optional[int] = None
    qa_min_markers: Optional[int] = None
    token_expire_hours: Optional[int] = None
