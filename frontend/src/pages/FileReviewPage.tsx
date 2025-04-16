import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getFileDetails,
  getFileSegments,
  updateSegment,
  ProjectFile,
  Segment,
  UpdateSegmentPayload,
  SegmentStatus,
} from '../api/fileService';
import {
  Layout, Typography, Button, Progress, Spin,
  Alert, Empty, Pagination, Select, Drawer, List,
  Collapse, Statistic, Badge, Space, Card, Modal, message
} from 'antd';
import {
  SortAscendingOutlined,
  SortDescendingOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import SegmentReview from '../components/review/SegmentReview';
import { axiosInstance as api } from '../api/base';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// KEEP UI state interface extending the imported Segment
interface EditableSegmentUI extends Segment {
  isEditing?: boolean;
  currentEditText: string;
  isSaving?: boolean;
  saveError?: string | null;
}

const FileReviewPage = () => {
  const { projectId, fileId } = useParams<{ projectId: string; fileId: string }>();
  const navigate = useNavigate();

  // Use the imported ProjectFile type for file details
  const [fileDetails, setFileDetails] = useState<ProjectFile | null>(null);
  const [editableSegments, setEditableSegments] = useState<EditableSegmentUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Renamed from segmentsPerPage for clarity with Pagination prop
  const [totalSegmentsCount, setTotalSegmentsCount] = useState(0); // Store total count for pagination

  // Filters and Sorting
  const [filterStatus, setFilterStatus] = useState<SegmentStatus[]>([]);
  const [filterIssues, setFilterIssues] = useState<boolean | undefined>(undefined); // Use undefined for "all"
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // UI State
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [terminology, setTerminology] = useState<Record<string, string>>({});

  // Fetch Core Data (File Details and Segments)
  const fetchData = useCallback(async () => {
    if (!fileId) {
      setError('File ID is missing');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      // Fetch file details using the service function
      const detailsRes = await getFileDetails(fileId);
      if (detailsRes.success && detailsRes.data) {
        setFileDetails(detailsRes.data); // Assume data matches ProjectFile type
      } else {
        throw new Error(detailsRes.message || 'Failed to load file details');
      }

      // Fetch segments based on current filters and pagination
      const params = {
        page: currentPage,
        limit: pageSize,
        sort: sortOrder === 'asc' ? 'segmentIndex' : '-segmentIndex', // Example sort field
        status: filterStatus.length > 0 ? filterStatus.join(',') : undefined,
        hasIssues: filterIssues,
      };
      const segmentsRes = await getFileSegments(fileId, params);

      if (segmentsRes.success && segmentsRes.data) {
        setTotalSegmentsCount(segmentsRes.data.total);
        // Map fetched Segment data to EditableSegmentUI for UI state
        const mappedSegments: EditableSegmentUI[] = segmentsRes.data.segments.map((seg: Segment) => ({
          ...seg,
          isEditing: false,
          // Initialize currentEditText: use humanReviewedText if available, else aiReviewed, else mt
          currentEditText: seg.humanReviewedText ?? seg.aiReviewedText ?? seg.mtText ?? '',
          isSaving: false,
          saveError: null,
        }));
        setEditableSegments(mappedSegments);
      } else {
        throw new Error(segmentsRes.message || 'Failed to load segments');
      }
    } catch (err: any) {
      console.error('Error fetching review data:', err);
      setError(err.message || 'An error occurred loading review data');
      setFileDetails(null); // Clear details on error
      setEditableSegments([]); // Clear segments on error
      setTotalSegmentsCount(0);
    } finally {
      setIsLoading(false);
    }
  // Depend on filters, sorting, pagination
  }, [fileId, currentPage, pageSize, filterStatus, filterIssues, sortOrder]);

  // Initial fetch and re-fetch on dependency change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch Terminology (can be separate)
  useEffect(() => {
    if (!fileId) return;
    const fetchTerminology = async () => {
      try {
        // Use the imported api client
        const response = await api.get<{ terms?: Record<string, string> }>(`/files/${fileId}/terminology`);
        setTerminology(response.data?.terms || {});
      } catch (error) {
        console.error('Error fetching terminology:', error);
        // Optionally show a non-blocking message to the user
      }
    };
    fetchTerminology();
  }, [fileId]);

  // Save segment changes (called by SegmentReview's onSave)
  const handleSaveSegment = useCallback(async (segmentId: string, reviewedText: string, status: SegmentStatus) => {
    const segmentIndex = editableSegments.findIndex(s => s._id === segmentId);
    if (segmentIndex === -1) return;

    setEditableSegments(prev => prev.map((seg, idx) =>
      idx === segmentIndex ? { ...seg, isSaving: true, saveError: null } : seg
    ));

    try {
        const payload: UpdateSegmentPayload = {
            humanReviewedText: reviewedText,
            status: status,
        };
        const response = await updateSegment(segmentId, payload); // Use imported service

        if (response.success && response.data) {
            const updatedSegmentData = response.data;
            setEditableSegments(prev => prev.map((seg, idx) =>
                idx === segmentIndex ? {
                    ...seg, // Keep existing editable segment fields
                    ...updatedSegmentData, // Update with fields from API response (like status, potentially updated reviewedText)
                    currentEditText: updatedSegmentData.humanReviewedText ?? '', // Reflect saved text
                    isEditing: false, // Exit edit mode on successful save
                    isSaving: false,
                    saveError: null
                } : seg
            ));
            message.success(`段落 ${segmentId} 已保存`);

            // Optimistically update file progress details if needed
            if (fileDetails) {
              // Recalculate counts based on the *new* status
              const previousStatus = editableSegments[segmentIndex].status;
              const completedChange = status === SegmentStatus.COMPLETED ? 1 : (previousStatus === SegmentStatus.COMPLETED ? -1 : 0);
              const pendingChange = status === SegmentStatus.PENDING_REVIEW ? 1 : (previousStatus === SegmentStatus.PENDING_REVIEW ? -1 : 0);

              const newCompleted = (fileDetails.completedSegments ?? 0) + completedChange;
              const newPending = (fileDetails.pendingSegments ?? 0) + pendingChange;
              const totalSegments = fileDetails.totalSegments ?? 0;
              const newProgress = totalSegments > 0 ? (newCompleted / totalSegments) * 100 : 0;

              setFileDetails(prev => prev ? ({
                 ...prev,
                 completedSegments: newCompleted,
                 pendingSegments: newPending,
                 progress: newProgress
              }) : null);
            }

        } else {
            throw new Error(response.message || 'Failed to save segment');
        }
    } catch (err: any) {
        console.error('Save segment error:', err);
        message.error(`保存段落 ${segmentId} 失败: ${err.message}`);
        setEditableSegments(prev => prev.map((seg, idx) =>
            idx === segmentIndex ? { ...seg, isSaving: false, saveError: err.message || 'Save failed' } : seg
        ));
        // Re-throw to allow SegmentReview to handle its state if needed
        throw err;
    }
  }, [editableSegments, fileDetails]); // Add dependencies


  // Navigate to the next logical segment or page
  const handleNextSegment = () => {
    // Find the index of the *next* segment that isn't completed
    const currentSegment = editableSegments.find(s => document.activeElement?.closest(`#segment-${s._id}`));
    const currentIdx = currentSegment ? editableSegments.indexOf(currentSegment) : -1;

    let nextIncompleteIdx = -1;
    for (let i = currentIdx + 1; i < editableSegments.length; i++) {
        if (editableSegments[i].status !== SegmentStatus.COMPLETED) {
            nextIncompleteIdx = i;
            break;
        }
    }

    if (nextIncompleteIdx !== -1) {
      // Focus next incomplete segment on the current page
      document.getElementById(`segment-${editableSegments[nextIncompleteIdx]._id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      // Potentially focus the textarea within that segment
      // document.querySelector(`#segment-${editableSegments[nextIncompleteIdx]._id} textarea`)?.focus();
    } else if (currentPage * pageSize < totalSegmentsCount) {
      // Go to the next page if available
      setCurrentPage(prev => prev + 1);
    } else {
      // All segments on all pages are potentially complete
      message.success('所有段落审校完成!');
      // Optionally show a modal confirmation
      Modal.success({
        title: '审校完成',
        content: '您已完成此文件所有段落的审校。',
        onOk: () => navigate(`/projects/${projectId}/files`) // Use projectId from useParams
      });
    }
  };

  // --- Render Logic ---

  if (isLoading && !fileDetails) { // Show loading spinner only on initial load
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="加载审校数据中..." />
      </div>
    );
  }

  if (error && !fileDetails) { // Show full page error if details failed to load
    return <Alert message="Error Loading Data" description={error} type="error" showIcon closable />;
  }

  if (!fileDetails) {
    return <Empty description="未找到文件详情" />;
  }

  // Calculate completion stats
  const completedCount = fileDetails.completedSegments ?? 0;
  const totalCount = fileDetails.totalSegments ?? 1; // Avoid division by zero
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Main Layout Render
  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Layout.Header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'white', 
        padding: '0 24px', 
        borderBottom: '1px solid #f0f0f0' 
      }}>
        <Space align="center">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(`/projects/${projectId}/files`)} // Use projectId from params
          >
            返回文件列表
          </Button>
          <FileTextOutlined style={{ fontSize: '20px', marginLeft: '16px' }} />
          {/* Use fileName from fileDetails */}
          <Title level={4} style={{ marginBottom: 0, marginLeft: '8px' }}>
            审校: {fileDetails.fileName}
          </Title>
        </Space>
        <Space>
          <Button onClick={() => setDrawerVisible(true)} icon={<InfoCircleOutlined />}>
            项目信息
          </Button>
          {/* Add other header actions if needed */}
        </Space>
      </Layout.Header>

     {/* Content Area */}
      <Layout.Content style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}> {/* Full height minus header */}
         {/* Filter/Pagination Bar */}
         <Card style={{ margin: '16px 16px 0', flexShrink: 0 }}> {/* No bottom margin */}
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
             <Space wrap>
               <Text strong>筛选:</Text>
               <Select<SegmentStatus[]>
                 mode="multiple"
                 placeholder="状态"
                 style={{ minWidth: 150 }}
                 value={filterStatus}
                 onChange={setFilterStatus}
                 maxTagCount={1}
                 allowClear
               >
                 <Option value={SegmentStatus.PENDING_REVIEW}>待审校</Option>
                 <Option value={SegmentStatus.EDITED}>审校中</Option>
                 <Option value={SegmentStatus.COMPLETED}>已完成</Option>
                 <Option value={SegmentStatus.REVIEWING}>进行中</Option>
               </Select>
               <Select<boolean | undefined>
                 placeholder="问题"
                 style={{ minWidth: 120 }}
                 value={filterIssues}
                 onChange={setFilterIssues}
                 allowClear
               >
                 <Option value={true}>有问题</Option>
                 <Option value={false}>无问题</Option>
               </Select>
             </Space>
             <Space wrap>
                <Badge count={fileDetails.pendingSegments ?? 0} showZero color="#faad14" style={{ marginRight: '10px' }}>
                  <Text>待审校</Text>
                </Badge>
                <Badge count={fileDetails.completedSegments ?? 0} showZero color="#52c41a">
                  <Text>已完成</Text>
                </Badge>
               <Button
                 icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                 onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
               >
                 排序
               </Button>
             </Space>
           </div>
           <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
             <Pagination
               current={currentPage}
               pageSize={pageSize}
               total={totalSegmentsCount}
               onChange={(page, size) => {
                   setCurrentPage(page);
                   if (size !== pageSize) setPageSize(size); // Update page size if changed
               }}
               onShowSizeChange={(_current, size) => { // Correct signature
                 setCurrentPage(1); // Reset page to 1 on size change
                 setPageSize(size);
               }}
               pageSizeOptions={[5, 10, 20, 50]}
               showSizeChanger
               showQuickJumper
               showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`} // Correct signature
             />
           </div>
         </Card>

         {/* Scrollable Segment List */}
         <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px', background: '#f0f2f5' }}>
           {isLoading ? (
             <div style={{ textAlign: 'center', padding: '50px' }}>
               <Spin size="large" />
             </div>
           ) : editableSegments.length === 0 ? (
             <Empty description={filterStatus.length > 0 || filterIssues !== undefined ? "没有符合筛选条件的段落" : "此文件没有段落"} />
           ) : (
             <div style={{ maxWidth: '1000px', margin: '0 auto' }}> {/* Optional max-width */}
               {editableSegments.map((segment) => (
                 <div id={`segment-${segment._id}`} key={segment._id} style={{ marginBottom: '16px' }}>
                   <SegmentReview
                     // Pass Segment data
                     segmentId={segment._id}
                     sourceText={segment.sourceText}
                     aiTranslation={segment.mtText || ''}
                     // Pass editable text from UI state
                     aiReviewedTranslation={segment.currentEditText}
                     status={segment.status} // Pass status directly
                     issues={segment.issues || []} // Ensure issues is an array
                     // Pass handlers
                     onSave={handleSaveSegment} // Pass generic save handler
                     onNext={handleNextSegment}
                     terminology={terminology}
                     // Pass UI state flags
                     isSaving={segment.isSaving}
                     saveError={segment.saveError}
                   />
                 </div>
               ))}
             </div>
           )}
         </div>
      </Layout.Content>

      {/* Drawer */}
      <Drawer
        title="文件详情"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={Math.min(450, window.innerWidth - 40)} // Responsive width
      >
        {fileDetails && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Statistic title="文件名称" value={fileDetails.fileName} />
            <Statistic title="原始名称" value={fileDetails.originalFilename ?? '-'} />
            <Statistic title="语言对" value={`${fileDetails.sourceLanguage} → ${fileDetails.targetLanguage}`} />
            <Statistic title="文件状态" value={fileDetails.status || '-'} />

            <Collapse defaultActiveKey={['progress']} bordered={false}>
              <Panel header="进度统计" key="progress">
                <List size="small">
                  <List.Item>总段落数 <Text strong style={{float: 'right'}}>{fileDetails.totalSegments ?? 0}</Text></List.Item>
                  <List.Item>已完成 <Text strong style={{float: 'right', color: '#52c41a'}}>{fileDetails.completedSegments ?? 0}</Text></List.Item>
                  <List.Item>待审校 <Text strong style={{float: 'right', color: '#faad14'}}>{fileDetails.pendingSegments ?? 0}</Text></List.Item>
                  <List.Item>整体进度 <Progress percent={progressPercent} size="small" /></List.Item>
                </List>
              </Panel>
            </Collapse>

             <Collapse bordered={false}>
                <Panel header="项目信息" key="project">
                     {/* Here you might need to fetch project details separately if not included */}
                     <Button
                         type="link"
                         icon={<FileTextOutlined />}
                         onClick={() => navigate(`/projects/${projectId}`)} // Use projectId from params
                         style={{padding: 0}}
                     >
                         查看项目详情 (ID: {projectId})
                     </Button>
                </Panel>
             </Collapse>
            <Text type="secondary" style={{ fontSize: '12px' }}>创建时间: {new Date(fileDetails.createdAt).toLocaleString()}</Text>

          </Space>
        )}
      </Drawer>
    </Layout>
  );
};

export default FileReviewPage; 