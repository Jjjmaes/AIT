import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Badge, Dropdown, theme } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  FormOutlined,
  BookOutlined,
  DatabaseOutlined,
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  
  const isAdmin = user?.role === 'admin';

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'projects',
      icon: <ProjectOutlined />,
      label: '项目管理',
      onClick: () => navigate('/projects'),
    },
    {
      key: 'prompts',
      icon: <FormOutlined />,
      label: '提示词管理',
      onClick: () => navigate('/prompts'),
      disabled: !isAdmin,
    },
    {
      key: 'terminology',
      icon: <BookOutlined />,
      label: '术语管理',
      onClick: () => navigate('/terminology'),
    },
    {
      key: 'tm',
      icon: <DatabaseOutlined />,
      label: '翻译记忆库',
      onClick: () => navigate('/translation-memory'),
    },
  ];

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: logout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="light"
        style={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          zIndex: 10,
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'flex-start', 
          padding: collapsed ? 0 : '0 16px',
          borderBottom: `1px solid ${token.colorBorder}`
        }}>
          {collapsed ? 
            <span style={{ fontSize: 24, fontWeight: 'bold' }}>TP</span> : 
            <span style={{ fontSize: 18, fontWeight: 'bold' }}>翻译审校平台</span>
          }
        </div>
        <Menu
          mode="inline"
          selectedKeys={[window.location.pathname.split('/')[1] || 'dashboard']}
          style={{ borderRight: 0 }}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 16px', 
          background: token.colorBgContainer, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '16px', width: 48, height: 48 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={unreadCount} overflowCount={99}>
              <Button 
                type="text" 
                icon={<BellOutlined />} 
                onClick={() => navigate('/notifications')}
                style={{ fontSize: '16px' }}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                {!collapsed && <span>{user?.name}</span>}
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ 
          margin: '16px', 
          padding: 24, 
          background: token.colorBgContainer, 
          borderRadius: token.borderRadius,
          overflow: 'auto',
          minHeight: 280,
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout; 