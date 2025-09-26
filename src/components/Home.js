import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Image, Edit3, Layers, Sparkles, Users, Shield, Zap, LogIn, UserPlus, Settings } from 'lucide-react';

const Home = () => {
  const { currentUser, logout } = useAuth();
  const statBase = currentUser?.generationStats;
  const userStats = React.useMemo(() => {
    if (!statBase || typeof statBase !== 'object') {
      return { today: 0, thisMonth: 0, total: 0 };
    }

    const safeNumber = (value) => (
      typeof value === 'number' && Number.isFinite(value) ? value : 0
    );

    return {
      today: safeNumber(statBase.today),
      thisMonth: safeNumber(statBase.thisMonth),
      total: safeNumber(statBase.total)
    };
  }, [statBase]);

  const features = [
    {
      icon: <Image className="w-8 h-8 text-purple-600" />,
      title: '文本生图',
      description: '通过自然语言描述生成高质量的AI图像'
    },
    {
      icon: <Edit3 className="w-8 h-8 text-blue-600" />,
      title: '图像编辑',
      description: '上传图片进行AI智能编辑和修改'
    },
    {
      icon: <Layers className="w-8 h-8 text-green-600" />,
      title: '图像合成',
      description: '多张图片智能合成创造全新作品'
    },
    {
      icon: <Users className="w-8 h-8 text-orange-600" />,
      title: '用户管理',
      description: '个人账户系统，统计生成记录'
    },
    {
      icon: <Shield className="w-8 h-8 text-red-600" />,
      title: '安全可靠',
      description: '账户激活验证，密码安全保护'
    },
    {
      icon: <Zap className="w-8 h-8 text-yellow-600" />,
      title: '高效便捷',
      description: '快速响应，支持多种格式输出'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      {/* 导航栏 */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                🎨 BOB Studio
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {currentUser ? (
                <>
                  <span className="text-gray-600">
                    欢迎，{currentUser.username}
                    {currentUser.isSuperAdmin && (
                      <span className="ml-1 text-yellow-600">👑</span>
                    )}
                  </span>
                  {currentUser.isSuperAdmin && (
                    <Link
                      to="/admin"
                      className="text-yellow-600 hover:text-yellow-800 transition-colors flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      管理端
                    </Link>
                  )}
                  <Link
                    to="/studio"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    进入工作室
                  </Link>
                  <button
                    onClick={() => {
                      console.log('首页退出按钮被点击');
                      logout(); // logout函数现在自己处理跳转
                    }}
                    className="text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-800 transition-colors flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    注册
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* 英雄区域 */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-6">
            专业AI图像生成工具
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            BOB Studio 是一款功能强大的AI图像生成与编辑工具，支持文本生图、图像编辑和多图合成。
            让创意无限延伸，让想象变为现实。
          </p>
          <div className="flex items-center justify-center gap-4">
            {currentUser ? (
              <Link
                to="/studio"
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-3"
              >
                <Sparkles className="w-6 h-6" />
                开始创作
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center gap-3"
                >
                  <UserPlus className="w-6 h-6" />
                  免费注册
                </Link>
                <Link
                  to="/login"
                  className="border-2 border-purple-600 text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-50 transition-all flex items-center gap-3"
                >
                  <LogIn className="w-6 h-6" />
                  立即登录
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 功能特色 */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">核心功能</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  {feature.icon}
                  <h3 className="text-xl font-semibold text-gray-800">{feature.title}</h3>
                </div>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 使用流程 */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">使用流程</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">1. 注册账户</h3>
              <p className="text-gray-600">创建您的专属账户，激活后即可使用</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">2. 配置API</h3>
              <p className="text-gray-600">设置您的API密钥开始使用</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Edit3 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">3. 创作内容</h3>
              <p className="text-gray-600">输入描述或上传图片开始创作</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">4. 获得作品</h3>
              <p className="text-gray-600">AI生成高质量图像，自动保存</p>
            </div>
          </div>
        </div>

        {/* 用户统计展示 */}
        {currentUser && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">我的创作统计</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {userStats.today}
                </div>
                <div className="text-purple-700 font-medium">今日生成</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {userStats.thisMonth}
                </div>
                <div className="text-blue-700 font-medium">本月生成</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {userStats.total}
                </div>
                <div className="text-green-700 font-medium">总计生成</div>
              </div>
            </div>
          </div>
        )}

        {/* 底部信息 */}
        <div className="text-center py-8 border-t border-gray-200">
          <p className="text-gray-600">
            © 2024 BOB Studio. 基于最新AI技术打造的专业图像生成工具。
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;