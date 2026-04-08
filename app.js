import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAlO_s9S98snIJJcEcgy3_N_5AOUR-sOMI",
  authDomain: "coffee-spark-ai-barista-1533b.firebaseapp.com",
  projectId: "coffee-spark-ai-barista-1533b",
  storageBucket: "coffee-spark-ai-barista-1533b.firebasestorage.app",
  messagingSenderId: "889650442187",
  appId: "1:889650442187:web:24048033267d744594904e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Global state
let specsData = [];
let currentFilteredSpecs = [];
let currentBanners = [];
let currentScreenshots = [];
let filters = {
    platforms: new Set(),
    types: new Set(),
    search: ""
};

// Initialize
async function init() {
    if (localStorage.getItem('adminMode') === 'true') {
        document.body.classList.remove('readonly-mode');
    }

    try {
        const querySnapshot = await getDocs(collection(db, "specs"));
        specsData = [];
        querySnapshot.forEach((docSnap) => {
            specsData.push(docSnap.data());
        });

        if (specsData.length === 0 && window.adSpecsData) {
            specsData = window.adSpecsData;
            for (const spec of specsData) {
                await setDoc(doc(db, "specs", spec.id), spec);
            }
        }
    } catch (e) {
        console.error("Error fetching documents: ", e);
        if (window.adSpecsData) specsData = window.adSpecsData;
    }

    renderFilters();
    setupEventListeners();
    updateDashboard();
}

function getUniqueValues(key) {
    const vals = specsData.map(s => s[key]).filter(x => x);
    return [...new Set(vals)].sort();
}

function renderFilters() {
    const platforms = ["Desktop", "Mobile site", "Apps", "Video/Other"];
    const allTypesRaw = getUniqueValues('type');
    
    const typeFiltersBox = document.getElementById('typeFilters');
    const platFiltersBox = document.getElementById('platformFilters');

    platFiltersBox.innerHTML = '';
    platforms.forEach(plat => {
        platFiltersBox.innerHTML += `
            <label class="checkbox-label">
                <input type="checkbox" value="${plat}" class="filter-plat">
                ${plat}
            </label>
        `;
    });

    typeFiltersBox.innerHTML = '';
    allTypesRaw.forEach(type => {
        typeFiltersBox.innerHTML += `
            <label class="checkbox-label">
                <input type="checkbox" value="${type}" class="filter-type">
                ${type}
            </label>
        `;
    });
}

function setupEventListeners() {
    let logoClickCount = 0;
    let logoClickTimer;

    document.getElementById('logoBtn').addEventListener('click', () => {
        logoClickCount++;
        clearTimeout(logoClickTimer);
        
        if (logoClickCount >= 10) {
            logoClickCount = 0;
            const isReadonly = document.body.classList.contains('readonly-mode');
            if (isReadonly) {
                document.body.classList.remove('readonly-mode');
                localStorage.setItem('adminMode', 'true');
                console.log('Admin mode enabled');
            } else {
                document.body.classList.add('readonly-mode');
                localStorage.setItem('adminMode', 'false');
                console.log('Admin mode disabled');
            }
        }
        
        logoClickTimer = setTimeout(() => {
            logoClickCount = 0;
        }, 2000); // 2 second reset window
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
        exportToXLS(currentFilteredSpecs);
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.classList.contains('filter-plat')) {
            if (e.target.checked) filters.platforms.add(e.target.value);
            else filters.platforms.delete(e.target.value);
            updateDashboard();
        }
        if (e.target.classList.contains('filter-type')) {
            if (e.target.checked) filters.types.add(e.target.value);
            else filters.types.delete(e.target.value);
            updateDashboard();
        }
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        filters.search = e.target.value.toLowerCase();
        updateDashboard();
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        filters.platforms.clear();
        filters.types.clear();
        filters.search = "";
        document.getElementById('searchInput').value = "";
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        updateDashboard();
    });

    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('saveSpecBtn').addEventListener('click', handleEditSubmit);
    document.getElementById('newSpecBtn').addEventListener('click', openNewModal);

    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeModal();
    });

    document.getElementById('bannerUpload').addEventListener('change', async (e) => {
        await handleFileUpload(e.target.files, 'banners', currentBanners, 'bannerList');
        e.target.value = '';
    });
    
    document.getElementById('screenshotUpload').addEventListener('change', async (e) => {
        await handleFileUpload(e.target.files, 'screenshots', currentScreenshots, 'screenshotList');
        e.target.value = '';
    });
}

