import os
import glob
from PIL import Image

brain_dir = os.path.expanduser('~/.gemini/antigravity/brain/73982e5e-2621-4cb6-9061-becb8534a0c7')
candidates = glob.glob(os.path.join(brain_dir, 'elegant_saas_logo_purple_black_*.png'))
if candidates:
    latest_img_path = sorted(candidates)[-1]
    img = Image.open(latest_img_path).convert("RGBA")
    
    # Very tight crop for the left side (the arrow mark)
    # The image is 640x640. Let's crop from x=100 to 260, y=200 to 410
    cropped = img.crop((100, 200, 260, 410))
    
    logo_path = '/Users/lefterisgilmaz/Desktop/lisai-app/client/src/assets/listai-logo.png'
    cropped.save(logo_path)
    
    # Favicon
    # Let's crop to a square for the favicon so it doesn't get distorted
    square_crop = img.crop((100, 220, 280, 400)) # 180x180
    favicon = square_crop.resize((64, 64), Image.Resampling.LANCZOS)
    
    favicon_path1 = '/Users/lefterisgilmaz/Desktop/lisai-app/client/public/favicon.png'
    favicon.save(favicon_path1)
    
    print("Logo and favicon updated tightly.")
