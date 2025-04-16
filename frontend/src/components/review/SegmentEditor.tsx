import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Space, Card, Tooltip, Badge, Divider } from 'antd';
import { CheckCircleOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface Segment {
  id: string;
  segmentNumber: number;
  source: string;
  target: string;
  status: 'pending' | 'confirmed';
  aiSuggestion?: string;
  issues?: Array<{
    type: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

interface SegmentEditorProps {
  segment: Segment;
  onUpdate: (segmentId: string, translation: string, confirmed: boolean) => void;
  isUpdating: boolean;
}

const SegmentEditor: React.FC<SegmentEditorProps> = ({
  segment,
  onUpdate,
  isUpdating,
}) => {
  const [form] = Form.useForm();
  const [editedTranslation, setEditedTranslation] = useState(segment.target);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Reset form and state when segment changes
  useEffect(() => {
    form.setFieldsValue({ translation: segment.target });
    setEditedTranslation(segment.target);
    setHasChanges(false);
  }, [segment, form]);
  
  // Handle translation change
  const handleTranslationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTranslation = e.target.value;
    setEditedTranslation(newTranslation);
    setHasChanges(newTranslation !== segment.target);
  };
  
  // Handle reset
  const handleReset = () => {
    form.setFieldsValue({ translation: segment.target });
    setEditedTranslation(segment.target);
    setHasChanges(false);
  };
  
  // Handle confirm
  const handleConfirm = () => {
    onUpdate(segment.id, editedTranslation, true);
  };
  
  // Handle save without confirming
  const handleSave = () => {
    onUpdate(segment.id, editedTranslation, false);
  };
  
  // Determine if there are issues
  const hasIssues = segment.issues && segment.issues.length > 0;
  
  return (
    <div className="segment-editor">
      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={5} style={{ margin: 0 }}>段落 #{segment.segmentNumber}</Title>
            {segment.status === 'confirmed' ? (
              <Badge status="success" text="已确认" />
            ) : hasIssues ? (
              <Badge status="warning" text="有问题" />
            ) : (
              <Badge status="default" text="待确认" />
            )}
          </Space>
          
          <Space>
            {hasChanges && (
              <Button 
                icon={<UndoOutlined />} 
                onClick={handleReset}
                size="small"
              >
                重置
              </Button>
            )}
          </Space>
        </div>
        
        <Card
          title={
            <Text strong>原文</Text>
          }
          type="inner"
          style={{ marginBottom: 16 }}
        >
          <Paragraph>{segment.source}</Paragraph>
        </Card>
        
        <Card
          title={
            <Text strong>译文</Text>
          }
          type="inner"
          extra={
            <Tooltip title="编辑译文">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => {
                  // Focus the textarea
                  const textarea = document.getElementById(`translation-${segment.id}`);
                  if (textarea) {
                    textarea.focus();
                  }
                }} 
              />
            </Tooltip>
          }
        >
          <Form form={form} layout="vertical" initialValues={{ translation: segment.target }}>
            <Form.Item name="translation">
              <TextArea
                id={`translation-${segment.id}`}
                rows={4}
                onChange={handleTranslationChange}
                status={hasIssues ? 'warning' : ''}
              />
            </Form.Item>
          </Form>
        </Card>
        
        {segment.aiSuggestion && (
          <>
            <Divider dashed style={{ margin: '16px 0' }} />
            
            <Card
              title={
                <Text strong>AI审校建议</Text>
              }
              type="inner"
              style={{ marginBottom: 16, borderColor: '#1890ff' }}
            >
              <Paragraph>{segment.aiSuggestion}</Paragraph>
              <Button 
                type="link" 
                onClick={() => {
                  form.setFieldsValue({ translation: segment.aiSuggestion });
                  setEditedTranslation(segment.aiSuggestion || '');
                  setHasChanges(segment.aiSuggestion !== segment.target);
                }}
                style={{ padding: 0 }}
              >
                应用建议
              </Button>
            </Card>
          </>
        )}
        
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            {hasChanges && (
              <Button 
                onClick={handleSave} 
                loading={isUpdating}
              >
                保存
              </Button>
            )}
            
            <Button 
              type="primary" 
              icon={<CheckCircleOutlined />} 
              onClick={handleConfirm}
              loading={isUpdating}
              disabled={segment.status === 'confirmed' && !hasChanges}
            >
              {segment.status === 'confirmed' ? '已确认' : '确认'}
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default SegmentEditor; 