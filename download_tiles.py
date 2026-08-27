import math
import os
import requests
import time

def deg2num(lat_deg, lon_deg, zoom):
  lat_rad = math.radians(lat_deg)
  n = 2.0 ** zoom
  xtile = int((lon_deg + 180.0) / 360.0 * n)
  ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
  return (xtile, ytile)

# Bounding box covering Leon, Iloilo and the paths
min_lat = 10.74
max_lat = 10.91
min_lon = 122.28
max_lon = 122.43

zoom_levels = [11, 12, 13, 14]
base_dir = os.path.join(os.path.dirname(__file__), "static", "tiles")

headers = {
    'User-Agent': 'OfflineEvacMap/1.0 (Contact: student@example.com)'
}

def download_tiles():
    total_downloaded = 0
    for z in zoom_levels:
        x_min, y_max = deg2num(min_lat, min_lon, z)
        x_max, y_min = deg2num(max_lat, max_lon, z)
        
        if x_min > x_max: x_min, x_max = x_max, x_min
        if y_min > y_max: y_min, y_max = y_max, y_min
        
        print(f"Zoom {z}: X {x_min}-{x_max}, Y {y_min}-{y_max}")
        for x in range(x_min, x_max + 1):
            for y in range(y_min, y_max + 1):
                tile_dir = os.path.join(base_dir, str(z), str(x))
                os.makedirs(tile_dir, exist_ok=True)
                tile_path = os.path.join(tile_dir, f"{y}.png")
                
                if not os.path.exists(tile_path):
                    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    try:
                        resp = requests.get(url, headers=headers)
                        if resp.status_code == 200:
                            with open(tile_path, 'wb') as f:
                                f.write(resp.content)
                            total_downloaded += 1
                        else:
                            print(f"Failed to download {url}: {resp.status_code}")
                    except Exception as e:
                        print(f"Error downloading {url}: {e}")
                    time.sleep(0.1) # Be polite to OSM
                    
    print(f"Tile download complete. Downloaded {total_downloaded} new tiles.")

if __name__ == '__main__':
    download_tiles()
