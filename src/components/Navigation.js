import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as Icons from 'lucide-react';

const { LogOut, Shield, BarChart3, Users, User } = Icons;

const Navigation = () => {
  const { currentUser, logout } = useAuth();

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* LOGO - 可点击返回首页或工作室 */}
          <Link 
            to={currentUser ? "/studio" : "/"}
            className="flex items-center gap-2 sm:gap-4"
          >
            <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity">
              🎨 BOB Studio
            </h1>
          </Link>

          {/* 右侧菜单 */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {currentUser ? (
              <>
                {/* 好友 */}
                <Link
                  to="/friends"
                  className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                  title="好友管理"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">好友</span>
                </Link>

                {/* 统计 */}
                <Link
                  to="/stats"
                  className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                  title="统计"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">统计</span>
                </Link>

                {/* 管理端（仅管理员） */}
                {currentUser.isSuperAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-1 sm:gap-2 text-yellow-600 hover:text-yellow-800 transition-colors text-sm sm:text-base"
                    title="管理端"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">管理端</span>
                  </Link>
                )}

                {/* 个人中心（点击用户名） */}
                <Link
                  to="/profile"
                  className="flex items-center gap-1 sm:gap-2 text-purple-600 hover:text-purple-800 transition-colors text-xs sm:text-sm"
                  title="个人中心"
                >
                  <User className="w-4 h-4" />
                  <span className="truncate max-w-[100px] sm:max-w-none">
                    {currentUser.displayName || currentUser.username}
                    {currentUser.isSuperAdmin && (
                      <span className="ml-1 text-yellow-600">👑</span>
                    )}
                  </span>
                </Link>

                {/* 退出 */}
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-red-600 hover:text-red-800 transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">退出</span>
                </button>
              </>
            ) : (
              <>
                {/* 未登录时显示登录按钮 */}
                <Link
                  to="/login"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  登录
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

