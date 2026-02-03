// Configuration
const NAVY = '#064681';
const PINK = '#ee3162';
const CONFIG = {
    borderColor: NAVY,
    borderWidth: 1.5,
    radius: 6
};
const MIN_CROP_SIZE = 24;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const resultArea = document.getElementById('resultArea');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const toast = document.getElementById('toast');
const colorSwitch = document.getElementById('colorSwitch');
const switchLabel = document.getElementById('switchLabel');
const previewWrapper = document.querySelector('.preview-wrapper');
const cropOverlay = document.getElementById('cropOverlay');
const cropRectEl = document.getElementById('cropRect');
const cropHandles = cropRectEl ? cropRectEl.querySelectorAll('.crop-handle') : [];

const state = {
    img: null,
    crop: null
};
let isDragging = false;
let dragEdge = null;
let dragStart = null;
let drawQueued = false;

// --- Event Listeners ---
// 0. Color Switch
if (colorSwitch) {
    colorSwitch.addEventListener('click', () => {
        if (colorSwitch.classList.contains('active')) {
            colorSwitch.classList.remove('active');
            CONFIG.borderColor = NAVY;
            switchLabel.textContent = 'Navy';
        } else {
            colorSwitch.classList.add('active');
            CONFIG.borderColor = PINK;
            switchLabel.textContent = 'Pink';
        }
        if (state.img) requestDraw();
    });
}

// 1. Paste Event (Global)
document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
                e.preventDefault();
                processFile(blob);
                return;
            }
        }
    }
    for (let item of items) {
        if (item.type === 'text/html') {
            e.preventDefault();
            item.getAsString((htmlString) => {
                handleHtmlPaste(htmlString);
            });
            return;
        }
    }
});

// 2. Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
    }
});

// 3. Click to Upload
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) processFile(fileInput.files[0]);
});

// 4. Buttons
copyBtn.addEventListener('click', copyToClipboard);
downloadBtn.addEventListener('click', downloadImage);

// 5. Crop Drag Handles
cropHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
        if (!state.img || !state.crop) return;
        const edge = e.currentTarget.dataset.edge;
        if (!edge) return;
        isDragging = true;
        dragEdge = edge;
        dragStart = { crop: { ...state.crop } };
        window.addEventListener('pointermove', onDragMove);
        window.addEventListener('pointerup', onDragEnd);
        window.addEventListener('pointercancel', onDragEnd);
        e.preventDefault();
    });
});

window.addEventListener('resize', () => {
    if (state.img) {
        syncOverlayBounds();
        updateCropOverlay();
    }
});

// --- Core Logic ---
function processFile(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
        showToast("Please upload an image file.", true);
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => onImageReady(img);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function handleHtmlPaste(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const img = doc.querySelector('img');
    if (img && img.src) {
        loadImageFromUrl(img.src);
    } else {
        showToast("No usable image found in clipboard.", true);
    }
}

function loadImageFromUrl(url) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        onImageReady(img);
    };
    img.onerror = () => {
        console.error("CORS Error or Load Error for URL:", url);
        showToast("Cannot access image (CORS protected). Try saving to computer first.", true);
    };
    img.src = url;
}

function onImageReady(img) {
    state.img = img;
    state.crop = { x: 0, y: 0, w: img.width, h: img.height };
    requestDraw();
}

function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
        drawQueued = false;
        drawPreview();
    });
}

function drawPreview() {
    if (!state.img) return;
    const img = state.img;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    resultArea.style.display = 'block';
    if (cropOverlay) {
        if (cropRectEl) cropRectEl.style.color = CONFIG.borderColor;
        cropOverlay.style.display = 'block';
        syncOverlayBounds();
        updateCropOverlay();
    }
}

function syncOverlayBounds() {
    if (!cropOverlay || !previewWrapper) return;
    const canvasRect = canvas.getBoundingClientRect();
    const wrapperRect = previewWrapper.getBoundingClientRect();
    cropOverlay.style.left = `${canvasRect.left - wrapperRect.left}px`;
    cropOverlay.style.top = `${canvasRect.top - wrapperRect.top}px`;
    cropOverlay.style.width = `${canvasRect.width}px`;
    cropOverlay.style.height = `${canvasRect.height}px`;
}

function updateCropOverlay() {
    if (!cropOverlay || !cropRectEl || !state.crop) return;
    const overlayWidth = cropOverlay.clientWidth;
    const overlayHeight = cropOverlay.clientHeight;
    if (!overlayWidth || !overlayHeight || !canvas.width || !canvas.height) return;
    const scaleX = overlayWidth / canvas.width;
    const scaleY = overlayHeight / canvas.height;
    cropRectEl.style.left = `${state.crop.x * scaleX}px`;
    cropRectEl.style.top = `${state.crop.y * scaleY}px`;
    cropRectEl.style.width = `${state.crop.w * scaleX}px`;
    cropRectEl.style.height = `${state.crop.h * scaleY}px`;
}

function onDragMove(e) {
    if (!isDragging || !state.img || !state.crop || !dragStart) return;
    const pos = getPointerPos(e);
    updateCropFromEdge(pos);
    requestDraw();
}

