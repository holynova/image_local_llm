import torch
import time
from diffusers import ZImagePipeline

def main():
    # Allow Tensor Float 32 (TF32) for improved performance on Ampere/Ada/Blackwell NVIDIA GPUs
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

    print("=" * 60)
    print(" Z-IMAGE-TURBO ULTRA-OPTIMIZED PIPELINE (BF16)")
    print("=" * 60)
    
    print("Loading unquantized bfloat16 Z-Image-Turbo pipeline...")
    # Load standard bfloat16 model from the source
    pipe = ZImagePipeline.from_pretrained(
        "Tongyi-MAI/Z-Image-Turbo",
        torch_dtype=torch.bfloat16,
        low_cpu_mem_usage=True,  # Speeds up initial load into RAM
    )
    
    print("\nMoving entire pipeline to GPU CUDA VRAM (RTX 5070 Ti 16GB)...")
    # Keep the entire pipeline resident in VRAM for instant subsequent generations (no offloading overhead)
    pipe.to("cuda")

    # Optional torch.compile feature: Fuses CUDA operators for 30-50% faster step execution
    print("\n" + "-" * 60)
    print("OPTIMIZATION OPTION: torch.compile()")
    print("Fuses neural network kernels together. Highly recommended for RTX 5070 Ti.")
    print("Note: The FIRST image generation will take 1-2 minutes to compile in the background.")
    print("-" * 60)
    compile_choice = input("Enable torch.compile() for faster generations? [y/N]: ").strip().lower()
    
    if compile_choice == 'y':
        print("Compiling transformer model... (JIT compiling will trigger on the first image)")
        try:
            pipe.transformer = torch.compile(
                pipe.transformer,
                mode="reduce-overhead",
                fullgraph=False  # Set False for safety on varying inputs
            )
            print("Compilation hooks installed successfully!")
        except Exception as e:
            print(f"Warning: Model compilation failed or not supported. Falling back to default mode. Error: {e}")

    print("\nInitialization complete! Entering interactive generation loop.")
    print("Type your prompt and press Enter. Type 'exit' to quit.")
    print("=" * 60)

    img_counter = 1

    while True:
        try:
            prompt = input("\nEnter prompt for image generation: ").strip()
            if not prompt:
                continue
            if prompt.lower() == 'exit':
                print("Exiting interactive pipeline...")
                break

            filename = f"generated_optimized_{img_counter}.png"
            print(f"\nGenerating image: '{prompt}'...")
            
            start_time = time.time()
            
            # Generate the image
            image = pipe(
                prompt=prompt,
                height=1024,
                width=1024,
                num_inference_steps=9,  # Results in 8 actual DiT forwards
                guidance_scale=0.0,     # Guidance scale should be 0.0 for Turbo
                generator=torch.Generator("cuda").manual_seed(42),
            ).images[0]
            
            elapsed_time = time.time() - start_time
            print(f"Generation finished in {elapsed_time:.2f} seconds!")
            
            # Save the image locally
            image.save(filename)
            print(f"Successfully saved to: {filename}")
            img_counter += 1
            print("-" * 60)
            
        except KeyboardInterrupt:
            print("\nExiting interactive loop...")
            break
        except Exception as e:
            print(f"Error during generation: {e}")
            print("-" * 60)

if __name__ == "__main__":
    main()
