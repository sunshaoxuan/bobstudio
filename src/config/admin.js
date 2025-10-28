// 超级管理员配置文件
const ADMIN_CONFIG = {
  // 超级管理员账户 - 无需激活即可登录
  superAdmin: {
    username: 'admin',
    email: 'sunsx@briconbric.com',
    password: 'twgdh169', // 建议在生产环境中使用更复杂的密码
    isActive: true,
    isSuperAdmin: true,
    showApiConfig: true,
    apiKey: '',
    generationStats: {
      today: 0,
      thisMonth: 0,
      total: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
      lastResetMonth: new Date().toISOString().slice(0, 7)
    }
  },
  
  // 默认用户设置
  defaultUserSettings: {
    isActive: true, // 管理员创建的用户默认激活
    showApiConfig: false, // 默认不显示API配置
    apiKey: '',
    generationStats: {
      today: 0,
      thisMonth: 0,
      total: 0,
      lastResetDate: new Date().toISOString().split('T')[0],
      lastResetMonth: new Date().toISOString().slice(0, 7)
    }
  }
};

export default ADMIN_CONFIG;