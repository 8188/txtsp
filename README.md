# 童心调色盘

面向第九届全国青少年人工智能创新挑战赛的纯前端静态站，围绕“登录建档 -> 采集 voice / face -> 调用 Coze 工作流 -> 展示鼓励话与治愈画作 -> 留存本地记录”构建。

## 已实现

- 学生登录时自动生成 `student_uuid`
- 浏览器本地存储学生基本信息和历史记录
- 麦克风录音采集 voice
- 摄像头拍照采集 face
- 一键调用两个 Coze 工作流
- 显示鼓励话、`image_url` 和本地试用记录
- 手机和笔记本自适配布局

## 本地启动

1. 安装依赖：`pnpm install`
2. 复制 `.env.example` 为 `.env`
3. 填写 `PUBLIC_COZE_TOKEN`
4. 本地运行：`pnpm dev`

## 构建发布

```bash
pnpm build
```

构建产物会输出到 `dist/`，可直接部署到静态站点。

## 环境变量

- `PUBLIC_COZE_TOKEN`：Coze Access Token
- `PUBLIC_COZE_API_BASE`：Coze 工作流接口地址，默认 `https://api.coze.cn/v1/workflow/run`
- `PUBLIC_COZE_ENCOURAGE_WORKFLOW_ID`：鼓励话工作流 ID，默认 `7639346749559373839`
- `PUBLIC_COZE_ARTWORK_WORKFLOW_ID`：治愈画工作流 ID，默认 `7638979852711985192`

## 当前注意点

- 这是纯前端方案，学生信息和历史记录都只存在浏览器本地。
- 如果 Coze 工作流后续要求更严格的文件上传格式，可以再把 `voice` 和 `face` 的编码方式改成对应的文件协议。
