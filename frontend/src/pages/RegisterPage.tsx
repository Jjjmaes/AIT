import React, { useState } from 'react';
import { Form, Input, Button, Alert, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api'; // Assuming API client

const { Title } = Typography;

interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (values: RegisterFormValues) => {
    setError(null);
    if (values.password !== values.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      // Replace with actual API call
      const response = await api.post('/auth/register', {
        name: values.name,
        email: values.email,
        password: values.password,
      });

      if (response.data?.success || response.status === 201) {
        message.success('注册成功！请登录。');
        navigate('/login');
      } else {
        throw new Error(response.data?.message || '注册失败');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || '注册过程中发生错误';
      setError(errorMsg);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>
        创建新账户
      </Title>
      
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}
      
      <Form
        form={form}
        name="register"
        onFinish={handleSubmit}
        layout="vertical"
        requiredMark={false}
      >
        <Form.Item
          name="name"
          rules={[{ required: true, message: '请输入您的姓名' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="姓名" size="large" />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="邮箱地址" size="large" />
        </Form.Item>
        
        <Form.Item
          name="password"
          rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少需要6位' }
            ]}
          hasFeedback // Shows validation status icon
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密码 (至少6位)" size="large" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']} // Ensures re-validation when password changes
          rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          hasFeedback
        >
          <Input.Password prefix={<LockOutlined />} placeholder="确认密码" size="large" />
        </Form.Item>
        
        <Form.Item>
          <Button type="primary" htmlType="submit" size="large" loading={loading} block>
            注册
          </Button>
        </Form.Item>

        <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
           已有账户? <Link to="/login">立即登录</Link>
        </Form.Item>
      </Form>
    </div>
  );
};

export default RegisterPage; 