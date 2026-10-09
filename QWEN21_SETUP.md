# Qwen-Image 2.1：RTX 5070 Ti 16GB / RAM 32GB 配置

使用官方 Comfy-Org 量化权重，避免全精度模型和额外提示词增强模型的内存开销。

| 组件 | 文件 | 大小 |
|---|---|---|
| 主模型 | qwen_image_2.1_int8_convrot.safetensors | 7.26GB |
| 文本编码器 | qwen3vl_8b_int8_convrot.safetensors | 9.35GB |
| VAE | qwen_image_2.1_vae_bf16.safetensors | 0.68GB |

目录：`G:\AI\Models\qwen-image-2.1`，按 diffusion_models / text_encoders / vae 分类。

## 安装结构

- 独立 ComfyUI 核心：`G:\code\ComfyUI_qwen21`。
- 新依赖放在该目录的 `runtime_deps`，原 Portable CUDA/PyTorch 运行时不变。
- `tools/run_qwen_comfy.py` 优先加载新核心和依赖覆盖层。
- 核心来源：https://github.com/Comfy-Org/ComfyUI ，安装版本 commit `08ff3c1`。
- 权重来源：https://huggingface.co/Comfy-Org/Qwen-Image-2.1 。

## 启动

1. 运行 `start_comfy_qwen21.bat`（8190）。
2. 运行 `start_studio_qwen21.bat`（8000）。旧工作台进程若仍占用8000，先正常关闭。
3. 页面选择 `Qwen-Image 2.1 · INT8 / 16GB`。

新核心同时支持已经安装的 Z-Image-Turbo 和 SDXL Turbo。工作台任务仍在同一个 SQLite 数据库中，切换启动方式不会删除历史。未完成的任务在重启后暂停，确认后再继续。

## 运行策略

- 默认768×768、25步、CFG=1、Euler/simple、单张生成。
- 文本编码器在CPU运行；VAE也在CPU运行。
- `--lowvram --reserve-vram 2 --cpu-vae --disable-pinned-memory`：保留约2GB显存余量，并避免固定内存额外占用。
- QwenImage21Cache 使用CPU/int8。
- 不加载9B提示词增强编码器，直接使用用户提示词。
- 初次加载包含权重读取和初始化，耗时明显高于后续生成。需要更快的草稿时可降低尺寸或步数，但最终质量须实测。
- 当前接入的是文生图；参考图编辑与透明输出的专门操作尚未接入页面。

## 文件校验

```text
主模型 cb74113cb03faecd79611b01fd7fd642f0aa60d6f0b95086abee214d75eaa57d
文本编码器 8bfd0f6e12abf2d2d697ecc888e5e90b0d6741d6708f05799f53afa560452e8f
VAE bb21f7473051e1ac368515dd3f2e15cd44d7a11748ee8823e1ddca3e4876b7c9
```

以上SHA-256来自官方Hub文件元数据；下载完成并校验后才将`.part`文件改为正式模型文件。

## 本机验收（2026-10-09）

- 三份权重已完成下载与SHA-256校验。
- ComfyUI 0.39.0 / PyTorch 2.12.0+cu130 / RTX 5070 Ti 16GB 上成功运行。
- 768×768、25步、CFG=1、种子0首次完整生成约67.27秒，PNG结果正常；未发生显存不足。
- 项目17项测试通过，包含Qwen低显存配置的参数绑定检查。
- 工作台已切换到8190后端，三个模型均被识别为可用。
- 安装切换时曾中断一项旧后端任务，之后该任务所在队列被清除；未自动重加清除的任务。
- 测试图片：`output/qwen21-first.png`。更多分辨率与复杂多角色提示词需要单独验证，建议先从768px开始。
