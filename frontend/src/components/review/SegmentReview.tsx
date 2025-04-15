import { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Divider, Button, Input, Tag, Tooltip, Space, Popconfirm, Alert } from 'antd';
import { CheckOutlined, WarningOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { markupToReact } from '../../utils/markupUtils';
import { SegmentStatus, Issue } from '../../api/fileService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SegmentReviewProps {
  segmentId: string;
  sourceText: string;
  aiTranslation: string;
  aiReviewedTranslation: string;
  status: SegmentStatus;
  issues: Issue[];
  onSave: (segmentId: string, reviewedText: string, status: SegmentStatus) => Promise<void>;
  onNext: () => void;
  terminology?: { [key: string]: string };
  isSaving?: boolean;
  saveError?: string | null;
}

const SegmentReview = ({
  segmentId,
  sourceText,
  aiTranslation,
  aiReviewedTranslation,
  status,
  issues,
  onSave,
  onNext,
  terminology = {},
  isSaving = false,
  saveError = null
}: SegmentReviewProps) => {
  const [editMode, setEditMode] = useState(false);
  const [editedTranslation, setEditedTranslation] = useState(aiReviewedTranslation);
  const [highlightedTerms, setHighlightedTerms] = useState<string[]>([]);

  useEffect(() => {
    setEditedTranslation(aiReviewedTranslation);
    if (status === SegmentStatus.COMPLETED) {
      setEditMode(false);
    }
  }, [aiReviewedTranslation, status]);

  useEffect(() => {
    const terms = Object.keys(terminology);
    const found = terms.filter(term => 
      sourceText.toLowerCase().includes(term.toLowerCase())
    );
    setHighlightedTerms(found);
  }, [sourceText, terminology]);

  const handleSave = async (completeReview = false) => {
    try {
      const newStatus = completeReview ? SegmentStatus.COMPLETED : SegmentStatus.EDITED;
      await onSave(segmentId, editedTranslation, newStatus);
      
      if (completeReview) {
        onNext();
      }
    } catch (error) {
      console.error('Error saving segment review (handled by parent):', error);
    }
  };

  const renderIssueTag = (issue: Issue) => {
    let color = '';
    let icon = null;
    
    switch (issue.severity) {
      case 'high':
        color = 'error';
        icon = <WarningOutlined />;
        break;
      case 'medium':
        color = 'warning';
        break;
      case 'low':
        color = 'default';
        break;
    }
    
    return (
      <Tooltip title={issue.description} key={issue.id}>
        <Tag color={color} icon={icon} style={{ marginBottom: 8 }}>
          {issue.type}
        </Tag>
      </Tooltip>
    );
  };

  const renderSourceText = () => {
    let result = sourceText;
    highlightedTerms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      result = result.replace(regex, `<term>$1</term>`);
    });
    
    return markupToReact(result, {
      term: (content: string) => (
        <Tooltip title={`术语: ${terminology[content.toLowerCase()]}`}>
          <Text mark>{content}</Text>
        </Tooltip>
      )
    });
  };

  return (
    <Card 
      bordered 
      style={{ marginBottom: 16, border: saveError ? '1px solid red' : undefined }}
      className={`segment-card ${status === SegmentStatus.COMPLETED ? 'segment-completed' : ''}`}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">段落ID: {segmentId}</Text>
            <Space>
              {status === SegmentStatus.COMPLETED && (
                <Tag color="success" icon={<CheckOutlined />}>已确认</Tag>
              )}
              {status === SegmentStatus.EDITED && (
                <Tag color="processing">审校中</Tag>
              )}
              {status === SegmentStatus.REVIEWING && (
                <Tag color="blue">进行中</Tag>
              )}
              {issues.length > 0 && (
                <Tooltip title={issues.map(iss => `${iss.type}: ${iss.description}`).join(' | ')}>
                  <Tag color="warning" icon={<WarningOutlined />}>
                    {issues.length} 个问题
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </div>
        </Col>
        
        <Col span={24}>
          <Title level={5}>原文</Title>
          <Paragraph style={{ 
            padding: 12, 
            background: '#f9f9f9', 
            borderRadius: 4,
            marginBottom: 8
          }}>
            {renderSourceText()}
          </Paragraph>
        </Col>
        
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5}>AI翻译</Title>
          </div>
          <Paragraph style={{ 
            padding: 12, 
            background: '#f5f5f5', 
            borderRadius: 4,
            marginBottom: 8
          }}>
            {aiTranslation}
          </Paragraph>
        </Col>
        
        <Col span={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5}>AI审校结果</Title>
          </div>
          
          {editMode ? (
            <>
              <TextArea
                value={editedTranslation}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedTranslation(e.target.value)}
                autoSize={{ minRows: 3, maxRows: 6 }}
                style={{ marginBottom: 16 }}
                disabled={isSaving}
              />
              {saveError && <Alert message={saveError} type="error" showIcon style={{marginBottom: '8px'}}/>}
              <Space>
                <Button onClick={() => setEditMode(false)} disabled={isSaving}>
                  取消
                </Button>
                <Button 
                  type="default" 
                  onClick={() => handleSave(false)}
                  loading={isSaving && status !== SegmentStatus.COMPLETED}
                  disabled={isSaving}
                >
                  保存修改
                </Button>
                <Popconfirm
                  title="确认此段落翻译?"
                  description="确认后将标记为已完成"
                  onConfirm={() => handleSave(true)}
                  okText="确认"
                  cancelText="取消"
                  icon={<QuestionCircleOutlined style={{ color: 'green' }} />}
                  disabled={isSaving}
                >
                  <Button 
                    type="primary" 
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    icon={<CheckOutlined />}
                    loading={isSaving && status === SegmentStatus.COMPLETED}
                    disabled={isSaving}
                  >
                    确认通过
                  </Button>
                </Popconfirm>
                <Button onClick={onNext} disabled={isSaving}>下一段 &rarr;</Button>
              </Space>
            </>
          ) : (
            <Paragraph 
              style={{ 
                padding: 12, 
                background: status === SegmentStatus.COMPLETED ? '#f6ffed' : '#f0f7ff',
                borderRadius: 4,
                border: `1px solid ${status === SegmentStatus.COMPLETED ? '#b7eb8f' : '#d6e4ff'}`,
                marginBottom: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setEditMode(true)}
            >
              {editedTranslation || aiReviewedTranslation}
            </Paragraph>
          )}
        </Col>
        
        {issues.length > 0 && (
          <Col span={24}>
            <Divider orientation="left">问题 & 修改建议</Divider>
            <Space wrap>
              {issues.map(renderIssueTag)}
            </Space>
          </Col>
        )}
      </Row>
    </Card>
  );
};

export default SegmentReview; 