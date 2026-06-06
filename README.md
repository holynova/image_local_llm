# Z-Image-Turbo Local Studio

一个基于 **FastAPI** 和 **Linear.app 暗黑极客风格网页前端** 的本地图像生成工作区系统，专门针对消费级显卡（如 **RTX 5070 Ti / 40-系列 16GB 显存**）进行了超轻量、低延迟优化，支持常驻后台和批量提示词队列排队生成。

---

## ✨ 项目特点

* **模型常驻内存 / 避免重复加载：** 采用 Client-Server 架构，启动时一次性加载 Z-Image-Turbo（60亿参数蒸馏单流扩散 Transformer 模型）并在后台持续运行，客户端发送请求立即可得出图，出图仅需 8~9 秒。
* **混合设备映射（Hybrid Device Layout）优化：** 
  * 将 **T5-XXL 文本编码器** (9.4GB) 和 **VAE 编码器** (160MB) 分配在 **CPU** 运行；
  * 将 **Transformer 核心模块** (12GB) 锁定在 **GPU VRAM** 中运行。
  * 完美控制 peak 显存开销在 **13GB 以下**，彻底避免了 Windows WDDM 系统显存分页（Paging）到系统内存导致的生成速度暴跌问题。
* **支持完整的排队与控制流：** 
  * 前端可批量输入几十甚至上百个提示词（每行一个）。
  * 网页提供 **Pause（暂停）**、**Resume（恢复）** 和 **Stop（中止）** 控制。
  * 采用了 `callback_on_step_end` 异常钩子，能在**推理步骤的中途瞬间中断 GPU 计算**，释放显存锁。
* **前后端状态实时同步：** 即使刷新或重新打开网页，前台也能自动向后台拉取最新的生成队列、状态与画廊。
* **Linear.app 暗黑科技美学：** 采用 Bento Box（便当盒）网格布局、Inter Display 字体栈、纯 SVG 极简线框图标、霓虹渐变发光，以及 snappy `250ms` 的贝塞尔微动效。
* **实时开发者日志控制台：** 网页自带 monospace 单色命令台，输出任务排队、接口数据传输、耗时计时等详细日志。

---

## 🚀 本地运行指南

### 1. 克隆项目与环境初始化

在项目根目录下创建并激活 Python 虚拟环境：

```powershell
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (Windows PowerShell)
.\venv\Scripts\Activate.ps1
```

### 2. 安装支持 CUDA 12.8 的 PyTorch

针对 NVIDIA RTX 50-系列（Blackwell 架构 `sm_120`）及旧款显卡，推荐使用 CUDA 12.8 支持的 PyTorch，以避免 `no kernel image is available` 错误：

```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

### 3. 安装依赖库

安装最新版 `diffusers`（目前 Z-Image 处于开发主分支）及其他组件：

```powershell
# 从源码安装最新 diffusers
pip install git+https://github.com/huggingface/diffusers

# 安装 transformers 和 web 框架依赖
pip install transformers accelerate sentencepiece protobuf peft fastapi uvicorn requests
```

### 4. 运行环境修复补丁 (关键步骤)

Windows 环境下的 PyTorch 会因为缺失某些 fp8 数据类型以及不支持跨设备 tensor 运算而导致报错或推理变慢。我们提供了一个自动补丁脚本，执行即可自动修复虚拟环境中对应的库代码：

```powershell
python apply_patches.py
```

*此脚本会自动对 `transformers` 的 fp8 导入语句，以及 `diffusers` 调度器/管道中的动态设备转换（`.to(device)`）打上补丁。*

### 5. 启动 Studio 服务端

```powershell
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

* 服务端启动时会自动下载并加载 unquantized BF16 版本的 `Tongyi-MAI/Z-Image-Turbo` 模型。
* 首次加载由于下载权重需要一定时间，请耐心等待控制台输出 `Model loaded successfully into Hybrid CPU/GPU memory!`。

### 6. 使用客户端工作区

打开浏览器访问以下链接即可开始使用：

👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 📂 仓库文件说明

* `server.py` — 基于 FastAPI 的后台程序，包含 GPU 锁、队列轮询器和推理控制器。
* `apply_patches.py` — 一键自动修补 `venv` 环境代码的补丁工具。
* `static/`
  * `index.html` — Bento 网格骨架与 SVG 图标。
  * `index.css` — 遵循 Linear.app 极客黑色彩规范与贝塞尔过渡的样式表。
  * `index.js` — 实现状态轮询、接口请求、灯箱效果和日志记录的前端逻辑。