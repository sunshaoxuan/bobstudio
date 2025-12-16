import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut,
  BarChart3,
  Users,
  User,
  Menu,
  X,
  Settings,
  Sparkles,
} from 'lucide-react';

const useMediaQuery = (query) => {
  const getMatches = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia(query);
    const handler = () => setMatches(mediaQuery.matches);
    handler();
    if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handler);
    else mediaQuery.addListener(handler);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener("change", handler);
      else mediaQuery.removeListener(handler);
    };
  }, [query]);

  return matches;
};

const Navigation = () => {
  const { currentUser, logout } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  const menuItems = useMemo(() => {
    if (!currentUser) {
      return [{ key: "login", to: "/login", label: "登录" }];
    }
    const items = [
      { key: "studio", to: "/studio", label: "工作室", icon: Sparkles },
      { key: "friends", to: "/friends", label: "好友", icon: Users },
      { key: "stats", to: "/stats", label: "统计", icon: BarChart3 },
      { key: "profile", to: "/profile", label: "个人中心", icon: User },
    ];
    if (currentUser.isSuperAdmin) {
      items.push({ key: "admin", to: "/admin", label: "管理端", icon: Settings, highlight: true });
    }
    return items;
  }, [currentUser]);

  if (isMobile) {
    return (
      <>
        <nav className="sticky top-0 z-40 bg-white shadow-lg">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200"
                aria-label="打开菜单"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>

              <Link to={currentUser ? "/studio" : "/"} className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                  🎨
                </div>
                <div className="font-bold text-gray-900">BOB Studio</div>
              </Link>

              <Link
                to={currentUser ? "/profile" : "/login"}
                className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200"
                aria-label="个人中心"
              >
                <User className="w-5 h-5 text-gray-700" />
              </Link>
            </div>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[78vw] max-w-[320px] bg-white shadow-2xl flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                    🎨
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">BOB Studio</div>
                    {currentUser && (
                      <div className="text-xs text-gray-500 truncate">
                        {currentUser.displayName || currentUser.username}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200"
                  aria-label="关闭菜单"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              <div className="p-3 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full px-3 py-3 rounded-xl flex items-center gap-3 hover:bg-gray-100 active:bg-gray-200 ${
                        item.highlight ? "text-yellow-700" : "text-gray-800"
                      }`}
                    >
                      {Icon ? <Icon className="w-5 h-5" /> : <span className="w-5 h-5" />}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="p-3 border-t">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-3 py-3 rounded-xl flex items-center gap-3 text-red-600 hover:bg-red-50 active:bg-red-100"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">退出登录</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full px-3 py-3 rounded-xl flex items-center justify-center bg-blue-600 text-white font-semibold"
                  >
                    登录
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

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
                    <span className="text-base">🛡️</span>
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