async function handleFileUpload(files, folder, targetArray, listId) {
    // Show a temporary loading indicator
    document.getElementById(listId).innerHTML += '<div class="file-item">Uploading...</div>';
    
    for (const file of files) {
        const uniqueName = Date.now() + "_" + file.name;
        const storageRef = ref(storage, `${folder}/${uniqueName}`);
        try {
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            targetArray.push({ name: file.name, url: url });
        } catch (e) {
            console.error("Upload failed", e);
        }
    }
    renderFileList(targetArray, listId, folder);
}

function renderFileList(arr, listId, type) {
    const listEl = document.getElementById(listId);
    listEl.innerHTML = '';
    arr.forEach((item, index) => {
        listEl.innerHTML += `
            <div class="file-item">
                <a href="${item.url}" target="_blank" title="${item.name}">${item.name}</a>
                <button type="button" onclick="removeAttachment(${index}, '${type}')">×</button>
            </div>
        `;
    });
    window.removeAttachment = removeAttachment;
}

function removeAttachment(index, type) {
    if (type === 'banners') {
        currentBanners.splice(index, 1);
        renderFileList(currentBanners, 'bannerList', 'banners');
    } else {
        currentScreenshots.splice(index, 1);
        renderFileList(currentScreenshots, 'screenshotList', 'screenshots');
    }
}

function updateDashboard() {
    const filtered = specsData.filter(spec => {
        if (filters.platforms.size > 0 && !spec.platforms.some(p => filters.platforms.has(p))) return false;
        if (filters.types.size > 0 && !filters.types.has(spec.type)) return false;
        if (filters.search) {
            const matchesType = spec.type.toLowerCase().includes(filters.search);
            const matchesComments = spec.comments && spec.comments.toLowerCase().includes(filters.search);
            if (!matchesType && !matchesComments) return false;
        }
        return true;
    });

    currentFilteredSpecs = filtered;

    renderCards(filtered);
    updateMetrics(filtered);
}

function updateMetrics(data) {
    document.getElementById('totalSpecsCount').innerText = data.length;
    document.getElementById('deskCount').innerText = data.filter(d => d.platforms.includes('Desktop')).length;
    document.getElementById('mobCount').innerText = data.filter(d => d.platforms.includes('Mobile site')).length;
}

