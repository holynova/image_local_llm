import torch
import time
from diffusers import ZImagePipeline

def main():
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    print("Loading Z-Image-Turbo pipeline...")
    pipe = ZImagePipeline.from_pretrained(
        "Tongyi-MAI/Z-Image-Turbo",
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=True
    )

    print("Enabling model CPU offload...")
    # This is critical on Windows to keep peak VRAM under 16GB
    # It loads text_encoder (8GB) and transformer (12GB) sequentially into GPU VRAM
    pipe.enable_model_cpu_offload()

    prompt = "A futuristic starship flying through a colorful nebula, glowing thrusters, massive scale, deep space, high detail"
    
    print("\nGenerating image (should take only 3-8 seconds)...")
    start_time = time.time()
    
    image = pipe(
        prompt=prompt,
        height=1024,
        width=1024,
        num_inference_steps=9,  # 8 steps
        guidance_scale=0.0,
        generator=torch.Generator("cuda").manual_seed(42),
    ).images[0]
    
    elapsed = time.time() - start_time
    print(f"\nSUCCESS! Image generated in {elapsed:.2f} seconds!")
    image.save("speed_test_result.png")

if __name__ == "__main__":
    main()
