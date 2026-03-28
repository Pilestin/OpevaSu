// Map Layers
const cartoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© CartoDB, © OSM' });
const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' });
const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' });

// Initialize Map
const map = L.map('map', {
    layers: [cartoVoyager] // Default layer
}).setView([39.751, 30.481], 14);

const baseMaps = {
    "CartoDB Base": cartoVoyager,
    "OpenStreetMap": osmStandard,
    "Satellite/Esri": esriSat
};

// Add Layer Control
L.control.layers(baseMaps).addTo(map);

// Define Custom Colored Icons for Leaflet
const createColorIcon = (color) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const icons = {
    start: createColorIcon('green'),
    end: createColorIcon('red'),
    delivery: createColorIcon('blue')
};

// App State
let markers = [];
let routeLines = [];
let generatedRouteJSON = null;
let lastRouteData = null; 

// UI Elements
const clearBtn = document.getElementById('clearBtn');
const calcRouteBtn = document.getElementById('calcRouteBtn');
const exportBtn = document.getElementById('exportBtn');
const pointsList = document.getElementById('pointsList');
const pointCount = document.getElementById('pointCount');
const editModal = document.getElementById('editModal');

function generateObjectId() {
    return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function getPointType(idx, totalLength) {
    if (idx === 0) return 'Start (Depot)';
    if (idx === totalLength - 1 && totalLength > 1) return 'End (Depot)';
    return 'Delivery';
}

function updateMapMarkers() {
    markers.forEach((m, idx) => {
        const typeStr = getPointType(idx, markers.length);
        
        // Setup Icon color based on type
        if (typeStr.includes('Start')) {
            m.marker.setIcon(icons.start);
            m.marker.unbindTooltip(); // Clean any previous tooltip turning back from Delivery to End
        } else if (typeStr.includes('End')) {
            m.marker.setIcon(icons.end);
            m.marker.unbindTooltip();
        } else {
            m.marker.setIcon(icons.delivery);
            // Label for Delivery Points
            m.marker.bindTooltip(m.id, {
                permanent: true,
                direction: 'right',
                className: 'delivery-tooltip',
                offset: [10, -25]
            });
        }

        m.marker.setPopupContent(`<b>${typeStr}</b><br>ID: ${m.id}`);
    });
}

function createPointObject(lat, lng, idx, isStart) {
    // We add marker natively with blue fallback. It will be immediately themed by updateUI -> updateMapMarkers
    return {
        lat: lat,
        lng: lng,
        marker: L.marker([lat, lng]).addTo(map),
        id: isStart ? "cs5" : `del_${Date.now().toString().slice(-4)}`,
        // Delivery detail defaults
        product_id: "1",
        product_name: "A",
        ready_time: 0,
        due_date: 4332,
        service_time: 120,
        status: "Ordered",
        weight: 19,
        quantity: 1
    };
}

// Map Click to Add Points
map.on('click', function(e) {
    const isStart = markers.length === 0;
    const pt = createPointObject(e.latlng.lat, e.latlng.lng, markers.length, isStart);
    markers.push(pt);
    updateUI();
});

function updateUI() {
    updateMapMarkers(); // Triggers colors and tooltips correctly
    pointCount.textContent = `(${markers.length})`;
    pointsList.innerHTML = '';
    
    markers.forEach((m, idx) => {
        const li = document.createElement('li');
        const typeStr = getPointType(idx, markers.length);
        
        li.innerHTML = `
            <div><strong>${idx + 1}. ${typeStr}</strong> (ID: ${m.id})</div>
            <div><small>Lat: ${m.lat.toFixed(5)} | Lng: ${m.lng.toFixed(5)}</small></div>
            ${typeStr === 'Delivery' ? `<div><small>Product: ${m.product_name} | Qty: ${m.quantity} | Weight: ${m.weight}</small></div>` : ''}
            <div class="point-actions">
                <button class="btn-small btn-edit" onclick="openEdit(${idx})">Edit Details</button>
                <button class="btn-small btn-danger" onclick="deletePoint(${idx})">Delete</button>
            </div>
        `;
        pointsList.appendChild(li);
    });
    
    exportBtn.disabled = true;
    lastRouteData = null;
    routeLines.forEach(l => map.removeLayer(l));
    routeLines = [];
}

window.deletePoint = function(idx) {
    map.removeLayer(markers[idx].marker);
    markers.splice(idx, 1);
    updateUI();
};

// Modal Operations
window.openEdit = function(idx) {
    const pt = markers[idx];
    const typeStr = getPointType(idx, markers.length);
    const isDelivery = typeStr === 'Delivery';

    document.getElementById('editIndex').value = idx;
    document.getElementById('editId').value = pt.id;
    document.getElementById('pointTypeLabel').textContent = `Point Type: ${typeStr}`;
    
    const deliveryFields = document.getElementById('deliveryFields');
    if (isDelivery) {
        deliveryFields.style.display = 'block';
        document.getElementById('editProductId').value = pt.product_id;
        document.getElementById('editProductName').value = pt.product_name;
        document.getElementById('editReadyTime').value = pt.ready_time;
        document.getElementById('editDueDate').value = pt.due_date;
        document.getElementById('editServiceTime').value = pt.service_time;
        document.getElementById('editStatus').value = pt.status;
        document.getElementById('editWeight').value = pt.weight;
        document.getElementById('editQuantity').value = pt.quantity;
    } else {
        deliveryFields.style.display = 'none';
        if (pt.id.startsWith("del_")) {
            document.getElementById('editId').value = "cs5";
        }
    }
    
    editModal.style.display = 'flex';
};

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    editModal.style.display = 'none';
});

