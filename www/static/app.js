let map;
let allFeatures = [];
let routeLayer = null;

let globalGraph = load_graph_from_data(ROAD_DATA);
const GOAL_NODE = 'Poblacion';

// Blocked edges stored locally
let blockedEdges = new Set();
// History stored in localStorage
let routingHistory = JSON.parse(localStorage.getItem('routingHistory')) || [];

function saveHistory() {
    localStorage.setItem('routingHistory', JSON.stringify(routingHistory));
}

// Initialize Map
function initMap() {
    map = L.map('map', {
        renderer: L.canvas({ padding: 0.5 }), // Fixes path detaching/lag on zoom
        rotate: true,
        touchRotate: true,
        rotateControl: {
            closeOnZeroBearing: false,
            position: 'bottomleft'
        }
    }).setView([10.825, 122.354], 12);

    // Load OFFLINE tiles from our local server
    L.tileLayer('static/tiles/{z}/{x}/{y}.png', {
        minZoom: 11,
        maxZoom: 16,
        attribution: 'Offline Map Data © OpenStreetMap'
    }).addTo(map);

    loadGeoJSON();
    loadHistory();
}

function loadGeoJSON() {
    allFeatures = GEOJSON_DATA.features;
    
    // Populate Dropdowns
    const bgySet = new Set();
    allFeatures.forEach(f => {
        if (f.properties.Path_Name) {
            let parts = f.properties.Path_Name.split(' to ');
            if (parts.length === 2) {
                let b1 = parts[0].replace(/[0-9]/g, '').trim();
                let b2 = parts[1].replace(/[0-9]/g, '').trim();
                b1 = b1.charAt(0).toUpperCase() + b1.slice(1);
                b2 = b2.charAt(0).toUpperCase() + b2.slice(1);
                if (b1.toLowerCase() !== 'poblacion') bgySet.add(b1);
                if (b2.toLowerCase() !== 'poblacion') bgySet.add(b2);
            }
        }
    });
    
    const bgySelect = document.getElementById('barangay-select');
    
    Array.from(bgySet).sort().forEach(bgy => {
        bgySelect.innerHTML += `<option value="${bgy}">${bgy}</option>`;
    });
}

function extractNodes(pathName) {
    if (pathName.includes(' to ')) {
        const parts = pathName.split(' to ');
        return [parts[0].trim(), parts[1].trim()];
    }
    return null;
}

window.blockRoad = function(pathName) {
    if(!confirm(`Are you sure you want to block ${pathName}?`)) return;
    
    const nodes = extractNodes(pathName);
    if (!nodes) return;
    const u = nodes[0];
    const v = nodes[1];

    if (globalGraph.update_edge_cost(u, v, Infinity)) {
        blockedEdges.add(`${u}|${v}`);
        blockedEdges.add(`${v}|${u}`);
        alert(`Successfully blocked: ${pathName}`);
        
        const select = document.getElementById('barangay-select');
        if (select && select.value) {
            select.dispatchEvent(new Event('change'));
        }
        updateBlockedList();
    } else {
        alert("Path not found in graph.");
    }
};

window.unblockRoad = function(pathName) {
    if(!confirm(`Are you sure you want to unblock ${pathName}?`)) return;
    
    const nodes = extractNodes(pathName);
    if (!nodes) return;
    const u = nodes[0];
    const v = nodes[1];

    const originalCost = globalGraph.base_costs[`${u}|${v}`];
    
    if (originalCost !== undefined && globalGraph.update_edge_cost(u, v, originalCost)) {
        blockedEdges.delete(`${u}|${v}`);
        blockedEdges.delete(`${v}|${u}`);
        alert(`Successfully unblocked: ${pathName}`);
        
        const select = document.getElementById('barangay-select');
        if (select && select.value) {
            select.dispatchEvent(new Event('change'));
        }
        updateBlockedList();
    } else {
        alert("Path not found in graph.");
    }
};

