import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Table, Button, Modal, Form, Input, Space, App, Upload, Tabs, Tag, Popconfirm } from 'antd'
import { PlusOutlined, UploadOutlined, ArrowLeftOutlined, DeleteOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons'
import api from '../services/api'

interface Entry {
  id: string
  type: string
  question: string | null
  content: string
  source_doc: string | null
  created_at: string
}

export default function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [kb, setKb] = useState<any>({})
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Entry | null>(null)
  const [form] = Form.useForm()
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const { message } = App.useApp()

  const loadKb = async () => {
    try {
      const res = await api.get(`/admin/kb/${id}`)
      setKb(res.data)
    } catch { }
  }

  const loadEntries = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/kb/${id}/entries`)
      setEntries(res.data)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => {
    loadKb()
    loadEntries()
  }, [id])

  const handleCreate = () => {
    setEditItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: Entry) => {
    setEditItem(record)
    form.setFieldsValue({ question: record.question, content: record.content })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editItem) {
        await api.put(`/admin/kb/${id}/entries/${editItem.id}`, values)
        message.success('更新成功')
      } else {
        await api.post(`/admin/kb/${id}/entries`, { ...values, type: 'q_a' })
        message.success('添加成功')
      }
      setModalOpen(false)
      loadEntries()
    } catch { }
  }

  const handleDelete = async (entryId: string) => {
    try {
      await api.delete(`/admin/kb/${id}/entries/${entryId}`)
      message.success('删除成功')
      loadEntries()
    } catch { message.error('删除失败') }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post(`/admin/kb/${id}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      message.success(res.data.message || '导入成功')
      loadEntries()
      loadKb()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '导入失败')
    }
    setUploading(false)
    return false
  }

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: string) => <Tag color={t === 'q_a' ? 'blue' : 'green'}>{t === 'q_a' ? '问答对' : '文档块'}</Tag>,
    },
    { title: '问题', dataIndex: 'question', key: 'question', ellipsis: true, width: 250 },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '来源', dataIndex: 'source_doc', key: 'source_doc', width: 120, ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Entry) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
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
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/knowledge')}>返回</Button>
          <h2>{kb.name || '知识库详情'}</h2>
        </Space>
        <Space>
          <Upload beforeUpload={handleUpload} showUploadList={false} accept=".txt,.pdf,.docx,.md,.markdown">
            <Button icon={<UploadOutlined />} loading={uploading}>导入文档</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} loading={downloading} onClick={async () => {
            setDownloading(true)
            try {
              const res = await api.get('/admin/kb/qa-template', { responseType: 'blob' })
              const url = window.URL.createObjectURL(new Blob([res.data]))
              const link = document.createElement('a')
              link.href = url
              link.setAttribute('download', 'qa_template.docx')
              document.body.appendChild(link)
              link.click()
              link.remove()
              window.URL.revokeObjectURL(url)
            } catch {
              message.error('下载模板失败')
            }
            setDownloading(false)
          }}>问答对模板</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>添加问答对</Button>
        </Space>
      </div>
      <div className="content-card">
        <Table dataSource={entries} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} />
      </div>
      <Modal title={editItem ? '编辑条目' : '添加问答对'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)} width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="question" label="问题">
            <Input placeholder="请输入标准问题" />
          </Form.Item>
          <Form.Item name="content" label="答案/内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={6} placeholder="请输入答案或内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
