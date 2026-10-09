# ComfyUI 后端版本

工作台不再加载 PyTorch/Diffusers。模型下载、加载、显存分配由 ComfyUI 负责；Stability Matrix 可以管理 ComfyUI 安装和模型下载，也可以使用现有 ComfyUI Portable。

## 本机快速开始

1. 执行 `install.bat`，创建独立轻量环境 `.venv-comfy`。原有 `venv` 不会被覆盖。
2. 模型位于 `G:\AI\Models\z-image-turbo-comfy\split_files`。已下载的权重可继续使用；下载可使用 Stability Matrix 的模型浏览器、ComfyUI 模板下载入口，或官方 Hugging Face 下载器：

```powershell
& 'G:\code\ComfyUI_windows_portable\python_embeded\python.exe' tools/download_models.py
```

3. 执行 `start_comfy_local.bat`，启动专用 ComfyUI（127.0.0.1:8189，默认禁用自定义节点）。
4. 执行 `start_studio_local.bat`，打开 http://127.0.0.1:8000 。模型安装完成后点击“刷新方案”。

启动脚本中的 `COMFYUI_HOME` 可以指向其他 Portable 目录。修改 `comfy-model-paths.yaml` 可使用自己的模型库。Stability Matrix 启动的 ComfyUI 可直接使用其地址，不必再运行 Portable。

## 接入已有 ComfyUI / Stability Matrix

```powershell
$env:COMFYUI_URL = 'http://127.0.0.1:8188'
# 仅在这个 ComfyUI 实例专供本工作台使用时启用即时停止。
$env:COMFYUI_DEDICATED = '1'
.\.venv-comfy\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
```

默认 `COMFYUI_DEDICATED=0`：暂停始终可用，即时停止会返回明确提示；避免误中断共享实例的其他任务。重启/停止页面上的服务器按钮只作用于工作台 API，不重启 ComfyUI。

## Z-Image-Turbo 所需权重

| 类型 | 文件 |
|---|---|
| diffusion_models | z_image_turbo_bf16.safetensors |
| text_encoders | qwen_3_4b.safetensors |
| vae | ae.safetensors |

来源：https://huggingface.co/Comfy-Org/z_image_turbo 。总计约 20GB。现有 Diffusers 缓存不能直接当作这三份 ComfyUI 权重。

本模板使用 ComfyUI KSampler CFG=1、Euler、simple scheduler、AuraFlow shift=3。CFG 不等于旧 Diffusers 的 guidance_scale=0，迁移时不能照搬。

## 新增生成方案

1. 在 ComfyUI 验证新模型的完整工作流，导出 **API 格式** JSON（不是包含 `nodes` 的编辑器 JSON）。
2. 放入 `workflows/`。
3. 在 `workflows/registry.json` 添加唯一 ID、显示名、JSON 文件路径、默认值、参数绑定与输出节点。
4. 重启工作台。页面自动读取列表并检查模型/节点是否可用。

绑定格式为 `节点ID.输入名`。支持 prompt、seed、width、height、steps、guidance_scale；不支持的参数可以省略绑定。输出使用 SaveImage PNG，`output_nodes` 指定保存节点 ID。量化模型需要匹配的工作流与节点，下载文件本身不代表可以推理。

模型选择器提供 Z-Image-Turbo、SDXL Turbo、Qwen-Image 2.1 INT8 与 FLUX.2 klein 4B FP8。切换后设置默认参数，并同步更新待执行任务；正在生成和已完成的任务不变。SDXL Turbo 默认 512×512、4步、CFG=1，建议英文提示词。权重下载命令：`G:\code\ComfyUI_windows_portable\python_embeded\python.exe tools/download_sdxl.py`，路径为 `G:\AI\Models\sdxl-turbo`；这些是开发机路径，其他电脑需调整。安装后重启 ComfyUI 并刷新模型列表。

每批最多 1000 条非空提示词，每条最长 20000 字符；超过限制会显示具体原因。

## 队列与恢复语义

- 每个任务保存独立工作流快照；切换模型会重新绑定待执行任务并更新默认参数，不改变正在生成或已完成的任务。
- 本工作台每次向 ComfyUI 提交一个任务，排序操作只影响未提交任务。
- 暂停不取消当前任务；即时停止取消当前任务并暂停队列，取消的任务变为“已跳过”。
- SQLite 位于 `data/studio.sqlite3`。重启后队列默认暂停，仍核对已提交任务的远端结果。
- 提交响应丢失时，通过任务标记查询 ComfyUI；不盲目重发。远端任务丢失则标记“待核对”，用户检查 ComfyUI 历史后可跳过/删除再重新提交。
- HTTP history 是完成状态的依据；WebSocket 提供采样进度，断线不影响结果核对。
- 清理队列不删除图片，隐藏后的已完成记录仍提供图库恢复。图库“清空”仅隐藏当前浏览器中的已有图片，不删除磁盘文件。
- 工作台只需一个 uvicorn 进程，不能使用多个 workers，否则会重复运行队列消费者。
- 历史数据库只记录迁移后的任务；旧 PNG 文件仍可下载，但缺少元数据的旧文件不会自动出现在新图库中。

## 开发验证

```powershell
.\.venv-comfy\Scripts\python.exe -m unittest discover -s tests -v
node --check static/index.js
```

测试覆盖工作流绑定、种子0、恢复、响应丢失、未确认任务、共享停止保护和图库持久化。真实出图只需安装所选方案要求的权重与节点，并确保 ComfyUI 能正常推理，不必安装全部模型。

## 本次验收结果（2026-10-09）

- 12 项自动测试通过，包括取消、排序、恢复、提交响应丢失和完成状态竞态。
- 真实 ComfyUI 接口测试通过（EmptyImage → SaveImage → 下载 PNG → SQLite 恢复）。命令：`.venv-comfy\Scripts\python.exe -m tests.live_comfy_smoke`。
- Z-Image-Turbo 官方三份权重已下载至配置中的模型目录；本机 RTX 5070 Ti 上，页面提交 512×512、9步、种子0 的任务成功，端到端约15.3秒。
- 页面刷新后的图库恢复、390px 窄屏无横向溢出已验证。
- 尚未测试其他模型家族与外部自定义节点。
