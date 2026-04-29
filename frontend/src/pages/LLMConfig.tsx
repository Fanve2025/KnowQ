import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, App, Tag, Popconfirm, InputNumber, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons'
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

export default function LLMConfigPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<LLMConfig | null>(null)
  const [form] = Form.useForm()
  const [testing, setTesting] = useState<string | null>(null)
  const { message } = App.useApp()

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
    form.setFieldsValue({
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
    })
    setModalOpen(true)
  }

  const handleEdit = (record: LLMConfig) => {
    setEditItem(record)
    let params = {}
    try { params = JSON.parse(record.params_json) } catch { }
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      model_name: record.model_name,
      api_key: '',
      base_url: record.endpoint || PROVIDER_DEFAULTS[record.provider]?.baseUrl || '',
      temperature: (params as any).temperature ?? 0.7,
      max_tokens: (params as any).max_tokens ?? 4096,
      top_p: (params as any).top_p ?? 1,
      is_default: record.is_default,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const params_json = JSON.stringify({
        temperature: values.temperature,
        max_tokens: values.max_tokens,
        top_p: values.top_p,
      })
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
      <Modal title={editItem ? '编辑大模型配置' : '新增大模型配置'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：DeepSeek-V3" />
          </Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select placeholder="请选择提供商" onChange={handleProviderChange}>
              {PROVIDERS.map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="model_name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="如：deepseek-chat" />
          </Form.Item>
          <Form.Item name="base_url" label="API Base URL">
            <Input placeholder="选择提供商后自动填充，也可手动修改" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" extra={editItem ? '留空则不修改' : ''}>
            <Input.Password placeholder="请输入API Key" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="temperature" label="Temperature" tooltip="控制输出随机性，0=确定性，2=高随机性。推荐：0.3(代码) 0.7(对话)">
              <InputNumber min={0} max={2} step={0.1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="max_tokens" label="Max Tokens" tooltip="最大输出Token数。推荐：1024(简答) 4096(详答) 8192+(长文)">
              <InputNumber min={1} max={128000} step={256} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="top_p" label="Top P" tooltip="核采样阈值，与Temperature配合使用。推荐：0.9(默认) 1.0(不限制)">
              <InputNumber min={0} max={1} step={0.05} style={{ width: 140 }} />
            </Form.Item>
          </Space>
          <Form.Item name="is_default" label="设为默认" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
