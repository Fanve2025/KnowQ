import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, App, Popconfirm, InputNumber, Switch, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons'
import api from '../services/api'

interface SearchConfigItem {
  id: string
  name: string
  provider: string
  api_key_encrypted: string | null
  max_results: number
  summary_length: number
  is_enabled_global: boolean
}

export default function SearchConfigPage() {
  const [configs, setSearchConfigs] = useState<SearchConfigItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<SearchConfigItem | null>(null)
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const [providers, setProviders] = useState<any[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/search-config')
      setSearchConfigs(res.data)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  const loadProviders = async () => {
    try {
      const res = await api.get('/admin/search-config/providers')
      setProviders(res.data.providers || [])
    } catch { }
  }

  useEffect(() => { load(); loadProviders() }, [])

  const handleCreate = () => {
    setEditItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: SearchConfigItem) => {
    setEditItem(record)
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      api_key: '',
      max_results: record.max_results,
      summary_length: record.summary_length,
      is_enabled_global: record.is_enabled_global,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editItem) {
        await api.put(`/admin/search-config/${editItem.id}`, values)
        message.success('更新成功')
      } else {
        await api.post('/admin/search-config', values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch { }
  }

  const handleToggleGlobal = async (record: SearchConfigItem) => {
    try {
      await api.put(`/admin/search-config/${record.id}`, {
        is_enabled_global: !record.is_enabled_global,
      })
      message.success(record.is_enabled_global ? '已关闭全局启用' : '已开启全局启用')
      load()
    } catch { message.error('操作失败') }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/search-config/${id}`)
      message.success('删除成功')
      load()
    } catch { message.error('删除失败') }
  }

  const handleTest = async (id: string) => {
    try {
      const res = await api.post(`/admin/search-config/${id}/test`)
      if (res.data.success) {
        message.success('搜索测试成功')
      } else {
        message.error(`搜索失败: ${res.data.message}`)
      }
    } catch (err: any) {
      message.error('测试失败')
    }
  }

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag color="purple">{p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Tavily'}</Tag>,
    },
    {
      title: 'API Key',
      dataIndex: 'api_key_encrypted',
      key: 'api_key',
      render: (v: string) => v ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>,
    },
    { title: '最大结果数', dataIndex: 'max_results', key: 'max_results', width: 100 },
    { title: '摘要长度', dataIndex: 'summary_length', key: 'summary_length', width: 100 },
    {
      title: '全局启用',
      dataIndex: 'is_enabled_global',
      key: 'is_enabled_global',
      width: 100,
      render: (v: boolean, record: SearchConfigItem) => (
        <Switch checked={v} onChange={() => handleToggleGlobal(record)} checkedChildren="启用" unCheckedChildren="停用" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: SearchConfigItem) => (
        <Space>
          <Button size="small" icon={<ApiOutlined />} onClick={() => handleTest(record.id)}>测试</Button>
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
        <h2>搜索管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增配置</Button>
      </div>
      <div className="content-card">
        <Table dataSource={configs} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </div>
      <Modal title={editItem ? '编辑搜索配置' : '新增搜索配置'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：Tavily默认配置" />
          </Form.Item>
          <Form.Item name="provider" label="搜索提供商" rules={[{ required: true, message: '请选择提供商' }]} initialValue="tavily">
            <Select placeholder="请选择搜索提供商">
              {providers.map((p: any) => (
                <Select.Option key={p.key} value={p.key}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="api_key" label="API Key" extra={editItem ? '留空则不修改' : ''}>
            <Input.Password placeholder="请输入API Key" />
          </Form.Item>
          <Form.Item name="max_results" label="最大搜索结果数" initialValue={5}>
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="summary_length" label="摘要长度" initialValue={500}>
            <InputNumber min={100} max={2000} step={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_enabled_global" label="全局启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
