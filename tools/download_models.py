"""Bootstrap via Hugging Face's official downloader; optional, outside app runtime."""
import os
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
from huggingface_hub import snapshot_download

if __name__ == '__main__':
    path = snapshot_download('Comfy-Org/z_image_turbo', local_dir=os.environ.get(
        'STUDIO_MODEL_DIR', r'G:\AI\Models\z-image-turbo-comfy'),
        allow_patterns=['split_files/diffusion_models/z_image_turbo_bf16.safetensors',
                        'split_files/text_encoders/qwen_3_4b.safetensors',
                        'split_files/vae/ae.safetensors'], max_workers=3)
    print(path, flush=True)
