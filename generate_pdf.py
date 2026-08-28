from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Path Metrics Computations & Theories', 0, 1, 'C')
        self.ln(10)
        
    def chapter_title(self, title):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 10, title, 0, 1, 'L', 1)
        self.ln(4)
        
    def chapter_body(self, body):
        self.set_font('Arial', '', 11)
        self.multi_cell(0, 8, body)
        self.ln()

pdf = PDF()
pdf.add_page()

pdf.chapter_title('1. Distance Calculation (Spherical & Euclidean Theory)')
body1 = """- 2D Ground Distance (d2d): Uses the Haversine Formula, which is the standard trigonometric theory for calculating the great-circle distance between two points on a sphere (the Earth).
  Formula:
  a = sin^2(delta_phi/2) + cos(phi1)*cos(phi2)*sin^2(delta_lambda/2)
  c = 2 * atan2(sqrt(a), sqrt(1-a))
  d2d = R * c (where R = 6371000 meters, Earth's radius)
  
- 3D Travel Distance (d3d): Uses the Pythagorean Theorem to account for elevation changes, ensuring the distance includes the physical hypotenuse of traveling up/down a hill.
  Formula: d3d = sqrt(d2d^2 + dz^2)"""
pdf.chapter_body(body1)

pdf.chapter_title('2. Topographical Computations')
body2 = """- Total Ascent/Descent: Loops through every segment between GPX points. If the elevation difference (dz) is positive, it adds it to total_ascent. If dz is negative, it adds the absolute value to total_descent.
- Max Slope (max_slope): Calculated by finding the slope of every individual segment ((dz / d2d) * 100) and tracking the highest absolute value found along the entire route.
- Overall Gradient (gradient): The average slope of the entire path from start to finish.
  Formula: (elev_diff / total_dist_2d) * 100"""
pdf.chapter_body(body2)

pdf.chapter_title('3. Kinematic Penalty Theory (Speed & Travel Time)')
body3 = """Instead of a complex non-linear curve (like Tobler's function), this script uses a Linear Slope Penalty Theory:
- Base Speed: 8.33 m/s (roughly 30 km/h, typically implying vehicle travel).
- Slope Penalty: Linear rule where base speed reduces by 2% for every 1% of absolute overall gradient. Capped at a maximum penalty of 80% (0.8) to ensure theoretical movement on steep hills.
  Formula: slope_penalty = min(abs(gradient) * 0.02, 0.8)
- Adjusted Speed (adj_speed_mps): 
  Formula: base_speed_mps * (1.0 - slope_penalty)
- Travel Time (tt_slope_s): 
  Formula: Time = Distance (3D) / Adjusted Speed. 
  It is then divided by 60 to compute the 'Travel_Time_with_Slope_min' used in path calculations."""
pdf.chapter_body(body3)

pdf.output('Path_Metrics_Documentation.pdf')
print("PDF generated successfully: Path_Metrics_Documentation.pdf")
