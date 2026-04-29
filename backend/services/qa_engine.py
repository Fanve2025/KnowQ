import json
import math
import re
from typing import List, Dict, Tuple, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import QASystem, KnowledgeEntry, KnowledgeBase, LLMConfig, SearchConfig, SystemSettings
from services.llm_gateway import LLMGateway
from services.search import SearchClient
from auth import decrypt_api_key


async def get_system_settings(db: AsyncSession) -> SystemSettings:
    result = await db.execute(select(SystemSettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = SystemSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


class AIEngine:
    def __init__(self, db: AsyncSession, system: QASystem):
        self.db = db
        self.system = system
        self.kb_ids = json.loads(system.kb_ids) if system.kb_ids else []

    async def _get_kb_name_map(self) -> Dict[str, str]:
        if not self.kb_ids:
            return {}
        result = await self.db.execute(
            select(KnowledgeBase.id, KnowledgeBase.name).where(
                KnowledgeBase.id.in_(self.kb_ids),
                KnowledgeBase.status == "active"
            )
        )
        return {row[0]: row[1] for row in result.all()}

    async def _get_kb_entries(self) -> List[KnowledgeEntry]:
        if not self.kb_ids:
            return []
        active_kb_result = await self.db.execute(
            select(KnowledgeBase.id).where(
                KnowledgeBase.id.in_(self.kb_ids),
                KnowledgeBase.status == "active"
            )
        )
        active_kb_ids = [row[0] for row in active_kb_result.all()]
        if not active_kb_ids:
            return []
        result = await self.db.execute(
            select(KnowledgeEntry).where(KnowledgeEntry.kb_id.in_(active_kb_ids))
        )
        return list(result.scalars().all())

    async def _get_llm_gateway(self) -> LLMGateway:
        if not self.system.llm_config_id:
            result = await self.db.execute(
                select(LLMConfig).where(LLMConfig.is_default == True)
            )
            config = result.scalar_one_or_none()
        else:
            result = await self.db.execute(
                select(LLMConfig).where(LLMConfig.id == self.system.llm_config_id)
            )
            config = result.scalar_one_or_none()

        if not config:
            result = await self.db.execute(select(LLMConfig).limit(1))
            config = result.scalar_one_or_none()

        if not config:
            raise ValueError("未配置大模型，请先在管理后台配置LLM")

        return LLMGateway(config)

    async def _get_search_client(self) -> SearchClient:
        if self.system.search_config_id:
            result = await self.db.execute(
                select(SearchConfig).where(SearchConfig.id == self.system.search_config_id)
            )
        else:
            result = await self.db.execute(
                select(SearchConfig).where(SearchConfig.is_enabled_global == True).limit(1)
            )
        config = result.scalar_one_or_none()
        if not config:
            raise ValueError("未配置联网搜索，请先在管理后台配置并全局启用")
        return SearchClient(config)

    def _simple_search(self, question: str, entries: List[KnowledgeEntry], top_k: int = 5) -> List[KnowledgeEntry]:
        scored = []
        q_words = set(re.findall(r'[\w]+', question.lower()))

        for entry in entries:
            text = ((entry.question or "") + " " + entry.content).lower()
            text_words = set(re.findall(r'[\w]+', text))
            overlap = len(q_words & text_words)
            if overlap > 0:
                score = overlap / max(len(q_words), 1)
                scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:top_k]]

    async def process(self, question: str, history: List[Dict]) -> Tuple[str, str, List[Dict]]:
        settings = await get_system_settings(self.db)
        gateway = await self._get_llm_gateway()
        entries = await self._get_kb_entries()
        kb_name_map = await self._get_kb_name_map()

        matched = self._simple_search(question, entries, top_k=settings.ai_top_k)
        kb_context = ""
        if matched:
            kb_context = "\n\n".join([
                f"[知识条目{i+1}]" + (f" 问题：{e.question}" if e.question else "") + f"\n内容：{e.content}"
                for i, e in enumerate(matched)
            ])

        system_prompt = self.system.system_prompt or (
            "你是一个智能助手。首先判断用户问题是否与提供的知识库内容相关。\n"
            "如果相关，请严格基于知识库内容回答，在回答末尾标注「基于知识库生成」。\n"
            "如果不相关，请回复 '__USE_SEARCH__'。"
        )

        messages = [{"role": "system", "content": system_prompt}]
        if kb_context:
            messages.append({"role": "system", "content": f"知识库内容：\n{kb_context}"})
        for h in history[-settings.ai_history_limit:]:
            messages.append(h)
        messages.append({"role": "user", "content": question})

        response = await gateway.generate(messages)

        if "__USE_SEARCH__" in response and self.system.enable_web_search:
            try:
                search_client = await self._get_search_client()
                search_results = await search_client.search(question)
                search_context = "\n\n".join([
                    f"[搜索结果{i+1}] {r['title']}\n{r['content']}\n来源：{r['url']}"
                    for i, r in enumerate(search_results)
                ])

                search_messages = [
                    {"role": "system", "content": "你是一个智能助手。请基于以下联网搜索结果，用自然语言回答用户的问题。在回答末尾标注「基于联网搜索结果生成」。"},
                    {"role": "system", "content": f"搜索结果：\n{search_context}"},
                ]
                for h in history[-settings.ai_history_limit:]:
                    search_messages.append(h)
                search_messages.append({"role": "user", "content": question})

                response = await gateway.generate(search_messages)
                references = [
                    {"title": r["title"], "url": r["url"]}
                    for r in search_results if r.get("url")
                ]
                return response, "web", references
            except Exception as e:
                return f"联网搜索失败：{str(e)}", "web_error", []

        source = "kb" if matched else "llm"
        references = []
        if matched:
            for e in matched[:3]:
                ref = {"title": e.source_doc or "知识库条目"}
                if e.question:
                    ref["question"] = e.question
                if e.kb_id in kb_name_map:
                    ref["kb_name"] = kb_name_map[e.kb_id]
                references.append(ref)

        return response, source, references

    async def process_stream(self, question: str, history: List[Dict]) -> AsyncGenerator[Dict, None]:
        settings = await get_system_settings(self.db)
        gateway = await self._get_llm_gateway()
        entries = await self._get_kb_entries()
        kb_name_map = await self._get_kb_name_map()

        matched = self._simple_search(question, entries, top_k=settings.ai_top_k)
        kb_context = ""
        if matched:
            kb_context = "\n\n".join([
                f"[知识条目{i+1}]" + (f" 问题：{e.question}" if e.question else "") + f"\n内容：{e.content}"
                for i, e in enumerate(matched)
            ])

        system_prompt = self.system.system_prompt or (
            "你是一个智能助手。请基于提供的知识库内容回答用户的问题。\n"
            "如果知识库中没有相关内容，请根据你的知识回答，并标注「此回答非基于知识库」。\n"
            "如果基于知识库内容回答，在回答末尾标注「基于知识库生成」。"
        )

        messages = [{"role": "system", "content": system_prompt}]
        if kb_context:
            messages.append({"role": "system", "content": f"知识库内容：\n{kb_context}"})
        for h in history[-settings.ai_history_limit:]:
            messages.append(h)
        messages.append({"role": "user", "content": question})

        source = "kb" if matched else "llm"
        references = []
        if matched:
            for e in matched[:3]:
                ref = {"title": e.source_doc or "知识库条目"}
                if e.question:
                    ref["question"] = e.question
                if e.kb_id in kb_name_map:
                    ref["kb_name"] = kb_name_map[e.kb_id]
                references.append(ref)

        yield {"type": "source", "source": source, "references": references}

        full_answer = ""
        async for chunk in gateway.generate_stream(messages):
            full_answer += chunk
            yield {"type": "content", "content": chunk}

        yield {"type": "done", "answer": full_answer}


