import torch
from diffusers import ZImagePipeline

def main():
    print("Loading Z-Image-Turbo pipeline in BF16 precision (unquantized)...")
    # Using from_pretrained to load the full BF16 model
    pipe = ZImagePipeline.from_pretrained(
        "Tongyi-MAI/Z-Image-Turbo",
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=False,
    )
    
    # Your RTX 5070 Ti has 16 GB VRAM. 
    # Enabling model CPU offload keeps peak VRAM low (~6GB) by moving components 
    # (text encoder, VAE, transformer) to the GPU only when they are actively running.
    # This prevents any potential Out-of-Memory (OOM) errors while keeping generation very fast.
    print("Enabling model CPU offload for VRAM safety...")
    pipe.enable_model_cpu_offload()

    prompt = "星舰穿越彩虹"

    print("Generating image...")
    image = pipe(
        prompt=prompt,
        height=1024,
        width=1024,
        num_inference_steps=9,  # This results in 8 DiT forwards
        guidance_scale=0.0,     # Guidance should be 0 for the Turbo models
        generator=torch.Generator("cuda").manual_seed(42),
    ).images[0]

    print("Saving image to example_standard.png...")
    image.save("example_standard.png")
    print("Generation complete! Image saved as example_standard.png.")

if __name__ == "__main__":
    main()
