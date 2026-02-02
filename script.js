// Configuration
const NAVY = '#064681';
const PINK = '#ee3162';
const CONFIG = {
    borderColor: NAVY,
    borderWidth: 1.5,
    radius: 6
};
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
        // Redraw if image is loaded
        if (canvas.width > 0 && canvas.height > 0) {
            // Re-draw last image with new border color
            // We need to keep a reference to the last image
            if (window._lastImage) drawToCanvas(window._lastImage);
        }
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
fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) processFile(fileInput.files[0]);
});
// 4. Buttons
copyBtn.addEventListener('click', copyToClipboard);
downloadBtn.addEventListener('click', downloadImage);
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
        img.onload = () => drawToCanvas(img);
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
        drawToCanvas(img);
    };
    img.onerror = () => {
        console.error("CORS Error or Load Error for URL:", url);
        showToast("Cannot access image (CORS protected). Try saving to computer first.", true);
    };
    img.src = url;
}
function drawToCanvas(img) {
        window._lastImage = img;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const r = CONFIG.radius;
    const bw = CONFIG.borderWidth;
    const offset = bw / 2;
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(offset, offset, w - bw, h - bw, r);
    } else {
        ctx.moveTo(offset + r, offset);
        ctx.lineTo(w - offset - r, offset);
        ctx.quadraticCurveTo(w - offset, offset, w - offset, offset + r);
        ctx.lineTo(w - offset, h - offset - r);
        ctx.quadraticCurveTo(w - offset, h - offset, w - offset - r, h - offset);
        ctx.lineTo(offset + r, h - offset);
        ctx.quadraticCurveTo(offset, h - offset, offset, h - offset - r);
        ctx.lineTo(offset, offset + r);
        ctx.quadraticCurveTo(offset, offset, offset + r, offset);
    }
    ctx.clip();
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(offset, offset, w - bw, h - bw, r);
    } else {
        ctx.moveTo(offset + r, offset);
        ctx.lineTo(w - offset - r, offset);
        ctx.quadraticCurveTo(w - offset, offset, w - offset, offset + r);
        ctx.lineTo(w - offset, h - offset - r);
        ctx.quadraticCurveTo(w - offset, h - offset, w - offset - r, h - offset);
        ctx.lineTo(offset + r, h - offset);
        ctx.quadraticCurveTo(offset, h - offset, offset, h - offset - r);
        ctx.lineTo(offset, offset + r);
        ctx.quadraticCurveTo(offset, offset, offset + r, offset);
    }
    ctx.strokeStyle = CONFIG.borderColor;
    ctx.lineWidth = CONFIG.borderWidth;
    ctx.stroke();
    resultArea.style.display = 'block';
}
async function copyToClipboard() {
    try {
        const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const dataUrl = canvas.toDataURL('image/png');
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
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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
        const dataUrl = canvas.toDataURL('image/webp', 0.95);
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