STOP_WORDS = {'吗', '呢', '啊', '吧', '呀', '的', '了', '是', '在', '有', '和', '与',
              '或', '都', '也', '还', '就', '要', '会', '能', '可以', '怎么', '什么',
              '如何', '哪', '哪个', '哪些', '多少', '几', '请', '想', '问', '知道',
              '一下', '嗯', '哦', '哈', '嘛', '啦', '呗', '嘞'}

SYNONYM_MAP = {
    '上班': ['工作', '打卡', '考勤', '出勤'],
    '下班': ['下班时间'],
    '年假': ['年休', '休假', '假期', '放假'],
    '报销': ['费用', '经费', '花费'],
    '密码': ['口令', '密钥'],
    '账号': ['账户', '用户名'],
    '登录': ['登陆', '登入', '签到'],
    '配置': ['设置', '设定', '参数'],
    '删除': ['移除', '清除', '去掉'],
    '创建': ['新建', '添加', '增加'],
    '修改': ['编辑', '更改', '变更'],
    '查看': ['浏览', '看'],
    '搜索': ['查找', '检索', '寻找'],
    '导入': ['上传', '载入'],
    '导出': ['下载', '输出'],
    '部署': ['安装', '上线'],
    '架构': ['结构', '框架', '技术栈'],
}