function updateBlockedList() {
    const list = document.getElementById('blocked-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (blockedEdges.size === 0) {
        list.innerHTML = '<li style="color:#94a3b8; font-style:italic;">No roads are currently blocked.</li>';
        return;
    }
    
    const uniquePaths = new Set();
    blockedEdges.forEach(edge => {
        const parts = edge.split('|');
        if (parts.length === 2) {
            // Standardize order to avoid duplicates
            const u = parts[0];
            const v = parts[1];
            const pathName = u < v ? `${u} to ${v}` : `${v} to ${u}`;
            uniquePaths.add(pathName);
        }
    });
    
    uniquePaths.forEach(pathName => {
        list.innerHTML += `
            <li style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #334155; padding: 5px 0;">
                <span style="color:#ef4444; font-weight:bold; font-size:13px;">${pathName}</span>
                <button onclick="unblockRoad('${pathName}')" style="background-color: #10b981; color: white; padding: 2px 5px; font-size: 11px; border: none; border-radius: 3px; cursor: pointer;">Unblock</button>
            </li>
        `;
    });
}

function cloneGraph(graph) {
    const newGraph = new Graph();
    // Deep copy edges
    for (let u in graph.edges) {
        newGraph.add_node(u);
        for (let v in graph.edges[u]) {
            newGraph.edges[u][v] = graph.edges[u][v];
        }
    }
    newGraph.base_costs = JSON.parse(JSON.stringify(graph.base_costs));
    newGraph.edge_details = JSON.parse(JSON.stringify(graph.edge_details));
    return newGraph;
}

function blockEdgeInGraph(graph, path) {
    for (let i = 0; i < path.length - 1; i++) {
        let u = path[i];
        let v = path[i+1];
        if (!u.startsWith('V-') && !v.startsWith('V-')) {
            graph.update_edge_cost(u, v, Infinity);
            return { u, v };
        }
    }
    return null;
}

function calculatePathCost(graph, path) {
    let cost = 0;
    for (let i = 0; i < path.length - 1; i++) {
        cost += graph.edges[path[i]][path[i+1]];
    }
    const mode = document.querySelector('input[name="travel-mode"]:checked');
    if (mode && mode.value === 'walk') {
        cost = cost * 6; // Walking is slower
    }
    return cost;
}

// Re-run routing when travel mode changes
document.querySelectorAll('input[name="travel-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (document.getElementById('barangay-select').value) {
            document.getElementById('barangay-select').dispatchEvent(new Event('change'));
        }
    });
});

document.getElementById('barangay-select').addEventListener('change', () => {
    const start = document.getElementById('barangay-select').value;
    if (!start) {
        document.getElementById('path-details-list').innerHTML = '';
        document.getElementById('route-result').innerHTML = '';
        if (routeLayer) map.removeLayer(routeLayer);
        return;
    }

    const startNode = Object.keys(globalGraph.edges).find(k => k.toLowerCase() === start.toLowerCase());
    
    if (!startNode || !(startNode in globalGraph.edges)) {
        alert("Start node not found in graph.");
        return;
    }

    let paths = [];
    let tempGraph = cloneGraph(globalGraph);
    let attempts = 0;
    const maxPaths = 5;

    while (paths.length < maxPaths && attempts < 10) {
        attempts++;
        
        let dstar = new DStarLite(tempGraph, startNode, GOAL_NODE);
        dstar.compute_shortest_path();
        let path = dstar.get_path();
        
        if (!path) break;

        let cost = calculatePathCost(tempGraph, path);
        if (cost === Infinity) break;

        let details = [];
        for (let i = 0; i < path.length - 1; i++) {
            let u = path[i];
            let v = path[i+1];
            let det = tempGraph.edge_details[`${u}|${v}`] || {};
            let is_edge_blocked = blockedEdges.has(`${u}|${v}`);
            details.push({
                type: det.type,
                cond: det.cond,
                is_edge_blocked: is_edge_blocked
            });
        }

        paths.push({
            path: path,
            cost: cost,
            details: details,
            is_blocked: false
        });

        blockEdgeInGraph(tempGraph, path);
    }

    // Add blocked path checking if needed (omitted here for simplicity, but can be added back if desired)

    if (paths.length === 0) {
        if (routeLayer) map.removeLayer(routeLayer);
        document.getElementById('route-result').innerHTML = `
            <strong style="color:#ef4444;">No Path Available</strong><br>
            This location is currently cut off due to road blockages.
        `;
        document.getElementById('path-details-list').innerHTML = '';
        return alert("No alternative paths exist! This location is completely cut off.");
    }
    
    drawRoute(paths);
    displayPathDetails(paths);
    
    const bestPath = paths[0];
    
    document.getElementById('route-result').innerHTML = `
        <strong>Best Time:</strong> ${bestPath.cost.toFixed(2)} mins<br>
        <strong>Paths Found:</strong> ${paths.length}
    `;

    routingHistory.unshift({
        start: startNode,
        goal: GOAL_NODE,
        cost: bestPath.cost,
        timestamp: new Date().toISOString()
    });
    
    // keep only last 50
    if (routingHistory.length > 50) routingHistory.pop();
    
    saveHistory();
    loadHistory();
});

