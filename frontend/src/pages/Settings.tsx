import { useState, useEffect } from 'react'
import { Card, Descriptions, Tag, App, Row, Col, Divider, Form, InputNumber, Button, Spin, Tabs, Tooltip, Input } from 'antd'
import {
  DatabaseOutlined, CloudServerOutlined, UserOutlined,
  RobotOutlined, BookOutlined, SettingOutlined, ApiOutlined,
  SearchOutlined, GlobalOutlined, SafetyCertificateOutlined,
  SaveOutlined, UndoOutlined, QuestionCircleOutlined,
} from '@ant-design/icons'
import api from '../services/api'

interface SettingsData {
  id: string
  rule_threshold: number
  rule_secondary_threshold: number
  rule_secondary_top_n: number
  bm25_k1: number
  bm25_b: number
  question_bonus_weight: number
  substring_full_match_score: number
  substring_partial_match_score: number
  substring_segment_score: number
  ai_top_k: number
  ai_history_limit: number
  chunk_size: number
  chunk_overlap: number
  qa_detect_lines: number
  qa_min_markers: number
  token_expire_hours: number
}

const defaultSettings: SettingsData = {
  id: '',
  rule_threshold: 0.12,
  rule_secondary_threshold: 0.05,
  rule_secondary_top_n: 3,
  bm25_k1: 1.5,
  bm25_b: 0.75,
  question_bonus_weight: 2.0,
  substring_full_match_score: 1.0,
  substring_partial_match_score: 0.8,
  substring_segment_score: 0.3,
  ai_top_k: 5,
  ai_history_limit: 10,
  chunk_size: 512,
  chunk_overlap: 50,
  qa_detect_lines: 20,
  qa_min_markers: 2,
  token_expire_hours: 24,
}

