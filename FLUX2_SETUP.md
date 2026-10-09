# FLUX.2 klein 4B FP8

RTX 5070 Ti 16GB profile: official distilled FP8 model, 1024×1024,
4 steps, Euler + Flux2Scheduler, CFG 1. Text encoder runs on CPU;
the existing ComfyUI launcher uses CPU VAE decoding and low-VRAM mode.

- Diffusion: `G:/AI/Models/flux2-klein-4b/diffusion_models/flux-2-klein-4b-fp8.safetensors`
- VAE: `G:/AI/Models/flux2-klein-4b/vae/flux2-vae.safetensors`
- Text encoder: reuse `G:/AI/Models/z-image-turbo-comfy/split_files/text_encoders/qwen_3_4b.safetensors`.

Sources:
- https://huggingface.co/black-forest-labs/FLUX.2-klein-4b-fp8
- https://huggingface.co/Comfy-Org/flux2-klein-4B
- https://docs.comfy.org/zh/tutorials/flux/flux-2-klein

Workflow: `workflows/flux2-klein-4b-fp8.api.json`. Switching to this model
in the studio updates waiting tasks, not the active task or finished images.
Larger resolutions can consume more VRAM. Initial loading/text encoding on CPU
can be noticeably slower than the four diffusion steps themselves.

## Verified on this computer

2026-10-09: 1024×1024, 4 steps, CFG 1, seed 0 completed through
ComfyUI → PNG → SQLite recovery in 31.76 seconds (includes first-load overhead).
Output: `output/flux2-klein-first.png`. Runtime GPU memory after completion was
approximately 6.3GB; this is not a measured peak-VRAM figure.

Verified SHA-256:
- Diffusion: `97ed34fe0567e436200f2faee3939b88f2b5d99f8af2a4dc16532c4245c0ccb6`
- VAE: `868fe7b343cc8f3a19dbcfcafbc3d5f888802be3f89bd81b65b3621a066ce8f3`

Hard links in `G:/code/ComfyUI_qwen21/models/diffusion_models` and `models/vae`
make the weights visible immediately without restarting ComfyUI or duplicating
disk storage. The extra model paths config also registers the source directory.
