import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Input, App, Form } from 'antd'
import {
  SendOutlined, LikeOutlined, DislikeOutlined, LikeFilled, DislikeFilled,
  SunOutlined, MoonOutlined, UserOutlined, LockOutlined, LogoutOutlined,
  CopyOutlined, ClockCircleOutlined, PlusOutlined, MessageOutlined,
  DeleteOutlined, MenuFoldOutlined, MenuUnfoldOutlined, StopOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'
import dayjs from 'dayjs'

interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: string
  references?: any[]
  logId?: string
  feedback?: number
  loading?: boolean
  time?: string
}

interface ConversationItem {
  id: string
  title: string
  created_at: string | null
  updated_at: string | null
  message_count: number
}

export default function QAFrontend() {
  const { systemId } = useParams<{ systemId: string }>()
  const { isDark, toggleTheme } = useTheme()
  const [config, setConfig] = useState<any>({})
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({})
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({})
  const [input, setInput] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [qaUser, setQaUser] = useState<any>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [passwordVerified, setPasswordVerified] = useState(false)
  const [passwordModal, setPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const { message: messageApi, modal } = App.useApp()
  const [loginForm] = Form.useForm()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [qaToken, setQaToken] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const messages = messagesMap[conversationId || ''] || []
  const sending = pendingMap[conversationId || ''] || false

  const authHeaders = useCallback(() => {
    const token = qaToken || localStorage.getItem('knowq-qa-token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [qaToken])

  useEffect(() => {
    const token = localStorage.getItem('knowq-qa-token')
    const userStr = localStorage.getItem('knowq-qa-user')
    if (token && userStr) {
      setQaToken(token)
      setLoggedIn(true)
      try { setQaUser(JSON.parse(userStr)) } catch { }
    } else {
      const adminToken = localStorage.getItem('knowq-token')
      if (adminToken) {
        api.post('/qa/auto-login', null, {
          params: { system_id: systemId || '' },
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then(res => {
          const qaTokenVal = res.data.access_token
          setQaToken(qaTokenVal)
          try { localStorage.setItem('knowq-qa-token', qaTokenVal) } catch { }
          try { localStorage.setItem('knowq-qa-user', JSON.stringify(res.data.user)) } catch { }
          setLoggedIn(true)
          setQaUser(res.data.user)
          if (res.data.session_id) {
            setSessionId(res.data.session_id)
          }
        }).catch(() => { })
      }
    }
  }, [])

  useEffect(() => {
    if (systemId && loggedIn) {
      api.get(`/qa/${systemId}/config`, { headers: authHeaders() }).then(res => {
        setConfig(res.data)
        if (res.data.has_password) {
          setPasswordModal(true)
        } else {
          setPasswordVerified(true)
        }
      }).catch(() => {
        messageApi.error('问答系统不存在或已停用')
      })
    }
  }, [systemId, loggedIn])

  useEffect(() => {
    if (loggedIn && systemId && passwordVerified) {
      loadConversations()
    }
  }, [loggedIn, systemId, passwordVerified])

  useEffect(() => {
    if (chatAreaRef.current && conversationId) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [messagesMap, conversationId])

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/qa/conversations', { params: { system_id: systemId }, headers: authHeaders() })
      setConversations(res.data.conversations || [])
    } catch { }
  }, [systemId, authHeaders])

  const switchConversation = useCallback(async (convId: string) => {
    if (convId === conversationId) return

    if (messagesMap[convId]) {
      setConversationId(convId)
      return
    }

    try {
      const res = await api.get(`/qa/conversations/${convId}`, { headers: authHeaders() })
      setConversationId(convId)
      const loadedMessages: Message[] = []
      if (res.data.messages && res.data.messages.length > 0) {
        for (const m of res.data.messages) {
          loadedMessages.push({
            role: 'user',
            content: m.question,
            time: m.created_at ? dayjs(m.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
          })
          loadedMessages.push({
            role: 'assistant',
            content: m.answer,
            source: m.source,
            references: m.references,
            logId: m.id,
            feedback: m.feedback,
            time: m.created_at ? dayjs(m.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
          })
        }
      }
      setMessagesMap(prev => ({ ...prev, [convId]: loadedMessages }))
    } catch {
      messageApi.error('加载对话失败')
    }
  }, [conversationId, messagesMap, authHeaders])

  const deleteConversation = useCallback((convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    modal.confirm({
      title: '删除对话',
      content: '确定要删除这个对话吗？删除后不可恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/qa/conversations/${convId}`, { headers: authHeaders() })
        } catch (err: any) {
          if (err.response?.status !== 404) {
            messageApi.error('删除失败')
            return
          }
        }
        setMessagesMap(prev => {
          const newMap = { ...prev }
          delete newMap[convId]
          return newMap
        })
        setPendingMap(prev => {
          const newMap = { ...prev }
          delete newMap[convId]
          return newMap
        })
        if (convId === conversationId) {
          setConversationId(null)
        }
        loadConversations()
        messageApi.success('对话已删除')
      },
    })
  }, [conversationId, loadConversations, modal, authHeaders])

  const deleteAllConversations = useCallback(() => {
    modal.confirm({
      title: '删除全部对话',
      content: '确定要删除所有对话记录吗？此操作不可恢复。',
      okText: '全部删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          for (const conv of conversations) {
            try {
              await api.delete(`/qa/conversations/${conv.id}`, { headers: authHeaders() })
            } catch { }
          }
          setMessagesMap({})
          setPendingMap({})
          setConversationId(null)
          loadConversations()
          messageApi.success('已删除全部对话')
        } catch {
          messageApi.error('删除失败')
        }
      },
    })
  }, [conversations, loadConversations, modal, authHeaders])

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoginLoading(true)
    try {
      const res = await api.post('/qa/login', null, {
        params: { username: values.username, password: values.password, system_id: systemId || '' },
      })
      const token = res.data.access_token
      setQaToken(token)
      try { localStorage.setItem('knowq-qa-token', token) } catch { }
      try { localStorage.setItem('knowq-qa-user', JSON.stringify(res.data.user)) } catch { }
      setLoggedIn(true)
      setQaUser(res.data.user)
      if (res.data.session_id) {
        setSessionId(res.data.session_id)
      }
      messageApi.success('登录成功')
    } catch (err: any) {
      messageApi.error(err.response?.data?.detail || '登录失败')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = async () => {
    if (sessionId) {
      try {
        await api.post('/qa/logout', null, { params: { session_id: sessionId }, headers: authHeaders() })
      } catch { }
    }
    try { localStorage.removeItem('knowq-qa-token') } catch { }
    try { localStorage.removeItem('knowq-qa-user') } catch { }
    setQaToken(null)
    setLoggedIn(false)
    setQaUser(null)
    setMessagesMap({})
    setPendingMap({})
    setPasswordVerified(false)
    setConfig({})
    setConversationId(null)
    setConversations([])
    setSessionId(null)
  }

  const handleVerifyPassword = async () => {
    try {
      await api.post(`/qa/${systemId}/verify-password`, null, { params: { password } })
      setPasswordVerified(true)
      setPasswordModal(false)
    } catch {
      messageApi.error('访问密码错误')
    }
  }

  const handleCopyToInput = (text: string) => {
    setInput(text)
    messageApi.success('已复制到输入框')
  }

  const handleNewChat = () => {
    setConversationId(null)
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    const convId = conversationId || ''
    if (!convId) return
    setMessagesMap(prev => {
      if (!prev[convId]) return prev
      const convMsgs = [...prev[convId]]
      const lastIdx = convMsgs.length - 1
      if (lastIdx >= 0 && convMsgs[lastIdx].loading) {
        convMsgs[lastIdx] = {
          ...convMsgs[lastIdx],
          content: '已停止生成',
          loading: false,
          time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
      }
      return { ...prev, [convId]: convMsgs }
    })
    setPendingMap(prev => ({ ...prev, [convId]: false }))
    messageApi.info('已停止生成回复')
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const question = input.trim()
    setInput('')
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

    let targetConvId: string = conversationId || ''

    if (!conversationId) {
      try {
        const convRes = await api.post('/qa/conversations', {
          system_id: systemId,
          title: question.substring(0, 50),
        }, { headers: authHeaders() })
        targetConvId = convRes.data.id
        setConversationId(targetConvId)
        loadConversations()
      } catch {
        messageApi.error('创建对话失败')
        return
      }
    }

    if (pendingMap[targetConvId]) return

    const history = (messagesMap[targetConvId] || [])
      .filter((m: Message) => !m.loading)
      .map((m: Message) => ({ role: m.role, content: m.content }))

    const userMsg: Message = { role: 'user', content: question, time: now }
    const assistantMsg: Message = { role: 'assistant', content: '', loading: true }

    setMessagesMap(prev => ({
      ...prev,
      [targetConvId!]: [...(prev[targetConvId!] || []), userMsg, assistantMsg],
    }))
    setPendingMap(prev => ({ ...prev, [targetConvId!]: true }))

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const params = new URLSearchParams()
      if (sessionId) params.set('session_id', sessionId)
      if (targetConvId) params.set('conversation_id', targetConvId)

      const res = await api.post(`/qa/${systemId}/ask?${params.toString()}`, {
        question,
        history,
      }, { headers: authHeaders(), signal: controller.signal })

      const data = res.data
      const replyTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
      setMessagesMap(prev => {
        if (!prev[targetConvId!]) return prev
        const convMsgs = [...prev[targetConvId!]]
        const lastIdx = convMsgs.length - 1
        if (lastIdx >= 0 && convMsgs[lastIdx].loading) {
          convMsgs[lastIdx] = {
            role: 'assistant',
            content: data.answer,
            source: data.source,
            references: data.references,
            logId: data.log_id,
            feedback: 0,
            loading: false,
            time: replyTime,
          }
        }
        return { ...prev, [targetConvId!]: convMsgs }
      })
      loadConversations()
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return
      }
      const replyTime = dayjs().format('YYYY-MM-DD HH:mm:ss')
      setMessagesMap(prev => {
        if (!prev[targetConvId!]) return prev
        const convMsgs = [...prev[targetConvId!]]
        const lastIdx = convMsgs.length - 1
        if (lastIdx >= 0 && convMsgs[lastIdx].loading) {
          convMsgs[lastIdx] = {
            role: 'assistant',
            content: '抱歉，处理您的问题时出现错误，请稍后重试。',
            loading: false,
            time: replyTime,
          }
        }
        return { ...prev, [targetConvId!]: convMsgs }
      })
    }
    setPendingMap(prev => ({ ...prev, [targetConvId!]: false }))
    abortControllerRef.current = null
  }

  const handleFeedback = async (logId: string | undefined, feedback: number, msgIndex: number) => {
    if (!logId || !conversationId) return
    try {
      await api.post('/qa/feedback', { log_id: logId, feedback }, { headers: authHeaders() })
      setMessagesMap(prev => {
        const convMsgs = [...(prev[conversationId] || [])]
        if (convMsgs[msgIndex]) {
          convMsgs[msgIndex] = { ...convMsgs[msgIndex], feedback }
        }
        return { ...prev, [conversationId]: convMsgs }
      })
    } catch { }
  }

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'kb': return '基于知识库生成'
      case 'web': return '基于联网搜索结果'
      case 'rule_match': return '基于规则匹配'
      case 'rule_none': return '未找到匹配内容'
      default: return ''
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatConvDate = (dateStr: string | null) => {
    if (!dateStr) return ''
    const d = dayjs(dateStr)
    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    const dateDay = d.format('YYYY-MM-DD')
    if (dateDay === today) return d.format('HH:mm')
    if (dateDay === yesterday) return '昨天 ' + d.format('HH:mm')
    return d.format('MM-DD HH:mm')
  }

  const canChat = loggedIn && passwordVerified

  if (!loggedIn) {
    return (
      <div className="qa-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: 380,
          background: 'var(--bg-card)',
          borderRadius: 16,
          padding: '40px 32px',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48 }}>🤖</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', marginTop: 12 }}>KnowQ 智答星</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>请登录后继续</p>
          </div>
          <Form form={loginForm} onFinish={handleLogin} size="large">
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loginLoading}
                style={{ height: 44, borderRadius: 8, fontSize: 16 }}>
                登 录
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    )
  }

  return (
    <div className="qa-page-deepseek">
      <div className={`qa-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="qa-sidebar-header">
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="qa-sidebar-toggle"
          />
          {!sidebarCollapsed && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleNewChat}
              className="qa-new-chat-btn"
            >
              新对话
            </Button>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="qa-sidebar-list">
            {conversations.length > 0 && (
              <div style={{ padding: '4px 8px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  type="text"
                  icon={<ClearOutlined />}
                  onClick={deleteAllConversations}
                  style={{ fontSize: 12, color: 'var(--text-secondary)' }}
                >
                  删除全部
                </Button>
              </div>
            )}
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`qa-sidebar-item ${conv.id === conversationId ? 'active' : ''}`}
                onClick={() => switchConversation(conv.id)}
              >
                <MessageOutlined style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="qa-sidebar-item-title">{conv.title}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {formatConvDate(conv.updated_at || conv.created_at)}
                  </div>
                </div>
                {pendingMap[conv.id] && (
                  <span className="qa-sidebar-pending-dot" />
                )}
                <button
                  className="qa-sidebar-item-delete"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  title="删除对话"
                >
                  <DeleteOutlined style={{ fontSize: 12 }} />
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                暂无对话记录
              </div>
            )}
          </div>
        )}

        {!sidebarCollapsed && (
          <div className="qa-sidebar-footer">
            <div className="qa-sidebar-user">
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {qaUser?.username}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} size="small" />
              <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} size="small" title="退出登录" />
            </div>
          </div>
        )}
      </div>

      <div className="qa-main">
        <div className="qa-main-header">
          <h1>🤖 {config.name || 'KnowQ 智答星'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="qa-brand-logo">凡维科技</span>
            {sidebarCollapsed && (
              <>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{qaUser?.username}</span>
                <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} size="small" />
                <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} size="small" />
              </>
            )}
            {!sidebarCollapsed && (
              <>
                <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} size="small" />
                <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} size="small" />
              </>
            )}
          </div>
        </div>

        <div className="qa-chat-area" ref={chatAreaRef}
          style={!conversationId ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>
          {conversationId ? (
            messages.map((msg, i) => (
              <div key={i} className={`qa-message ${msg.role}`}>
                <div className="avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="qa-message-content">
                  <div className="bubble">
                    {msg.loading ? (
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    ) : (
                      <>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        {msg.source && (
                          <div className="source-tag">{getSourceLabel(msg.source)}</div>
                        )}
                        {msg.references && msg.references.length > 0 && (
                          <div className="qa-references">
                            <div className="qa-references-title">📎 引用来源</div>
                            {msg.references.map((ref: any, ri: number) => (
                              <div key={ri} className="qa-reference-item">
                                {ref.kb_name && <span className="qa-ref-kb">📚 {ref.kb_name}</span>}
                                {ref.kb_name && ref.title && <span className="qa-ref-sep">›</span>}
                                {ref.title && <span className="qa-ref-doc">📄 {ref.title}</span>}
                                {ref.url && <a href={ref.url} target="_blank" rel="noreferrer" className="qa-ref-link">查看</a>}
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.role === 'assistant' && !msg.loading && msg.logId && (
                          <div className="qa-feedback">
                            <button
                              className={msg.feedback === 1 ? 'active' : ''}
                              onClick={() => handleFeedback(msg.logId, 1, i)}
                            >
                              {msg.feedback === 1 ? <LikeFilled /> : <LikeOutlined />} 有帮助
                            </button>
                            <button
                              className={msg.feedback === -1 ? 'active' : ''}
                              onClick={() => handleFeedback(msg.logId, -1, i)}
                            >
                              {msg.feedback === -1 ? <DislikeFilled /> : <DislikeOutlined />} 无帮助
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="qa-message-meta">
                    {msg.time && (
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        <ClockCircleOutlined style={{ marginRight: 2 }} />{msg.time}
                      </span>
                    )}
                    {msg.role === 'user' && !msg.loading && (
                      <button
                        className="qa-copy-btn"
                        onClick={() => handleCopyToInput(msg.content)}
                        title="复制到输入框"
                      >
                        <CopyOutlined /> 复制
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="welcome-section">
              <div style={{ fontSize: 56, marginBottom: 20 }}>🤖</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                {config.name || 'KnowQ 智答星'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15, textAlign: 'center', maxWidth: 420, lineHeight: 1.8 }}>
                {config.welcome_message || '你好！有什么可以帮你的吗？'}
              </p>
            </div>
          )}
        </div>

        <div className="qa-input-area">
          <div className="qa-input-wrapper">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              rows={1}
              disabled={!canChat}
            />
            {sending ? (
              <Button
                type="default"
                danger
                icon={<StopOutlined />}
                onClick={handleStop}
                style={{ borderRadius: 8, height: 44, minWidth: 80 }}
              >
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={!canChat || !input.trim()}
                style={{ borderRadius: 8, height: 44 }}
              >
                发送
              </Button>
            )}
          </div>
        </div>
      </div>

      {passwordModal && !passwordVerified && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 32, width: 360,
            boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
          }}>
            <h3 style={{ marginBottom: 16, color: 'var(--text)' }}>访问验证</h3>
            <p style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 14 }}>该问答系统需要访问密码</p>
            <Input.Password
              placeholder="请输入访问密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onPressEnter={handleVerifyPassword}
              style={{ marginBottom: 16 }}
            />
            <Button type="primary" block onClick={handleVerifyPassword} style={{ height: 40, borderRadius: 8 }}>
              验证
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
