import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Button, Typography, Skeleton, Tag } from 'antd';
import { ProjectOutlined, FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
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
          api.get('/users/stats'),
          api.get('/projects/recent')
        ]);
        
        setStats(statsResponse.data);
        setRecentProjects(projectsResponse.data.projects);
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
    <div>
      <Title level={2}>仪表盘</Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
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
          <Card>
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
          <Card>
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
          <Card>
            <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
              <Statistic
                title="总体进度"
                value={stats.overallProgress}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: stats.overallProgress > 75 ? '#52c41a' : undefined }}
              />
            </Skeleton>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 24 }}>
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
          />
        </Skeleton>
      </div>
    </div>
  );
};

export default DashboardPage; 