function renderCards(data) {
    const grid = document.getElementById('specsGrid');
    grid.innerHTML = '';

    if (data.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No specifications match the selected filters.</div>`;
        return;
    }

    data.forEach(spec => {
        const div = document.createElement('div');
        div.className = 'spec-card glass-panel';
        
        const isCreatingHighlight = filters.platforms.size > 0;

        div.innerHTML = `
            <div class="spec-card-header">
                <div class="spec-type">${spec.type}</div>
                <div class="platforms-container">
                    ${spec.platforms.map(p => {
                        const doHighlight = filters.platforms.has(p);
                        return `<span class="spec-platform ${doHighlight ? 'highlight' : ''}">${p}</span>`;
                    }).join('')}
                </div>
            </div>
            <div class="spec-details">
                <div class="spec-row">
                    <span class="spec-label">Dimension</span>
                    <span class="spec-val">${spec.dimension || '-'}</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Format</span>
                    <span class="spec-val">${spec.format || '-'}</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Size Max</span>
                    <span class="spec-val">${spec.size || '-'}</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Duration</span>
                    <span class="spec-val">${spec.duration || '-'}</span>
                </div>
                ${spec.comments ? `<div class="spec-row" style="flex-direction:column; gap:6px;">
                    <span class="spec-label">Comments</span>
                    <span class="spec-val" style="text-align:left; max-width:100%;">${spec.comments}</span>
                </div>` : ''}
            </div>
            <div class="attachments-display">
                ${(spec.banners || []).map(b => `<a href="${b.url}" target="_blank" class="attachment-pill">🖼️ ${b.name}</a>`).join('')}
                ${(spec.screenshots || []).map(s => `<a href="${s.url}" target="_blank" class="attachment-pill">📸 ${s.name}</a>`).join('')}
            </div>
            <div class="card-actions">
                <button class="btn btn-sm admin-only" onclick="openEditModal('${spec.id}')">Edit Spec</button>
            </div>
        `;
        window.openEditModal = openEditModal; 
        grid.appendChild(div);
    });
}
function closeModal() {
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.remove('active');
}

function openEditModal(id) {
    const spec = specsData.find(s => s.id === id);
    if (!spec) return;
    
    document.querySelector('#editModal h2').innerText = "Edit Spec";
    document.getElementById('editId').value = spec.id;
    document.getElementById('editType').value = spec.type;
    
    const checkboxes = document.querySelectorAll('#editPlatformBoxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = spec.platforms.includes(cb.value));

    document.getElementById('editDimension').value = spec.dimension || "";
    document.getElementById('editFormat').value = spec.format || "";
    document.getElementById('editSize').value = spec.size || "";
    document.getElementById('editDuration').value = spec.duration || "";
    document.getElementById('editComments').value = spec.comments || "";

    currentBanners = [...(spec.banners || [])];
    currentScreenshots = [...(spec.screenshots || [])];
    renderFileList(currentBanners, 'bannerList', 'banners');
    renderFileList(currentScreenshots, 'screenshotList', 'screenshots');

    document.getElementById('editModal').classList.add('active');
}

function openNewModal() {
    document.querySelector('#editModal h2').innerText = "Add New Spec";
    document.getElementById('editId').value = "";
    document.getElementById('editType').value = "";
    
    const checkboxes = document.querySelectorAll('#editPlatformBoxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    document.getElementById('editDimension').value = "";
    document.getElementById('editFormat').value = "";
    document.getElementById('editSize').value = "";
    document.getElementById('editDuration').value = "";
    document.getElementById('editComments').value = "";

    currentBanners = [];
    currentScreenshots = [];
    renderFileList(currentBanners, 'bannerList', 'banners');
    renderFileList(currentScreenshots, 'screenshotList', 'screenshots');

    document.getElementById('editModal').classList.add('active');
}

async function handleEditSubmit(e) {
    if (e) e.preventDefault();
    console.log("handleEditSubmit fired!");
    
    const id = document.getElementById('editId').value;
    
    const platforms = [];
    document.querySelectorAll('#editPlatformBoxes input[type="checkbox"]:checked').forEach(cb => {
        platforms.push(cb.value);
    });

    const newData = {
        type: document.getElementById('editType').value,
        platforms: platforms,
        dimension: document.getElementById('editDimension').value,
        format: document.getElementById('editFormat').value,
        size: document.getElementById('editSize').value,
        duration: document.getElementById('editDuration').value,
        comments: document.getElementById('editComments').value,
        banners: currentBanners,
        screenshots: currentScreenshots,
    };

    let targetId = id;
    if (id) {
        const specIndex = specsData.findIndex(s => s.id === id);
        if (specIndex > -1) {
            specsData[specIndex] = { ...specsData[specIndex], ...newData };
        }
    } else {
        targetId = "spec_" + Math.random().toString(36).substr(2, 9);
        specsData.push({ id: targetId, ...newData });
        // re-render filters since new types might exist
        renderFilters(); 
    }
    
    try {
        await setDoc(doc(db, "specs", targetId), { id: targetId, ...newData }, { merge: true });
        console.log("Saved to Firebase successfully.");
    } catch (err) {
        console.error("Error writing to Firebase:", err);
        alert("Failed to save to cloud. Check console for details.");
    }

    closeModal();
    updateDashboard();
}

function exportToXLS(data) {
    if (!data || data.length === 0) {
        alert("No data available to export.");
        return;
    }

    let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <style>
            table { border-collapse: collapse; font-family: Calibri, sans-serif; }
            th { 
                background-color: #8b5cf6; 
                color: #ffffff; 
                font-weight: bold; 
                border: 1px solid #000000; 
                padding: 10px; 
                text-align: left; 
                font-size: 14px;
            }
            td { 
                border: 1px solid #000000; 
                padding: 8px; 
                text-align: left; 
                vertical-align: top;
                font-size: 13px;
                background-color: #ffffff;
                color: #000000;
            }
        </style>
    </head>
    <body>
        <table>
            <thead>
                <tr>
                    <th>Banner Type</th>
                    <th>Platforms</th>
                    <th>Dimension</th>
                    <th>Format</th>
                    <th>Size Max</th>
                    <th>Duration</th>
                    <th>Comments</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(spec => {
        const type = spec.type ? spec.type.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const plats = spec.platforms ? spec.platforms.join(" | ") : '';
        const dim = spec.dimension ? spec.dimension.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const fmt = spec.format ? spec.format.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const size = spec.size ? spec.size.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const dur = spec.duration ? spec.duration.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const comm = spec.comments ? spec.comments.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

        html += `
            <tr>
                <td><b>${type}</b></td>
                <td>${plats}</td>
                <td>${dim}</td>
                <td>${fmt}</td>
                <td>${size}</td>
                <td>${dur}</td>
                <td>${comm}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </body>
    </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Cricbuzz_Ad_Specs.xls";
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
