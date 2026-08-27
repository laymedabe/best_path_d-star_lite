import heapq

class DStarLite:
    """
    A minimal implementation of D* Lite for finding the shortest path dynamically.
    D* Lite searches backwards from the Goal to the Start, which makes it extremely
    efficient at replanning when edge costs near the Start node change.
    """
    def __init__(self, graph, start, goal):
        self.graph = graph
        self.start = start
        self.goal = goal
        
        # Priority queue
        self.U = [] 
        self.km = 0
        
        # rhs (one step lookahead) and g (objective distance) values
        self.rhs = {}
        self.g = {}
        
        # Initialize all nodes to infinity
        for node in self.graph.edges:
            self.rhs[node] = float('inf')
            self.g[node] = float('inf')
            
        # The goal is our starting point for the backward search
        self.rhs[self.goal] = 0.0
        heapq.heappush(self.U, (self.calculate_key(self.goal), self.goal))
        
    def heuristic(self, a, b):
        # Without lat/lon coordinates to calculate a real distance heuristic, 
        # we return 0. This effectively makes it behave like dynamic Dijkstra's.
        return 0.0
        
    def calculate_key(self, s):
        k1 = min(self.g[s], self.rhs[s]) + self.heuristic(self.start, s) + self.km
        k2 = min(self.g[s], self.rhs[s])
        return (k1, k2)
        
    def update_vertex(self, u):
        if u != self.goal:
            # rhs[u] = min over all neighbors s' of (cost(u, s') + g(s'))
            min_val = float('inf')
            for neighbor, cost in self.graph.get_neighbors(u).items():
                val = cost + self.g[neighbor]
                if val < min_val:
                    min_val = val
            self.rhs[u] = min_val
            
        # Remove u from U if it's in there (this is inefficient for huge graphs, 
        # but perfectly fine for MST/Barangay scale graphs)
        self.U = [item for item in self.U if item[1] != u]
        heapq.heapify(self.U)
        
        # If the vertex is inconsistent, put it back on the queue
        if self.g[u] != self.rhs[u]:
            heapq.heappush(self.U, (self.calculate_key(u), u))
            
    def compute_shortest_path(self):
        while len(self.U) > 0:
            self.U.sort()
            u_key, u = self.U[0]
            
            # If the start node is consistent and has the lowest key, we are done
            if u_key >= self.calculate_key(self.start) and self.rhs[self.start] == self.g[self.start]:
                break
                
            heapq.heappop(self.U)
            
            k_old = u_key
            k_new = self.calculate_key(u)
            
            if k_old < k_new:
                heapq.heappush(self.U, (k_new, u))
            elif self.g[u] > self.rhs[u]:
                # Vertex is over-consistent (found a shorter path)
                self.g[u] = self.rhs[u]
                for neighbor in self.graph.get_neighbors(u):
                    self.update_vertex(neighbor)
            else:
                # Vertex is under-consistent (a path got longer)
                self.g[u] = float('inf')
                self.update_vertex(u)
                for neighbor in self.graph.get_neighbors(u):
                    self.update_vertex(neighbor)
                    
    def get_path(self):
        """Extracts the shortest path from start to goal based on the calculated g values."""
        if self.g[self.start] == float('inf'):
            return None # No path exists
            
        path = [self.start]
        current = self.start
        
        while current != self.goal:
            min_cost = float('inf')
            next_node = None
            
            for neighbor, cost in self.graph.get_neighbors(current).items():
                val = cost + self.g[neighbor]
                if val < min_cost:
                    min_cost = val
                    next_node = neighbor
                    
            if next_node is None:
                break
                
            path.append(next_node)
            current = next_node
            
        return path
        
    def dynamically_update_edge(self, u, v, new_cost):
        """
        The power of D* Lite: Call this when a road condition changes.
        It instantly updates the graph and recalculates the new best path.
        """
        self.graph.update_edge_cost(u, v, new_cost)
        
        self.update_vertex(u)
        self.update_vertex(v)
        
        self.compute_shortest_path()
