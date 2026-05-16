# 抖音视频解析工具

一款基于 Cloudflare Worker + Pages 的抖音视频/图集解析工具，支持获取视频直链、作者信息、互动数据，以及无水印下载。

演示地址：https://douyindownload.937788.xyz/

## 功能特性

- **视频解析**：输入抖音分享链接，获取无水印视频直链
- **图集解析**：支持抖音图集作品，提取所有高清图片
- **信息展示**：作者昵称、签名、作品描述、发布时间
- **数据统计**：点赞、评论、分享、收藏、播放数（播放数仅作者后台能看到）
- **在线预览**：视频直接播放，图片网格展示
- **一键下载**：通过 Blob 下载绕过跨域限制，支持视频本地下载
- **跨域支持**：Worker 代理解决抖音防盗链（Referer）限制

## 技术方案

| 组件 | 技术 | 用途 |
|------|------|------|
| 前端 | HTML + CSS + JS（纯静态） | 用户界面，部署于 Cloudflare Pages |
| 后端 | Cloudflare Worker | 抖音页面抓取、数据解析、视频流代理 |
| 部署 | Cloudflare 生态 | 全球 CDN 加速，免费额度充足 |

**架构特点**：
- Worker 只做 API，前端独立部署，职责分离
- 通过 CORS 跨域通信，前后端可独立更新
- 自定义域名绑定，避免 `workers.dev`  国内访问问题

<br>
<br>

# 部署指南

### 方案概述

**Worker 只做 API，HTML 放 Cloudflare Pages**

- **Cloudflare Worker**：负责抖音链接解析、视频代理（CORS 处理）
- **Cloudflare Pages**：托管前端静态页面（HTML/CSS/JS）

两者独立部署，通过跨域请求通信。


## 一、部署 Cloudflare Worker（API 后端）

### 1. 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单 → **Workers & Pages** → **创建**
3. 选择 **创建 Worker**
4. 输入 Worker 名称，例如：`douyinapi`（自定义）

### 2. 粘贴 Worker 代码

删除默认代码，粘贴 `workers.js` 文件的内容

### 3. 绑定自定义域名（重要）

`workers.dev` 域名在国内可能被墙，必须绑定自定义域名：

1. Worker → **设置** → **触发器**（或 **自定义域**）
2. 点击 **添加自定义域**
3. 输入你的域名或子域名，例如：`api.yourdomain.com`
4. 按提示完成 DNS 配置
5. 等待证书颁发（通常几分钟）

> **注意**：域名必须托管在 Cloudflare，或修改 NS 指向 Cloudflare。

### 4. 保存并部署

点击 **保存并部署**。

测试 API：
```
https://api.yourdomain.com/?url=https://v.douyin.com/xxxxx&data=1
```


## 二、部署 Cloudflare Pages（前端页面）

### 1. 准备前端文件

创建项目目录，放入 `index.html`：

```
douyin-frontend/
└── index.html
```

### 2. 修改前端配置

打开 `index.html`，找到以下代码并修改：

```javascript
// 第1处：修改为你的 Worker 自定义域名
const API_BASE = 'https://api.yourdomain.com';
```

**必须修改**，否则前端无法连接到你的 API。

### 3. 部署到 Pages

#### 方式 A：通过 Git 部署（推荐）

1. 将代码推送到 GitHub/GitLab 仓库
2. Cloudflare Dashboard → **Workers & Pages** → **创建** → **Pages**
3. 选择 **连接到 Git 提供商**
4. 授权并选择仓库
5. 构建设置：
   - 构建命令：留空（纯静态）
   - 输出目录：`/` 或 `./`
6. 点击 **保存并部署**

#### 方式 B：直接上传

1. Cloudflare Dashboard → **Workers & Pages** → **创建** → **Pages**
2. 选择 **上传资源**
3. 拖拽或选择 `index.html` 文件
4. 输入项目名称，例如：`douyin-web`
5. 点击 **上传**

### 4. 绑定自定义域名（可选但推荐）

Pages 默认域名是 `xxx.pages.dev`，同样可能被墙：

1. Pages 项目 → **自定义域**
2. 点击 **设置自定义域**
3. 输入域名，例如：`douyin.yourdomain.com`
4. 按提示完成配置


## 三、需要修改的地方汇总

### 部署者必须修改

| 位置 | 说明 | 示例 |
|------|------|------|
| Worker 自定义域 | Worker 绑定的域名 | `api.yourdomain.com` |
| Pages 自定义域 | Pages 绑定的域名（可选） | `douyin.yourdomain.com` |
| `index.html` 中 `API_BASE` | 前端请求的后端地址 | `https://api.yourdomain.com` |

### 备案信息（如在中国大陆使用）

如需备案信息，修改 `index.html` 中的：

- `浙ICP备XXXXXXXX号` → 你的 ICP 备案号
- `浙公网安备XXXXXXXX号` → 你的公安备案号
- `https://yourdomain.com/gonganbeian.png` → 公安备案图标地址（可选）


## 四、常见问题

### Q: Worker 返回 400 "请提供url参数"
A: 这是正常的，说明 Worker 运行正常，只是没传参数。带 `?url=xxx` 访问即可。

### Q: 浏览器提示 CORS 错误
A: 检查 Worker 代码中每个 `Response` 是否都带了 `corsHeaders`。如果修改过代码，确保 `corsHeaders` 常量存在且被正确使用。

### Q: 视频无法预览/下载 403
A: 抖音视频有 Referer 防盗链，必须通过 `/proxy` 路由代理。检查前端 `proxyUrl()` 函数是否正确拼接了代理地址。

### Q: `workers.dev` 或 `pages.dev` 无法访问
A: 国内网络可能阻断这些域名，**必须绑定自定义域名**。

### Q: 自定义域名如何配置？
A: 域名 DNS 需指向 Cloudflare（修改 NS 记录），或在 Cloudflare 添加站点后配置 DNS 解析。


## 五、文件说明

| 文件 | 用途 | 部署位置 |
|------|------|----------|
| `worker.js` | API 后端（解析、代理） | Cloudflare Worker |
| `index.html` | 前端页面 | Cloudflare Pages |


## 六、本地开发测试

如需本地调试前端页面，可临时用 Python 起静态服务器：

```bash
# 在 index.html 所在目录执行
python -m http.server 8080
```

访问 `http://localhost:8080`

同时把 `API_BASE` 改为已部署的 Worker 域名：
```javascript
const API_BASE = 'https://api.yourdomain.com';
```

> 注意：本地测试时前端通过跨域请求访问 Worker API，确保 Worker CORS 配置正确。


## 免责声明

本项目仅供学习和交流使用，请勿用于商业用途。使用本工具下载的内容版权归原著作权人所有，请遵守相关法律法规。
