import xml.etree.ElementTree as ET
import csv
import math
import os
import glob

def haversine_distance(lon1, lat1, lon2, lat2):
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def calculate_metrics():
    # Find the newly uploaded gpx file
    cwd = r"d:\CaelianProj\project_mst"
    gpx_files = glob.glob(os.path.join(cwd, "*.gpx"))
    
    if not gpx_files:
        print("No GPX file found!")
        return
        
    gpx_file = gpx_files[0]
    csv_file = r"d:\CaelianProj\project_mst\Calculated_Path_Metrics_GPX.csv"

    print(f"Processing {gpx_file}...")

    tree = ET.parse(gpx_file)
    root = tree.getroot()

    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'

    # Setup CSV writing
    headers = [
        "Path_Name", "Distance_m", "Start_Elevation_m", "End_Elevation_m", 
        "Elevation_Diff_m", "Total_Ascent_m", "Total_Descent_m", "Gradient_Percent",
        "Max_Slope_Percent", "Sinuosity_Index", "Base_Speed_mps", "Adj_Speed_mps", 
        "Travel_Time_s", "Travel_Time_min", "Travel_Time_with_Slope_s", "Travel_Time_with_Slope_min",
        "Road_Type", "Condition"
    ]

    base_speed_mps = 8.33  

    results = []

    for trk in root.findall(f'.//{ns}trk'):
        name_elem = trk.find(f'{ns}name')
        pm_name = name_elem.text.strip() if name_elem is not None else "Unknown"
        
        points = []
        for trkseg in trk.findall(f'{ns}trkseg'):
            for trkpt in trkseg.findall(f'{ns}trkpt'):
                lat = float(trkpt.get('lat'))
                lon = float(trkpt.get('lon'))
                ele_elem = trkpt.find(f'{ns}ele')
                ele = float(ele_elem.text) if ele_elem is not None else 0.0
                points.append((lon, lat, ele))
                
        if len(points) < 2:
            continue

        total_dist_2d = 0.0
        total_dist_3d = 0.0
        total_ascent = 0.0
        total_descent = 0.0
        max_slope = 0.0

        start_elev = points[0][2]
        end_elev = points[-1][2]
        elev_diff = end_elev - start_elev

        for i in range(len(points) - 1):
            lon1, lat1, z1 = points[i]
            lon2, lat2, z2 = points[i+1]

            d2d = haversine_distance(lon1, lat1, lon2, lat2)
            dz = z2 - z1
            d3d = math.sqrt(d2d**2 + dz**2)

            total_dist_2d += d2d
            total_dist_3d += d3d

            if dz > 0:
                total_ascent += dz
            else:
                total_descent += abs(dz)

            if d2d > 0:
                slope = (dz / d2d) * 100
                if abs(slope) > max_slope:
                    max_slope = abs(slope)

        if total_dist_2d == 0:
            continue
        
        gradient = (elev_diff / total_dist_2d) * 100
        
        # Calculate Sinuosity
        lon_start, lat_start, _ = points[0]
        lon_end, lat_end, _ = points[-1]
        straight_line_dist = haversine_distance(lon_start, lat_start, lon_end, lat_end)
        
        if straight_line_dist > 0:
            sinuosity = total_dist_2d / straight_line_dist
        else:
            sinuosity = 1.0 # Default to 1.0 if start and end are the same point
            
        # Simple rule: Base speed reduces by 2% for every 1% of absolute gradient
        slope_penalty = min(abs(gradient) * 0.02, 0.8) # max 80% penalty
        
        # Curvature penalty: For every 0.1 over 1.0 sinuosity, reduce speed by 5% (max 50% penalty)
        # e.g., Sinuosity 1.5 -> penalty of 0.25 (25% reduction)
        curvature_penalty = min(max(sinuosity - 1.0, 0) * 0.5, 0.5)
        
        adj_speed_mps = base_speed_mps * (1.0 - slope_penalty) * (1.0 - curvature_penalty)

        # Time calculations
        tt_s = total_dist_3d / base_speed_mps
        tt_min = tt_s / 60.0

        tt_slope_s = total_dist_3d / adj_speed_mps
        tt_slope_min = tt_slope_s / 60.0

        results.append([
            pm_name,
            round(total_dist_3d, 2),
            round(start_elev, 2),
            round(end_elev, 2),
            round(elev_diff, 2),
            round(total_ascent, 2),
            round(total_descent, 2),
            round(gradient, 2),
            round(max_slope, 2),
            round(sinuosity, 2),
            round(base_speed_mps, 2),
            round(adj_speed_mps, 2),
            round(tt_s, 2),
            round(tt_min, 2),
            round(tt_slope_s, 2),
            round(tt_slope_min, 2),
            "",  # Road_Type
            ""   # Condition
        ])

    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(results)

    print(f"Metrics calculation complete! Saved to {csv_file}")

if __name__ == '__main__':
    calculate_metrics()
