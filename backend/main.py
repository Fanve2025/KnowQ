from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import init_db, async_session
from models import User, LLMConfig, SearchConfig, KnowledgeBase, KnowledgeEntry, QASystem, SystemSettings
from auth import hash_password
import json


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_data()
    yield


app = FastAPI(
    title="KnowQ智答星AI知识库问答平台",
    description="AI知识库问答平台后端API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth, users, knowledge, systems, llm_config, search_config, stats, qa, logs, conversations, settings

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(knowledge.router)
app.include_router(systems.router)
app.include_router(llm_config.router)
app.include_router(search_config.router)
app.include_router(stats.router)
app.include_router(qa.router)
app.include_router(logs.router)
app.include_router(conversations.router)
app.include_router(settings.router)


async def seed_data():
    async with async_session() as db:
        from sqlalchemy import select

        settings_result = await db.execute(select(SystemSettings).limit(1))
        if not settings_result.scalar_one_or_none():
            default_settings = SystemSettings()
            db.add(default_settings)
            await db.commit()

        result = await db.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none():
            return

        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
            status="active",
        )
        db.add(admin)

        user1 = User(
            username="user1",
            password_hash=hash_password("user123"),
            role="user",
            status="active",
        )
        db.add(user1)

        user2 = User(
            username="user2",
            password_hash=hash_password("user123"),
            role="user",
            status="active",
        )
        db.add(user2)

        await db.commit()

        kb1 = KnowledgeBase(
            name="产品常见问题",
            description="KnowQ平台常见问题解答",
            created_by=admin.id,
            status="active",
        )
        db.add(kb1)

        kb2 = KnowledgeBase(
            name="技术文档库",
            description="系统技术文档和操作指南",
            created_by=admin.id,
            status="active",
        )
        db.add(kb2)

        kb3 = KnowledgeBase(
            name="公司规章制度",
            description="公司内部规章制度和流程",
            created_by=admin.id,
            status="active",
        )
        db.add(kb3)

        await db.commit()

        sample_entries = [
            (kb1.id, "q_a", "KnowQ是什么？", "KnowQ智答星是一款AI知识库问答平台，支持创建多个知识库，配置大模型与搜索策略，并一键生成面向最终用户的AI问答前端。系统支持AI模式和规则模式两种运行方式。"),
            (kb1.id, "q_a", "如何创建知识库？", "登录管理后台，在左侧导航栏点击「知识库管理」，然后点击「新建知识库」按钮，填写知识库名称和描述即可创建。创建后可以通过手动添加问答对或批量导入文档来充实知识库内容。"),
            (kb1.id, "q_a", "支持哪些文档格式？", "目前支持TXT、PDF、Word（.docx）、Markdown等常见文档格式。系统会自动解析文档内容并分块入库。"),
            (kb1.id, "q_a", "AI模式和规则模式有什么区别？", "AI模式由大模型主导，会先判断知识库中是否存在相关内容，存在则基于知识库生成回复，不存在则调用联网搜索获取信息。规则模式不依赖大模型，采用关键字匹配算法（BM25/TF-IDF），匹配成功返回知识库内容，匹配失败返回友好提示。"),
            (kb1.id, "q_a", "如何配置大模型？", "在管理后台的「大模型配置」页面，选择LLM提供商，填写API Key和模型名称，设置请求参数（温度、最大Token数等），然后点击测试连接验证配置是否可用。"),
            (kb1.id, "q_a", "支持哪些大模型提供商？", "内置支持Anthropic、OpenAI、Google、xAI、DeepSeek、Kimi、智谱AI、Minimax、阿里云、硅基流动、无问芯穹、模力方舟等13家提供商，同时支持自定义配置。"),
            (kb1.id, "q_a", "如何开启联网搜索？", "在「联网搜索配置」页面配置Tavily Search API密钥，然后在创建或编辑问答系统时开启联网搜索功能。AI模式下当知识库中无相关内容时会自动触发联网搜索。"),
            (kb1.id, "q_a", "问答系统如何生成？", "在管理后台的「问答系统管理」页面，点击「创建问答系统」，输入系统名称、选择关联知识库、选择运行模式，系统会自动生成唯一的前端访问地址。"),
            (kb1.id, "q_a", "数据统计看板包含哪些内容？", "包含知识库总数、文档总数、问答系统数、用户数、提问次数、知识库命中率、联网搜索触发次数等统计指标，支持按时间维度筛选，并提供可视化图表展示。"),
            (kb1.id, "q_a", "如何管理用户权限？", "管理员可以在「用户管理」页面创建新用户、分配角色（管理员/普通用户）、重置密码、启用/禁用账号。仅管理员角色能登录管理平台，普通用户仅能访问前端问答系统。"),

            (kb2.id, "q_a", "系统技术架构是什么？", "系统采用前后端分离架构，前端使用React + TypeScript，后端使用Python FastAPI，数据库使用SQLite，支持BM25全文检索和LLM网关统一适配。"),
            (kb2.id, "q_a", "如何部署系统？", "系统支持Docker容器化部署，也可以直接使用Python和Node.js运行。后端使用uvicorn启动FastAPI服务，前端使用Vite开发服务器或构建静态文件部署。"),
            (kb2.id, "q_a", "API接口如何鉴权？", "管理端API使用JWT Token鉴权，登录后获取Token，后续请求在Header中携带Authorization: Bearer <token>。前端问答API根据问答系统配置决定是否需要访问密码。"),
            (kb2.id, "q_a", "如何进行文档分块？", "文档导入时系统自动进行分块处理，默认分块大小为512字符，重叠50字符。对于问答对格式的文档（如Q:...A:...），系统会自动识别并按问答对解析。"),

            (kb3.id, "q_a", "公司上班时间是什么？", "公司标准上班时间为周一至周五 9:00-18:00，午休时间 12:00-13:00。弹性工作制下可在8:30-10:00之间打卡上班。"),
            (kb3.id, "q_a", "如何申请年假？", "员工入职满一年后享有5天年假，满五年10天，满十年15天。申请年假需提前3个工作日在OA系统提交申请，经直属领导审批后生效。"),
            (kb3.id, "q_a", "报销流程是什么？", "1. 收集相关票据和凭证；2. 在OA系统填写报销单，上传凭证照片；3. 提交至部门经理审批；4. 审批通过后转财务处理；5. 财务审核通过后5个工作日内打款。"),
            (kb3.id, "q_a", "IT技术支持如何联系？", "IT技术支持邮箱：it-support@company.com，内部电话：8888。工作时间：周一至周五 9:00-18:00。紧急问题可拨打24小时值班电话：13900001111。"),
        ]

        for kb_id, entry_type, question, content in sample_entries:
            entry = KnowledgeEntry(
                kb_id=kb_id,
                type=entry_type,
                question=question,
                content=content,
            )
            db.add(entry)

        await db.commit()

        qa_system1 = QASystem(
            name="产品智能助手",
            description="KnowQ产品常见问题AI问答系统",
            kb_ids=json.dumps([kb1.id, kb2.id]),
            mode="ai",
            enable_web_search=True,
            status="active",
            welcome_message="你好！我是KnowQ产品智能助手，可以回答关于产品功能、使用方法和技术架构的问题。请问有什么可以帮你的？",
        )
        db.add(qa_system1)
        await db.flush()

        qa_system2 = QASystem(
            name="公司制度问答",
            description="公司规章制度规则匹配问答系统",
            kb_ids=json.dumps([kb3.id]),
            mode="rule",
            enable_web_search=False,
            status="active",
            welcome_message="你好！我是公司制度问答助手，可以回答关于公司规章制度的问题。请输入你的问题：",
        )
        db.add(qa_system2)
        await db.flush()

        qa_system1.frontend_url = f"/qa/{qa_system1.id}"
        qa_system2.frontend_url = f"/qa/{qa_system2.id}"

        await db.commit()


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "KnowQ Backend"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=6428, reload=True)
