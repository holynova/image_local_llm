"""Optional SDXL Turbo bootstrap through the official Hugging Face downloader."""
import os
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
from huggingface_hub import snapshot_download

if __name__ == '__main__':
    print(snapshot_download('stabilityai/sdxl-turbo',
        allow_patterns=['sd_xl_turbo_1.0_fp16.safetensors'],
        local_dir=os.environ.get('STUDIO_SDXL_DIR', r'G:\AI\Models\sdxl-turbo')), flush=True)
