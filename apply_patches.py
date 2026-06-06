import os
import sys

def patch_file(filepath, target, replacement):
    if not os.path.exists(filepath):
        print(f"[Warning] File not found: {filepath}")
        return False
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if replacement in content:
        print(f"[Info] Already patched: {os.path.basename(filepath)}")
        return True
        
    if target not in content:
        print(f"[Error] Target string not found in {os.path.basename(filepath)}")
        return False
        
    updated_content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(updated_content)
        
    print(f"[Success] Patched: {os.path.basename(filepath)}")
    return True

def main():
    # Detect site-packages directory in the active virtual environment
    venv_path = os.path.dirname(os.path.dirname(sys.executable))
    site_packages_dir = os.path.join(venv_path, "Lib", "site-packages")
    
    if not os.path.exists(site_packages_dir):
        # Fallback to sys.path search
        found_dir = None
        for path in sys.path:
            if "site-packages" in path and os.path.exists(path):
                found_dir = path
                break
        if found_dir:
            site_packages_dir = found_dir
        else:
            print("[Error] Could not find site-packages directory. Make sure you run this script using the venv Python interpreter.")
            sys.exit(1)

    print(f"Using site-packages directory: {site_packages_dir}")
    
    # 1. Patch transformers integrations finegrained_fp8.py
    transformers_fp8_path = os.path.join(
        site_packages_dir, 
        "transformers", "integrations", "finegrained_fp8.py"
    )
    patch_file(
        transformers_fp8_path,
        '_UE8M0_SF_DTYPE = torch.float8_e8m0fnu',
        '_UE8M0_SF_DTYPE = getattr(torch, "float8_e8m0fnu", None)'
    )
    
    # 2. Patch diffusers scheduling_flow_match_euler_discrete.py
    scheduler_path = os.path.join(
        site_packages_dir, 
        "diffusers", "schedulers", "scheduling_flow_match_euler_discrete.py"
    )
    patch_file(
        scheduler_path,
        'prev_sample = sample + dt * model_output',
        'prev_sample = sample + dt.to(device=sample.device, dtype=sample.dtype) * model_output.to(device=sample.device, dtype=sample.dtype)'
    )
    
    # 3. Patch diffusers pipeline_z_image.py (Dynamic Device Casting)
    pipeline_path = os.path.join(
        site_packages_dir, 
        "diffusers", "pipelines", "z_image", "pipeline_z_image.py"
    )
    
    # Patch 3.1: Transformer input casting
    target_3_1 = """                latent_model_input = latent_model_input.unsqueeze(2)
                latent_model_input_list = list(latent_model_input.unbind(dim=0))"""
                
    replacement_3_1 = """                latent_model_input = latent_model_input.unsqueeze(2)
                latent_model_input_list = list(latent_model_input.unbind(dim=0))

                # Ensure all inputs are on the transformer's device and dtype for hybrid CPU/GPU compatibility
                latent_model_input_list = [l.to(self.transformer.device, dtype=self.transformer.dtype) for l in latent_model_input_list]
                timestep_model_input = timestep_model_input.to(self.transformer.device, dtype=self.transformer.dtype)
                prompt_embeds_model_input = [p.to(self.transformer.device, dtype=self.transformer.dtype) for p in prompt_embeds_model_input]"""
                
    patch_file(pipeline_path, target_3_1, replacement_3_1)
    
    # Patch 3.2: VAE decoder input casting
    target_3_2 = """        if output_type == "latent":
            image = latents

        else:
            latents = (latents / self.vae.config.scaling_factor) + self.vae.config.shift_factor"""
            
    replacement_3_2 = """        if output_type == "latent":
            image = latents

        else:
            # Ensure latents are cast to the VAE's device and dtype
            latents = latents.to(self.vae.device, dtype=self.vae.dtype)
            latents = (latents / self.vae.config.scaling_factor) + self.vae.config.shift_factor"""
            
    patch_file(pipeline_path, target_3_2, replacement_3_2)

    print("\nPatching process completed.")

if __name__ == "__main__":
    main()
