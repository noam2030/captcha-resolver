/**
 * ADK Gemini CAPTCHA Resolver - Frontend Application
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const imagePreview = document.getElementById('image-preview');
  const emptyState = document.getElementById('empty-state');
  const previewMeta = document.getElementById('preview-meta');
  const btnSolve = document.getElementById('btn-solve');
  const btnSolveText = document.getElementById('btn-solve-text');
  const resultCard = document.getElementById('result-card');
  const resultSolution = document.getElementById('result-solution');
  const resultTypeBadge = document.getElementById('result-type-badge');
  const resultLatencyBadge = document.getElementById('result-latency-badge');
  const resultConfidence = document.getElementById('result-confidence');
  const confidenceIndicator = document.getElementById('confidence-indicator');
  const resultExplanation = document.getElementById('result-explanation');
  const btnCopy = document.getElementById('btn-copy');
  const btnCopyText = document.getElementById('btn-copy-text');
  const historyTableBody = document.getElementById('history-table-body');
  const emptyHistoryRow = document.getElementById('empty-history-row');
  const btnClearHistory = document.getElementById('btn-clear-history');

  // Generator elements
  const btnGenText = document.getElementById('btn-gen-text');
  const btnGenMath = document.getElementById('btn-gen-math');
  const btnGenNoise = document.getElementById('btn-gen-noise');
  const btnGenCombo = document.getElementById('btn-gen-combo');
  const canvas = document.getElementById('captcha-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  // 4 Small Project Sample Icon Buttons
  const sampleIconBtns = document.querySelectorAll('.sample-icon-btn');

  let currentImageDataUrl = null;

  // Initialize
  initSampleIcons();
  checkHealth();

  // --- 4 Small Sample Icon Previews ---
  function initSampleIcons() {
    sampleIconBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Clear active states on all sample buttons
        sampleIconBtns.forEach(b => b.classList.remove('selected', 'ring-2', 'ring-indigo-500', 'border-indigo-500'));
        // Mark clicked button as selected
        btn.classList.add('selected', 'ring-2', 'ring-indigo-500', 'border-indigo-500');

        const src = btn.getAttribute('data-src');
        const title = btn.getAttribute('data-title') || 'Sample Challenge';
        selectSampleAsUploaded(src, title);
      });
    });

    // Auto-select the first sample icon on page load
    if (sampleIconBtns.length > 0) {
      setTimeout(() => {
        sampleIconBtns[0].click();
      }, 100);
    }
  }

  function selectSampleAsUploaded(imageSrc, label) {
    previewMeta.textContent = `Loading ${label}...`;

    // Convert image to Base64 Data URL via canvas so it functions exactly like an uploaded file
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.naturalWidth || 600;
        offCanvas.height = img.naturalHeight || 300;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0);
        const dataUrl = offCanvas.toDataURL('image/jpeg', 0.95);
        loadImage(dataUrl, label);
      } catch (err) {
        fallbackFetchToDataUrl(imageSrc, label);
      }
    };
    img.onerror = () => {
      fallbackFetchToDataUrl(imageSrc, label);
    };
    img.src = imageSrc;
  }

  function fallbackFetchToDataUrl(url, label) {
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = (e) => loadImage(e.target.result, label);
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // Fallback: pass image URL directly (app.py handles static paths too!)
        loadImage(url, label);
      });
  }

  // --- Upload / File Drag-and-Drop ---
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-500', 'bg-indigo-950/20');
    });

    ['dragleave', 'dragend'].forEach(type => {
      dropZone.addEventListener(type, () => {
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleFile(files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });
  }

  // --- Clipboard Paste Listener ---
  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        handleFile(blob, 'Pasted Clipboard Image');
        break;
      }
    }
  });

  function handleFile(file, customName) {
    // Clear selection on sample icons when custom file uploaded
    sampleIconBtns.forEach(b => b.classList.remove('selected', 'ring-2', 'ring-indigo-500', 'border-indigo-500'));

    const reader = new FileReader();
    reader.onload = (e) => {
      loadImage(e.target.result, customName || file.name || 'Uploaded CAPTCHA');
    };
    reader.readAsDataURL(file);
  }

  function loadImage(dataUrl, label = 'Ready') {
    currentImageDataUrl = dataUrl;
    imagePreview.src = dataUrl;
    imagePreview.classList.remove('hidden');
    emptyState.classList.add('hidden');
    btnSolve.disabled = false;
    previewMeta.textContent = label;

    // Reset result card
    resultCard.classList.add('hidden');
    if (window.lucide) lucide.createIcons();
  }

  // --- Client-Side Dynamic CAPTCHA Generator ---
  function getRandomString(length = 6) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  function drawCaptcha(text, options = {}) {
    if (!canvas || !ctx) return;
    sampleIconBtns.forEach(b => b.classList.remove('selected', 'ring-2', 'ring-indigo-500', 'border-indigo-500'));

    canvas.width = 320;
    canvas.height = 100;

    // Background
    ctx.fillStyle = options.bgColor || '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Random background dots / noise
    for (let i = 0; i < 150; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, 0.35)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distorted random lines
    const lineCount = options.lines || 6;
    for (let i = 0; i < lineCount; i++) {
      ctx.strokeStyle = `rgba(${Math.floor(Math.random()*200 + 55)}, ${Math.floor(Math.random()*200 + 55)}, 255, 0.45)`;
      ctx.lineWidth = Math.random() * 2 + 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.bezierCurveTo(
        Math.random() * canvas.width, Math.random() * canvas.height,
        Math.random() * canvas.width, Math.random() * canvas.height,
        Math.random() * canvas.width, Math.random() * canvas.height
      );
      ctx.stroke();
    }

    // Render characters
    const charSpacing = canvas.width / (text.length + 1);
    ctx.textBaseline = 'middle';

    for (let i = 0; i < text.length; i++) {
      ctx.save();
      const x = charSpacing * (i + 0.7);
      const y = canvas.height / 2 + (Math.random() * 16 - 8);
      const angle = (Math.random() * 40 - 20) * (Math.PI / 180);

      ctx.translate(x, y);
      ctx.rotate(angle);

      // Random font and color
      const fonts = ['Arial', 'Courier New', 'Verdana', 'Georgia', 'Impact'];
      const font = fonts[Math.floor(Math.random() * fonts.length)];
      ctx.font = `bold ${Math.floor(Math.random() * 10 + 36)}px ${font}`;
      
      const colors = ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#34d399', '#fde047', '#fb923c'];
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.fillText(text[i], 0, 0);

      // Stroke border on characters
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.strokeText(text[i], 0, 0);

      ctx.restore();
    }

    // Add foreground cross-cutting lines
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * canvas.height);
      ctx.lineTo(canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    const dataUrl = canvas.toDataURL('image/png');
    loadImage(dataUrl, `Generated (${text})`);
  }

  if (btnGenText) {
    btnGenText.addEventListener('click', () => {
      const text = getRandomString(5);
      drawCaptcha(text, { lines: 5 });
    });
  }

  if (btnGenMath) {
    btnGenMath.addEventListener('click', () => {
      const n1 = Math.floor(Math.random() * 20) + 1;
      const n2 = Math.floor(Math.random() * 10) + 1;
      const ops = ['+', '-', 'x'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      const text = `${n1} ${op} ${n2} = ?`;
      drawCaptcha(text, { lines: 4 });
    });
  }

  if (btnGenNoise) {
    btnGenNoise.addEventListener('click', () => {
      const text = getRandomString(6);
      drawCaptcha(text, { lines: 10 });
    });
  }

  if (btnGenCombo) {
    btnGenCombo.addEventListener('click', () => {
      const text = getRandomString(4).toUpperCase() + Math.floor(Math.random() * 90 + 10);
      drawCaptcha(text, { lines: 7 });
    });
  }

  // --- Solve Action ---
  btnSolve.addEventListener('click', async () => {
    if (!currentImageDataUrl) return;

    btnSolve.disabled = true;
    btnSolveText.textContent = 'Resolving with ADK Gemini...';
    btnSolve.classList.add('glow-active');

    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: currentImageDataUrl })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to solve CAPTCHA');
      }

      displayResult(data);
      addHistory(data);

    } catch (err) {
      alert(`Error resolving CAPTCHA: ${err.message}`);
    } finally {
      btnSolve.disabled = false;
      btnSolveText.textContent = 'Resolve with ADK Gemini';
      btnSolve.classList.remove('glow-active');
    }
  });

  function displayResult(data) {
    resultSolution.textContent = data.solution || 'N/A';
    resultTypeBadge.textContent = (data.captcha_type || 'Alphanumeric').toUpperCase();
    resultLatencyBadge.textContent = `${data.latency_ms || 0}ms`;

    const conf = (data.confidence || 'high').toLowerCase();
    resultConfidence.textContent = conf.charAt(0).toUpperCase() + conf.slice(1);
    
    if (conf === 'high') {
      confidenceIndicator.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
    } else if (conf === 'medium') {
      confidenceIndicator.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
    } else {
      confidenceIndicator.className = 'w-2.5 h-2.5 rounded-full bg-rose-400';
    }

    resultExplanation.textContent = data.explanation || 'Characters extracted by ADK Gemini Vision model.';
    resultCard.classList.remove('hidden');

    if (window.lucide) lucide.createIcons();
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --- Copy Solution ---
  btnCopy.addEventListener('click', () => {
    const text = resultSolution.textContent.trim();
    if (text && text !== '------') {
      navigator.clipboard.writeText(text).then(() => {
        btnCopyText.textContent = 'Copied!';
        setTimeout(() => { btnCopyText.textContent = 'Copy'; }, 2000);
      });
    }
  });

  // --- Session History ---
  function addHistory(data) {
    emptyHistoryRow.classList.add('hidden');
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';

    const now = new Date().toLocaleTimeString();
    tr.innerHTML = `
      <td class="py-2.5 px-3">
        <img src="${currentImageDataUrl}" class="w-16 h-8 object-cover rounded border border-slate-700">
      </td>
      <td class="py-2.5 px-3 font-medium text-slate-300">${data.captcha_type || 'alphanumeric'}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-white text-sm">${data.solution}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
          (data.confidence || '').toLowerCase() === 'high' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
        }">${data.confidence || 'high'}</span>
      </td>
      <td class="py-2.5 px-3 font-mono text-slate-400">${data.latency_ms}ms</td>
      <td class="py-2.5 px-3 text-right text-slate-500">${now}</td>
    `;

    historyTableBody.prepend(tr);
  }

  btnClearHistory.addEventListener('click', () => {
    historyTableBody.innerHTML = '';
    historyTableBody.appendChild(emptyHistoryRow);
    emptyHistoryRow.classList.remove('hidden');
  });

  // --- Health Check ---
  async function checkHealth() {
    try {
      const res = await fetch('/health');
      const data = await res.json();
      if (data.status === 'healthy') {
        document.getElementById('connection-text').textContent = 'Load Balancer Connected';
        document.getElementById('model-badge').textContent = data.model || 'gemini-2.5-flash';
      }
    } catch (e) {
      document.getElementById('connection-text').textContent = 'Backend Offline';
      document.getElementById('connection-status').className = 'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20';
    }
  }
});
