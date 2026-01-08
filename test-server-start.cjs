#!/usr/bin/env node

/**
 * 服务器启动诊断脚本
 * 用于检查服务器启动前的环境配置
 */

const fsSync = require("fs");
const path = require("path");

console.log("🔍 开始诊断服务器启动环境...\n");

// 1. 检查 config/models.cjs 是否存在
const configPath = path.join(__dirname, "config", "models.cjs");
console.log("1. 检查配置文件:");
console.log(`   路径: ${configPath}`);
if (fsSync.existsSync(configPath)) {
  console.log("   ✅ 配置文件存在");
  
  // 尝试加载配置
  try {
    const modelConfig = require("./config/models");
    console.log("   ✅ 配置文件可以正常加载");
    console.log(`   - 图像模型: ${modelConfig.image.model}`);
    console.log(`   - 优化主模型: ${modelConfig.optimize.primary}`);
    console.log(`   - 优化回退模型: ${modelConfig.optimize.fallback}`);
  } catch (error) {
    console.log("   ❌ 配置文件加载失败:");
    console.log(`   错误: ${error.message}`);
    console.log(`   堆栈: ${error.stack}`);
    process.exit(1);
  }
} else {
  console.log("   ❌ 配置文件不存在!");
  console.log("   请确保已拉取最新代码: git pull origin main");
  process.exit(1);
}

// 2. 检查必要的目录
console.log("\n2. 检查必要的目录:");
const dirs = ["logs", "history", "images", "sessions"];
for (const dir of dirs) {
  const dirPath = path.join(__dirname, dir);
  if (fsSync.existsSync(dirPath)) {
    console.log(`   ✅ ${dir}/ 存在`);
  } else {
    console.log(`   ⚠️  ${dir}/ 不存在（服务器启动时会自动创建）`);
  }
}

// 3. 检查 server.cjs 语法
console.log("\n3. 检查 server.cjs 语法:");
try {
  require("./server.cjs");
  console.log("   ✅ server.cjs 语法正确");
} catch (error) {
  console.log("   ❌ server.cjs 语法错误:");
  console.log(`   错误: ${error.message}`);
  process.exit(1);
}

console.log("\n✅ 所有检查通过，服务器应该可以正常启动");