class RuleEngine:
    def __init__(self, db: AsyncSession, system: QASystem):
        self.db = db
        self.system = system
        self.kb_ids = json.loads(system.kb_ids) if system.kb_ids else []
        self.threshold = 0.12
        self.secondary_threshold = 0.05
        self.secondary_top_n = 3
        self.bm25_k1 = 1.5
        self.bm25_b = 0.75
        self.question_bonus_weight = 2.0
        self.substring_full_match_score = 1.0
        self.substring_partial_match_score = 0.8
        self.substring_segment_score = 0.3

    async def _get_kb_name_map(self) -> Dict[str, str]:
        if not self.kb_ids:
            return {}
        result = await self.db.execute(
            select(KnowledgeBase.id, KnowledgeBase.name).where(
                KnowledgeBase.id.in_(self.kb_ids),
                KnowledgeBase.status == "active"
            )
        )
        return {row[0]: row[1] for row in result.all()}

    async def _get_entries(self) -> List[KnowledgeEntry]:
        if not self.kb_ids:
            return []
        active_kb_result = await self.db.execute(
            select(KnowledgeBase.id).where(
                KnowledgeBase.id.in_(self.kb_ids),
                KnowledgeBase.status == "active"
            )
        )
        active_kb_ids = [row[0] for row in active_kb_result.all()]
        if not active_kb_ids:
            return []
        result = await self.db.execute(
            select(KnowledgeEntry).where(KnowledgeEntry.kb_id.in_(active_kb_ids))
        )
        return list(result.scalars().all())

    def _tokenize(self, text: str) -> List[str]:
        try:
            import jieba
            tokens = list(jieba.cut(text.lower()))
        except ImportError:
            tokens = re.findall(r'[\w]+', text.lower())
        return [t.strip() for t in tokens if t.strip()]

    def _expand_query(self, question: str) -> List[str]:
        tokens = self._tokenize(question)
        expanded = set(tokens)
        for token in tokens:
            if token in SYNONYM_MAP:
                for syn in SYNONYM_MAP[token]:
                    expanded.add(syn.lower())
            for key, syns in SYNONYM_MAP.items():
                if token in syns:
                    expanded.add(key.lower())
                    for s in syns:
                        expanded.add(s.lower())
        return [t for t in expanded if t not in STOP_WORDS or len(t) > 1]

    def _compute_bm25_score(self, query_tokens: List[str], doc_tokens: List[str],
                            avgdl: float, doc_freq: Dict[str, int], N: int) -> float:
        k1 = self.bm25_k1
        b = self.bm25_b
        score = 0.0
        dl = len(doc_tokens)
        for qt in query_tokens:
            if qt not in doc_freq:
                continue
            df = doc_freq[qt]
            idf = math.log((N - df + 0.5) / (df + 0.5) + 1)
            tf = doc_tokens.count(qt)
            tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
            score += idf * tf_norm
        return score

    def _compute_question_bonus(self, query_tokens: List[str], entry: KnowledgeEntry) -> float:
        if not entry.question:
            return 0.0
        q_tokens = set(self._tokenize(entry.question))
        q_set = set(query_tokens)
        overlap = len(q_set & q_tokens)
        if overlap == 0:
            return 0.0
        return (overlap / max(len(q_set), 1)) * self.question_bonus_weight

    def _substring_match(self, question: str, entry: KnowledgeEntry) -> float:
        score = 0.0
        q_lower = question.lower()
        if entry.question and entry.question.lower() in q_lower:
            score += self.substring_full_match_score
        if entry.question and q_lower in entry.question.lower():
            score += self.substring_partial_match_score
        content_lower = entry.content.lower()
        for seg in re.findall(r'[\u4e00-\u9fff]{2,}', question):
            if seg.lower() in content_lower:
                score += self.substring_segment_score
        return score

    async def process(self, question: str) -> Tuple[str, str, List[Dict]]:
        settings = await get_system_settings(self.db)
        self.threshold = settings.rule_threshold
        self.secondary_threshold = settings.rule_secondary_threshold
        self.secondary_top_n = settings.rule_secondary_top_n
        self.bm25_k1 = settings.bm25_k1
        self.bm25_b = settings.bm25_b
        self.question_bonus_weight = settings.question_bonus_weight
        self.substring_full_match_score = settings.substring_full_match_score
        self.substring_partial_match_score = settings.substring_partial_match_score
        self.substring_segment_score = settings.substring_segment_score

        entries = await self._get_entries()
        if not entries:
            return "未找到相关内容，请尝试其他关键词。", "rule_none", []

        kb_name_map = await self._get_kb_name_map()

        query_tokens = self._expand_query(question)

        doc_texts = []
        for entry in entries:
            text = (entry.question or "") + " " + entry.content
            doc_texts.append(self._tokenize(text))

        N = len(doc_texts)
        avgdl = sum(len(d) for d in doc_texts) / N if N > 0 else 1

        doc_freq = {}
        for doc in doc_texts:
            for token in set(doc):
                doc_freq[token] = doc_freq.get(token, 0) + 1

        scored = []
        for i, (doc_tokens, entry) in enumerate(zip(doc_texts, entries)):
            bm25_score = self._compute_bm25_score(query_tokens, doc_tokens, avgdl, doc_freq, N)
            question_bonus = self._compute_question_bonus(query_tokens, entry)
            substring_score = self._substring_match(question, entry)
            total = bm25_score + question_bonus + substring_score
            scored.append((total, i))

        scored.sort(key=lambda x: x[0], reverse=True)

        if scored and scored[0][0] > self.threshold:
            best_entry = entries[scored[0][1]]
            answer = best_entry.content
            if best_entry.question:
                answer = f"**问题：{best_entry.question}**\n\n{answer}"
            references = []
            ref = {}
            if best_entry.source_doc:
                ref["title"] = best_entry.source_doc
            if best_entry.kb_id in kb_name_map:
                ref["kb_name"] = kb_name_map[best_entry.kb_id]
            if ref:
                references.append(ref)
            return answer, "rule_match", references

        if scored and len(scored) >= 2 and scored[0][0] > self.secondary_threshold:
            top_entries = [entries[s[1]] for s in scored[:self.secondary_top_n] if s[0] > self.secondary_threshold]
            if top_entries:
                parts = []
                for idx, entry in enumerate(top_entries, 1):
                    part = f"【相关结果{idx}】"
                    if entry.question:
                        part += f"\n问题：{entry.question}"
                    part += f"\n{entry.content}"
                    parts.append(part)
                answer = "未找到完全匹配的内容，但以下信息可能对您有帮助：\n\n" + "\n\n---\n\n".join(parts)
                references = []
                for e in top_entries:
                    ref = {}
                    if e.source_doc:
                        ref["title"] = e.source_doc
                    if e.kb_id in kb_name_map:
                        ref["kb_name"] = kb_name_map[e.kb_id]
                    if ref:
                        references.append(ref)
                return answer, "rule_match", references

        return "未找到相关内容，请尝试其他关键词或换一种表述方式提问。", "rule_none", []
