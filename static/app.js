let map;
let allFeatures = [];
let routeLayer = null;

// Initialize Map
function initMap() {
    map = L.map('map').setView([10.825, 122.354], 12);

    // Load OFFLINE tiles from our local server
    L.tileLayer('/tiles/{z}/{x}/{y}.png', {
        minZoom: 11,
        maxZoom: 16,
        attribution: 'Offline Map Data © OpenStreetMap'
    }).addTo(map);

    loadGeoJSON();
    loadHistory();
}

function loadGeoJSON() {
    fetch('/api/geojson')
        .then(r => r.json())
        .then(data => {
            allFeatures = data.features;
            
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
            const reportSelect = document.getElementById('report-barangay');
            
            Array.from(bgySet).sort().forEach(bgy => {
                bgySelect.innerHTML += `<option value="${bgy}">${bgy}</option>`;
                reportSelect.innerHTML += `<option value="${bgy}">${bgy}</option>`;
            });

            // Draw default network faded
            L.geoJSON(data, {
                style: { color: '#64748b', weight: 2, opacity: 0.4 }
            }).addTo(map);
        });
}

document.getElementById('route-btn').addEventListener('click', () => {
    const start = document.getElementById('barangay-select').value;
    if(!start) return alert("Select a barangay!");

    fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: start })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) return alert(data.error);
        
        // Find geojson features that connect these nodes to get actual path names
        const activeFeatures = [];
        for(let i=0; i<data.path.length - 1; i++) {
            const u = data.path[i];
            const v = data.path[i+1];
            
            const feature = allFeatures.find(f => {
                const pname = f.properties.Path_Name;
                return (pname.startsWith(u + ' to ') && pname.endsWith(v)) || 
                       (pname.startsWith(v + ' to ') && pname.endsWith(u)) ||
                       pname === `${u} to ${v}` || 
                       pname === `${v} to ${u}`;
            });
            if(feature) activeFeatures.push(feature);
        }
        
        let displayRoute = data.path.join(' &rarr; ');
        if (activeFeatures.length > 0) {
            const uniqueNames = [...new Set(activeFeatures.map(f => f.properties.Path_Name))];
            displayRoute = uniqueNames.join(', ');
        }

        document.getElementById('route-result').innerHTML = `
            <strong>Time:</strong> ${data.cost.toFixed(2)} mins<br>
            <strong>Route:</strong> ${displayRoute}
        `;

        drawRoute(data.path);
        loadHistory();
    });
});

document.getElementById('report-btn').addEventListener('click', () => {
    const data = {
        barangay: document.getElementById('report-barangay').value,
        condition_type: document.getElementById('report-type').value,
        details: document.getElementById('report-details').value,
        severity: document.getElementById('report-severity').value
    };

    if(!data.barangay) return alert("Select affected barangay!");

    fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(() => {
        alert("Report submitted! The graph has been instantly updated.");
        // If a route is active, we could auto-recalculate here.
    });
});

function drawRoute(pathNodes) {
    if (routeLayer) map.removeLayer(routeLayer);
    
    const activeFeatures = [];
    for(let i=0; i<pathNodes.length - 1; i++) {
        const u = pathNodes[i];
        const v = pathNodes[i+1];
        
        const feature = allFeatures.find(f => {
            const pname = f.properties.Path_Name;
            return (pname.startsWith(u + ' to ') && pname.endsWith(v)) || 
                   (pname.startsWith(v + ' to ') && pname.endsWith(u)) ||
                   pname === `${u} to ${v}` || 
                   pname === `${v} to ${u}`;
        });
        if(feature) activeFeatures.push(feature);
    }

    routeLayer = L.geoJSON(activeFeatures, {
        style: { color: '#38bdf8', weight: 5, opacity: 1.0 }
    }).addTo(map);
}

function loadHistory() {
    fetch('/api/history')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('history-list');
            list.innerHTML = '';
            data.forEach(h => {
                list.innerHTML += `
                    <li>
                        <strong>${h.start} to ${h.goal}</strong><br>
                        <span style="color:#94a3b8">${h.cost.toFixed(2)} mins - ${new Date(h.timestamp).toLocaleString()}</span>
                    </li>
                `;
            });
        });
}

window.onload = initMap;
