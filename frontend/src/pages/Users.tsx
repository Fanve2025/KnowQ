import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, Space, App, Tag, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons'
import api from '../services/api'

interface UserItem {
  id: string
  username: string
  role: string
  status: string
  created_at: string
}

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<UserItem | null>(null)
  const [form] = Form.useForm()
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [pwdUser, setPwdUser] = useState<UserItem | null>(null)
  const [pwdForm] = Form.useForm()
  const { message } = App.useApp()

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users')
      setUsers(res.data)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = () => {
    setEditItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record: UserItem) => {
    setEditItem(record)
    form.setFieldsValue({ username: record.username, role: record.role, status: record.status })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editItem) {
        await api.put(`/admin/users/${editItem.id}`, values)
        message.success('更新成功')
      } else {
        await api.post('/admin/users', values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } catch { }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/users/${id}`)
      message.success('删除成功')
      load()
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败')
    }
  }

  const handleOpenPwdModal = (record: UserItem) => {
    setPwdUser(record)
    pwdForm.resetFields()
    setPwdModalOpen(true)
  }

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields()
      await api.put(`/admin/users/${pwdUser!.id}`, { password: values.new_password })
      message.success('密码修改成功')
      setPwdModalOpen(false)
    } catch { }
  }

  const handleToggleStatus = async (record: UserItem) => {
    if (record.role === 'admin') {
      message.warning('管理员账号不可被禁用')
      return
    }
    try {
      await api.put(`/admin/users/${record.id}`, {
        status: record.status === 'active' ? 'disabled' : 'active',
      })
      message.success('状态已更新')
      load()
    } catch { message.error('操作失败') }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (r: string) => <Tag color={r === 'admin' ? 'purple' : 'blue'}>{r === 'admin' ? '管理员' : '普通用户'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '启用' : '禁用'}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: any, record: UserItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => handleOpenPwdModal(record)}>修改密码</Button>
          {record.role !== 'admin' && (
            <Button size="small" onClick={() => handleToggleStatus(record)}>
              {record.status === 'active' ? '禁用' : '启用'}
            </Button>
          )}
          {record.role !== 'admin' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h2>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增用户</Button>
      </div>
      <div className="content-card">
        <Table dataSource={users} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </div>
      <Modal title={editItem ? '编辑用户' : '新增用户'} open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" disabled={!!editItem} />
          </Form.Item>
          {!editItem && (
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="user">普通用户</Select.Option>
            </Select>
          </Form.Item>
          {editItem && editItem.role !== 'admin' && (
            <Form.Item name="status" label="状态">
              <Select>
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="disabled">禁用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Modal title={`修改密码 - ${pwdUser?.username || ''}`} open={pwdModalOpen} onOk={handleChangePassword} onCancel={() => setPwdModalOpen(false)}>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[
            { required: true, message: '请输入新密码' },
            { min: 6, message: '密码至少6位' },
          ]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item name="confirm_password" label="确认密码" dependencies={['new_password']} rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('两次输入的密码不一致'))
              },
            }),
          ]}>
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
