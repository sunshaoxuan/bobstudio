import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

const ActivateAccount = () => {
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');
  const { token } = useParams();
  const { activateAccount } = useAuth();

  useEffect(() => {
    const activate = async () => {
      if (!token) {
        setStatus('error');
        setMessage('激活链接无效');
        return;
      }

      try {
        const result = await activateAccount(token);
        if (result.success) {
          setStatus('success');
          setMessage(result.message);
        } else {
          setStatus('error');
          setMessage(result.message);
        }
      } catch (error) {
        setStatus('error');
        setMessage('激活过程中发生错误，请重试');
      }
    };

    activate();
  }, [token, activateAccount]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader className="w-16 h-16 mx-auto mb-4 text-purple-600 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">正在激活账户</h2>
            <p className="text-gray-600">请稍候，我们正在验证您的激活链接...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">激活成功！</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="inline-block w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                立即登录
              </Link>
              <Link
                to="/"
                className="inline-block w-full text-gray-500 hover:text-gray-700 transition-colors"
              >
                返回首页
              </Link>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">激活失败</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/register"
                className="inline-block w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
              >
                重新注册
              </Link>
              <Link
                to="/login"
                className="inline-block w-full text-purple-600 hover:text-purple-700 transition-colors"
              >
                尝试登录
              </Link>
              <Link
                to="/"
                className="inline-block w-full text-gray-500 hover:text-gray-700 transition-colors"
              >
                返回首页
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            🎨 BOB Studio
          </h1>
          <p className="text-gray-600">账户激活</p>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default ActivateAccount;