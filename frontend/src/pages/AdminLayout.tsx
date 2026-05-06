import { useState } from 'react'
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import {
  BookOutlined,
  RobotOutlined,
  SettingOutlined,
  BarChartOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  FileTextOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

const { Sider, Header, Content } = Layout

const menuItems = [
  { key: '/admin/stats', icon: <BarChartOutlined />, label: '首页' },
  { key: '/admin/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/admin/knowledge', icon: <BookOutlined />, label: '知识库管理' },
  { key: '/admin/systems', icon: <RobotOutlined />, label: '问答系统管理' },
  { key: '/admin/search-config', icon: <ToolOutlined />, label: '搜索管理' },
  { key: '/admin/llm-config', icon: <SettingOutlined />, label: '大模型管理' },
  { key: '/admin/logs', icon: <FileTextOutlined />, label: '问答日志' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: '系统设置' },
]

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const token = localStorage.getItem('knowq-token')
  const userStr = localStorage.getItem('knowq-user')
  const user = userStr ? JSON.parse(userStr) : null

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    localStorage.removeItem('knowq-token')
    localStorage.removeItem('knowq-user')
    navigate('/login')
  }

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  }

  return (
    <Layout className="admin-layout" style={{ minHeight: '100vh' }}>
      <Sider
        className="admin-sider"
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        collapsedWidth={64}
        style={{
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="sider-logo">
          <span style={{ fontSize: 24 }}>🤖</span>
          {!collapsed && <span>KnowQ 智答星</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none', background: 'transparent' }}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
            />
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: '#6366f1' }} />
                <span style={{ fontSize: 14 }}>{user?.username || 'Admin'}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
