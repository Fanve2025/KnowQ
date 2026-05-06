import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, App, Tag, Popconfirm, InputNumber, Switch, Collapse, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, QuestionCircleOutlined, MinusCircleOutlined } from '@ant-design/icons'
import api from '../services/api'

interface LLMConfig {
  id: string
  name: string
  provider: string
  model_name: string
  api_key_encrypted: string | null
  endpoint: string | null
  params_json: string
  is_default: boolean
}

const PROVIDERS = [
  'Anthropic', 'OpenAI', 'Google', 'xAI', 'DeepSeek',
  'Kimi', '智谱AI', 'Minimax', '阿里云', '硅基流动',
  '无问芯穹', '模力方舟', '自定义',
]

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; temperature: number; maxTokens: number; topP: number }> = {
  'OpenAI': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', temperature: 0.7, maxTokens: 4096, topP: 1 },
  'Anthropic': { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', temperature: 0.7, maxTokens: 4096, topP: 1 },
  'Google': { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', temperature: 0.7, maxTokens: 4096, topP: 1 },
  'xAI': { baseUrl: 'https://api.x.ai/v1', model: 'grok-3', temperature: 0.7, maxTokens: 4096, topP: 1 },
  'DeepSeek': { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temperature: 0.7, maxTokens: 4096, topP: 1 },
  'Kimi': { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', temperature: 0.7, maxTokens: 4096, topP: 1 },
  '智谱AI': { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', temperature: 0.7, maxTokens: 4096, topP: 1 },
  'Minimax': { baseUrl: 'https://api.minimax.chat/v1', model: 'MiniMax-Text-01', temperature: 0.7, maxTokens: 4096, topP: 1 },
  '阿里云': { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', temperature: 0.7, maxTokens: 4096, topP: 1 },
  '硅基流动': { baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct', temperature: 0.7, maxTokens: 4096, topP: 1 },
  '无问芯穹': { baseUrl: 'https://cloud.infini-ai.com/maas/v1', model: 'qwen2.5-7b-instruct', temperature: 0.7, maxTokens: 4096, topP: 1 },
  '模力方舟': { baseUrl: 'https://model-ark.cn-beijing.volces.com/v1', model: 'doubao-1.5-pro-32k', temperature: 0.7, maxTokens: 4096, topP: 1 },
  '自定义': { baseUrl: '', model: '', temperature: 0.7, maxTokens: 2048, topP: 1 },
}

interface CustomParam {
  key: string
  value: string
}

export default function LLMConfigPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<LLMConfig | null>(null)
  const [form] = Form.useForm()
  const [testing, setTesting] = useState<string | null>(null)
  const [customParams, setCustomParams] = useState<CustomParam[]>([])
  const { message } = App.useApp()

  const provider = Form.useWatch('provider', form)
  const enableThinking = Form.useWatch('enable_thinking', form)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/llm-config')
      setConfigs(res.data)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleProviderChange = (provider: string) => {
    const defaults = PROVIDER_DEFAULTS[provider]
    if (defaults) {
      form.setFieldsValue({
        base_url: defaults.baseUrl,
        model_name: defaults.model,
        temperature: defaults.temperature,
        max_tokens: defaults.maxTokens,
        top_p: defaults.topP,
      })
    }
  }

  const handleCreate = () => {
    setEditItem(null)
    form.resetFields()
    setCustomParams([])
    form.setFieldsValue({
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
      enable_thinking: false,
    })
    setModalOpen(true)
  }

  const handleEdit = (record: LLMConfig) => {
    setEditItem(record)
    let params: any = {}
    try { params = JSON.parse(record.params_json) } catch { }
    const builtInKeys = ['temperature', 'max_tokens', 'top_p', 'enable_thinking', 'thinking_budget', 'frequency_penalty', 'presence_penalty', 'stop']
    const custom: CustomParam[] = []
    for (const [k, v] of Object.entries(params)) {
      if (!builtInKeys.includes(k)) {
        custom.push({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) })
      }
    }
    setCustomParams(custom)
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      model_name: record.model_name,
      api_key: '',
      base_url: record.endpoint || PROVIDER_DEFAULTS[record.provider]?.baseUrl || '',
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 4096,
      top_p: params.top_p ?? 1,
      enable_thinking: params.enable_thinking ?? false,
      thinking_budget: params.thinking_budget,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
      stop: params.stop ? (Array.isArray(params.stop) ? params.stop.join(',') : params.stop) : undefined,
      is_default: record.is_default,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const params: any = {
        temperature: values.temperature,
        max_tokens: values.max_tokens,
        top_p: values.top_p,
      }
      if (values.enable_thinking) {
        params.enable_thinking = true
        if (values.thinking_budget) {
          params.thinking_budget = values.thinking_budget
        }
      }
      if (values.frequency_penalty != null) {
        params.frequency_penalty = values.frequency_penalty
      }
      if (values.presence_penalty != null) {
        params.presence_penalty = values.presence_penalty
      }
      if (values.stop) {
        params.stop = values.stop.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      for (const cp of customParams) {
        if (cp.key.trim()) {
          try {
            params[cp.key.trim()] = JSON.parse(cp.value)
          } catch {
            params[cp.key.trim()] = cp.value
          }
        }
      }
      const params_json = JSON.stringify(params)
      const payload = {
        name: values.name,
        provider: values.provider,
        model_name: values.model_name,
        api_key: values.api_key || undefined,
        endpoint: values.base_url || undefined,
        params_json,
        is_default: values.is_default,
      }
      if (editItem) {
        await api.put(`/admin/llm-config/${editItem.id}`, payload)
        message.success('更新成功')
      } else {
        await api.post('/admin/llm-config', payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch { }
  }

  const handleToggleDefault = async (record: LLMConfig) => {
    try {
      await api.put(`/admin/llm-config/${record.id}`, {
        is_default: !record.is_default,
      })
      message.success(record.is_default ? '已取消默认' : '已设为默认')
      load()
    } catch { message.error('操作失败') }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/llm-config/${id}`)
      message.success('删除成功')
      load()
    } catch { message.error('删除失败') }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const res = await api.post(`/admin/llm-config/${id}/test`)
      if (res.data.success) {
        message.success(`连接成功: ${res.data.message}`)
      } else {
        message.error(`连接失败: ${res.data.message}`)
      }
    } catch (err: any) {
      message.error('测试失败: ' + (err.response?.data?.detail || err.message))
    }
    setTesting(null)
  }

  const addCustomParam = () => {
    setCustomParams([...customParams, { key: '', value: '' }])
  }

  const removeCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index))
  }

  const updateCustomParam = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...customParams]
    updated[index] = { ...updated[index], [field]: val }
    setCustomParams(updated)
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag color="purple">{p}</Tag>,
    },
    { title: '模型', dataIndex: 'model_name', key: 'model_name' },
    {
      title: 'API Key',
      dataIndex: 'api_key_encrypted',
      key: 'api_key',
      render: (v: string) => v ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>,
    },
    {
      title: '参数',
      key: 'params',
      width: 160,
      render: (_: any, record: LLMConfig) => {
        try {
          const p = JSON.parse(record.params_json)
          const tags = []
          if (p.enable_thinking) tags.push(<Tag key="think" color="orange">思考</Tag>)
          if (p.temperature != null) tags.push(<Tag key="temp" color="blue">T:{p.temperature}</Tag>)
          if (p.frequency_penalty != null) tags.push(<Tag key="fp" color="cyan">FP:{p.frequency_penalty}</Tag>)
          if (p.presence_penalty != null) tags.push(<Tag key="pp" color="geekblue">PP:{p.presence_penalty}</Tag>)
          const builtinKeys = ['temperature', 'max_tokens', 'top_p', 'enable_thinking', 'thinking_budget', 'frequency_penalty', 'presence_penalty', 'stop']
          const customCount = Object.keys(p).filter(k => !builtinKeys.includes(k)).length
          if (customCount > 0) tags.push(<Tag key="custom" color="purple">+{customCount}自定义</Tag>)
          return tags.length > 0 ? <Space size={2} wrap>{tags}</Space> : <span style={{ color: '#999' }}>默认</span>
        } catch {
          return <span style={{ color: '#999' }}>默认</span>
        }
      },
    },
    {
      title: '默认',
      dataIndex: 'is_default',
      key: 'is_default',
      width: 80,
      render: (v: boolean, record: LLMConfig) => (
        <Switch checked={v} onChange={() => handleToggleDefault(record)} checkedChildren="默认" unCheckedChildren="普通" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: LLMConfig) => (
        <Space>
          <Button size="small" icon={<ApiOutlined />} loading={testing === record.id} onClick={() => handleTest(record.id)}>
            测试
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>大模型管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增配置</Button>
      </div>
      <div className="content-card">
        <Table dataSource={configs} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </div>
      <Modal
        title={editItem ? '编辑大模型配置' : '新增大模型配置'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={720}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="如：DeepSeek-V3" />
            </Form.Item>
            <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
              <Select placeholder="请选择提供商" onChange={handleProviderChange}>
                {PROVIDERS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="model_name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
              <Input placeholder="如：deepseek-chat" />
            </Form.Item>
            <Form.Item name="base_url" label="API Base URL">
              <Input placeholder="选择提供商后自动填充，也可手动修改" />
            </Form.Item>
          </div>
          <Form.Item name="api_key" label="API Key" extra={editItem ? '留空则不修改' : ''}>
            <Input.Password placeholder="请输入API Key" />
          </Form.Item>

          <Collapse
            defaultActiveKey={['basic']}
            size="small"
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'basic',
                label: '🔧 基础参数',
                children: (
                  <Space style={{ width: '100%' }} size="large" wrap>
                    <Form.Item name="temperature" label={
                      <Space size={4}>Temperature <Tooltip title="控制输出随机性，0=确定性，2=高随机性。推荐：0.3(代码) 0.7(对话)"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                    }>
                      <InputNumber min={0} max={2} step={0.1} style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item name="max_tokens" label={
                      <Space size={4}>Max Tokens <Tooltip title="最大输出Token数。推荐：1024(简答) 4096(详答) 8192+(长文)"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                    }>
                      <InputNumber min={1} max={128000} step={256} style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item name="top_p" label={
                      <Space size={4}>Top P <Tooltip title="核采样阈值，与Temperature配合使用。推荐：0.9(默认) 1.0(不限制)"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                    }>
                      <InputNumber min={0} max={1} step={0.05} style={{ width: 140 }} />
                    </Form.Item>
                  </Space>
                ),
              },
              {
                key: 'thinking',
                label: '🧠 思考模式',
                children: (
                  <>
                    <Form.Item name="enable_thinking" label="启用思考模式" valuePropName="checked" extra="开启后模型会先进行内部推理再给出回答，适用于复杂推理场景。支持Qwen3、DeepSeek-R1、Claude等模型的思考模式。">
                      <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                    </Form.Item>
                    {enableThinking && (
                      <Form.Item name="thinking_budget" label={
                        <Space size={4}>思考Token预算 <Tooltip title="模型用于内部思考的最大Token数，思考Token不计入max_tokens。推荐：1000-10000"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                      }>
                        <InputNumber min={100} max={100000} step={500} style={{ width: 200 }} placeholder="默认10000" />
                      </Form.Item>
                    )}
                  </>
                ),
              },
              {
                key: 'advanced',
                label: '⚙️ 高级参数',
                children: (
                  <>
                    <Space style={{ width: '100%' }} size="large" wrap>
                      <Form.Item name="frequency_penalty" label={
                        <Space size={4}>Frequency Penalty <Tooltip title="频率惩罚，-2.0到2.0。正值降低重复用词，负值增加重复。推荐：0(默认) 0.5(减少重复)"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                      }>
                        <InputNumber min={-2} max={2} step={0.1} style={{ width: 140 }} placeholder="0" />
                      </Form.Item>
                      <Form.Item name="presence_penalty" label={
                        <Space size={4}>Presence Penalty <Tooltip title="存在惩罚，-2.0到2.0。正值鼓励谈论新话题，负值偏向已出现的话题。推荐：0(默认) 0.6(增加多样性)"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                      }>
                        <InputNumber min={-2} max={2} step={0.1} style={{ width: 140 }} placeholder="0" />
                      </Form.Item>
                    </Space>
                    <Form.Item name="stop" label={
                      <Space size={4}>停止序列 <Tooltip title="模型遇到这些字符串时停止生成，多个用英文逗号分隔。如：\n,###,END"><QuestionCircleOutlined style={{ color: '#999' }} /></Tooltip></Space>
                    }>
                      <Input placeholder="多个用英文逗号分隔，如：\n,###,END" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'custom',
                label: '📝 自定义参数',
                children: (
                  <>
                    <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
                      添加模型API支持的自定义参数，将直接传递给API请求。值会尝试解析为JSON，解析失败则作为字符串传递。
                    </div>
                    {customParams.map((cp, index) => (
                      <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <Input
                          placeholder="参数名"
                          value={cp.key}
                          onChange={e => updateCustomParam(index, 'key', e.target.value)}
                          style={{ width: 180 }}
                        />
                        <Input
                          placeholder="参数值"
                          value={cp.value}
                          onChange={e => updateCustomParam(index, 'value', e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => removeCustomParam(index)}
                        />
                      </div>
                    ))}
                    <Button type="dashed" onClick={addCustomParam} block icon={<PlusOutlined />}>
                      添加自定义参数
                    </Button>
                  </>
                ),
              },
            ]}
          />

          <Form.Item name="is_default" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
