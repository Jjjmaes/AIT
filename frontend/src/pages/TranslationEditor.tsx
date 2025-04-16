// frontend/src/pages/TranslationEditor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Layout, Row, Col, Card, Input, Button, Spin, Empty, message,
    Typography, Tag, Space, Tooltip, Affix
} from 'antd';
import { SaveOutlined, CheckCircleOutlined, CheckSquareOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getTranslatedSegments, updateSegment, confirmTranslationTask, Segment, SegmentStatus } from '../api/translationService';

const { Content } = Layout;
const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

// Segment Status Display Configuration
const segmentStatusConfigs: Record<SegmentStatus, { color: string; text: string }> = {
    unconfirmed: { color: 'orange', text: '未确认' },
    confirmed: { color: 'green', text: '已确认' },
    needs_revision: { color: 'red', text: '需修改' },
};

const TranslationEditor: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<Record<string, boolean>>({}); // Track saving state per segment
    const [confirming, setConfirming] = useState<boolean>(false); // Track overall confirm state
    const [error, setError] = useState<string | null>(null);

    // Fetch segments
    const fetchSegments = useCallback(async () => {
        if (!taskId) {
            setError("Task ID is missing.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fetchedSegments = await getTranslatedSegments(taskId);
            // Sort segments by sequence just in case API doesn't guarantee order
            fetchedSegments.sort((a, b) => a.sequence - b.sequence);
            setSegments(fetchedSegments);
        } catch (err) {
            console.error("Error fetching segments:", err);
            setError(err instanceof Error ? err.message : 'Failed to load segments.');
            message.error('加载翻译片段失败！');
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchSegments();
    }, [fetchSegments]);

    // Handle target text changes
    const handleTargetChange = (segmentId: string, newTarget: string) => {
        setSegments(prevSegments =>
            prevSegments.map(seg =>
                seg._id === segmentId ? { ...seg, target: newTarget } : seg
            )
        );
        // Optionally auto-save on change (or use a dedicated save button)
        // handleSaveSegment(segmentId, newTarget); // Example auto-save
    };

    // Handle saving a single segment (e.g., triggered by blur or button)
    const handleSaveSegment = async (segmentId: string) => {
        const segmentToSave = segments.find(s => s._id === segmentId);
        if (!segmentToSave) return;

        setSaving(prev => ({ ...prev, [segmentId]: true }));
        try {
            await updateSegment(segmentId, { target: segmentToSave.target });
            message.success(`片段 ${segmentToSave.sequence} 已保存`);
            // Optionally update segment status locally if needed, or refetch
        } catch (err) {
            message.error(`保存片段 ${segmentToSave.sequence} 失败`);
            console.error("Save segment error:", err);
        } finally {
            setSaving(prev => ({ ...prev, [segmentId]: false }));
        }
    };

     // Handle changing the status of a single segment
     const handleSegmentStatusChange = async (segmentId: string, newStatus: SegmentStatus) => {
        const segmentToUpdate = segments.find(s => s._id === segmentId);
        if (!segmentToUpdate || segmentToUpdate.status === newStatus) return;

        setSaving(prev => ({ ...prev, [segmentId]: true })); // Use saving state for status update too
        try {
            await updateSegment(segmentId, { status: newStatus });
            // Update local state immediately for better UX
            setSegments(prevSegments =>
                prevSegments.map(seg =>
                    seg._id === segmentId ? { ...seg, status: newStatus } : seg
                )
            );
            message.success(`片段 ${segmentToUpdate.sequence} 状态已更新`);
        } catch (err) {
            message.error(`更新片段 ${segmentToUpdate.sequence} 状态失败`);
            console.error("Update segment status error:", err);
        } finally {
            setSaving(prev => ({ ...prev, [segmentId]: false }));
        }
    };

    // Handle confirming the entire task
    const handleConfirmAll = async () => {
        if (!taskId) return;
        setConfirming(true);
        try {
            await confirmTranslationTask(taskId);
            message.success('任务已确认完成！');
            // Optionally navigate back or update UI
            navigate('/translation-center'); // Navigate back after confirmation
        } catch (err) {
            message.error('确认任务失败！');
            console.error("Confirm task error:", err);
        } finally {
            setConfirming(false);
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 100px)' }}><Spin size="large" tip="加载片段中..." /></div>;
    }

    if (error) {
        return <div style={{ padding: '50px', textAlign: 'center' }}><Empty description={<Text type="danger">加载失败: {error}</Text>} /></div>;
    }

    if (segments.length === 0) {
        return <div style={{ padding: '50px', textAlign: 'center' }}><Empty description="未找到该任务的翻译片段。" /></div>;
    }

    return (
        <Layout style={{ padding: '24px', background: '#fff' }}>
            <Affix offsetTop={80}> {/* Adjust offset as needed based on header height */}
                 <Card bodyStyle={{padding: '10px 24px'}} style={{marginBottom: '16px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)'}}>
                     <Row justify="space-between" align="middle">
                        <Col>
                             <Space>
                                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/translation-center')}>
                                    返回翻译中心
                                </Button>
                                <Title level={4} style={{ margin: 0 }}>编辑任务: {taskId}</Title>
                             </Space>
                         </Col>
                         <Col>
                             <Button
                                 type="primary"
                                 icon={<CheckSquareOutlined />}
                                 onClick={handleConfirmAll}
                                 loading={confirming}
                                 disabled={segments.some(s => s.status !== 'confirmed')} // Only enable if all segments are confirmed
                             >
                                 确认并完成任务
                             </Button>
                         </Col>
                     </Row>
                 </Card>
             </Affix>

            <Content>
                {segments.map((segment) => (
                    <Card key={segment._id} style={{ marginBottom: '16px' }} bodyStyle={{padding: '16px'}}>
                        <Row gutter={16}>
                            {/* Source Column */}
                            <Col xs={24} sm={12}>
                                <div style={{ marginBottom: '8px' }}>
                                    <Tag color="blue">源文 #{segment.sequence}</Tag>
                                    <Tag color={segmentStatusConfigs[segment.status]?.color || 'default'}>
                                        {segmentStatusConfigs[segment.status]?.text || segment.status}
                                    </Tag>
                                </div>
                                <Paragraph style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', minHeight: '80px' }}>
                                    {segment.source}
                                </Paragraph>
                            </Col>

                            {/* Target Column */}
                            <Col xs={24} sm={12}>
                                <div style={{ marginBottom: '8px' }}>
                                     <Tag color="green">译文 #{segment.sequence}</Tag>
                                     {/* Segment Actions */}
                                     <Space style={{float: 'right'}}>
                                        <Tooltip title="保存此片段">
                                             <Button
                                                 icon={<SaveOutlined />}
                                                 size="small"
                                                 onClick={() => handleSaveSegment(segment._id)}
                                                 loading={saving[segment._id]}
                                                 disabled={saving[segment._id]}
                                                 type="text"
                                             />
                                         </Tooltip>
                                          <Tooltip title="确认此片段">
                                             <Button
                                                 icon={<CheckCircleOutlined />}
                                                 size="small"
                                                 onClick={() => handleSegmentStatusChange(segment._id, 'confirmed')}
                                                 loading={saving[segment._id]}
                                                 disabled={saving[segment._id] || segment.status === 'confirmed'}
                                                 type={segment.status === 'confirmed' ? 'primary' : 'text'}
                                                 ghost={segment.status === 'confirmed'}
                                             />
                                          </Tooltip>
                                          {/* Add button for 'needs_revision' if needed */}
                                     </Space>
                                </div>
                                <TextArea
                                    rows={4}
                                    value={segment.target}
                                    onChange={(e) => handleTargetChange(segment._id, e.target.value)}
                                    onBlur={() => handleSaveSegment(segment._id)} // Save on blur
                                    style={{ minHeight: '80px', borderColor: segment.status === 'unconfirmed' ? 'orange' : undefined }}
                                    placeholder="在此输入或编辑译文..."
                                />
                            </Col>
                        </Row>
                    </Card>
                ))}
            </Content>
             <Affix offsetBottom={20} style={{ textAlign: 'right', marginTop: '20px' }}>
                 <Button
                     type="primary"
                     icon={<CheckSquareOutlined />}
                     onClick={handleConfirmAll}
                     loading={confirming}
                     disabled={segments.some(s => s.status !== 'confirmed')} // Only enable if all segments are confirmed
                 >
                     确认并完成任务
                 </Button>
             </Affix>
        </Layout>
    );
};

export default TranslationEditor;
