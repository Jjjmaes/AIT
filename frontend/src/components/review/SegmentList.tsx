import React from 'react';
import { List, Tag, Typography, Badge, Tooltip } from 'antd';

const { Text, Paragraph } = Typography;

interface Segment {
  id: string;
  segmentNumber: number;
  source: string;
  target: string;
  status: 'pending' | 'confirmed';
  issues?: Array<{
    type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  aiSuggestion?: string;
}

interface SegmentListProps {
  segments: Segment[];
  currentSegmentId: string | null;
  onSelectSegment: (segmentId: string) => void;
}

const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  currentSegmentId,
  onSelectSegment,
}) => {
  // Function to get status badge
  const getStatusBadge = (segment: Segment) => {
    if (segment.status === 'confirmed') {
      return <Badge status="success" text="已确认" />;
    }
    
    if (segment.issues && segment.issues.length > 0) {
      return (
        <Badge
          status="warning"
          text={
            <span>
              有问题 <Tag color="warning">{segment.issues.length}</Tag>
            </span>
          }
        />
      );
    }
    
    return <Badge status="default" text="待确认" />;
  };

  // Function to truncate text
  const truncateText = (text: string, maxLength: number = 40) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Function to render item
  const renderListItem = (segment: Segment) => {
    const hasIssues = segment.issues && segment.issues.length > 0;
    
    return (
      <List.Item
        key={segment.id}
        onClick={() => onSelectSegment(segment.id)}
        className={`segment-list-item ${currentSegmentId === segment.id ? 'segment-list-item-active' : ''}`}
        style={{
          padding: '12px 16px',
          cursor: 'pointer',
          background: currentSegmentId === segment.id ? '#e6f7ff' : 'white',
          borderLeft: currentSegmentId === segment.id ? '3px solid #1890ff' : '3px solid transparent',
        }}
      >
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>#{segment.segmentNumber}</Text>
            {getStatusBadge(segment)}
          </div>
          
          <Paragraph 
            style={{ 
              margin: 0, 
              fontSize: '13px', 
              color: '#666', 
              marginBottom: 4 
            }}
          >
            <Text type="secondary">原文: </Text> 
            {truncateText(segment.source)}
          </Paragraph>
          
          <Paragraph 
            style={{ 
              margin: 0, 
              fontSize: '13px', 
              borderLeft: hasIssues ? '2px solid #faad14' : 'none',
              paddingLeft: hasIssues ? 8 : 0,
            }}
          >
            <Text type="secondary">译文: </Text>
            {truncateText(segment.target)}
          </Paragraph>
          
          {hasIssues && segment.issues && (
            <div style={{ marginTop: 4 }}>
              {segment.issues.map((issue, index) => (
                <Tooltip key={index} title={issue.description}>
                  <Tag 
                    color={
                      issue.severity === 'high' ? 'error' : 
                      issue.severity === 'medium' ? 'warning' : 
                      'default'
                    }
                    style={{ margin: '2px 4px 2px 0' }}
                  >
                    {issue.type}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      </List.Item>
    );
  };

  return (
    <div className="segment-list">
      <div className="segment-list-header" style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong>段落列表</Text>
        <Text type="secondary" style={{ marginLeft: 8 }}>
          共 {segments.length} 个段落
        </Text>
      </div>
      <List
        dataSource={segments}
        renderItem={renderListItem}
        style={{ 
          maxHeight: 'calc(100vh - 300px)', 
          overflowY: 'auto',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
        }}
      />
    </div>
  );
};

export default SegmentList; 