function displayPathDetails(paths) {
    const detailsContainer = document.getElementById('path-details-list');
    detailsContainer.innerHTML = '';
    
    paths.forEach((pathObj, index) => {
        const isBlocked = pathObj.is_blocked;
        const color = isBlocked ? '#64748b' : (index === 0 ? '#38bdf8' : '#ef4444');
        const costStr = isBlocked ? "BLOCKED" : `${pathObj.cost.toFixed(2)} mins`;
        const titleStr = isBlocked ? 'Blocked Route' : (index === 0 ? 'Primary Route' : 'Alternative Route #' + index);
        
        let routeHtml = `<h4 style="margin-bottom: 5px; color: ${color};">${titleStr} (${costStr})</h4><ul style="margin-top: 0; padding-left: 20px; font-size: 13px; color: #cbd5e1;">`;
        
        const pathNodes = pathObj.path;
        for(let j=0; j<pathNodes.length - 1; j++) {
            const u = pathNodes[j];
            const v = pathNodes[j+1];
            
            if (pathObj.details && pathObj.details[j]) {
                const det = pathObj.details[j];
                const rtype = det.type || 'Unknown';
                
                if (rtype !== 'Zero-Cost Connection') {
                    const cond = det.cond || 'Unknown';
                    const condStr = cond ? ` - ${cond}` : '';
                    
                    const isEdgeBlocked = det.is_edge_blocked;
                    
                    const btnStyle = "padding: 3px 8px; font-size: 11px; border-radius: 4px; cursor: pointer; border: none; font-weight: bold; white-space: nowrap; margin-left: 10px;";
                    const btnHtml = isEdgeBlocked 
                        ? `<button onclick="unblockRoad('${u} to ${v}')" style="${btnStyle} background-color: #10b981; color: white;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Unblock</button>`
                        : `<button onclick="blockRoad('${u} to ${v}')" style="${btnStyle} background-color: #ef4444; color: white;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Block</button>`;
                        
                    routeHtml += `<li style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                        <span><strong>${u} &rarr; ${v}</strong><br><span style="font-size: 11px; color: #94a3b8;">${rtype}${condStr}</span></span>
                        ${btnHtml}
                    </li>`;
                }
            } else {
                routeHtml += `<li style="margin-bottom: 3px;"><strong>${u} &rarr; ${v}</strong>: Unknown</li>`;
            }
        }
        routeHtml += '</ul>';
        detailsContainer.innerHTML += routeHtml;
    });
}

