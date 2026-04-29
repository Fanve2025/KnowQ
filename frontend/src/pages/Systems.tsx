import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, App, Tag, Switch, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, EyeOutlined, SearchOutlined, CopyOutlined } from '@ant-design/icons'
import api from '../services/api'

interface System {
  id: string
  name: string
  description: string
  kb_ids: string
  mode: string
  llm_config_id: string | null
  search_config_id: string | null
  enable_web_search: boolean
  frontend_url: string | null
  status: string
  welcome_message: string
  system_prompt: string
  access_password: string | null
}

interface KBItem { id: string; name: string }
interface LLMItem { id: string; name: string; provider: string }
interface SearchItem { id: string; name: string }

export default function Systems() {
  const [systems, setSystems] = useState<System[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<System | null>(null)
  const [form] = Form.useForm()
  const [kbs, setKbs] = useState<KBItem[]>([])
  const [llms, setLlms] = useState<LLMItem[]>([])
  const [searchConfigs, setSearchConfigs] = useState<SearchItem[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/systems', { params: { keyword } })
      setSystems(res.data)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  const loadOptions = async () => {
    try {
      const [kbRes, llmRes, searchRes] = await Promise.all([
        api.get('/admin/kb'),
        api.get('/admin/llm-config'),
        api.get('/admin/search-config'),
      ])
      setKbs(kbRes.data)
      setLlms(llmRes.data)
      setSearchConfigs(searchRes.data)
    } catch { }
  }

  useEffect(() => { load(); loadOptions() }, [])

  const handleCreate = () => {
    setEditItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: System) => {
    setEditItem(record)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      kb_ids: JSON.parse(record.kb_ids || '[]'),
      mode: record.mode,
      llm_config_id: record.llm_config_id,
      search_config_id: record.search_config_id,
      enable_web_search: record.enable_web_search,
      welcome_message: record.welcome_message,
      system_prompt: record.system_prompt,
      access_password: record.access_password,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editItem) {
        await api.put(`/admin/systems/${editItem.id}`, values)
        message.success('更新成功')
      } else {
        await api.post('/admin/systems', values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch { }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/systems/${id}`)
      message.success('删除成功')
      load()
    } catch { message.error('删除失败') }
  }

  const handleToggleStatus = async (record: System) => {
    try {
      await api.put(`/admin/systems/${record.id}`, {
        status: record.status === 'active' ? 'inactive' : 'active',
      })
      message.success('状态已更新')
      load()
    } catch { message.error('操作失败') }
  }

  const handlePreview = (record: System) => {
    const url = record.frontend_url || `/qa/${record.id}`
    setPreviewUrl(url)
    setPreviewOpen(true)
  }

  const handleCopyUrl = (record: System) => {
    const url = `${window.location.origin}/qa/${record.id}`
    navigator.clipboard.writeText(url).then(() => {
      message.success('访问地址已复制')
    }).catch(() => {
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      message.success('访问地址已复制')
    })
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 140, ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      width: 90,
      render: (m: string) => <Tag color={m === 'ai' ? 'purple' : 'blue'}>{m === 'ai' ? 'AI模式' : '规则模式'}</Tag>,
    },
    {
      title: '联网搜索',
      dataIndex: 'enable_web_search',
      key: 'enable_web_search',
      width: 90,
      render: (v: boolean) => v ? <Tag color="green">已开启</Tag> : <Tag>未开启</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '访问地址',
      dataIndex: 'frontend_url',
      key: 'frontend_url',
      width: 200,
      ellipsis: true,
      render: (url: string, record: System) => (
        <Space size={4}>
          <a href={`/qa/${record.id}`} target="_blank" rel="noreferrer"><LinkOutlined /> 打开</a>
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleCopyUrl(record)} title="复制访问地址" />
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: System) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>预览</Button>
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
        <h2>问答系统管理</h2>
        <Space>
          <Input placeholder="搜索系统" prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} onPressEnter={load} style={{ width: 200 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>创建问答系统</Button>
        </Space>
      </div>
      <div className="content-card">
        <Table dataSource={systems} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
      </div>

      <Modal title={editItem ? '编辑问答系统' : '创建问答系统'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="系统名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入问答系统名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="kb_ids" label="关联知识库" rules={[{ required: true, message: '请选择知识库' }]}>
            <Select mode="multiple" placeholder="请选择知识库">
              {kbs.map(kb => <Select.Option key={kb.id} value={kb.id}>{kb.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="mode" label="运行模式" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="ai">AI模式（大模型驱动）</Select.Option>
              <Select.Option value="rule">规则模式（关键字匹配）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="llm_config_id" label="大模型配置">
            <Select placeholder="请选择LLM配置" allowClear>
              {llms.map(l => <Select.Option key={l.id} value={l.id}>{l.name} ({l.provider})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="search_config_id" label="联网搜索配置">
            <Select placeholder="请选择搜索配置" allowClear>
              {searchConfigs.map(s => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="enable_web_search" label="启用联网搜索" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="access_password" label="访问密码（可选）">
            <Input.Password placeholder="留空则无需密码" />
          </Form.Item>
          <Form.Item name="welcome_message" label="欢迎语">
            <Input.TextArea rows={2} placeholder="请输入欢迎语" />
          </Form.Item>
          <Form.Item name="system_prompt" label="系统提示词（AI模式）">
            <Input.TextArea rows={3} placeholder="自定义系统提示词，留空使用默认" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="预览问答系统" open={previewOpen} onCancel={() => setPreviewOpen(false)} width={800} footer={null}>
        <iframe src={previewUrl} style={{ width: '100%', height: 500, border: '1px solid var(--border)', borderRadius: 8 }} />
      </Modal>
    </div>
  )
}
