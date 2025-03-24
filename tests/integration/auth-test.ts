// scripts/test-auth.ts

import axios from 'axios';

interface AuthResponse {
  success: boolean;
  token: string;
  user?: {
    id: string;
    email: string;
    username: string;
  };
}

interface ProfileResponse {
  success: boolean;
  data: {
    id: string;
    email: string;
    username: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
}

const API_URL = 'http://localhost:5000/api';
let token: string;

const testAuth = async () => {
  try {
    console.log('===== 开始测试身份验证API =====');
    console.log('API URL:', API_URL);
    
    // 1. 注册测试
    console.log('\n--- 测试用户注册 ---');
    
    try {
      console.log('发送注册请求...');
      const registerResponse = await axios.post<AuthResponse>(`${API_URL}/auth/register`, {
        username: 'testuser888',
        password: 'password123',
        email: 'test888@example.com'
      });
      
      console.log('✅ 注册成功:', registerResponse.data);
      token = registerResponse.data.token;
    } catch (error: any) {
      console.log('❌ 注册失败:', error.response?.data || error.message);
      console.log('错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      // 尝试使用登录（可能用户已经存在）
      console.log('\n尝试登录已存在用户...');
      try {
        const loginResponse = await axios.post<AuthResponse>(`${API_URL}/auth/login`, {
          email: 'test@example.com',
          password: 'password123'
        });
        
        console.log('✅ 登录成功:', loginResponse.data);
        token = loginResponse.data.token;
      } catch (loginError: any) {
        console.log('❌ 登录失败:', loginError.response?.data || loginError.message);
        console.log('登录错误详情:', {
          status: loginError.response?.status,
          statusText: loginError.response?.statusText,
          data: loginError.response?.data
        });
        throw loginError;
      }
    }
    
    // 2. 登录测试
    console.log('\n--- 测试用户登录 ---');
    try {
      console.log('发送登录请求...');
      const loginResponse = await axios.post<AuthResponse>(`${API_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
      });
      
      console.log('✅ 登录成功:', loginResponse.data);
      token = loginResponse.data.token;
    } catch (error: any) {
      console.log('❌ 登录失败:', error.response?.data || error.message);
      console.log('错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw error;
    }
    
    // 3. 获取用户资料
    console.log('\n--- 测试获取用户资料 ---');
    try {
      console.log('发送获取用户资料请求...');
      console.log('使用的token:', token.substring(0, 20) + '...');
      
      const profileResponse = await axios.get<ProfileResponse>(`${API_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('✅ 获取资料成功:', profileResponse.data);
    } catch (error: any) {
      console.log('❌ 获取资料失败:', error.response?.data || error.message);
      console.log('错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      if (error.response?.status === 401) {
        console.log('认证失败，请检查token是否正确');
      }
      throw error;
    }
    
    // 4. 测试无效令牌
    console.log('\n--- 测试无效令牌 ---');
    try {
      console.log('发送无效token请求...');
      const invalidResponse = await axios.get<ProfileResponse>(`${API_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer invalid_token`
        }
      });
      
      console.log('❓ 无效令牌测试未能如期失败:', invalidResponse.data);
    } catch (error: any) {
      console.log('✅ 无效令牌正确拒绝:', error.response?.data);
      console.log('错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
    
    console.log('\n===== 身份验证API测试完成 =====');
  } catch (error: any) {
    console.error('测试过程中发生错误:', error.message);
    console.error('错误详情:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    process.exit(1);
  }
};

// 运行测试
testAuth();