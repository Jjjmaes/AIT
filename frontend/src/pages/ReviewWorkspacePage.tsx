import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, Card, Tabs, Button, Alert, Spin, Space, 
  Badge, Row, Col, Statistic, Divider
} from 'antd';
import { 
  FileTextOutlined, SaveOutlined 
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';

import { 
  getFileDetails, 
  getFileSegments, 
  updateSegment,   
  ProjectFile,     
  Segment,         
  SegmentStatus as BackendSegmentStatus,
} from '../api/fileService'; 

import SegmentList from '../components/review/SegmentList';
import SegmentEditor from '../components/review/SegmentEditor';
import ReviewFilter from '../components/review/ReviewFilter';
import IssuePanel from '../components/review/IssuePanel';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Local status enum for ReviewFilter component (matches its internal definition)
enum SegmentStatus { 
  ALL = 'all',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  WITH_ISSUES = 'with_issues'
}

// --- Helper Function to Map Segment Data --- 
const mapSegmentForUI = (segment: Segment | undefined): any | undefined => {
  if (!segment) return undefined;
  return {
    id: segment._id, 
    segmentNumber: segment.segmentIndex, 
    source: segment.sourceText, 
    target: segment.humanReviewedText ?? segment.aiReviewedText ?? segment.mtText ?? '', 
    // Map backend status to the simple status expected by UI components
    status: segment.status === BackendSegmentStatus.COMPLETED ? 'confirmed' : 'pending',
    issues: segment.issues, 
    aiSuggestion: segment.aiReviewedText 
  };
};

const ReviewWorkspacePage: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State for current segment and filters
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<SegmentStatus>(SegmentStatus.ALL); 
  const [filterIssueType, setFilterIssueType] = useState<string | null>(null);
  
  // Fetch file data
  const { 
    data: file,
    isLoading: fileLoading, 
    error: fileError 
  } = useQuery({
    queryKey: ['file', fileId],
    queryFn: () => getFileDetails(fileId as string),
    enabled: !!fileId,
    select: (res): ProjectFile | undefined => res?.data
  });

  // Build filter parameters for API call
  const buildFilterParams = () => {
    const params: { status?: string; hasIssues?: boolean; issueType?: string } = {};
    
    // Map local SegmentStatus (from ReviewFilter) to backend BackendSegmentStatus
    if (filterStatus === SegmentStatus.PENDING) {
      params.status = BackendSegmentStatus.PENDING_REVIEW; // Adjust as needed
    } else if (filterStatus === SegmentStatus.CONFIRMED) {
      params.status = BackendSegmentStatus.COMPLETED; 
    } else if (filterStatus === SegmentStatus.WITH_ISSUES) {
      params.hasIssues = true; 
    }
    
    if (filterIssueType) {
      params.issueType = filterIssueType;
    }
    
    return params;
  };

  // Fetch segments with filtering
  const { 
    data: segmentsData, 
    isLoading: segmentsLoading, 
    error: segmentsError 
  } = useQuery({
    queryKey: ['fileSegments', fileId, filterStatus, filterIssueType],
    queryFn: () => getFileSegments(fileId as string, buildFilterParams()),
    enabled: !!fileId,
    // Data structure from API: { segments: Segment[], total: number }
    select: (res): { segments: Segment[], total: number } | undefined => res?.data 
  });

  // Set first segment as current when data loads
  useEffect(() => {
    // Reset current segment if the segments list is empty or loading
    if (segmentsLoading || !segmentsData?.segments || segmentsData.segments.length === 0) {
      setCurrentSegmentId(null);
      return;
    }
    // If no segment is selected, or the selected one is not in the current list, select the first one
    const currentSegmentExists = segmentsData.segments.some(s => s._id === currentSegmentId);
    if (!currentSegmentId || !currentSegmentExists) {
       setCurrentSegmentId(segmentsData.segments[0]._id); 
    }

  }, [segmentsData, segmentsLoading, currentSegmentId]);

  // Find the original segment object from the fetched data
  const originalCurrentSegment = segmentsData?.segments?.find(
    (segment: Segment) => segment._id === currentSegmentId
  );
  // Map the segment for UI components
  const currentSegmentForUI = mapSegmentForUI(originalCurrentSegment);

  // Mutation to update segment status via fileService.updateSegment
  const confirmSegmentMutation = useMutation({
    mutationFn: (params: {
      segmentId: string; 
      translation: string;
    }) => updateSegment(params.segmentId, { 
        humanReviewedText: params.translation, 
        status: BackendSegmentStatus.COMPLETED // Use backend enum
    }),
    onSuccess: (updatedSegment) => { 
      queryClient.invalidateQueries({ queryKey: ['fileSegments', fileId] });
      message.success(`段落 ${updatedSegment.data?.segmentIndex ?? ''} 已确认`);
    },
    onError: (error: any) => {
      message.error(`确认段落失败: ${error?.message || '未知错误'}`);
    }
  });

  // Batch confirm segments mutation - Placeholder
  const batchConfirmMutation = useMutation({
    mutationFn: async (/* params */ { /* fileId, */ segmentIds }: { // Removed unused fileId destructuring
      fileId: string;
      segmentIds: string[]; 
    }) => {
        console.warn('Batch confirm function not implemented yet. Using placeholder.');
        let success = true;
        for (const segmentId of segmentIds) {
            try {
                const segmentToConfirm = segmentsData?.segments?.find(s => s._id === segmentId);
                if (segmentToConfirm) {
                    await updateSegment(segmentId, {
                        humanReviewedText: segmentToConfirm.humanReviewedText ?? segmentToConfirm.aiReviewedText ?? segmentToConfirm.mtText ?? '',
                        status: BackendSegmentStatus.COMPLETED // Use backend enum
                    });
                } else {
                     console.warn(`Segment ${segmentId} not found for batch confirm`);
                }
            } catch (e) {
                console.error(`Failed to batch confirm segment ${segmentId}:`, e);
                success = false;
            }
        }
        return { success };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['fileSegments', fileId] });
      if (result.success) {
          message.success('选定段落已批量确认');
      } else {
          message.error('批量确认过程中部分段落失败');
      }
    },
    onError: (error: any) => {
      message.error(`批量确认失败: ${error?.message || '未知错误'}`);
    }
  });

  // Handle segment selection from SegmentList (receives _id)
  const handleSelectSegment = (segmentId: string) => { 
    setCurrentSegmentId(segmentId);
  };

  // Handle save/confirm action from SegmentEditor
  // SegmentEditor calls this with its internal ID (mapped from _id) and the new text
  const handleUpdateSegment = (segmentId: string, translation: string) => {
    // The segmentId received here is the mapped ID (_id)
    confirmSegmentMutation.mutate({
      segmentId,
      translation,
    });
  };

  // Handle batch confirm action
  const handleBatchConfirm = (segmentIds: string[]) => { // Receives _ids
    if (segmentIds.length === 0) {
      message.warning('请选择要批量确认的段落');
      return;
    }
    batchConfirmMutation.mutate({
      fileId: fileId as string, 
      segmentIds
    });
  };

  // Handle filter changes from ReviewFilter
  const handleFilterChange = (status: SegmentStatus, issueType: string | null) => {
    setFilterStatus(status);
    setFilterIssueType(issueType);
  };

  // Loading state
  if (fileLoading || segmentsLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>加载审校工作区...</Text>
        </div>
      </div>
    );
  }

  // Error state
  if (fileError || segmentsError) {
    const error = fileError || segmentsError;
    return (
      <Alert 
        type="error" 
        message="加载失败" 
        description={(error as Error)?.message || "无法加载文件或段落数据，请刷新页面重试。"} 
        showIcon 
      />
    );
  }
  
  if (!file) {
     return <Alert message="错误" description="无法加载文件数据" type="error" showIcon />;
  }

  // Prepare mapped segments for SegmentList
  const segmentsForUI = segmentsData?.segments?.map(mapSegmentForUI) || [];

  // Calculate statistics based on original segment data
  const totalSegments = segmentsData?.total || 0;
  const confirmedCount = segmentsData?.segments?.filter((s: Segment) => s.status === BackendSegmentStatus.COMPLETED).length || 0;
  const issuesCount = segmentsData?.segments?.filter((s: Segment) => s.issues && s.issues.length > 0).length || 0;
  const progress = totalSegments > 0 ? Math.round((confirmedCount / totalSegments) * 100) : 0;

  return (
    <div className="review-workspace">
      <Card>
        <div className="review-header">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={3} style={{ margin: 0 }}>
                  <FileTextOutlined /> 审校工作区: {file?.fileName}
                </Title>
                <Text type="secondary">
                  (原始文件名: {file?.originalFilename})
                </Text>
              </Col>
              <Col>
                <Space>
                  <Button 
                    icon={<SaveOutlined />} 
                    onClick={() => navigate(`/projects/${file?.projectId}`)}
                    disabled={!file?.projectId}
                  >
                    完成审校
                  </Button>
                </Space>
              </Col>
            </Row>
            {/* Statistics Row */}
            <Row gutter={16}>
              <Col><Statistic title="总段落数" value={totalSegments} /></Col>
              <Col><Statistic title="已确认" value={confirmedCount} /></Col>
              <Col><Statistic title="待处理" value={totalSegments - confirmedCount} /></Col>
              <Col><Statistic title="含问题" value={issuesCount} /></Col>
              <Col><Statistic title="进度" value={progress} suffix="%" /></Col>
            </Row>
          </Space>
        </div>

        <Divider />

        <Row gutter={16} className="review-main-content">
          {/* Left Column: Filters and Segment List */}
          <Col xs={24} md={8} lg={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <ReviewFilter 
                status={filterStatus} 
                issueType={filterIssueType}
                onChange={handleFilterChange} 
              />
              <SegmentList 
                segments={segmentsForUI} 
                currentSegmentId={currentSegmentId} 
                onSelectSegment={handleSelectSegment} 
              />
            </Space>
          </Col>

          {/* Right Column: Editor and Issue Panel */}
          <Col xs={24} md={16} lg={18}>
             {currentSegmentForUI ? (
              <Tabs defaultActiveKey="editor" className="review-tabs">
                <TabPane tab="段落编辑器" key="editor">
                  <SegmentEditor 
                    segment={currentSegmentForUI} 
                    onUpdate={handleUpdateSegment} 
                    isUpdating={confirmSegmentMutation.isPending}
                  />
                </TabPane>
                <TabPane tab={<Badge count={currentSegmentForUI.issues?.length || 0}>问题面板</Badge>} key="issues">
                  <IssuePanel 
                    segment={currentSegmentForUI} 
                    onApplyFix={(fixedTranslation) => { 
                        if (currentSegmentForUI?.id) {
                            handleUpdateSegment(currentSegmentForUI.id, fixedTranslation);
                        }
                    }}
                  />
                </TabPane>
              </Tabs>
            ) : (
              <Card style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Text type="secondary">请从左侧列表中选择一个段落进行审校。</Text>
              </Card>
            )}
          </Col>
        </Row>
        
        <Divider />
        <div className="review-footer">
           <Button 
             onClick={() => handleBatchConfirm(segmentsData?.segments?.filter(s => s.status !== BackendSegmentStatus.COMPLETED).map(s => s._id) || [])}
             disabled={batchConfirmMutation.isPending || segmentsLoading}
             loading={batchConfirmMutation.isPending}
           >
             确认所有未确认段落
           </Button>
        </div>

      </Card>
    </div>
  );
};

export default ReviewWorkspacePage; 