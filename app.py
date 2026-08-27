from flask import Flask, render_template, request, jsonify, send_from_directory
import sqlite3
import os
import json
from graph_builder import load_graph_from_csv
from dstar_lite import DStarLite

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'evacuation.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), 'Calculated_Path_Metrics_GPX.csv')
GEOJSON_PATH = os.path.join(os.path.dirname(__file__), 'Half_complete_Paths.geojson')

graph = load_graph_from_csv(CSV_PATH)

def apply_reports_to_graph(g):
    # Reset to base costs first
    for (u, v), cost in g.base_costs.items():
        if u in g.edges and v in g.edges[u]:
            g.edges[u][v] = cost
            
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT barangay, severity FROM reports")
    for row in c.fetchall():
        bgy, severity = row
        u = bgy
        v = "Poblacion"
        if u in g.edges and v in g.edges[u]:
            g.update_edge_cost(u, v, g.base_costs[(u, v)] * severity)
    conn.close()

apply_reports_to_graph(graph)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/geojson')
def get_geojson():
    with open(GEOJSON_PATH, 'r') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/api/route', methods=['POST'])
def get_route():
    data = request.json
    start = data.get('start')
    goal = data.get('goal', 'Poblacion')
    
    if start not in graph.edges or goal not in graph.edges:
        return jsonify({"error": "Invalid start or goal node"}), 400
        
    dstar = DStarLite(graph, start, goal)
    dstar.compute_shortest_path()
    path = dstar.get_path()
    
    if path:
        cost = 0
        for i in range(len(path)-1):
            cost += graph.edges[path[i]][path[i+1]]
            
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO history (start_barangay, destination, travel_time_mins) VALUES (?, ?, ?)", (start, goal, cost))
        conn.commit()
        conn.close()
        
        return jsonify({"path": path, "cost": cost})
    else:
        return jsonify({"error": "No path found"}), 404

@app.route('/api/reports', methods=['GET', 'POST'])
def handle_reports():
    if request.method == 'POST':
        data = request.json
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("INSERT INTO reports (barangay, condition_type, details, severity) VALUES (?, ?, ?, ?)",
                  (data['barangay'], data['condition_type'], data['details'], float(data['severity'])))
        conn.commit()
        conn.close()
        apply_reports_to_graph(graph)
        return jsonify({"status": "success"})
    else:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id, barangay, condition_type, details, severity, timestamp FROM reports ORDER BY timestamp DESC")
        reports = [{"id": r[0], "barangay": r[1], "type": r[2], "details": r[3], "severity": r[4], "timestamp": r[5]} for r in c.fetchall()]
        conn.close()
        return jsonify(reports)

@app.route('/api/history', methods=['GET'])
def get_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, start_barangay, destination, travel_time_mins, timestamp FROM history ORDER BY timestamp DESC LIMIT 50")
    history = [{"id": r[0], "start": r[1], "goal": r[2], "cost": r[3], "timestamp": r[4]} for r in c.fetchall()]
    conn.close()
    return jsonify(history)

@app.route('/tiles/<int:z>/<int:x>/<int:y>.png')
def serve_tile(z, x, y):
    tile_dir = os.path.join(app.root_path, 'static', 'tiles', str(z), str(x))
    return send_from_directory(tile_dir, f"{y}.png")

if __name__ == '__main__':
    app.run(debug=True, port=5000)
