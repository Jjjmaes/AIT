import React from 'react';
import { Typography, Progress, Card, List, Tag, Button, Space, Empty, Alert, Spin, Statistic, Row, Col } from 'antd';
import { CheckCircleOutlined, SyncOutlined, WarningOutlined, FileTextOutlined } from '@ant-design/icons';
import { TranslationStatusResponse } from '../../api/translation';

const { Title, Text, Paragraph } = Typography;

interface TranslationProgressProps {
  jobId: string | null;
  status: TranslationStatusResponse | null;
  isLoading: boolean;
  onViewReview: (fileId: string) => void;
}

const TranslationProgress: React.FC<TranslationProgressProps> = ({
  jobId,
  status,
  isLoading,
  onViewReview,
}) => {
  // --- Add Log --- 
  console.log('[TranslationProgress] Rendering with props:', { jobId, status, isLoading });
  // --- End Log ---

  if (!jobId) {
    return (
      <Empty description="暂无翻译任务" />
    );
  }

  if (isLoading && !status) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>正在获取翻译状态...</Text>
        </div>
      </div>
    );
  }

  // Determine overall progress
  const overallProgress = status?.progress || 0;
  const isCompleted = status?.status === 'completed';
  const hasErrors = status?.errors && status.errors.length > 0;

  // Determine status text and color
  let statusText = '进行中';
  let statusIcon = <SyncOutlined spin />;

  if (isCompleted) {
    statusText = '已完成';
    statusIcon = <CheckCircleOutlined />;
  } else if (hasErrors) {
    statusText = '有错误';
    statusIcon = <WarningOutlined />;
  }

  return (
    <div className="translation-progress">
      <Card bordered={false}>
        <Title level={4}>翻译进度</Title>
        
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Statistic 
              title="总体进度" 
              value={overallProgress} 
              suffix="%" 
              precision={1}
              valueStyle={{ color: isCompleted ? '#3f8600' : '#1890ff' }}
            />
            <Progress 
              percent={overallProgress} 
              status={isCompleted ? "success" : "active"} 
              style={{ marginTop: 8 }}
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="状态" 
              value={statusText}
              valueStyle={{ color: isCompleted ? '#3f8600' : '#1890ff' }}
              prefix={statusIcon}
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="已处理文件" 
              value={status?.completedFiles || 0} 
              suffix={`/ ${status?.totalFiles || 0}`}
            />
          </Col>
        </Row>

        {hasErrors && (
          <Alert
            message="翻译过程中遇到问题"
            description={
              <div>
                <Paragraph>部分文件可能未能成功翻译。请查看下方详情。</Paragraph>
                <ul>
                  {status?.errors?.map((error: any, index: number) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Title level={5}>文件处理详情</Title>
        <List
          itemLayout="horizontal"
          dataSource={status?.files || []}
          renderItem={(file: any) => {
            // --- Add Log ---
            console.log('[TranslationProgress] Rendering file item:', file);
            // --- End Log ---
            const fileStatus = file.status;
            let statusTag;
            
            switch (fileStatus) {
              case 'QUEUED':
                statusTag = <Tag color="default">队列中</Tag>;
                break;
              case 'TRANSLATING':
                statusTag = <Tag icon={<SyncOutlined spin />} color="processing">翻译中</Tag>;
                break;
              case 'REVIEWING':
                statusTag = <Tag icon={<SyncOutlined spin />} color="processing">AI审校中</Tag>;
                break;
              case 'TRANSLATED':
                statusTag = <Tag icon={<CheckCircleOutlined />} color="success">翻译完成</Tag>;
                break;
              case 'ERROR':
                statusTag = <Tag color="error">错误</Tag>;
                break;
              default:
                statusTag = <Tag color="default">未知</Tag>;
            }
            
            return (
              <List.Item
                actions={[
                  fileStatus === 'TRANSLATED' && (
                    <Button 
                      type="link" 
                      icon={<FileTextOutlined />}
                      onClick={() => onViewReview(file.id)}
                    >
                      查看审校
                    </Button>
                  )
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text>{file.originalName}</Text>
                      {statusTag}
                    </Space>
                  }
                  description={
                    <div>
                      <Text type="secondary">{file.sourceLanguage} → {file.targetLanguage}</Text>
                      <div style={{ marginTop: 8 }}>
                        <Progress 
                          percent={file.progress || 0} 
                          size="small" 
                          status={
                            fileStatus === 'ERROR' 
                              ? 'exception' 
                              : fileStatus === 'TRANSLATED' 
                                ? 'success' 
                                : 'active'
                          }
                        />
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
        
        {isCompleted && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Paragraph type="success">
              <CheckCircleOutlined /> AI 翻译已完成！请返回上一页面，点击“提交审校”按钮进行自动审校。
            </Paragraph>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TranslationProgress; 