import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Card, Space, Typography } from 'antd';
import { useAuth } from '../../context/AuthContext';

const { Title } = Typography;
const { Content } = Layout;

const AuthLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '50px 20px'
      }}>
        <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>AI辅助翻译审校平台</Title>
          </div>
          <Card variant="borderless" style={{ width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <Outlet />
          </Card>
        </Space>
      </Content>
    </Layout>
  );
};

export default AuthLayout; 