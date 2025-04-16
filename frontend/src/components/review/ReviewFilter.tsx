import React from 'react';
import { Radio, Select, Space, Typography } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, AppstoreOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Text } = Typography;

// We'll use the same enum as defined in the parent component
enum SegmentStatus {
  ALL = 'all',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  WITH_ISSUES = 'with_issues'
}

interface ReviewFilterProps {
  status: SegmentStatus;
  issueType: string | null;
  onChange: (status: SegmentStatus, issueType: string | null) => void;
}

// Common issue types in translation
const ISSUE_TYPES = [
  { value: 'terminology', label: '术语错误' },
  { value: 'mistranslation', label: '误译' },
  { value: 'omission', label: '漏译' },
  { value: 'addition', label: '过度翻译' },
  { value: 'grammar', label: '语法错误' },
  { value: 'style', label: '风格问题' },
  { value: 'punctuation', label: '标点问题' },
  { value: 'consistency', label: '一致性问题' },
];

const ReviewFilter: React.FC<ReviewFilterProps> = ({
  status,
  issueType,
  onChange,
}) => {
  // Handle status change
  const handleStatusChange = (e: any) => {
    onChange(e.target.value, issueType);
  };
  
  // Handle issue type change
  const handleIssueTypeChange = (value: string | null) => {
    onChange(status, value);
  };
  
  return (
    <div className="review-filter">
      <Space size="large" align="center">
        <div>
          <Text type="secondary" style={{ marginRight: 8 }}>状态:</Text>
          <Radio.Group 
            value={status} 
            onChange={handleStatusChange}
            buttonStyle="solid"
            optionType="button"
          >
            <Radio.Button value={SegmentStatus.ALL}>
              <AppstoreOutlined /> 全部
            </Radio.Button>
            <Radio.Button value={SegmentStatus.PENDING}>
              <ClockCircleOutlined /> 待确认
            </Radio.Button>
            <Radio.Button value={SegmentStatus.CONFIRMED}>
              <CheckCircleOutlined /> 已确认
            </Radio.Button>
            <Radio.Button value={SegmentStatus.WITH_ISSUES}>
              <WarningOutlined /> 有问题
            </Radio.Button>
          </Radio.Group>
        </div>
        
        {status === SegmentStatus.WITH_ISSUES && (
          <div>
            <Text type="secondary" style={{ marginRight: 8 }}>问题类型:</Text>
            <Select
              allowClear
              placeholder="选择问题类型"
              style={{ width: 150 }}
              value={issueType}
              onChange={handleIssueTypeChange}
            >
              {ISSUE_TYPES.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </div>
        )}
      </Space>
    </div>
  );
};

export default ReviewFilter; 