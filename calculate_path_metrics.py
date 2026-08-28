import xml.etree.ElementTree as ET
import csv
import math

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
    kml_file = r"d:\CaelianProj\project_mst\Half_complete.kml"
    csv_file = r"d:\CaelianProj\project_mst\Calculated_Path_Metrics.csv"

    tree = ET.parse(kml_file)
    root = tree.getroot()

    ns = ''
    if root.tag.startswith('{'):
        ns = root.tag.split('}')[0] + '}'

    # Setup CSV writing
    headers = [
        "Path_Name", "Distance_m", "Start_Elevation_m", "End_Elevation_m", 
        "Elevation_Diff_m", "Total_Ascent_m", "Total_Descent_m", "Gradient_Percent",
        "Max_Slope_Percent", "Base_Speed_mps", "Adj_Speed_mps", 
        "Travel_Time_s", "Travel_Time_min", "Travel_Time_with_Slope_s", "Travel_Time_with_Slope_min",
        "Road_Type", "Condition"
    ]

    # Base speed for motorcycle and 4-wheel car on barangay roads
    # Assuming ~30 km/h (8.33 meters per second) on flat ground
    base_speed_mps = 8.33  

    results = []

    for folder in root.findall(f'.//{ns}Folder'):
        folder_name_elem = folder.find(f'{ns}name')
        folder_name = folder_name_elem.text.strip() if folder_name_elem is not None else "Unknown"
        
        for pm in folder.findall(f'{ns}Placemark'):
            pm_name_elem = pm.find(f'{ns}name')
            pm_name = pm_name_elem.text.strip() if pm_name_elem is not None else "Unknown"
            
            coords_elem = pm.find(f'.//{ns}coordinates')
            if coords_elem is not None:
                coords_str = coords_elem.text.strip()
                points = []
                for pt in coords_str.split():
                    try:
                        parts = pt.split(',')
                        if len(parts) >= 3:
                            points.append((float(parts[0]), float(parts[1]), float(parts[2])))
                        elif len(parts) == 2:
                            points.append((float(parts[0]), float(parts[1]), 0.0))
                    except ValueError:
                        continue
                
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
                
                # Simple rule: Base speed reduces by 2% for every 1% of absolute gradient
                slope_penalty = min(abs(gradient) * 0.02, 0.8) # max 80% penalty
                adj_speed_mps = base_speed_mps * (1.0 - slope_penalty)

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