function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    dragEdge = null;
    dragStart = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
}

function getPointerPos(e) {
    const overlayRect = cropOverlay.getBoundingClientRect();
    const scaleX = canvas.width / overlayRect.width;
    const scaleY = canvas.height / overlayRect.height;
    const x = (e.clientX - overlayRect.left) * scaleX;
    const y = (e.clientY - overlayRect.top) * scaleY;
    return { x, y };
}

function updateCropFromEdge(pos) {
    const imgW = state.img.width;
    const imgH = state.img.height;
    const min = MIN_CROP_SIZE;
    const start = dragStart.crop;
    let x = start.x;
    let y = start.y;
    let w = start.w;
    let h = start.h;

    if (dragEdge === 'left') {
        const newX = clamp(pos.x, 0, start.x + start.w - min);
        x = newX;
        w = start.x + start.w - newX;
    } else if (dragEdge === 'right') {
        const newRight = clamp(pos.x, start.x + min, imgW);
        x = start.x;
        w = newRight - start.x;
    } else if (dragEdge === 'top') {
        const newY = clamp(pos.y, 0, start.y + start.h - min);
        y = newY;
        h = start.y + start.h - newY;
    } else if (dragEdge === 'bottom') {
        const newBottom = clamp(pos.y, start.y + min, imgH);
        y = start.y;
        h = newBottom - start.y;
    }

    state.crop = {
        x: Math.round(clamp(x, 0, imgW - min)),
        y: Math.round(clamp(y, 0, imgH - min)),
        w: Math.round(clamp(w, min, imgW - x)),
        h: Math.round(clamp(h, min, imgH - y))
    };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function renderOutputCanvas() {
    if (!state.img || !state.crop) return null;
    const img = state.img;
    const crop = normalizeCrop(state.crop, img);
    const output = document.createElement('canvas');
    output.width = crop.w;
    output.height = crop.h;
    const octx = output.getContext('2d');
    const bw = CONFIG.borderWidth;
    const offset = bw / 2;
    const r = Math.max(0, Math.min(CONFIG.radius, (Math.min(output.width, output.height) - bw) / 2));

    octx.save();
    octx.beginPath();
    pathRoundedRect(octx, offset, offset, output.width - bw, output.height - bw, r);
    octx.clip();
    octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, output.width, output.height);
    octx.restore();

    octx.beginPath();
    pathRoundedRect(octx, offset, offset, output.width - bw, output.height - bw, r);
    octx.strokeStyle = CONFIG.borderColor;
    octx.lineWidth = bw;
    octx.stroke();
    return output;
}

function normalizeCrop(crop, img) {
    const min = MIN_CROP_SIZE;
    const x = clamp(Math.round(crop.x), 0, img.width - min);
    const y = clamp(Math.round(crop.y), 0, img.height - min);
    const w = clamp(Math.round(crop.w), min, img.width - x);
    const h = clamp(Math.round(crop.h), min, img.height - y);
    return { x, y, w, h };
}

function pathRoundedRect(context, x, y, width, height, radius) {
    if (context.roundRect) {
        context.roundRect(x, y, width, height, radius);
        return;
    }
    const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
}

async function copyToClipboard() {
    try {
        const output = renderOutputCanvas();
        if (!output) return;
        const pngBlob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
        if (!pngBlob) throw new Error('Failed to create image');
        const dataUrl = output.toDataURL('image/png');
        const htmlContent = `<figure class="image" style="float: none; clear: both; margin: 0 auto 0 0; display: table;"><img src="${dataUrl}" alt="" /></figure>`;
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const item = new ClipboardItem({
            'image/png': pngBlob,
            'text/html': htmlBlob
        });
        await navigator.clipboard.write([item]);
        showToast("Copied! (Block Left-Aligned)");
    } catch (err) {
        console.warn("Smart copy failed, falling back to simple image copy:", err);
        if (err.name === 'SecurityError') {
            showToast("Security Block: Canvas is tainted. Download instead.", true);
            return;
        }
        try {
            const output = renderOutputCanvas();
            if (!output) return;
            const blob = await new Promise(resolve => output.toBlob(resolve, 'image/png'));
            const simpleItem = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([simpleItem]);
            showToast("Copied (Simple Mode)");
        } catch (fallbackErr) {
            showToast("Clipboard failed. Use Download.", true);
        }
    }
}

function downloadImage() {
    try {
        const output = renderOutputCanvas();
        if (!output) return;
        const dataUrl = output.toDataURL('image/webp', 0.95);
        const link = document.createElement('a');
        link.download = 'framed-image.webp';
        link.href = dataUrl;
        link.click();
    } catch (err) {
        showToast("Download failed. Image may be protected.", true);
    }
}

function showToast(msg, isError = false) {
    toast.textContent = msg;
    if (isError) {
        toast.classList.add("error");
    } else {
        toast.classList.remove("error");
    }
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 4000);
}

if (cropOverlay) {
    cropOverlay.style.display = 'none';
}
