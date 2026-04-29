import { useState, useEffect } from 'react'
import { Row, Col, Select, Tag } from 'antd'
import { FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import api from '../services/api'
import dayjs from 'dayjs'

export default function Stats() {
  const [stats, setStats] = useState<any>({})
  const [systemStats, setSystemStats] = useState<any[]>([])
  const [trend, setTrend] = useState<any>({})
  const [range, setRange] = useState(30)
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  useEffect(() => {
    api.get('/stats/dashboard', { params: { range_days: range } }).then(res => setStats(res.data))
    api.get('/stats/systems', { params: { range_days: range } }).then(res => setSystemStats(res.data))
    api.get('/stats/trend', { params: { range_days: range } }).then(res => setTrend(res.data))
    api.get('/admin/logs', { params: { page: 1, page_size: 10 } }).then(res => setRecentLogs(res.data.items || []))
  }, [range])

  const statCards = [
    { label: '知识库总数', value: stats.kb_count || 0, color: '#6366f1' },
    { label: '文档总数', value: stats.doc_count || 0, color: '#8b5cf6' },
    { label: '问答系统数', value: stats.system_count || 0, color: '#06b6d4' },
    { label: '用户数', value: stats.user_count || 0, color: '#10b981' },
    { label: '总提问数', value: stats.question_count || 0, color: '#f59e0b' },
    { label: '今日提问', value: stats.today_questions || 0, color: '#ef4444' },
    { label: '知识库命中率', value: `${stats.kb_hit_rate || 0}%`, color: '#6366f1' },
    { label: '联网搜索率', value: `${stats.web_search_rate || 0}%`, color: '#06b6d4' },
  ]

  const getSourceTag = (source: string) => {
    switch (source) {
      case 'kb': return <Tag color="blue">知识库</Tag>
      case 'web': return <Tag color="cyan">联网搜索</Tag>
      case 'rule_match': return <Tag color="green">规则匹配</Tag>
      case 'rule_none': return <Tag color="orange">未匹配</Tag>
      default: return <Tag>{source || '-'}</Tag>
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>数据统计</h2>
        <Select value={range} onChange={setRange} style={{ width: 140 }}>
          <Select.Option value={1}>今天</Select.Option>
          <Select.Option value={7}>最近7天</Select.Option>
          <Select.Option value={30}>最近30天</Select.Option>
          <Select.Option value={90}>最近90天</Select.Option>
        </Select>
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((c, i) => (
          <Col xs={12} sm={8} lg={6} xl={3} key={i}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
              <div className="stat-label">{c.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <div className="content-card" style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>提问趋势</h3>
            <div style={{ height: 260, display: 'flex', alignItems: 'flex-end', gap: 2, paddingTop: 20 }}>
              {(trend.dates || []).map((date: string, i: number) => {
                const total = (trend.total || [])[i] || 0
                const kb = (trend.kb || [])[i] || 0
                const maxVal = Math.max(...(trend.total || [1]), 1)
                const hTotal = Math.max((total / maxVal) * 220, 2)
                const hKb = Math.max((kb / maxVal) * 220, 2)
                return (
                  <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{total}</div>
                    <div style={{ width: '100%', maxWidth: 48, display: 'flex', gap: 2, alignItems: 'flex-end', height: 220 }}>
                      <div style={{ flex: 1, height: hTotal, background: 'linear-gradient(180deg, #6366f1, #818cf8)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                      <div style={{ flex: 1, height: hKb, background: 'linear-gradient(180deg, #10b981, #34d399)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{date.slice(5)}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#6366f1' }} /> 总提问
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: '#10b981' }} /> 知识库命中
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <div className="content-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>各系统统计</h3>
              <Tag color="purple">运行中</Tag>
            </div>
            {systemStats.length > 0 ? systemStats.map((s: any) => (
              <div key={s.system_id} style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.system_name}</span>
                  <Tag color={s.kb_hit_rate > 50 ? 'green' : 'orange'}>{s.kb_hit_rate}% 命中</Tag>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>提问 {s.question_count}</span>
                  <span>命中 {s.kb_hit_count}</span>
                  <span>搜索 {s.web_search_count}</span>
                </div>
              </div>
            )) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>暂无数据</div>
            )}
          </div>
        </Col>
      </Row>

      <div className="content-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}><FileTextOutlined style={{ marginRight: 8 }} />最近问答日志</h3>
          <Tag color="blue">最新10条</Tag>
        </div>
        {recentLogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentLogs.map((log: any) => (
              <div key={log.id} style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{log.username}</span>
                    {getSourceTag(log.source)}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.system_name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.question}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <ClockCircleOutlined />{log.created_at ? dayjs(log.created_at).format('MM-DD HH:mm') : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {log.latency_ms ? `${log.latency_ms}ms` : ''}
                    {log.feedback === 1 && <CheckCircleOutlined style={{ color: '#10b981', marginLeft: 6 }} />}
                    {log.feedback === -1 && <CloseCircleOutlined style={{ color: '#ef4444', marginLeft: 6 }} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无问答日志</div>
        )}
      </div>
    </div>
  )
}
