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
  const presetsContainer = document.getElementById('presets-container');

  // Tab elements
  const tabBtnResources = document.getElementById('tab-btn-resources');
  const tabBtnUpload = document.getElementById('tab-btn-upload');
  const tabBtnGenerator = document.getElementById('tab-btn-generator');
  const tabContentResources = document.getElementById('tab-content-resources');
  const tabContentUpload = document.getElementById('tab-content-upload');
  const tabContentGenerator = document.getElementById('tab-content-generator');
  const samplesGallery = document.getElementById('samples-gallery');
  const btnReloadSamples = document.getElementById('btn-reload-samples');

  // Generator buttons
  const btnGenText = document.getElementById('btn-gen-text');
  const btnGenMath = document.getElementById('btn-gen-math');
  const btnGenNoise = document.getElementById('btn-gen-noise');
  const btnGenCombo = document.getElementById('btn-gen-combo');
  const canvas = document.getElementById('captcha-canvas');
  const ctx = canvas.getContext('2d');

  let currentImageDataUrl = null;
  const historyLog = [];

  // Tab Navigation setup
  function setActiveTab(tab) {
    const inactiveClass = 'flex-1 py-2 px-2.5 rounded-lg text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition';
    const activeClass = 'flex-1 py-2 px-2.5 rounded-lg text-white bg-indigo-600 shadow flex items-center justify-center gap-1.5 transition';

    [tabBtnResources, tabBtnUpload, tabBtnGenerator].forEach(btn => {
      if (btn) btn.className = inactiveClass;
    });
    [tabContentResources, tabContentUpload, tabContentGenerator].forEach(content => {
      if (content) content.classList.add('hidden');
    });

    if (tab === 'resources' && tabBtnResources && tabContentResources) {
      tabBtnResources.className = activeClass;
      tabContentResources.classList.remove('hidden');
    } else if (tab === 'upload' && tabBtnUpload && tabContentUpload) {
      tabBtnUpload.className = activeClass;
      tabContentUpload.classList.remove('hidden');
    } else if (tab === 'generator' && tabBtnGenerator && tabContentGenerator) {
      tabBtnGenerator.className = activeClass;
      tabContentGenerator.classList.remove('hidden');
    }
    if (window.lucide) lucide.createIcons();
  }

  if (tabBtnResources) tabBtnResources.addEventListener('click', () => setActiveTab('resources'));
  if (tabBtnUpload) tabBtnUpload.addEventListener('click', () => setActiveTab('upload'));
  if (tabBtnGenerator) tabBtnGenerator.addEventListener('click', () => setActiveTab('generator'));

  // Initialize
  loadSamplesGallery();
  initPresets();
  checkHealth();

  // --- Upload / File Drag-and-Drop ---
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

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

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

  btnGenText.addEventListener('click', () => {
    const text = getRandomString(5);
    drawCaptcha(text, { lines: 5 });
  });

  btnGenMath.addEventListener('click', () => {
    const n1 = Math.floor(Math.random() * 20) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    const ops = ['+', '-', 'x'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const text = `${n1} ${op} ${n2} = ?`;
    drawCaptcha(text, { lines: 4 });
  });

  btnGenNoise.addEventListener('click', () => {
    const text = getRandomString(6);
    drawCaptcha(text, { lines: 10 });
  });

  btnGenCombo.addEventListener('click', () => {
    const text = getRandomString(4).toUpperCase() + Math.floor(Math.random() * 90 + 10);
    drawCaptcha(text, { lines: 7 });
  });

  // --- Project Resources Samples Gallery ---
  const DEFAULT_SAMPLES = [
    {
      id: "alphanumeric",
      title: "Alphanumeric Code",
      type: "alphanumeric",
      badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      description: "Distorted characters 'K8N49P' with scratch noise & strike lines",
      url: "/static/samples/sample_alphanumeric.jpg",
      expected: "K8N49P"
    },
    {
      id: "math",
      title: "Math Arithmetic Challenge",
      type: "math",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description: "Math problem '24 + 17 = ?' on textured paper with scratches",
      url: "/static/samples/sample_math.jpg",
      expected: "41"
    },
    {
      id: "grid",
      title: "3x3 Object Grid Selection",
      type: "grid_selection",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      description: "Photo verification: 'Select all squares with traffic lights'",
      url: "/static/samples/sample_grid.jpg",
      expected: "Tiles 2, 6, 7"
    },
    {
      id: "word",
      title: "Warped Word Puzzle",
      type: "word",
      badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      description: "Distorted dictionary word 'overlook' with wavy ripple lines",
      url: "/static/samples/sample_word.jpg",
      expected: "overlook"
    },
    {
      id: "wavy",
      title: "Colorful Wavy Distorted",
      type: "alphanumeric",
      badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      description: "High-contrast distorted text 'R9X2B5' with swirl interference",
      url: "/static/samples/sample_wavy.jpg",
      expected: "R9X2B5"
    }
  ];

  let activeSampleCard = null;

  async function loadSamplesGallery() {
    let samples = DEFAULT_SAMPLES;
    try {
      const res = await fetch('/api/samples');
      if (res.ok) {
        const data = await res.json();
        if (data.samples && data.samples.length > 0) {
          samples = data.samples;
        }
      }
    } catch (e) {
      console.warn('Using default samples list');
    }

    renderSamplesGallery(samples);
  }

  function renderSamplesGallery(samples) {
    if (!samplesGallery) return;
    samplesGallery.innerHTML = '';

    samples.forEach((sample, idx) => {
      const card = document.createElement('div');
      card.className = 'p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition flex items-center gap-3.5 group';
      card.dataset.id = sample.id;

      const typeBadgeClass = sample.badgeClass || (
        sample.type === 'math' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
        sample.type === 'grid_selection' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
        sample.type === 'word' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
        'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
      );

      card.innerHTML = `
        <div class="relative shrink-0">
          <img src="${sample.url}" alt="${sample.title}" class="w-20 h-14 object-cover rounded-lg border border-slate-800 bg-slate-900 group-hover:scale-105 transition-transform">
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="sample-title text-xs font-semibold text-white group-hover:text-indigo-300 truncate">${sample.title}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium border ${typeBadgeClass}">
              ${sample.type}
            </span>
          </div>
          <p class="text-[11px] text-slate-400 line-clamp-1 leading-snug">${sample.description}</p>
          <div class="flex items-center justify-between mt-1 text-[11px]">
            <span class="text-slate-500 font-mono text-[10px]">Expected: <span class="text-slate-300">${sample.expected}</span></span>
            <span class="text-indigo-400 font-medium group-hover:text-indigo-300 flex items-center gap-1 text-[11px]">
              Load <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        selectSample(sample, card);
      });

      samplesGallery.appendChild(card);

      // Select first sample automatically on initial load
      if (idx === 0) {
        selectSample(sample, card);
      }
    });

    if (window.lucide) lucide.createIcons();
  }

  async function selectSample(sample, cardElement) {
    if (activeSampleCard) {
      activeSampleCard.classList.remove('sample-card-active');
    }
    activeSampleCard = cardElement;
    if (activeSampleCard) {
      activeSampleCard.classList.add('sample-card-active');
    }

    try {
      previewMeta.textContent = `Loading ${sample.title}...`;
      const res = await fetch(sample.url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        loadImage(e.target.result, `${sample.title} • Expected: ${sample.expected}`);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to convert sample image to dataURL', err);
      loadImage(sample.url, `${sample.title} • Expected: ${sample.expected}`);
    }
  }

  if (btnReloadSamples) {
    btnReloadSamples.addEventListener('click', () => loadSamplesGallery());
  }

  // --- Curated Preset Thumbnails (Generator Tab) ---
  function initPresets() {
    if (!presetsContainer) return;
    const presets = [
      { name: 'Alphanumeric Noise', text: '7B3k9', lines: 6 },
      { name: 'Math Challenge', text: '14 + 8 = ?', lines: 3 },
      { name: 'Wavy Distorted', text: 'Xy49W', lines: 8 },
      { name: 'Verification Code', text: '59284', lines: 5 }
    ];

    presetsContainer.innerHTML = '';
    presets.forEach((preset) => {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 160;
      pCanvas.height = 55;
      const pCtx = pCanvas.getContext('2d');
      pCtx.fillStyle = '#1e293b';
      pCtx.fillRect(0, 0, pCanvas.width, pCanvas.height);

      for (let i = 0; i < 3; i++) {
        pCtx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        pCtx.beginPath();
        pCtx.moveTo(0, Math.random() * pCanvas.height);
        pCtx.lineTo(pCanvas.width, Math.random() * pCanvas.height);
        pCtx.stroke();
      }

      pCtx.fillStyle = '#38bdf8';
      pCtx.font = 'bold 20px Arial';
      pCtx.textAlign = 'center';
      pCtx.textBaseline = 'middle';
      pCtx.fillText(preset.text, pCanvas.width / 2, pCanvas.height / 2);

      const card = document.createElement('div');
      card.className = 'p-2 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition text-center space-y-1 group';
      card.innerHTML = `
        <img src="${pCanvas.toDataURL()}" class="w-full h-12 object-cover rounded-lg border border-slate-800/80 group-hover:opacity-90">
        <p class="text-[11px] font-medium text-slate-400 group-hover:text-indigo-300 truncate">${preset.name}</p>
      `;

      card.addEventListener('click', () => {
        if (activeSampleCard) {
          activeSampleCard.classList.remove('sample-card-active');
          activeSampleCard = null;
        }
        drawCaptcha(preset.text, { lines: preset.lines });
      });

      presetsContainer.appendChild(card);
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
