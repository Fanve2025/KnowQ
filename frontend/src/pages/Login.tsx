import { useState } from 'react'
import { Form, Input, Button, App } from 'antd'
import { UserOutlined, LockOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import api from '../services/api'

interface LoginForm {
  username: string
  password: string
}

const quickAccounts = [
  { label: '管理员', icon: '👑', username: 'admin', password: 'admin123' },
]

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()
  const { isDark, toggleTheme } = useTheme()
  const [form] = Form.useForm()

  const onFinish = async (values: LoginForm) => {
    setLoading(true)
    try {
      const res = await api.post('/admin/auth/login', values)
      localStorage.setItem('knowq-token', res.data.access_token)
      localStorage.setItem('knowq-user', JSON.stringify(res.data.user))
      message.success('登录成功')
      navigate('/admin/dashboard')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = (username: string, password: string) => {
    form.setFieldsValue({ username, password })
    onFinish({ username, password })
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ position: 'absolute', top: 24, right: 24 }}>
          <Button
            type="text"
            icon={isDark ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            style={{ fontSize: 18, color: 'var(--text-secondary)' }}
          />
        </div>
        <div className="login-logo">
          <div style={{ fontSize: 48 }}>🤖</div>
          <h1>KnowQ 智答星</h1>
          <p>AI知识库问答平台</p>
        </div>
        <Form form={form} onFinish={onFinish} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}
              style={{ height: 44, borderRadius: 8, fontSize: 16 }}>
              登 录
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 8, marginBottom: 4, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          快捷登录
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {quickAccounts.map(acc => (
            <button
              key={acc.username}
              onClick={() => handleQuickLogin(acc.username, acc.password)}
              disabled={loading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 0',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.borderColor = 'var(--primary)'
                  e.currentTarget.style.color = 'var(--primary)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text)'
              }}
            >
              <span style={{ fontSize: 20 }}>{acc.icon}</span>
              <span>{acc.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