document.getElementById('saveEditBtn').addEventListener('click', () => {
    const idx = parseInt(document.getElementById('editIndex').value);
    const pt = markers[idx];
    const typeStr = getPointType(idx, markers.length);
    const isDelivery = typeStr === 'Delivery';
    
    pt.id = document.getElementById('editId').value || pt.id;
    
    if (isDelivery) {
        pt.product_id = document.getElementById('editProductId').value;
        pt.product_name = document.getElementById('editProductName').value;
        pt.ready_time = parseInt(document.getElementById('editReadyTime').value) || 0;
        pt.due_date = parseInt(document.getElementById('editDueDate').value) || 0;
        pt.service_time = parseInt(document.getElementById('editServiceTime').value) || 0;
        pt.status = document.getElementById('editStatus').value;
        pt.weight = parseFloat(document.getElementById('editWeight').value) || 0;
        pt.quantity = parseInt(document.getElementById('editQuantity').value) || 0;
    }
    
    editModal.style.display = 'none';
    updateUI(); // Updating UI will instantly refresh map ID labels and markers!
});

// Clear Map
clearBtn.addEventListener('click', () => {
    markers.forEach(m => map.removeLayer(m.marker));
    routeLines.forEach(l => map.removeLayer(l));
    markers = [];
    routeLines = [];
    generatedRouteJSON = null;
    lastRouteData = null;
    updateUI();
});

// Request routing
calcRouteBtn.addEventListener('click', async () => {
    if (markers.length < 2) {
        alert("Please add at least 2 points (Start and End) on the map.");
        return;
    }
    
    const coordsStr = markers.map(m => `${m.lng},${m.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=true&annotations=true`;

    calcRouteBtn.textContent = "Calculating...";
    calcRouteBtn.disabled = true;

    try {
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code !== 'Ok') {
            alert("Error fetching route from OSRM API.");
            return;
        }

        routeLines.forEach(l => map.removeLayer(l));
        routeLines = [];
        
        const route = data.routes[0];
        lastRouteData = route;

        const geojson = L.geoJSON(route.geometry, {
            style: { color: 'blue', weight: 4, opacity: 0.7 }
        }).addTo(map);
        routeLines.push(geojson);
        map.fitBounds(geojson.getBounds());

        exportBtn.disabled = false;
        alert("Route successfully calculated! Ready for JSON Export.");

    } catch (error) {
        console.error("Routing error:", error);
        alert("Failed to calculate route.");
    } finally {
        calcRouteBtn.textContent = "Calculate Route";
        calcRouteBtn.disabled = false;
    }
});

// Build JSON format matches payload exactly
exportBtn.addEventListener('click', () => {
    if (!lastRouteData) return;
    
    const legs = lastRouteData.legs;
    const routeName = document.getElementById('routeName').value || 'Generated_Route';
    
    const getLegWaypoints = (leg) => {
        if (!leg) return [];
        let coords = [];
        leg.steps.forEach(step => {
            step.geometry.coordinates.forEach(c => coords.push(c));
        });
        return coords.map(coord => ({
            location: { latitude: coord[1], longitude: coord[0] }
        }));
    };

    let deliveryPointsArr = [];
    
    for (let i = 1; i < markers.length - 1; i++) {
        let m = markers[i];
        deliveryPointsArr.push({
            id: m.id,
            location: { latitude: m.lat, longitude: m.lng },
            node_detail: {
                customer: {
                    requests: {
                        product_id: m.product_id,
                        product_name: m.product_name,
                        ready_time: m.ready_time,
                        due_date: m.due_date,
                        service_time: m.service_time,
                        status: m.status,
                        load_information: {
                            weight: m.weight,
                            quantity: m.quantity
                        }
                    }
                }
            },
            waypoints: getLegWaypoints(legs[i]),
            visited: false,
            visit_time: null
        });
    }

    const startM = markers[0];
    const endM = markers[markers.length - 1];

    generatedRouteJSON = {
        _id: {
            $oid: generateObjectId()
        },
        id: `ev_route_0_${Date.now()}`,
        delivery_points: deliveryPointsArr,
        end_point: {
            id: endM.id || "cs_end",
            location: { latitude: endM.lat, longitude: endM.lng },
            node_detail: { depot: "" },
            waypoints: markers.length > 1 ? getLegWaypoints(legs[legs.length - 1]) : [],
            visited: false,
            visit_time: null
        },
        name: routeName,
        source: "EV",
        start_point: {
            id: startM.id || "cs_start",
            location: { latitude: startM.lat, longitude: startM.lng },
            node_detail: { depot: "" },
            waypoints: markers.length > 1 ? getLegWaypoints(legs[0]) : [],
            visited: false,
            visit_time: null
        },
        timestamp: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generatedRouteJSON, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", routeName + ".json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});