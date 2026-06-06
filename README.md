# Z-Image-Turbo Local Studio

一个基于 **FastAPI** 和 **Tailwind 风格暗黑极客网页前端** 的本地图像生成工作区系统，专门针对消费级显卡（如 **RTX 5070 Ti / 40-系列 16GB 显存**）进行了超轻量、低延迟优化，支持常驻后台和批量提示词队列排队生成。

![UI Screenshot](screenshot.png)

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
* **提示词前缀与后缀批量注入：** 新增前缀与后缀输入框，在进行批量任务时，会自动加到每一行提示词上，大幅减少手动输入常用词的繁琐操作。
* **中英文多语言切换 (i18n)：** 支持中英文双语一键切换，偏好自动持久化在 `localStorage` 中。
* **同一个提示词结果聚合 (Bento Gallery Group)：** 前端画廊按照提示词智能聚合，支持同一个提示词生成多张图片时在 UI 上清晰呈现出版本对比，卡片尺寸自适应响应式排列。
* **智能快速重新生成 (插队优先)：**
  * 针对整组画廊（使用新随机种子）或单个缩略图/灯箱（使用固定种子）一键重新生成；
  * 重生成的任务会自动插入队列的最前面 (`front: true`) 获得最高优先级执行，并通过 toast 通知进行视觉反馈。
* **总进度与总任务计时器：** 提供 Linear 风格的渐变发光总进度条，以及总任务运行秒表计时器（防刷新缓存设计）。
* **灯箱大图上一张/下一张切换：** 预览大图时，支持浮动按钮和键盘左右方向键（`ArrowLeft` / `ArrowRight`）无缝切换浏览上一张/下一张，元数据自动同步更新。
* **右侧抽屉式日志控制台：** 将系统日志收纳在右侧伸缩式抽屉中，展开平滑，且通过 `max-height` 对生成队列容器限高滚动，保证任务列表与左侧输入区等高美观。
* **生成参数设置折叠收纳：** 分辨率、步数、CFG 等高级参数默认折叠，点击展开，保持界面整洁。
* **本地资源集成一键触达：**
  * **打开本地目录：** 自动在 Windows 资源管理器中弹出后端存放图片的本地 outputs 文件夹。
  * **下载全部图片：** 后端实时打包 outputs 下的所有图片并作为 ZIP 压缩文件流式返回浏览器。


---

## 🚀 本地极速运行指南 (Windows)

为了简化安装流程，我们提供了自动化安装和运行脚本，可一次性完成所有配置：

### 1. 自动一键安装
双击运行项目根目录下的 **`install.bat`**。该脚本将自动执行以下操作：
1. 检测本地 Python 环境（推荐使用 Python 3.10 或 3.11）。
2. 在项目根目录下创建 Python 虚拟环境 `venv` 并升级 pip。
3. 自动配置支持 CUDA 12.8 的 PyTorch 环境（适配 RTX 50/40 等显卡，避免 Blackwell 架构等兼容问题）。
4. 自动拉取最新的 `diffusers` 框架及相关网络库依赖。
5. 自动运行 **`apply_patches.py`** 修补 Windows 下的跨设备计算与 fp8 类型缺陷。

### 2. 启动服务与使用
安装完成后，你可以选择在安装脚本中直接运行服务，或在以后双击运行 **`start_server.bat`**：
* 首次启动时会自动下载并加载 unquantized BF16 版本的 `Tongyi-MAI/Z-Image-Turbo` 模型。
* 首次权重加载完成后，控制台将输出 `Model loaded successfully into Hybrid CPU/GPU memory!`。
* 打开浏览器访问：👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**。

---

## 🛠️ 手动运行指南 (供参考/高级用户)

如果你想手动控制每一步，可按以下步骤操作：

1. **环境初始化**：
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
2. **安装 PyTorch (CUDA 12.8)**：
   ```powershell
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```
3. **安装依赖与修补补丁**：
   ```powershell
   pip install git+https://github.com/huggingface/diffusers
   pip install transformers accelerate sentencepiece protobuf peft fastapi uvicorn requests
   python apply_patches.py
   ```
4. **启动服务**：
   ```powershell
   python -m uvicorn server:app --host 127.0.0.1 --port 8000
   ```

---

## 📂 仓库文件说明

* `server.py` — 基于 FastAPI 的后台程序，包含 GPU 锁、队列轮询器和推理控制器。
* `apply_patches.py` — 一键自动修补 `venv` 环境代码的补丁工具。
* `install.bat` — 全自动安装脚本（创建 venv、安装 PyTorch + 依赖、打补丁）。
* `start_server.bat` — 启动 FastAPI 生图服务的快捷脚本。
* `static/`
  * `index.html` — Bento 网格骨架、灯箱与 SVG 图标。
  * `index.css` — 遵循 Tailwind 色彩规范（Slate 背景 / Indigo 强调色）的样式表。
  * `index.js` — 实现状态轮询、接口请求、灯箱导航、前缀/后缀注入和日志记录的前端逻辑。