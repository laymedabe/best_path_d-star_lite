import csv

# ==========================================
# ADVANCED PATHFINDING FACTORS (FRAMEWORK)
# ==========================================
# Update these values once you collect your real-world data!
# A multiplier of 1.0 means NO penalty. A multiplier of 1.5 means 50% slower.

CONDITION_MULTIPLIERS = {
    "Dirt": 1.0,     # e.g., change to 1.6 later for muddy/dirt roads
    "Poor": 1.0,     # e.g., change to 1.2 later for cracked pavement
    "Paved": 1.0
}

ROAD_TYPE_MULTIPLIERS = {
    "Single Lane": 1.0,  # e.g., change to 1.2 later to account for bottlenecks
    "Highway": 1.0
}

# Flat time penalty (in minutes) added to every road segment to simulate stopping at an intersection
INTERSECTION_PENALTY_MIN = 0.0 # e.g., change to 0.16 (approx 10 seconds) later
# ==========================================

class Graph:
    def __init__(self):
        # Adjacency list: node -> {neighbor: cost}
        self.edges = {}
        # Keep track of original costs in case we want to reset
        self.base_costs = {}
        
    def add_node(self, node):
        if node not in self.edges:
            self.edges[node] = {}
            
    def add_edge(self, u, v, cost):
        self.add_node(u)
        self.add_node(v)
        # We assume roads are bidirectional
        self.edges[u][v] = cost
        self.edges[v][u] = cost
        self.base_costs[(u, v)] = cost
        self.base_costs[(v, u)] = cost
        
    def update_edge_cost(self, u, v, new_cost):
        """Updates the cost of an edge dynamically (e.g. if condition becomes 'Poor')"""
        if u in self.edges and v in self.edges[u]:
            self.edges[u][v] = new_cost
            self.edges[v][u] = new_cost
            return True
        return False

    def get_neighbors(self, u):
        return self.edges.get(u, {})

def load_graph_from_csv(csv_path):
    graph = Graph()
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            path_name = row['Path_Name'].strip()
            
            # Split the path name like "Bobon to Poblacion 1" into Source and Target
            if " to " in path_name.lower():
                idx = path_name.lower().find(" to ")
                source = path_name[:idx].strip()
                target = path_name[idx + 4:].strip()
            else:
                continue
                
            # Using the Travel_Time_with_Slope_min as the BASE edge weight/cost
            base_cost = float(row['Travel_Time_with_Slope_min'])
            
            # Extract new metrics if they exist in the CSV (default to empty string if missing)
            condition = row.get('Condition', '').strip()
            road_type = row.get('Road_Type', '').strip()
            
            # Apply mathematical penalties based on collected data
            cond_mult = CONDITION_MULTIPLIERS.get(condition, 1.0)
            type_mult = ROAD_TYPE_MULTIPLIERS.get(road_type, 1.0)
            
            # Final Time Cost = Base Time * Condition Penalty * Road Type Penalty + Intersection Penalty
            cost = (base_cost * cond_mult * type_mult) + INTERSECTION_PENALTY_MIN
            
            graph.add_edge(source, target, cost)
            
            # Virtual zero-cost edges
            import re
            source_base = re.sub(r'[0-9]', '', source).strip()
            if source_base != source:
                graph.add_edge(source_base, source, 0.0)
                
            target_base = re.sub(r'[0-9]', '', target).strip()
            if target_base != target:
                graph.add_edge(target_base, target, 0.0)
            
    return graph
