const fs = require('fs');
const https = require('https');
const path = require('path');

const z = 17;
const minLat = 10.75120889863211;
const maxLat = 10.89935869248547;
const minLng = 122.2903781825292;
const maxLng = 122.4190035142424;

function lon2tile(lon, zoom) {
    return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
    return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

const xMin = lon2tile(minLng, z);
const xMax = lon2tile(maxLng, z);
const yMin = lat2tile(maxLat, z); // maxLat has smaller y
const yMax = lat2tile(minLat, z);

let tilesToDownload = [];
for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
        tilesToDownload.push({ z, x, y });
    }
}

console.log(`Total tiles to download for zoom 17: ${tilesToDownload.length}`);

const baseDir = path.join(__dirname, 'static', 'tiles', z.toString());
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
}

let activeDownloads = 0;
const MAX_CONCURRENT = 10;
let index = 0;

function downloadNext() {
    if (index >= tilesToDownload.length) {
        if (activeDownloads === 0) {
            console.log('All downloads finished.');
        }
        return;
    }

    const tile = tilesToDownload[index++];
    activeDownloads++;

    const xDir = path.join(baseDir, tile.x.toString());
    if (!fs.existsSync(xDir)) {
        fs.mkdirSync(xDir, { recursive: true });
    }

    const tilePath = path.join(xDir, `${tile.y}.png`);
    if (fs.existsSync(tilePath)) {
        activeDownloads--;
        downloadNext();
        return;
    }

    const url = `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
    const options = {
        headers: { 'User-Agent': 'OfflineEvacuationApp/1.0' }
    };

    https.get(url, options, (res) => {
        if (res.statusCode === 200) {
            const fileStream = fs.createWriteStream(tilePath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                activeDownloads--;
                if (index % 100 === 0) console.log(`Downloaded ${index}/${tilesToDownload.length}`);
                downloadNext();
            });
        } else {
            console.error(`Failed to download ${url}: ${res.statusCode}`);
            activeDownloads--;
            downloadNext();
        }
    }).on('error', (err) => {
        console.error(`Error downloading ${url}: ${err.message}`);
        activeDownloads--;
        downloadNext();
    });
}

for (let i = 0; i < MAX_CONCURRENT; i++) {
    downloadNext();
}
