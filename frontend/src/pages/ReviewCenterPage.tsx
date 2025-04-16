import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Space, Input, Button, Typography, Statistic,
  Row, Col, Segmented, Empty, Spin, message, Tooltip
} from 'antd';
import {
  SearchOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined,
  ArrowRightOutlined, FileSearchOutlined, FireOutlined, EditOutlined, EyeOutlined, FlagOutlined, GlobalOutlined, SyncOutlined, WarningOutlined,
  RedoOutlined, SendOutlined // For Retry
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
// Import from the NEW reviewService
import { getReviewTasks, retryReviewTask, ReviewTask, ReviewStats } from '../api/reviewService';
// Import shared configs if applicable, or define review-specific ones
// Assuming statusConfigs from TranslationCenterPage contains necessary review statuses
// Adjust this import path if TranslationCenterPage is in a different directory
// You might need to export statusConfigs and priorityConfigs from TranslationCenterPage or move them to a shared location.
const commonStatusConfigs = {
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待处理' },
    preprocessing: { color: 'processing', icon: <SyncOutlined spin />, text: '预处理中' },
    ready_for_translation: { color: 'cyan', icon: <SendOutlined />, text: '待翻译' },
    in_translation_queue: { color: 'purple', icon: <ClockCircleOutlined />, text: '翻译队列中'},
    translating: { color: 'processing', icon: <SyncOutlined spin />, text: '翻译中' },
    translation_failed: { color: 'error', icon: <WarningOutlined />, text: '翻译失败' },
    translated_pending_confirmation: { color: 'warning', icon: <EyeOutlined />, text: '待确认翻译' },
    translation_confirmed: { color: 'success', icon: <CheckCircleOutlined />, text: '翻译已确认'},
    in_review_queue: { color: 'purple', icon: <ClockCircleOutlined />, text: '审校队列中'},
    reviewing: { color: 'processing', icon: <SyncOutlined spin />, text: '审校中' },
    review_failed: { color: 'error', icon: <WarningOutlined />, text: '审校失败' },
    reviewed_pending_confirmation: { color: 'warning', icon: <FileSearchOutlined />, text: '待确认审校' },
    completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
};

const priorityConfigs = {
  low: { color: 'blue', icon: <FlagOutlined />, text: '低' },
  medium: { color: 'orange', icon: <FlagOutlined />, text: '中' },
  high: { color: 'red', icon: <FireOutlined />, text: '高' },
};


const { Title, Text } = Typography;

// Define statuses specifically relevant for the Review Center UI
// You can merge commonStatusConfigs or define entirely new ones
const reviewStatusConfigs = {
  in_review_queue: commonStatusConfigs.in_review_queue || { color: 'purple', icon: <ClockCircleOutlined />, text: '审校队列中'},
  reviewing: commonStatusConfigs.reviewing || { color: 'processing', icon: <SyncOutlined spin />, text: '审校中' },
  review_failed: commonStatusConfigs.review_failed || { color: 'error', icon: <WarningOutlined />, text: '审校失败' },
  reviewed_pending_confirmation: commonStatusConfigs.reviewed_pending_confirmation || { color: 'warning', icon: <FileSearchOutlined />, text: '待确认审校' },
  completed: commonStatusConfigs.completed || { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' }, // Review confirmed = completed
  // Add other statuses if needed
};

const ReviewCenterPage: React.FC = () => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, completed: 0, pending: 0, inProgress: 0 /* Initialize based on ReviewStats */ });
  const [searchText, setSearchText] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string | number>('All');
  const navigate = useNavigate();

  const fetchReviewTasks = async () => {
      setLoading(true);
      try {
        const { tasks: fetchedTasks, stats: fetchedStats } = await getReviewTasks();
        setTasks(fetchedTasks);
        setStats(fetchedStats);
      } catch (err) {
        console.error('加载审校任务失败', err);
        message.error('Failed to load review tasks.');
        setTasks([]);
         // Reset stats based on ReviewStats interface
        setStats({ total: 0, completed: 0, pending: 0, inProgress: 0 /* Reset other expected keys */ });
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchReviewTasks();
  }, []);

  const handleRetryReviewTask = async (taskId: string) => {
    message.loading({ content: `Retrying review task ${taskId}...`, key: `retry-review-${taskId}` });
    try {
      await retryReviewTask(taskId);
      message.success({ content: `Review task ${taskId} submitted for retry.`, key: `retry-review-${taskId}`, duration: 2 });
      fetchReviewTasks(); // Refresh list after retry
    } catch (error) {
      message.error({ content: `Failed to retry review task ${taskId}.`, key: `retry-review-${taskId}`, duration: 2 });
      console.error("Review retry failed:", error);
    }
  };

  // Define table columns (similar to TranslationCenterPage, adjust as needed)
  const columns = [
    // File Name, Project, Languages, Word Count etc. (reuse from TranslationCenterPage columns if identical)
     {
        title: '文件名', dataIndex: 'fileName', key: 'fileName',
        render: (text: string) => (<Space><FileTextOutlined /> <Text strong>{text}</Text></Space>)
     },
     { title: '项目', dataIndex: 'projectName', key: 'projectName'},
     {
        title: '语言', key: 'languages',
        render: (_: any, record: ReviewTask) => (
            <Space>
              <Tag icon={<GlobalOutlined />}>{record.sourceLang}</Tag> <ArrowRightOutlined /> <Tag icon={<GlobalOutlined />} color="blue">{record.targetLang}</Tag>
            </Space>
        )
     },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      // Use reviewStatusConfigs for filters and rendering
      filters: Object.entries(reviewStatusConfigs).map(([value, config]) => ({ text: config.text, value })),
      onFilter: (value: any, record: ReviewTask) => record.status === value,
      render: (status: string) => {
        const config = reviewStatusConfigs[status as keyof typeof reviewStatusConfigs];
        if (!config) return <Tag>Unknown: {status}</Tag>;
        return <Tag icon={config.icon} color={config.color as any}>{config.text}</Tag>;
      }
    },
    {
        title: '优先级', dataIndex: 'priority', key: 'priority',
        // Reuse priorityConfigs if applicable
        filters: Object.entries(priorityConfigs).map(([value, config]) => ({ text: config.text, value })),
        onFilter: (value: any, record: ReviewTask) => record.priority === value,
        render: (priority: string) => {
             const config = priorityConfigs[priority as keyof typeof priorityConfigs];
             if (!config) return <Tag>Unknown: {priority}</Tag>;
             return <Tag icon={config.icon} color={config.color as any}>{config.text}</Tag>;
        }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_text: any, task: ReviewTask) => {
        const actions = [];

        // Action: View/Confirm Review Results
        if (task.status === 'reviewed_pending_confirmation') {
          actions.push(
            <Tooltip title="查看/确认审校结果" key="review">
              {/* Option 1: Navigate to Editor */}
               <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/review/${task._id}/edit`)}>审校</Button>
            </Tooltip>
          );
        }

        // Action: Retry Failed Review Task
        if (task.status === 'review_failed') {
          actions.push(
            <Tooltip title="重试审校" key="retryReview">
              <Button size="small" icon={<RedoOutlined />} onClick={() => handleRetryReviewTask(task._id)}>重试</Button>
            </Tooltip>
          );
        }

        // Action: View details if task is completed or no other action applies
         if (task.status === 'completed' || actions.length === 0) {
             actions.push(
                 <Tooltip title="查看详情" key="viewReview">
                     <Button size="small" icon={<EyeOutlined />} onClick={() => message.info(`查看审校任务 ${task._id} 详情 (功能待实现)`)}>详情</Button>
                  </Tooltip>
             );
         }

        return <Space size="small">{actions}</Space>;
      },
    },
  ];

  // Filter tasks based on search text and active filter
  const filteredTasks = tasks.filter(task => {
    // Adapt filtering logic if ReviewTask properties differ
     const lowerSearchText = searchText.toLowerCase();
     const matchesSearch = !searchText || (
                           task.projectName?.toLowerCase().includes(lowerSearchText) ||
                           task.fileName?.toLowerCase().includes(lowerSearchText)
                           );
     const matchesFilter = activeFilter === 'All' || task.status === activeFilter;
     return matchesSearch && matchesFilter;
   });

   // Dynamic filter options based on reviewStatusConfigs and stats
   const filterOptions = [
       { label: `全部 (${stats.total || 0})`, value: 'All' },
       ...Object.entries(reviewStatusConfigs).map(([value, config]) => {
           const count = stats[value as keyof ReviewStats] ?? 0;
           return { label: `${config.text} (${count})`, value: value };
       })
   ].filter(opt => opt.value === 'All' || (stats[opt.value as keyof ReviewStats] ?? 0) > 0);


  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[0, 24]}>
        <Col span={24}>
          <Title level={2}>审校中心</Title>
          <Text type="secondary">管理审校任务，确认 AI 审校结果</Text>
        </Col>

        {/* Statistics Cards - Adapt based on ReviewStats */}
         <Col span={24}>
           <Row gutter={16}>
             {Object.entries(stats)
                .filter(([key]) => key === 'total' || reviewStatusConfigs[key as keyof typeof reviewStatusConfigs])
                .map(([key, value]) => (
                 <Col key={key} xs={24} sm={12} md={8} lg={4} xl={4}>
                   <Card hoverable>
                     <Statistic
                       title={key === 'total' ? '总任务' : reviewStatusConfigs[key as keyof typeof reviewStatusConfigs]?.text || key}
                       value={value as number}
                       suffix="个任务"
                       valueStyle={{ color: key === 'total' ? '#1890ff' : reviewStatusConfigs[key as keyof typeof reviewStatusConfigs]?.color as string }}
                     />
                   </Card>
                 </Col>
               ))}
           </Row>
         </Col>

         {/* Filters and Search */}
          <Col span={24}>
           <Card>
             <Space direction="vertical" style={{ width: '100%' }} size="large">
               <Row gutter={16} justify="space-between" align="middle">
                 <Col xs={24} sm={24} md={14}>
                   <Segmented
                     options={filterOptions} // Use dynamic review filter options
                     value={activeFilter}
                     onChange={(value) => setActiveFilter(value as string)}
                     style={{ marginBottom: 16 }}
                     block
                   />
                 </Col>
                 <Col xs={24} sm={24} md={10}>
                   <Input
                     placeholder="搜索项目名、文件名..."
                     prefix={<SearchOutlined />}
                     value={searchText}
                     onChange={(e) => setSearchText(e.target.value)}
                     allowClear
                   />
                 </Col>
               </Row>
             </Space>
           </Card>
         </Col>

        {/* Task Table */}
        <Col span={24}>
           <Card bodyStyle={{ padding: 0 }}>
             {filteredTasks.length === 0 && !loading ? (
               <Empty description={searchText || activeFilter !== 'All' ? "没有找到匹配的任务" : "暂无审校任务"} style={{ padding: '40px 0'}} />
             ) : (
               <Table
                 dataSource={filteredTasks}
                 columns={columns}
                 rowKey="_id"
                 loading={loading}
                 pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
                 // expandable={{ ... }} // Optional: Add expandable details if needed
               />
             )}
           </Card>
         </Col>
      </Row>
    </div>
  );
};

export default ReviewCenterPage; 