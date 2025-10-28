import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User, Send, X } from 'lucide-react';

const ForgotPassword = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username) {
      setError('请输入用户名');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const result = await forgotPassword(username);
      if (result.success) {
        setSuccess(result.message);
        setUsername(''); // 清空输入
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('发送重置邮件时发生错误');
    } finally {
      setLoading(false);
    }
  };

  const closeError = () => setError('');
  const closeSuccess = () => setSuccess('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            🎨 BOB Studio
          </h1>
          <p className="text-gray-600">忘记密码</p>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            输入您的用户名，我们将发送重置密码的链接到您注册时使用的邮箱。
          </p>
          <p className="text-xs text-blue-600 mt-2">
            📧 为了保护您的隐私，我们不会显示完整的邮箱地址
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用户名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="请输入您的用户名"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                发送中...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                发送重置链接
              </>
            )}
          </button>
        </form>

        <div className="mt-6 space-y-4 text-center text-sm">
          <Link
            to="/login"
            className="text-purple-600 hover:text-purple-700 transition-colors block"
          >
            返回登录
          </Link>
          
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <span>还没有账户？</span>
            <Link
              to="/register"
              className="text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              立即注册
            </Link>
          </div>
          
          <Link
            to="/"
            className="text-gray-500 hover:text-gray-700 transition-colors block"
          >
            返回首页
          </Link>
        </div>
      </div>

      {/* 错误提示模态框 */}
      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                  <span className="text-red-500">⚠️</span>
                  发送失败
                </h3>
                <button
                  onClick={closeError}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700">{error}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={closeError}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 成功提示模态框 */}
      {success && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-green-50 border-b border-green-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                  <span className="text-green-500">✅</span>
                  发送成功
                </h3>
                <button
                  onClick={closeSuccess}
                  className="text-green-400 hover:text-green-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">{success}</p>
              <div className="p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-700">
                  💡 提示：请检查您的邮箱（包括垃圾邮件文件夹），点击重置链接完成密码重置。重置链接将在24小时后失效。
                </p>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2">
              <Link
                to="/login"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                onClick={closeSuccess}
              >
                去登录
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForgotPassword;
