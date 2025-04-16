import React from 'react';
import { List, Tag, Typography, Button, Card, Divider, Empty, Space, Alert } from 'antd';
import { WarningOutlined, CheckCircleOutlined, InfoCircleOutlined, HighlightOutlined } from '@ant-design/icons';
import { DiffOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface Issue {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion?: string;
  originalText?: string;
  modifiedText?: string;
}

interface Segment {
  id: string;
  segmentNumber: number;
  source: string;
  target: string;
  status: 'pending' | 'confirmed';
  issues?: Issue[];
  aiSuggestion?: string;
}

interface IssuePanelProps {
  segment: Segment;
  onApplyFix: (fixedTranslation: string) => void;
}

const IssuePanel: React.FC<IssuePanelProps> = ({
  segment,
  onApplyFix,
}) => {
  const issues = segment.issues || [];
  
  // Map issue types to friendly names
  const getIssueTypeLabel = (type: string): string => {
    const issueTypeMap: Record<string, string> = {
      'terminology': '术语错误',
      'mistranslation': '误译',
      'omission': '漏译',
      'addition': '过度翻译',
      'grammar': '语法错误',
      'style': '风格问题',
      'punctuation': '标点问题',
      'consistency': '一致性问题',
    };
    
    return issueTypeMap[type] || type;
  };
  
  // Get severity color
  const getSeverityColor = (severity: 'high' | 'medium' | 'low'): string => {
    const colorMap: Record<string, string> = {
      'high': 'error',
      'medium': 'warning',
      'low': 'default',
    };
    
    return colorMap[severity] || 'default';
  };
  
  // Get severity label
  const getSeverityLabel = (severity: 'high' | 'medium' | 'low'): string => {
    const labelMap: Record<string, string> = {
      'high': '严重',
      'medium': '中等',
      'low': '轻微',
    };
    
    return labelMap[severity] || '未知';
  };
  
  // Render issue diff if available
  const renderIssueDiff = (issue: Issue) => {
    if (!issue.originalText || !issue.modifiedText) {
      return null;
    }
    
    return (
      <Card size="small" style={{ marginTop: 8, background: '#f5f5f5' }}>
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <HighlightOutlined /> 修改对比:
          </Text>
        </div>
        <div>
          <Text delete style={{ background: '#ffccc7', padding: '0 4px' }}>
            {issue.originalText}
          </Text>
          <br />
          <Text style={{ background: '#d9f7be', padding: '0 4px' }}>
            {issue.modifiedText}
          </Text>
        </div>
      </Card>
    );
  };
  
  if (issues.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Empty
          image={<CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />}
          description={
            <Text>
              该段落没有审校问题，译文质量良好
            </Text>
          }
        />
      </div>
    );
  }
  
  return (
    <div className="issue-panel">
      <Alert
        message={`发现 ${issues.length} 个问题`}
        description="以下是AI审校过程中发现的问题，请根据建议进行修改或确认"
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <List
        itemLayout="vertical"
        dataSource={issues}
        renderItem={(issue, index) => (
          <List.Item
            key={index}
          >
            <Card 
              title={
                <Space>
                  <WarningOutlined />
                  <Text strong>{getIssueTypeLabel(issue.type)}</Text>
                  <Tag color={getSeverityColor(issue.severity)}>
                    {getSeverityLabel(issue.severity)}
                  </Tag>
                </Space>
              }
              style={{ 
                borderLeft: `3px solid ${
                  issue.severity === 'high' ? '#ff4d4f' : 
                  issue.severity === 'medium' ? '#faad14' : 
                  '#d9d9d9'
                }` 
              }}
            >
              <div>
                <Paragraph>
                  <InfoCircleOutlined style={{ marginRight: 8 }} />
                  {issue.description}
                </Paragraph>
                
                {issue.suggestion && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        <DiffOutlined /> 建议修改:
                      </Text>
                      <Paragraph>{issue.suggestion}</Paragraph>
                      <Button 
                        type="primary" 
                        size="small" 
                        onClick={() => onApplyFix(issue.suggestion || '')}
                      >
                        应用此修改
                      </Button>
                    </div>
                  </>
                )}
                
                {renderIssueDiff(issue)}
              </div>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default IssuePanel; 