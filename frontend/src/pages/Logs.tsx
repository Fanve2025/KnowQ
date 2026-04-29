import { useState, useEffect } from 'react'
import { Table, Button, Space, Input, Select, App, Tag, Modal, Popconfirm } from 'antd'
import { SearchOutlined, ClockCircleOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import api from '../services/api'
import dayjs from 'dayjs'

interface LogItem {
  id: string
  system_id: string
  system_name: string
  user_id: string | null
  username: string
  question: string
  answer: string
  mode: string | null
  source: string | null
  latency_ms: number | null
  feedback: number
  references: any[]
  created_at: string | null
}

export default function Logs() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [systemId, setSystemId] = useState<string | undefined>(undefined)
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  const [systems, setSystems] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<LogItem | null>(null)
  const { message } = App.useApp()

  const load = async () => {
    setLoading(true)
    try {
      const params: any = { page, page_size: pageSize }
      if (systemId) params.system_id = systemId
      if (userId) params.user_id = userId
      if (keyword) params.keyword = keyword
      const res = await api.get('/admin/logs', { params })
      setLogs(res.data.items)
      setTotal(res.data.total)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  const loadFilters = async () => {
    try {
      const [sysRes, userRes] = await Promise.all([
        api.get('/admin/logs/systems/list'),
        api.get('/admin/logs/users/list'),
      ])
      setSystems(sysRes.data.systems || [])
      setUsers(userRes.data.users || [])
    } catch { }
  }

  useEffect(() => { load(); loadFilters() }, [page, pageSize])

  const handleViewDetail = (record: LogItem) => {
    setDetail(record)
    setDetailOpen(true)
  }

  const handleClearOld = async () => {
    try {
      const params: any = {}
      if (systemId) params.system_id = systemId
      if (userId) params.user_id = userId
      if (keyword) params.keyword = keyword
      await api.delete('/admin/logs/clear', { params })
      message.success('问答日志已清空')
      load()
    } catch { message.error('清空失败') }
  }

  const formatLatency = (ms: number | null) => {
    if (!ms) return '-'
    if (ms >= 1000) return <Tag>{(ms / 1000).toFixed(2)}s</Tag>
    return <Tag>{ms}ms</Tag>
  }

  const getSourceTag = (source: string | null) => {
    switch (source) {
      case 'kb': return <Tag color="blue">知识库</Tag>
      case 'web': return <Tag color="cyan">联网搜索</Tag>
      case 'rule_match': return <Tag color="green">规则匹配</Tag>
      case 'rule_none': return <Tag color="orange">未匹配</Tag>
      case 'error': return <Tag color="red">错误</Tag>
      default: return <Tag>{source || '-'}</Tag>
    }
  }

  const getModeTag = (mode: string | null) => {
    switch (mode) {
      case 'ai': return <Tag color="purple">AI</Tag>
      case 'rule': return <Tag color="blue">规则</Tag>
      default: return <Tag>{mode || '-'}</Tag>
    }
  }

  const getFeedbackTag = (feedback: number) => {
    if (feedback === 1) return <Tag color="green">👍 有帮助</Tag>
    if (feedback === -1) return <Tag color="red">👎 无帮助</Tag>
    return <Tag>未评价</Tag>
  }

  const columns = [
    {
      title: '提问时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 90,
    },
    {
      title: '问答系统',
      dataIndex: 'system_name',
      key: 'system_name',
      width: 130,
      ellipsis: true,
    },
    {
      title: '提问内容',
      dataIndex: 'question',
      key: 'question',
      width: 200,
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 90,
      render: (v: string) => getSourceTag(v),
    },
    {
      title: '耗时',
      dataIndex: 'latency_ms',
      key: 'latency_ms',
      width: 80,
      render: (v: number) => formatLatency(v),
    },
    {
      title: '反馈',
      dataIndex: 'feedback',
      key: 'feedback',
      width: 90,
      render: (v: number) => getFeedbackTag(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_: any, record: LogItem) => (
        <Button size="small" onClick={() => handleViewDetail(record)}>详情</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>问答日志</h2>
        <Space>
          <Select placeholder="问答系统" value={systemId} onChange={v => setSystemId(v)}
            allowClear style={{ width: 150 }}>
            {systems.map(s => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
          </Select>
          <Select placeholder="用户" value={userId} onChange={v => setUserId(v)}
            allowClear style={{ width: 120 }}>
            {users.map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
          </Select>
          <Input placeholder="搜索提问内容" prefix={<SearchOutlined />} value={keyword}
            onChange={e => setKeyword(e.target.value)} onPressEnter={load} style={{ width: 180 }} />
          <Button type="primary" icon={<SearchOutlined />} onClick={load}>查询</Button>
          <Popconfirm title={systemId || userId || keyword ? "确定清空当前筛选条件下的问答日志？" : "未设置筛选条件，确定清空所有问答日志？"} onConfirm={handleClearOld}>
            <Button icon={<DeleteOutlined />}>清空日志</Button>
          </Popconfirm>
        </Space>
      </div>
      <div className="content-card">
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </div>

      <Modal
        title={<span><ClockCircleOutlined style={{ marginRight: 8 }} />问答详情</span>}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={680}
      >
        {detail && (
          <div>
            <div style={{
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                <div><span style={{ color: 'var(--text-secondary)' }}>用户：</span><b>{detail.username}</b></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>系统：</span>{detail.system_name}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>时间：</span>{detail.created_at ? dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>耗时：</span>{detail.latency_ms ? (detail.latency_ms >= 1000 ? `${(detail.latency_ms / 1000).toFixed(2)}s` : `${detail.latency_ms}ms`) : '-'}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>来源：</span>{getSourceTag(detail.source)}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>模式：</span>{getModeTag(detail.mode)}</div>
                <div><span style={{ color: 'var(--text-secondary)' }}>反馈：</span>{getFeedbackTag(detail.feedback)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>👤 用户提问</div>
              <div style={{
                padding: '12px 16px',
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap',
                fontSize: 14,
                lineHeight: 1.7,
              }}>
                {detail.question}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>🤖 AI 回复</div>
              <div style={{
                padding: '12px 16px',
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap',
                fontSize: 14,
                lineHeight: 1.7,
                maxHeight: 300,
                overflowY: 'auto',
              }}>
                {detail.answer || '无回复'}
              </div>
            </div>

            {detail.references && detail.references.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>📎 引用来源</div>
                {detail.references.map((r: any, ri: number) => (
                  <div key={ri} style={{ padding: '4px 0' }}>
                    {r.title || `来源${ri + 1}`}
                    {r.url && <a href={r.url} target="_blank" style={{ marginLeft: 8, color: 'var(--primary)' }}>查看</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
