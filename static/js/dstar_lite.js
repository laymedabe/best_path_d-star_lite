class PriorityQueue {
    constructor() {
        this.heap = [];
    }
    
    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i) { return 2 * i + 1; }
    _right(i) { return 2 * i + 2; }
    
    _compare(a, b) {
        if (a.key[0] < b.key[0]) return -1;
        if (a.key[0] > b.key[0]) return 1;
        if (a.key[1] < b.key[1]) return -1;
        if (a.key[1] > b.key[1]) return 1;
        return 0;
    }
    
    _swap(i, j) {
        const temp = this.heap[i];
        this.heap[i] = this.heap[j];
        this.heap[j] = temp;
    }
    
    push(key, node) {
        this.heap.push({ key, node });
        this._siftUp(this.heap.length - 1);
    }
    
    pop() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();
        
        const top = this.heap[0];
        this.heap[0] = this.heap.pop();
        this._siftDown(0);
        return top;
    }
    
    peek() {
        return this.heap.length > 0 ? this.heap[0] : null;
    }
    
    remove(node) {
        const idx = this.heap.findIndex(item => item.node === node);
        if (idx !== -1) {
            this.heap.splice(idx, 1);
            // Re-heapify simply by sorting (inefficient but perfectly fine for our scale)
            this.heap.sort(this._compare);
        }
    }
    
    _siftUp(i) {
        while (i > 0 && this._compare(this.heap[i], this.heap[this._parent(i)]) < 0) {
            this._swap(i, this._parent(i));
            i = this._parent(i);
        }
    }
    
    _siftDown(i) {
        let minIndex = i;
        const l = this._left(i);
        if (l < this.heap.length && this._compare(this.heap[l], this.heap[minIndex]) < 0) {
            minIndex = l;
        }
        const r = this._right(i);
        if (r < this.heap.length && this._compare(this.heap[r], this.heap[minIndex]) < 0) {
            minIndex = r;
        }
        if (i !== minIndex) {
            this._swap(i, minIndex);
            this._siftDown(minIndex);
        }
    }

    get length() {
        return this.heap.length;
    }
}

class DStarLite {
    constructor(graph, start, goal) {
        this.graph = graph;
        this.start = start;
        this.goal = goal;
        
        this.U = new PriorityQueue();
        this.km = 0;
        
        this.rhs = {};
        this.g = {};
        
        for (let node in this.graph.edges) {
            this.rhs[node] = Infinity;
            this.g[node] = Infinity;
        }
        
        this.rhs[this.goal] = 0.0;
        this.U.push(this.calculate_key(this.goal), this.goal);
    }
    
    heuristic(a, b) {
        return 0.0;
    }
    
    calculate_key(s) {
        let k1 = Math.min(this.g[s], this.rhs[s]) + this.heuristic(this.start, s) + this.km;
        let k2 = Math.min(this.g[s], this.rhs[s]);
        return [k1, k2];
    }
    
    update_vertex(u) {
        if (u !== this.goal) {
            let min_val = Infinity;
            const neighbors = this.graph.get_neighbors(u);
            for (let neighbor in neighbors) {
                let cost = neighbors[neighbor];
                let val = cost + this.g[neighbor];
                if (val < min_val) {
                    min_val = val;
                }
            }
            this.rhs[u] = min_val;
        }
        
        this.U.remove(u);
        
        if (this.g[u] !== this.rhs[u]) {
            this.U.push(this.calculate_key(u), u);
        }
    }
    
    compute_shortest_path() {
        while (this.U.length > 0) {
            let top = this.U.peek();
            let u_key = top.key;
            let u = top.node;
            
            let start_key = this.calculate_key(this.start);
            
            // if (u_key >= start_key)
            if (this.U._compare({key: u_key}, {key: start_key}) >= 0 && this.rhs[this.start] === this.g[this.start]) {
                break;
            }
            
            this.U.pop();
            
            let k_old = u_key;
            let k_new = this.calculate_key(u);
            
            if (this.U._compare({key: k_old}, {key: k_new}) < 0) {
                this.U.push(k_new, u);
            } else if (this.g[u] > this.rhs[u]) {
                this.g[u] = this.rhs[u];
                const neighbors = this.graph.get_neighbors(u);
                for (let neighbor in neighbors) {
                    this.update_vertex(neighbor);
                }
            } else {
                this.g[u] = Infinity;
                this.update_vertex(u);
                const neighbors = this.graph.get_neighbors(u);
                for (let neighbor in neighbors) {
                    this.update_vertex(neighbor);
                }
            }
        }
    }
    
    get_path() {
        if (this.g[this.start] === Infinity) {
            return null;
        }
        
        let path = [this.start];
        let current = this.start;
        
        while (current !== this.goal) {
            let min_cost = Infinity;
            let next_node = null;
            
            const neighbors = this.graph.get_neighbors(current);
            for (let neighbor in neighbors) {
                let cost = neighbors[neighbor];
                let neighbor_cost = cost + this.g[neighbor];
                
                // Prioritize natural roads over V- connections in case of a tie
                if (Math.abs(neighbor_cost - min_cost) < 1e-6) {
                    if (next_node && next_node.startsWith('V-') && !neighbor.startsWith('V-')) {
                        next_node = neighbor;
                    }
                } else if (neighbor_cost < min_cost) {
                    min_cost = neighbor_cost;
                    next_node = neighbor;
                }
            }
            
            if (!next_node) {
                return null;
            }
            
            path.push(next_node);
            current = next_node;
        }
        return path;
    }
}