export default function Settings() {
  const [stats, setStats] = useState<any>({})
  const [llmCount, setLlmCount] = useState(0)
  const [searchCount, setSearchCount] = useState(0)
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { message } = App.useApp()

  useEffect(() => {
    api.get('/stats/dashboard').then(res => setStats(res.data)).catch(() => {})
    api.get('/admin/llm-config').then(res => setLlmCount(res.data.length)).catch(() => {})
    api.get('/admin/search-config').then(res => setSearchCount(res.data.length)).catch(() => {})
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/settings')
      setSettings(res.data)
      form.setFieldsValue(res.data)
    } catch {
      form.setFieldsValue(defaultSettings)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await api.put('/admin/settings', values)
      setSettings(values)
      message.success('设置保存成功')
    } catch {
      message.error('保存失败')
    }
    setSaving(false)
  }

  const handleReset = () => {
    form.setFieldsValue(defaultSettings)
  }

  const systemInfo = [
    { label: '平台名称', value: 'KnowQ 智答星' },
    { label: '版本号', value: 'v1.0.0' },
    { label: '品牌', value: '凡维科技' },
    { label: '后端框架', value: 'FastAPI + Uvicorn' },
    { label: '前端框架', value: 'React + TypeScript + Ant Design' },
    { label: '数据库', value: 'SQLite (aiosqlite)' },
    { label: '后端端口', value: '6428' },
    { label: '前端端口', value: '2428' },
  ]

  const resourceCards = [
    { label: '知识库', value: stats.kb_count || 0, icon: <BookOutlined />, color: '#6366f1' },
    { label: '问答系统', value: stats.system_count || 0, icon: <RobotOutlined />, color: '#06b6d4' },
    { label: '用户数', value: stats.user_count || 0, icon: <UserOutlined />, color: '#10b981' },
    { label: '文档数', value: stats.doc_count || 0, icon: <DatabaseOutlined />, color: '#8b5cf6' },
    { label: 'LLM配置', value: llmCount, icon: <ApiOutlined />, color: '#f59e0b' },
    { label: '搜索配置', value: searchCount, icon: <SearchOutlined />, color: '#ef4444' },
  ]

  const supportedProviders = [
    'Anthropic', 'OpenAI', 'Google', 'xAI', 'DeepSeek',
    'Kimi', '智谱AI', 'Minimax', '阿里云', '硅基流动',
    '无问芯穹', '模力方舟', '自定义',
  ]

  const renderTooltip = (text: string) => (
    <Tooltip title={text}>
      <QuestionCircleOutlined style={{ color: 'var(--text-secondary)', marginLeft: 4, fontSize: 12 }} />
    </Tooltip>
  )

  const ruleModeItems = [
    { key: 'rule_threshold', label: '匹配阈值', tooltip: 'BM25+问题加分+子串匹配的总分阈值，高于此值才返回精确匹配结果', min: 0, max: 1, step: 0.01 },
    { key: 'rule_secondary_threshold', label: '次优阈值', tooltip: '低于主阈值但高于此值时返回"可能相关"结果', min: 0, max: 1, step: 0.01 },
    { key: 'rule_secondary_top_n', label: '次优返回数', tooltip: '次优匹配时最多返回的结果条数', min: 1, max: 10, step: 1 },
    { key: 'bm25_k1', label: 'BM25 k1参数', tooltip: 'BM25词频饱和参数，控制词频对评分的影响程度，越大则高频词权重越高', min: 0.1, max: 5, step: 0.1 },
    { key: 'bm25_b', label: 'BM25 b参数', tooltip: 'BM25文档长度归一化参数，控制文档长度对评分的影响，越大则长文档惩罚越重', min: 0, max: 1, step: 0.05 },
    { key: 'question_bonus_weight', label: '问题加分权重', tooltip: '当知识条目有问题字段时，问题token重叠率的加权系数', min: 0, max: 5, step: 0.1 },
    { key: 'substring_full_match_score', label: '子串完全包含加分', tooltip: '当知识条目的问题完全包含在用户输入中时的加分值', min: 0, max: 3, step: 0.1 },
    { key: 'substring_partial_match_score', label: '子串部分包含加分', tooltip: '当用户输入完全包含在知识条目问题中时的加分值', min: 0, max: 3, step: 0.1 },
    { key: 'substring_segment_score', label: '中文片段匹配加分', tooltip: '用户输入中每个2字以上中文片段出现在内容中时的加分值', min: 0, max: 1, step: 0.05 },
  ]

  const aiModeItems = [
    { key: 'ai_top_k', label: '知识检索Top-K', tooltip: 'AI模式从知识库检索的最相关条目数量', min: 1, max: 20, step: 1 },
    { key: 'ai_history_limit', label: '历史消息限制', tooltip: '发送给LLM的历史对话消息条数上限', min: 0, max: 30, step: 1 },
  ]

  const docImportItems = [
    { key: 'chunk_size', label: '分块大小(字符)', tooltip: '文档分块时每块的字符数，值越大每块包含内容越多', min: 100, max: 2000, step: 50 },
    { key: 'chunk_overlap', label: '分块重叠(字符)', tooltip: '相邻分块之间重叠的字符数，确保上下文不丢失', min: 0, max: 500, step: 10 },
    { key: 'qa_detect_lines', label: '问答检测行数', tooltip: '自动检测问答对格式时扫描的行数范围', min: 5, max: 50, step: 1 },
    { key: 'qa_min_markers', label: '最少问答标记数', tooltip: '检测范围内至少包含的问答标记数量才判定为问答对格式', min: 1, max: 10, step: 1 },
  ]

  const systemItems = [
    { key: 'token_expire_hours', label: 'Token过期时间(小时)', tooltip: 'JWT Token的有效时长，过期后需重新登录', min: 1, max: 168, step: 1 },
  ]

  const renderSettingGroup = (items: typeof ruleModeItems) => (
    <Row gutter={[16, 12]}>
      {items.map(item => (
        <Col xs={24} sm={12} lg={8} key={item.key}>
          <Form.Item name={item.key} label={<span>{item.label}{renderTooltip(item.tooltip)}</span>}>
            <InputNumber
              min={item.min}
              max={item.max}
              step={item.step}
              style={{ width: '100%' }}
              decimalSeparator="."
            />
          </Form.Item>
        </Col>
      ))}
    </Row>
  )

  return (
    <div>
      <div className="page-header">
        <h2>系统设置</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {resourceCards.map((c, i) => (
          <Col xs={12} sm={8} lg={4} key={i}>
            <div className="stat-card" style={{ padding: '18px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{c.label}</div>
                </div>
                <div style={{ fontSize: 24, color: c.color, opacity: 0.6 }}>{c.icon}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Tabs
        defaultActiveKey="config"
        items={[
          {
            key: 'config',
            label: '参数配置',
            children: (
              <Spin spinning={loading}>
                <Form form={form} layout="vertical">
                  <div className="content-card" style={{ padding: 24, marginBottom: 16 }}>
                    <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SearchOutlined style={{ color: 'var(--primary)' }} /> 规则模式参数
                    </h3>
                    {renderSettingGroup(ruleModeItems)}
                  </div>

                  <div className="content-card" style={{ padding: 24, marginBottom: 16 }}>
                    <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <RobotOutlined style={{ color: 'var(--primary)' }} /> AI模式参数
                    </h3>
                    {renderSettingGroup(aiModeItems)}
                  </div>

                  <div className="content-card" style={{ padding: 24, marginBottom: 16 }}>
                    <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DatabaseOutlined style={{ color: 'var(--primary)' }} /> 文档导入参数
                    </h3>
                    {renderSettingGroup(docImportItems)}
                  </div>

                  <div className="content-card" style={{ padding: 24, marginBottom: 16 }}>
                    <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SafetyCertificateOutlined style={{ color: 'var(--primary)' }} /> 系统参数
                    </h3>
                    {renderSettingGroup(systemItems)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <Button icon={<UndoOutlined />} onClick={handleReset}>恢复默认</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存设置</Button>
                  </div>
                </Form>
              </Spin>
            ),
          },
          {
            key: 'info',
            label: '系统信息',
            children: (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <div className="content-card" style={{ padding: 24 }}>
                      <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CloudServerOutlined style={{ color: 'var(--primary)' }} /> 系统信息
                      </h3>
                      <Descriptions column={1} size="small" bordered>
                        {systemInfo.map(item => (
                          <Descriptions.Item key={item.label} label={item.label}>{item.value}</Descriptions.Item>
                        ))}
                      </Descriptions>
                    </div>
                  </Col>

                  <Col xs={24} lg={12}>
                    <div className="content-card" style={{ padding: 24 }}>
                      <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SettingOutlined style={{ color: 'var(--primary)' }} /> AI引擎配置
                      </h3>
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RobotOutlined /> AI模式引擎</span>}>
                          LLM Gateway (OpenAI兼容协议)
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SearchOutlined /> 规则模式引擎</span>}>
                          BM25 + jieba分词 + 同义词扩展
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GlobalOutlined /> 联网搜索</span>}>
                          Tavily Search API
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DatabaseOutlined /> 文档解析</span>}>
                          PyMuPDF + python-docx + markdown
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SettingOutlined /> 文本分块</span>}>
                          {settings.chunk_size}字符/块, {settings.chunk_overlap}字符重叠
                        </Descriptions.Item>
                        <Descriptions.Item label={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SafetyCertificateOutlined /> 认证方式</span>}>
                          JWT (HS256, {settings.token_expire_hours}h过期)
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  </Col>
                </Row>

                <div className="content-card" style={{ padding: 24, marginTop: 16 }}>
                  <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ApiOutlined style={{ color: 'var(--primary)' }} /> 支持的LLM提供商
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {supportedProviders.map(p => (
                      <Tag key={p} color="purple" style={{ margin: 0, fontSize: 13, padding: '4px 12px' }}>{p}</Tag>
                    ))}
                  </div>
                </div>

                <div className="content-card" style={{ padding: 24, marginTop: 16 }}>
                  <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DatabaseOutlined style={{ color: 'var(--primary)' }} /> 文档导入说明
                  </h3>
                  <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="支持格式">TXT、PDF、Word(.docx)、Markdown</Descriptions.Item>
                    <Descriptions.Item label="分块策略">
                      自动检测文档格式：若为问答对格式（Q:/A:或问：/答：），按问答对解析；
                      否则按固定字符数分块（{settings.chunk_size}字符/块，{settings.chunk_overlap}字符重叠）
                    </Descriptions.Item>
                    <Descriptions.Item label="问答对识别">
                      自动检测前{settings.qa_detect_lines}行中是否包含{settings.qa_min_markers}个以上问答标记（Q:/A:/问：/答：/问题：/答案：），
                      若满足则按问答对逐条解析入库
                    </Descriptions.Item>
                    <Descriptions.Item label="文本分块逻辑">
                      每块默认{settings.chunk_size}字符，相邻块之间有{settings.chunk_overlap}字符重叠，确保上下文不丢失。
                      分块按字符位置顺序切割，不按句子边界切割
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
