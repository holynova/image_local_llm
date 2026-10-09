# Local Image Studio

本地多模型 AI 批量生图工作台。专注提示词、任务队列与作品管理，模型下载、加载和推理由独立的 ComfyUI 服务负责。

当前版本：**v1.5.0** · [更新记录](CHANGELOG.md) · [下载版本](https://github.com/holynova/image_local_llm/releases) · [页面预览](https://holynova.github.io/image_local_llm/)（静态预览不提供生图服务）

![工作台](screenshot.png)

## 功能

- 多模型选择、模型专属参数建议、带宽高比的尺寸选项。
- 批量提示词，每条生成 1–100 张，每批总计最多 1000 张；前缀、后缀、种子设置。
- 队列暂停、继续、停止、排序、打乱；切换模型同步更新待执行任务，不中断正在生成的图片。
- 工作区/作品结果双 Tab；宽屏三栏可调宽度，保存布局；中央查看最新结果。
- 提示词历史单行预览与行数；模型信息、全屏详情、下载、再生成、点赞/点踩与筛选。
- 单图进度按相同模型的历史平均耗时估算，完成前最多 99%；没有样本时显示不确定进度。
- SQLite 保存任务与结果记录；确认操作使用站内弹框。

## 技术栈与职责

```text
浏览器：HTML / CSS / 原生 JavaScript
    ↓ HTTP（队列、参数、图库）
FastAPI + Uvicorn：业务 API / 单消费者队列
    ├─ SQLite：任务、工作流快照、结果记录
    ├─ static/outputs：下载的生成图片
    └─ HTTPX + WebSocket → ComfyUI：执行 API JSON 工作流
                              └─ PyTorch / CUDA / 模型权重 / 节点
```

工作台运行时依赖见 [requirements.txt](requirements.txt)，**不包含 PyTorch、Diffusers、CUDA 或模型权重**。Node.js 仅用于开发测试，运行网站不需要 Node 或前端构建。提示词历史、评价、筛选与栏宽存储在浏览器本地，不是跨设备账号数据。

## 安装：推荐 Windows 原生分离部署

### 1. 准备 ComfyUI

安装官方 [ComfyUI Portable](https://docs.comfy.org/installation/comfyui_portable_windows) 或 [Comfy Desktop](https://docs.comfy.org/installation/desktop/windows)。已有 ComfyUI 可直接接入，无需重复安装。希望统一管理多个推理工具与共享模型库，可选 [Stability Matrix](https://github.com/LykosAI/StabilityMatrix)。

在 ComfyUI 中先验证目标模型能正常生成图片。模型文件按工作流要求放入 `diffusion_models`、`text_encoders`、`vae` 或 `checkpoints`；也可通过 extra model paths 引用独立模型库。

### 2. 安装工作台

安装 Python 3.11 或更新的兼容版本，下载源码并解压，双击 `install.bat`。脚本创建 `.venv-comfy` 并安装轻量客户端依赖，不修改 ComfyUI 的 Python 环境。

### 3. 接入 ComfyUI 并启动

ComfyUI 运行在 `127.0.0.1:8188` 时，直接双击 `start_server.bat`。其他地址在 PowerShell 中设置后启动：

```powershell
$env:COMFYUI_URL = 'http://127.0.0.1:8188'
# 只有此 ComfyUI 专供工作台使用时才设为 1，允许即时中断当前任务。
$env:COMFYUI_DEDICATED = '0'
.\.venv-comfy\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
```

打开 [http://127.0.0.1:8000](http://127.0.0.1:8000)，刷新模型列表。缺少权重或节点的模型会提示不可用；列表里出现模型不代表已下载安装。

只能启动一个 Uvicorn worker；当前 API 没有用户认证，不要直接暴露到公网。ComfyUI 地址必须是工作台服务端可以访问的地址。

### 机器专用脚本

`start_comfy_local.bat` / `start_studio_local.bat` 使用 8189；`start_comfy_qwen21.bat` / `start_studio_qwen21.bat` 使用 8190。脚本与下载工具中的 `G:\code`、`G:\AI\Models` 是开发机示例路径，**不是通用一键安装器**；其他电脑必须调整 `COMFYUI_HOME`、`QWEN_COMFY_HOME`、模型路径和相关脚本。

## 内置模型方案

| 方案 | 默认尺寸 | 步数 / CFG | 说明 |
|---|---|---|---|
| Z-Image-Turbo | 1024×1024 | 9 / 1 | ComfyUI 分离权重工作流 |
| SDXL Turbo | 512×512 | 4 / 1 | 快速草稿，建议英文提示词 |
| Qwen-Image 2.1 INT8 | 768×768 | 25 / 1 | CPU 文本编码与 VAE，优先稳定性 |
| FLUX.2 klein 4B FP8 | 1024×1024 | 4 / 1 | 蒸馏版，CPU 文本编码与 VAE |

当前量化配置在 RTX 5070 Ti 16GB、32GB RAM 上验证过；不是所有电脑的最低配置保证。不同显卡、节点版本、尺寸和 CPU 卸载策略都影响性能。权重、配置与实测见 [ComfyUI 接入](COMFYUI_SETUP.md)、[Qwen 安装记录](QWEN21_SETUP.md)、[FLUX 安装记录](FLUX2_SETUP.md)。权重许可、下载权限与再分发限制以各模型发布者为准。

## 数据与升级

| 位置 | 内容 |
|---|---|
| `data/studio.sqlite3` | 队列、任务参数、工作流快照与结果元数据 |
| `static/outputs/` | 生成图片的本地副本 |
| `workflows/registry.json`、`workflows/*.api.json` | 模型注册与 API 工作流 |
| ComfyUI 模型库 / `comfy-model-paths.yaml` | 外部权重，不随版本打包 |
| 浏览器 localStorage | 提示词历史、评价、隐藏图片与布局偏好 |

升级前正常停止工作台，备份数据库、输出目录以及修改过的工作流/路径配置；替换源码，重新执行 `install.bat`，然后启动。不要在生成时覆盖数据。重启后队列默认暂停，核对远端结果后继续。清空队列不删除已生成图片；清空图库仅在当前浏览器隐藏图片，不删除磁盘文件。

新增模型：先在 ComfyUI 验证 → 导出 API 格式 JSON → 放入 `workflows/` → 添加 registry 绑定 → 重启工作台并检查可用性。详见 [COMFYUI_SETUP.md](COMFYUI_SETUP.md)。

## Docker、桌面安装包，还是便携版？

推荐：**现在使用原生 ComfyUI + 轻量工作台；面向普通用户下一步做便携包与安装向导；服务器用户再提供容器部署。** 对比、依赖边界和发布规划见 [DEPLOYMENT.md](DEPLOYMENT.md)。

本版本是源码与文档，**没有发布 Docker 镜像、EXE 安装包或自动模型安装器**。模型和 CUDA 运行时不应塞进工作台安装包。

## 开发验证

```powershell
.\.venv-comfy\Scripts\python.exe -m unittest discover -s tests -v
node --check static/index.js
Get-ChildItem tests/test_*.js | ForEach-Object { node $_.FullName; if ($LASTEXITCODE -ne 0) { throw 'JS test failed' } }
```

自动化测试不需要下载模型；真实推理测试需要另行启动 ComfyUI 和安装对应权重。
