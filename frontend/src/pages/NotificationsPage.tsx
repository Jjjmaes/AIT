import React, { useEffect } from 'react';
import { Typography, List, Button, Space, Empty, Spin, Tooltip } from 'antd';
import { CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNotifications } from '../hooks/useNotifications';
import { formatDate, formatRelativeTime } from '../utils/formatUtils';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const NotificationsPage: React.FC = () => {
  const {
    notifications,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    switch (notification.relatedType) {
      case 'project':
        navigate(`/projects/${notification.relatedId}`);
        break;
      case 'file':
        if (notification.relatedProjectId) {
           navigate(`/files/${notification.relatedId}/review`);
        } else {
            console.warn('Project ID missing for file notification', notification);
        }
        break;
      default:
        console.log('No specific navigation for this notification type');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={2}>通知中心</Title>
        <Button 
          onClick={markAllAsRead}
          disabled={loading || notifications.filter(n => !n.isRead).length === 0}
        >
          全部标记为已读
        </Button>
      </div>

      {loading && <div style={{textAlign: 'center'}}><Spin /></div>}
      {error && <Text type="danger">{error}</Text>}
      
      {!loading && notifications.length === 0 && (
        <Empty description="没有通知" />
      )}

      {!loading && notifications.length > 0 && (
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          renderItem={item => (
            <List.Item
              style={{ 
                backgroundColor: item.isRead ? '#fff' : '#e6f7ff',
                padding: '12px 16px',
                cursor: 'pointer'
              }}
              actions={[
                <Tooltip title="标记为已读">
                  <Button 
                    type="text" 
                    icon={<CheckOutlined />} 
                    onClick={(e) => { e.stopPropagation(); markAsRead(item.id); }} 
                    disabled={item.isRead}
                  />
                </Tooltip>,
                <Tooltip title="删除通知">
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={(e) => { e.stopPropagation(); deleteNotification(item.id); }}
                  />
                </Tooltip>,
              ]}
              onClick={() => handleNotificationClick(item)}
            >
              <List.Item.Meta
                title={item.title}
                description={
                  <Space direction="vertical" size="small">
                    <Text>{item.content}</Text>
                    <Tooltip title={formatDate(item.createdAt, 'YYYY-MM-DD HH:mm:ss')}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </Tooltip>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default NotificationsPage; 