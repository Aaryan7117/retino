import os
import sys
import io
import pandas as pd
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

parquet_path = "data/samples/idrid/data/test-00000-of-00001.parquet"
out_dir = "data/samples/idrid_samples"
os.makedirs(out_dir, exist_ok=True)

df = pd.read_parquet(parquet_path)
saved = set()

for idx, row in df.iterrows():
    lbl = int(row['label'])
    if lbl not in saved:
        img_bytes = row['image']['bytes']
        img = Image.open(io.BytesIO(img_bytes))
        file_path = os.path.join(out_dir, f"idrid_grade_{lbl}.jpg")
        img.save(file_path, quality=92)
        saved.add(lbl)
        print(f"Saved Grade {lbl}: {file_path} (Size: {img.size})")
    if len(saved) == 5:
        break

print("All 5 DR severity grades extracted successfully from IDRiD Indian clinical dataset!")
