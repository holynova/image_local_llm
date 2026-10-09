# 安装与分发方案

## 结论

工作台是 ComfyUI 的业务前端，不应再负责安装整套 PyTorch/CUDA。将工作台、推理运行时、权重和用户数据分开发布，复用已有模型库，升级网站不用重新下载几十 GB 模型。

以下为建议与规划，**不是 v1.5.0 已提供的打包产物**。

## 方案比较

| 方案 | 适合谁 | 优点 | 代价 / 边界 |
|---|---|---|---|
| 官方 Portable + 工作台源码 | Windows、已有 ComfyUI 用户 | 原生 GPU、易复用模型 | 工作台需 Python，初次配置路径 |
| Comfy Desktop + 工作台 | 希望 GUI 安装升级的用户 | 官方环境管理 | 确认实例地址和节点兼容 |
| Stability Matrix + 工作台 | 多工具、多模型用户 | 包管理与共享模型库 | 多一层管理工具，仍需接入 API |
| 工作台便携包 / 安装向导 | 普通非开发用户 | 不用手动装工作台 Python | 需构建、签名、更新与干净机器验收 |
| 仅工作台 Docker + 外部 ComfyUI | 开发者、已有 GPU 服务 | 部署可复现，无 GPU 容器要求 | 配置容器到宿主机地址与持久卷 |
| 工作台 + GPU ComfyUI 双容器 | Linux GPU 服务器、团队 | 环境隔离、版本锁定 | 驱动、GPU 透传、CUDA/PyTorch、节点维护 |
| 远端 ComfyUI | 本机无合适 GPU 的用户 | 计算与界面分离 | 网络、安全与算力成本；并非任意厂商 API 都能接入 |

官方资料：[Portable](https://docs.comfy.org/installation/comfyui_portable_windows)、[Comfy Desktop](https://docs.comfy.org/installation/desktop/windows)、[Stability Matrix](https://github.com/LykosAI/StabilityMatrix)。

## Docker 为什么不是 Windows 默认入口？

Windows GPU 容器需要 Docker Desktop 的 WSL 2 后端和兼容 NVIDIA 驱动，增加普通用户的安装环节。[Docker 官方 GPU 文档](https://docs.docker.com/desktop/features/gpu/)

镜像不能解决模型下载、许可证、显存不足或新显卡与 PyTorch 兼容问题。模型不应烘焙进镜像：体积大、更新慢，还可能有再分发限制。双服务比巨型镜像更清晰：工作台只含 Python/API/静态资源，ComfyUI 用单独 GPU 运行时。

后续容器化建议：

1. 工作台非 root 用户、单 Uvicorn worker，内部监听 `0.0.0.0:8000`，宿主机只绑定 `127.0.0.1:8000`。
2. 独立可写卷保存 `data/`、`static/outputs/`，备份数据库和图片；自定义工作流单独挂载或版本管理。
3. ComfyUI 固定核心版本、PyTorch/CUDA 组合和节点清单；模型库挂载，输入/输出独立可写卷。
4. 同一 Compose 网络用 `COMFYUI_URL=http://comfyui:8188`。Docker Desktop 连宿主机可用 `host.docker.internal`，但宿主机 ComfyUI 必须监听容器可访问的接口，并用防火墙限制访问；不能假定宿主机 `127.0.0.1` 可从容器访问。
5. Linux 配置 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)，Windows 走 WSL 2。Apple/AMD 环境另行验证，不承诺复用 NVIDIA 镜像。
6. 工作台 `/health`、ComfyUI `/system_stats` 健康检查；就绪后才提交。无认证前不开放公网端口。

本版本没有 Dockerfile/Compose 或镜像，仍需构建与 GPU 实测。

## 推荐下一阶段：轻量便携包 + 安装向导

建议 `LocalImageStudio-Windows.zip`（嵌入式 Python 或 PyInstaller onedir），只含工作台，不捆绑权重/GPU 运行时：

1. 检测已有 ComfyUI，允许填写 URL；不存在时链接官方安装器，避免重复安装。
2. 检测版本、GPU/显存、节点、权重并显示缺失项。
3. 用户选模型、确认许可证与磁盘空间后，复用官方下载工具；自建下载器须有断点续传、SHA-256 校验与进度。
4. 基础/低显存 profile 来自实测清单，不只根据显存数字承诺一定能运行。
5. 配置进入用户数据目录，替代机器专用的 `G:` 路径，数据与程序更新分离。
6. 日志导出、依赖诊断、更新回滚；更新前等待/暂停队列，不强杀推理进程。

先做便携包，再决定安装器或 Tauri/Electron 外壳。外壳负责窗口与启动体验，不复制 ComfyUI 的环境管理。

## 验收

在干净机器验证安装、连接、缺模型提示、真实出图、重启恢复、升级保留数据和卸载保留权重。开发机硬编码路径脚本不等于通用安装方案。
