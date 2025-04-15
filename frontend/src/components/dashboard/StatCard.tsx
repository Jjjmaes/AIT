import React from 'react';
import { Card, Statistic, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface StatCardProps {
  title: string;
  value: number | string;
  suffix?: string;
  prefix?: React.ReactNode;
  tooltip?: string;
  color?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  tooltip,
  color,
  loading = false,
  icon,
  onClick,
}) => {
  return (
    <Card 
      hoverable={!!onClick}
      onClick={onClick}
      style={{ 
        cursor: onClick ? 'pointer' : 'default', 
        height: '100%' 
      }}
      bodyStyle={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Text strong>{title}</Text>
          {tooltip && (
            <Tooltip title={tooltip}>
              <QuestionCircleOutlined style={{ marginLeft: 4, color: '#8c8c8c' }} />
            </Tooltip>
          )}
        </div>
        {icon && <div>{icon}</div>}
      </div>
      
      <Statistic
        value={value}
        suffix={suffix}
        prefix={prefix}
        valueStyle={{ color }}
        loading={loading}
      />
    </Card>
  );
};

export default StatCard; 