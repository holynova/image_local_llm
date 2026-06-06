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

    print("Configuring Hybrid CPU/GPU execution...")
    # Keep text encoder on CPU (saves 8GB VRAM, takes ~1.5s on CPU)
    pipe.text_encoder.to("cpu")
    # Keep VAE on CPU (saves VRAM, takes ~3s on CPU)
    pipe.vae.to("cpu")
    # Move the main 12GB Transformer permanently to CUDA GPU
    pipe.transformer.to("cuda")

    prompt = "A futuristic starship flying through a colorful nebula, glowing thrusters, massive scale, deep space, high detail"
    
    print("\nGenerating image (Hybrid CPU/GPU mode)...")
    start_time = time.time()
    
    image = pipe(
        prompt=prompt,
        height=1024,
        width=1024,
        num_inference_steps=9,  # 8 actual steps
        guidance_scale=0.0,
        generator=torch.Generator("cpu").manual_seed(42), # Generator on CPU since text encoder is on CPU
    ).images[0]
    
    elapsed = time.time() - start_time
    print(f"\nSUCCESS! Image generated in {elapsed:.2f} seconds!")
    image.save("speed_test_hybrid.png")

if __name__ == "__main__":
    main()
