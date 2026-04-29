import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'

interface ThemeContextType {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('knowq-theme')
    return saved === 'dark'
  })

  useEffect(() => {
    localStorage.setItem('knowq-theme', isDark ? 'dark' : 'light')
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark(!isDark)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: '#6366f1',
            borderRadius: 8,
            colorBgContainer: isDark ? '#1e293b' : '#ffffff',
            colorBgElevated: isDark ? '#1e293b' : '#ffffff',
            colorBgLayout: isDark ? '#0f172a' : '#f8fafc',
            colorText: isDark ? '#f1f5f9' : '#1e293b',
            colorTextSecondary: isDark ? '#94a3b8' : '#64748b',
            colorBorder: isDark ? '#334155' : '#e2e8f0',
            colorBorderSecondary: isDark ? '#334155' : '#f0f0f0',
          },
          components: {
            Menu: {
              itemBg: 'transparent',
              itemColor: isDark ? '#f1f5f9' : '#1e293b',
              itemSelectedColor: '#6366f1',
              itemHoverColor: '#6366f1',
            },
            Table: {
              colorBgContainer: isDark ? '#1e293b' : '#ffffff',
              headerBg: isDark ? '#1e293b' : '#fafbfc',
              headerColor: isDark ? '#94a3b8' : '#64748b',
              rowHoverBg: isDark ? '#334155' : '#fafbfc',
            },
            Modal: {
              contentBg: isDark ? '#1e293b' : '#ffffff',
              headerBg: isDark ? '#1e293b' : '#ffffff',
            },
            Card: {
              colorBgContainer: isDark ? '#1e293b' : '#ffffff',
            },
            Input: {
              colorBgContainer: isDark ? '#0f172a' : '#ffffff',
            },
            Select: {
              colorBgContainer: isDark ? '#0f172a' : '#ffffff',
              optionSelectedBg: isDark ? '#334155' : '#eef2ff',
            },
            Dropdown: {
              colorBgElevated: isDark ? '#1e293b' : '#ffffff',
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
