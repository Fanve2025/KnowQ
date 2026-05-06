import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Space, App, Tag, Popconfirm, Switch } from 'antd'
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined, BookOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface KB {
  id: string
  name: string
  description: string
  entry_count: number
  doc_count: number
  status: string
  created_at: string
}

export default function KnowledgeBases() {
  const [kbs, setKbs] = useState<KB[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<KB | null>(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/kb', { params: { keyword } })
      setKbs(res.data)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = () => {
    setEditItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: KB) => {
    setEditItem(record)
    form.setFieldsValue({ name: record.name, description: record.description })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editItem) {
        await api.put(`/admin/kb/${editItem.id}`, values)
        message.success('更新成功')
      } else {
        await api.post('/admin/kb', values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch { }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/kb/${id}`)
      message.success('删除成功')
      load()
    } catch { message.error('删除失败') }
  }

  const handleToggleStatus = async (record: KB) => {
    try {
      await api.put(`/admin/kb/${record.id}`, {
        status: record.status === 'active' ? 'inactive' : 'active',
      })
      message.success('状态已更新')
      load()
    } catch { message.error('操作失败') }
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: KB) => (
        <a onClick={() => navigate(`/admin/knowledge/${record.id}`)} style={{ color: 'var(--primary)', fontWeight: 500 }}>
          <BookOutlined style={{ marginRight: 6 }} />{text}
        </a>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '条目数', dataIndex: 'entry_count', key: 'entry_count', width: 80 },
    { title: '文档数', dataIndex: 'doc_count', key: 'doc_count', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string, record: KB) => (
        <Switch
          checked={s === 'active'}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="启用"
          unCheckedChildren="停用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: KB) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>知识库管理</h2>
        <Space>
          <Input placeholder="搜索知识库" prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} onPressEnter={load} style={{ width: 200 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建知识库</Button>
        </Space>
      </div>
      <div className="content-card">
        <Table dataSource={kbs} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </div>
      <Modal title={editItem ? '编辑知识库' : '新建知识库'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入知识库名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
