// ==========================================
// ADVANCED PATHFINDING FACTORS (FRAMEWORK)
// ==========================================

const CONDITION_MULTIPLIERS = {
    "Very Good": 1.0,
    "Verygood": 1.0,
    "Good": 1.0,
    "Fairly Good": 1.1,
    "Poor": 1.4
};

const ROAD_TYPE_MULTIPLIERS = {
    "Concrete": 1.0,
    "Gravel": 1.2,
    "Earth": 1.5
};

const INTERSECTION_PENALTY_MIN = 0.0; // e.g., change to 0.16 (approx 10 seconds) later

class Graph {
    constructor() {
        this.edges = {};
        this.base_costs = {};
        this.edge_details = {};
    }

    add_node(node) {
        if (!(node in this.edges)) {
            this.edges[node] = {};
        }
    }

    add_edge(u, v, cost, road_type = 'Zero-Cost Connection', condition = '') {
        this.add_node(u);
        this.add_node(v);
        // We assume roads are bidirectional
        this.edges[u][v] = cost;
        this.edges[v][u] = cost;
        this.base_costs[`${u}|${v}`] = cost;
        this.base_costs[`${v}|${u}`] = cost;
        this.edge_details[`${u}|${v}`] = { type: road_type, cond: condition };
        this.edge_details[`${v}|${u}`] = { type: road_type, cond: condition };
    }

    update_edge_cost(u, v, new_cost) {
        if (u in this.edges && v in this.edges[u]) {
            this.edges[u][v] = new_cost;
            this.edges[v][u] = new_cost;
            return true;
        }
        return false;
    }

    get_neighbors(u) {
        return this.edges[u] || {};
    }
}

function load_graph_from_data(data) {
    const graph = new Graph();
    
    data.forEach(row => {
        let path_name = row['Path_Name'] ? row['Path_Name'].trim() : '';
        let source = '';
        let target = '';

        if (path_name.toLowerCase().includes(" to ")) {
            let idx = path_name.toLowerCase().indexOf(" to ");
            source = path_name.substring(0, idx).trim();
            target = path_name.substring(idx + 4).trim();
        } else {
            return;
        }

        let base_cost = parseFloat(row['Travel_Time_with_Slope_min']);

        let condition_str = row['Condition'] || '';
        let road_type_str = row['Road_Type'] || '';

        let conds = condition_str.split(',').map(c => c.trim()).filter(c => c);
        let types = road_type_str.split(',').map(t => t.trim()).filter(t => t);

        let cond_mults = conds.map(c => CONDITION_MULTIPLIERS[c] || 1.0);
        let type_mults = types.map(t => ROAD_TYPE_MULTIPLIERS[t] || 1.0);

        let cond_mult = cond_mults.length > 0 ? cond_mults.reduce((a, b) => a + b, 0) / cond_mults.length : 1.0;
        let type_mult = type_mults.length > 0 ? type_mults.reduce((a, b) => a + b, 0) / type_mults.length : 1.0;

        let cost = (base_cost * cond_mult * type_mult) + INTERSECTION_PENALTY_MIN;

        graph.add_edge(source, target, cost, road_type_str, condition_str);

        // Virtual zero-cost edges
        let source_base = source.replace(/[0-9]/g, '').trim();
        if (source_base !== source) {
            graph.add_edge(source_base, source, 0.0);
        }
        
        let target_base = target.replace(/[0-9]/g, '').trim();
        if (target_base !== target) {
            graph.add_edge(target_base, target, 0.0);
        }
    });

    return graph;
}
