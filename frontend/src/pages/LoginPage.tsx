import { useState } from 'react';
import { Form, Input, Button, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage = () => {
  const { login, error, loading } = useAuth();
  const [form] = Form.useForm();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (values: LoginFormValues) => {
    // // Check might not be necessary anymore, but keep for safety?
    // if (!values.email && !values.password) {
    //   // console.log('[LoginPage] handleSubmit called with empty values, skipping.');
    //   return;
    // }

    // console.log('[LoginPage] handleSubmit executing with:', values);
    setLocalError(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      // Error is already set in auth context
      // console.log('[LoginPage] Login failed, error should be set in context.');
    }
  };

  // Simplified handler for the button click
  const handleButtonClick = () => {
    form.validateFields()
      .then(values => {
        // console.log('[LoginPage] Manual validation success, calling handleSubmit.');
        handleSubmit(values);
      })
      .catch(info => {
        // console.log('[LoginPage] Manual validation failed:', info);
        // Optionally handle validation failure feedback here if needed
      });
  };
  
  // console.log(`[LoginPage] Rendering - Loading: ${loading}, Error: ${error}`);
  
  return (
    <div>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>
        用户登录
      </Title>
      
      {/* Restore the Alert */}
      {(error || localError) && (
        <Alert
          message={error || localError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {/* End Restore */}
      
      <Form
        form={form}
        name="login"
        // onFinish={handleSubmit} // REMOVED onFinish
        layout="vertical"
        requiredMark={false}
        autoComplete="off"
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input 
            prefix={<UserOutlined />} 
            placeholder="邮箱地址" 
            size="large" 
            autoComplete="off"
          />
        </Form.Item>
        
        <Form.Item
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="密码" 
            size="large" 
            autoComplete="new-password"
          />
        </Form.Item>
        
        <Form.Item>
          <Button
            type="primary"
            // htmlType="submit" // REMOVED htmlType
            onClick={handleButtonClick} // ADDED onClick
            size="large"
            loading={loading}
            block
          >
            登录
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default LoginPage; 