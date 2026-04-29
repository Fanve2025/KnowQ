import { useState, useEffect } from 'react'
import { Row, Col, Table, Tag } from 'antd'
import { BookOutlined, FileTextOutlined, RobotOutlined, UserOutlined, QuestionCircleOutlined, ThunderboltOutlined, GlobalOutlined, ClockCircleOutlined, RiseOutlined, DatabaseOutlined } from '@ant-design/icons'
import api from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState<any>({})
  const [systemStats, setSystemStats] = useState<any[]>([])
  const [trend, setTrend] = useState<any>({})

  useEffect(() => {
    api.get('/stats/dashboard').then(res => setStats(res.data)).catch(() => {})
    api.get('/stats/systems').then(res => setSystemStats(res.data)).catch(() => {})
    api.get('/stats/trend', { params: { range_days: 7 } }).then(res => setTrend(res.data)).catch(() => {})
  }, [])

  const primaryCards = [
    { label: '知识库', value: stats.kb_count || 0, icon: <BookOutlined />, color: '#6366f1', bg: 'linear-gradient(135deg, #6366f1, #818cf8)' },
    { label: '问答系统', value: stats.system_count || 0, icon: <RobotOutlined />, color: '#06b6d4', bg: 'linear-gradient(135deg, #06b6d4, #22d3ee)' },
    { label: '今日提问', value: stats.today_questions || 0, icon: <QuestionCircleOutlined />, color: '#f59e0b', bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    { label: '总提问数', value: stats.question_count || 0, icon: <RiseOutlined />, color: '#10b981', bg: 'linear-gradient(135deg, #10b981, #34d399)' },
  ]

  const secondaryCards = [
    { label: '文档总数', value: stats.doc_count || 0, icon: <FileTextOutlined />, color: '#8b5cf6' },
    { label: '用户总数', value: stats.user_count || 0, icon: <UserOutlined />, color: '#3b82f6' },
    { label: '知识库命中率', value: `${stats.kb_hit_rate || 0}%`, icon: <ThunderboltOutlined />, color: '#ef4444' },
    { label: '联网搜索率', value: `${stats.web_search_rate || 0}%`, icon: <GlobalOutlined />, color: '#06b6d4' },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>仪表盘</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </span>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {primaryCards.map((c, i) => (
          <Col xs={12} sm={12} lg={6} key={i}>
            <div style={{
              background: c.bg,
              borderRadius: 12,
              padding: '24px 20px',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', right: -8, top: -8, fontSize: 64, opacity: 0.15 }}>
                {c.icon}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{c.value}</div>
              <div style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>{c.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {secondaryCards.map((c, i) => (
          <Col xs={12} sm={12} lg={6} key={i}>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{c.label}</div>
                </div>
                <div className="stat-icon" style={{ background: `${c.color}15`, color: c.color, width: 44, height: 44, borderRadius: 10 }}>
                  {c.icon}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <div className="content-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>近7天提问趋势</h3>
              <Tag color="blue"><DatabaseOutlined /> 问答数据</Tag>
            </div>
            {(trend.dates || []).length > 0 ? (
              <div style={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {(trend.dates || []).map((date: string, i: number) => {
                  const total = (trend.total || [])[i] || 0
                  const kb = (trend.kb || [])[i] || 0
                  const maxVal = Math.max(...(trend.total || [1]), 1)
                  const hTotal = Math.max((total / maxVal) * 190, 2)
                  const hKb = Math.max((kb / maxVal) * 190, 2)
                  return (
                    <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{total}</div>
                      <div style={{ width: '100%', maxWidth: 48, display: 'flex', gap: 2, alignItems: 'flex-end', height: 190 }}>
                        <div style={{
                          flex: 1,
                          height: hTotal,
                          background: 'linear-gradient(180deg, #6366f1, #818cf8)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s',
                        }} />
                        <div style={{
                          flex: 1,
                          height: hKb,
                          background: 'linear-gradient(180deg, #10b981, #34d399)',
                          borderRadius: '4px 4px 0 0',
                          transition: 'height 0.3s',
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{date.slice(5)}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                暂无数据
              </div>
            )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>系统概览</h3>
              <Tag color="purple"><RobotOutlined /> 运行中</Tag>
            </div>
            {systemStats.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {systemStats.map((s: any) => (
                  <div key={s.system_id} style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{s.system_name}</span>
                      <Tag color={s.kb_hit_rate > 50 ? 'green' : 'orange'}>{s.kb_hit_rate}% 命中</Tag>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span>提问 {s.question_count}</span>
                      <span>知识库命中 {s.kb_hit_count}</span>
                      <span>联网搜索 {s.web_search_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                暂无系统数据
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}
