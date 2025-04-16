import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Typography, Skeleton, Tag } from 'antd';
import { ProjectOutlined, FileTextOutlined, ClockCircleOutlined, RightOutlined, TranslationOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { axiosInstance as api } from '../api/base';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

interface ProjectSummary {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  progress: number;
  status: string;
  deadline: string;
}

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingReviews: 0,
    completedFiles: 0,
    overallProgress: 0,
  });
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { /* user */ } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsResponse, projectsResponse] = await Promise.all([
          api.get('/api/users/stats'),
          api.get('/api/projects/recent')
        ]);
        
        setStats(statsResponse.data);
        
        if (projectsResponse.data && projectsResponse.data.success && projectsResponse.data.data) {
            setRecentProjects(projectsResponse.data.data.projects);
        } else {
            console.error('Unexpected structure for /api/projects/recent:', projectsResponse.data);
            setRecentProjects([]);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProjectSummary) => (
        <a onClick={() => navigate(`/projects/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '语言对',
      key: 'languages',
      render: (_: any, record: ProjectSummary) => (
        `${record.sourceLanguage} → ${record.targetLanguage}`
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => `${progress}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === '进行中') color = 'processing';
        if (status === '已完成') color = 'success';
        if (status === '已暂停') color = 'warning';
        
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      key: 'deadline',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ProjectSummary) => (
        <Button 
          type="link" 
          icon={<RightOutlined />} 
          onClick={() => navigate(`/projects/${record.id}`)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="dashboard-container">
      <Title level={2} style={{ marginBottom: 24 }}>仪表盘</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ height: '100%' }}>
            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
              <Statistic
                title="我的项目"
                value={stats.totalProjects}
                prefix={<ProjectOutlined />}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ height: '100%' }}>
            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
              <Statistic
                title="待审校"
                value={stats.pendingReviews}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: stats.pendingReviews > 0 ? '#faad14' : undefined }}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable style={{ height: '100%' }}>
            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
              <Statistic
                title="已完成文件"
                value={stats.completedFiles}
                prefix={<FileTextOutlined />}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
            hoverable 
            style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }} 
            onClick={() => navigate('/projects')}
          >
            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
              <TranslationOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
              <Typography.Text strong>开始翻译</Typography.Text>
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: '12px' }}>选择项目并启动</Typography.Text>
            </Skeleton>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4}>近期项目</Title>
          <Button type="primary" onClick={() => navigate('/projects')}>查看全部</Button>
        </div>
        
        <Skeleton loading={loading} active paragraph={{ rows: 6 }}>
          <Table 
            columns={columns} 
            dataSource={recentProjects}
            rowKey="id"
            pagination={false}
            style={{ overflowX: 'auto' }}
            scroll={{ x: 'max-content' }}
          />
        </Skeleton>
      </div>

      <style>{`
        .dashboard-container .ant-card {
          transition: all 0.3s;
        }
        .dashboard-container .ant-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        @media screen and (max-width: 768px) {
          .dashboard-container .ant-card {
            margin-bottom: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage; 