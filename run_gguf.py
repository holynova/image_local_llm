import torch
from diffusers import ZImagePipeline, ZImageTransformer2DModel, GGUFQuantizationConfig
from huggingface_hub import hf_hub_download

def main():
    # 1. Download the GGUF model file
    print("Downloading GGUF model from Hugging Face...")
    model_path = hf_hub_download(
        repo_id="unsloth/Z-Image-Turbo-GGUF",
        filename="z-image-turbo-Q4_K_M.gguf"
    )
    print(f"Downloaded to: {model_path}")

    # 2. Load the transformer from GGUF file
    print("Loading GGUF transformer...")
    transformer = ZImageTransformer2DModel.from_single_file(
        model_path,
        quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16),
        torch_dtype=torch.bfloat16,
    )

    # 3. Load the rest of the pipeline
    print("Loading Z-Image-Turbo pipeline (text encoder, VAE, etc.)...")
    pipe = ZImagePipeline.from_pretrained(
        "Tongyi-MAI/Z-Image-Turbo",
        transformer=transformer,
        torch_dtype=torch.bfloat16,
    )
    
    print("Moving pipeline to CUDA...")
    pipe.to("cuda")

    # 4. Generate image
    # prompt = "Young Chinese woman in red Hanfu, intricate embroidery. Impeccable makeup, red floral forehead pattern. Elaborate high bun, golden phoenix headdress, red flowers, beads. Holds round folding fan with lady, trees, bird. Neon lightning-bolt lamp (⚡️), bright yellow glow, above extended left palm. Soft-lit outdoor night background, silhouetted tiered pagoda (西安大雁塔), blurred colorful distant lights."
    prompt = "星舰穿越彩虹"

    print("Generating image...")
    image = pipe(
        prompt=prompt,
        height=1024,
        width=1024,
        num_inference_steps=9,  # This actually results in 8 DiT forwards
        guidance_scale=0.0,     # Guidance should be 0 for the Turbo models
        generator=torch.Generator("cuda").manual_seed(42),
    ).images[0]

    print("Saving image to example_gguf.png...")
    image.save("example_gguf.png")
    print("Generation complete! Image saved as example_gguf.png.")

if __name__ == "__main__":
    main()
