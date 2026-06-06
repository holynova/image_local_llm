import torch
import time
from diffusers import ZImagePipeline

def main():
    # Enable TF32 for optimal NVIDIA Ampere/Ada/Blackwell GPU acceleration
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    print("=" * 60)
    print(" Z-IMAGE-TURBO BATCH SPEED & STYLE TEST (BF16)")
    print("=" * 60)

    # 10 prompts showcasing different styles
    test_prompts = [
        ("cyberpunk", "A cyberpunk hacker cat in a neon-lit room, typing on a holographic keyboard, futuristic, highly detailed"),
        ("oil_painting", "A serene lake surrounded by autumn forest, reflection of golden leaves on water, classic oil painting, textured brushstrokes"),
        ("sci_fi", "A futuristic starship flying through a colorful nebula, glowing thrusters, massive scale, deep space, high detail"),
        ("watercolor", "A delicate bouquet of cherry blossoms in a glass vase, soft pastel colors, watercolor painting style, splatters"),
        ("anime", "An anime-style girl standing under a starry night sky, wind blowing through her hair, beautiful, vibrant colors"),
        ("photorealistic", "Close-up portrait of an old man with deep wrinkles, smiling, natural lighting, highly detailed, photorealistic, 8k"),
        ("surrealism", "A clock melting over a tree branch in a desert landscape, surrealism style, dream-like, melting textures"),
        ("clay_3d", "A cute little 3D clay style dragon sitting on a gold coin, glossy texture, vibrant colors, miniature toy look"),
        ("ink_wash", "Solitary fisherman on a tiny boat in a misty river, mountains in the background, traditional Chinese ink wash painting style"),
        ("pencil_sketch", "Detailed pencil sketch of a majestic lion roaring, dramatic shadows, hand-drawn look")
    ]

    print("Loading unquantized bfloat16 Z-Image-Turbo pipeline...")
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

    print("\nStarting batch generation of 10 images...")
    print("=" * 60)

    total_inference_time = 0.0
    times = []

    for i, (style, prompt) in enumerate(test_prompts, start=1):
        filename = f"style_{i}_{style}.png"
        print(f"[{i}/10] Style: {style.upper()}")
        print(f"Prompt: {prompt}")
        
        start_time = time.time()
        
        image = pipe(
            prompt=prompt,
            height=1024,
            width=1024,
            num_inference_steps=9,  # 8 actual forwards
            guidance_scale=0.0,     # Guidance should be 0.0 for Turbo
            generator=torch.Generator("cpu").manual_seed(42 + i),  # Different seed for each image
        ).images[0]
        
        elapsed = time.time() - start_time
        times.append(elapsed)
        total_inference_time += elapsed
        
        image.save(filename)
        print(f"Saved to {filename} in {elapsed:.2f} seconds")
        print("-" * 60)

    print("\n" + "=" * 60)
    print(" BATCH BENCHMARK SUMMARY")
    print("=" * 60)
    print(f"Total time for 10 images: {total_inference_time:.2f} seconds")
    print(f"Average time per image: {total_inference_time / 10:.2f} seconds")
    for idx, (style, _) in enumerate(test_prompts, start=1):
        print(f" - Style {idx:2d} ({style:15s}): {times[idx-1]:.2f}s")
    print("=" * 60)

if __name__ == "__main__":
    main()