function drawRoute(paths) {
    if (routeLayer) map.removeLayer(routeLayer);
    
    routeLayer = L.featureGroup().addTo(map);

    // Draw in reverse order so the best path (index 0) is drawn last and on top
    for (let i = paths.length - 1; i >= 0; i--) {
        const pathNodes = paths[i].path;
        
        const activeFeatures = [];
        for(let j=0; j<pathNodes.length - 1; j++) {
            const u = pathNodes[j];
            const v = pathNodes[j+1];
            
            const feature = allFeatures.find(f => {
                const pname = f.properties.Path_Name;
                if(!pname) return false;
                return (pname.startsWith(u + ' to ') && pname.endsWith(v)) || 
                       (pname.startsWith(v + ' to ') && pname.endsWith(u)) ||
                       pname === `${u} to ${v}` || 
                       pname === `${v} to ${u}`;
            });
            if(feature) activeFeatures.push(feature);
        }

        const isBlocked = paths[i].is_blocked;
        const isBestPath = (i === 0 && !isBlocked);
        const style = isBlocked
            ? { color: '#000000', weight: 4, opacity: 0.8, dashArray: '10, 10' }
            : (isBestPath 
                ? { color: '#38bdf8', weight: 5, opacity: 1.0 }
                : { color: '#ef4444', weight: 3, opacity: 0.7, dashArray: '5, 5' });

        L.geoJSON(activeFeatures, {
            style: style,
            onEachFeature: function (feature, layer) {
                if (feature.properties) {
                    const pname = feature.properties.Path_Name || 'Unknown';
                    const rtype = feature.properties.Road_Type || 'Unknown';
                    const cond = feature.properties.Condition || 'Unknown';
                    const routeRank = isBlocked ? "BLOCKED ROUTE" : (isBestPath ? "Primary Route" : `Alternative Route #${i + 1}`);
                    const actionBtn = isBlocked 
                        ? `<button onclick="unblockRoad('${pname}')" class="safe-btn" style="margin-top:5px; padding:2px 5px; font-size:12px; background-color:#10b981; color:white; border:none; border-radius:3px; cursor:pointer;">Unblock This Road</button>`
                        : `<button onclick="blockRoad('${pname}')" class="danger-btn" style="margin-top:5px; padding:2px 5px; font-size:12px; background-color:#ef4444; color:white; border:none; border-radius:3px; cursor:pointer;">Block This Road</button>`;
                    layer.bindPopup(`<b>${routeRank}</b><br><b>${pname}</b><br>Type: ${rtype}<br>Condition: ${cond}<br>${actionBtn}`);
                }
            }
        }).addTo(routeLayer);
    }
}

function loadHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    routingHistory.forEach(h => {
        list.innerHTML += `
            <li>
                <strong>${h.start} to ${h.goal}</strong><br>
                <span style="color:#94a3b8">${h.cost.toFixed(2)} mins - ${new Date(h.timestamp).toLocaleString()}</span>
            </li>
        `;
    });
}

window.onload = initMap;

// Database Management (History & Blocked Roads)
document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm("Are you sure you want to completely clear the local database (History and Blocked Roads)?")) {
        routingHistory = [];
        blockedEdges.clear();
        localStorage.removeItem('routingHistory');
        localStorage.removeItem('blockedEdges');
        loadHistory();
        renderBlockedList();
        if (routeLayer) map.removeLayer(routeLayer);
        document.getElementById('path-details-list').innerHTML = '';
        document.getElementById('route-result').innerHTML = '';
        document.getElementById('barangay-select').value = '';
        alert("Database cleared successfully.");
    }
});

// GPS Location Feature
let gpsMarker = null;
let gpsRing = null;

document.getElementById('btn-gps').addEventListener('click', () => {
    if (!navigator.geolocation) {
        return alert("Geolocation is not supported by your device.");
    }
    
    const btn = document.getElementById('btn-gps');
    btn.style.opacity = '0.5';
    
    navigator.geolocation.getCurrentPosition((position) => {
        btn.style.opacity = '1';
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        if (gpsMarker) map.removeLayer(gpsMarker);
        if (gpsRing) map.removeLayer(gpsRing);
        
        gpsMarker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: "#3b82f6",
            color: "#ffffff",
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);
        
        gpsRing = L.circleMarker([lat, lng], {
            radius: 20,
            color: "#3b82f6",
            weight: 2,
            opacity: 0.5,
            fill: false
        }).addTo(map);
        
        map.setView([lat, lng], 15);
    }, (error) => {
        btn.style.opacity = '1';
        alert("Unable to retrieve your location. Please ensure Location services are turned on.");
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
});

// First Aid Modal
document.getElementById('btn-first-aid').addEventListener('click', () => {
    document.getElementById('first-aid-modal').style.display = 'block';
});

document.getElementById('close-first-aid').addEventListener('click', () => {
    document.getElementById('first-aid-modal').style.display = 'none';
});
