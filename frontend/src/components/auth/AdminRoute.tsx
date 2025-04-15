import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Result, Spin } from 'antd';

const AdminRoute = ({ children }: { children?: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="抱歉，您没有访问该页面的权限"
        extra={<Navigate to="/dashboard" replace />}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AdminRoute; 