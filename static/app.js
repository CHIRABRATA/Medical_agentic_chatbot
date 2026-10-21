/* ═══════════════════════════════════════════════
   MedGuide AI — Client Application
   ═══════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

let history = [];
let imageData = null;
let recorder = null;
let audioChunks = [];
let cameraStream = null;
let lastAnswer = '';

// ── Auth headers ──
function getHeaders() {
  const h = {};
  const t = $('token').value.trim();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

// ── Simple Markdown → HTML ──
function md(text) {
  if (!text) return '';
  let s = text
    // escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // links  [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // unordered lists
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // paragraphs: double newlines
    .replace(/\n{2,}/g, '</p><p>')
    // single newlines → <br>
    .replace(/\n/g, '<br>');
  return '<p>' + s + '</p>';
}

// ── Create chat bubble ──
function bubble(content, kind = 'bot', raw = false) {
  const wrap = document.createElement('div');
  wrap.className = `msg msg-${kind}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = kind === 'bot' ? '✚' : '👤';

  const body = document.createElement('div');
  body.className = 'msg-body';

  if (kind === 'bot') {
    const name = document.createElement('div');
    name.className = 'msg-name';
    name.textContent = 'MedGuide AI';
    body.appendChild(name);
  }

  const text = document.createElement('div');
  text.className = 'msg-text';
  if (raw) {
    text.innerHTML = content;
  } else {
    text.textContent = content;
  }
  body.appendChild(text);

  wrap.appendChild(avatar);
  wrap.appendChild(body);
  $('messages').appendChild(wrap);
  $('messages').scrollTop = $('messages').scrollHeight;
  return { wrap, body, text };
}

// ── Health check ──
async function checkHealth() {
  const badge = $('status');
  const dot = badge.querySelector('.dot');
  const label = badge.querySelector('.badge-text');
  try {
    const r = await fetch('/api/health');
    const d = await r.json();
    if (d.configured) {
      label.textContent = 'Connected';
      dot.style.background = '#38d9a9';
      dot.style.boxShadow = '0 0 6px #38d9a9';
    } else {
      label.textContent = 'Keys needed';
      dot.style.background = '#f59e0b';
      dot.style.boxShadow = '0 0 6px #f59e0b';
    }
  } catch {
    label.textContent = 'Offline';
    dot.style.background = '#fb7185';
    dot.style.boxShadow = '0 0 6px #fb7185';
  }
}
checkHealth();

// ── Auto-resize textarea ──
$('message').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 160) + 'px';
});

// ── Image handling ──
function setImage(file) {
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5e6) {
    alert('Use PNG/JPEG/WebP under 5 MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    imageData = reader.result;
    $('thumbnail').src = imageData;
    $('preview').hidden = false;
  };
  reader.readAsDataURL(file);
}

$('image').addEventListener('change', e => setImage(e.target.files[0]));
$('remove').onclick = () => {
  imageData = null;
  $('preview').hidden = true;
  $('image').value = '';
};

// ── Chat submit ──
$('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const message = $('message').value.trim();
  if (!message) return;

  const prior = history.slice(-8);
  bubble(message, 'user');

  $('message').value = '';
  $('message').style.height = 'auto';
  $('send').disabled = true;

  // Thinking indicator
  const pending = bubble('<span class="thinking-dots">Thinking</span>', 'bot', true);

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: prior, image_data: imageData })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || 'Request failed');

    // Render markdown answer
    pending.text.innerHTML = md(d.answer);
    lastAnswer = d.answer;

    // Sources
    if (d.sources && d.sources.length) {
      const src = document.createElement('div');
      src.className = 'sources';
      src.innerHTML = '<strong>Sources:</strong> ' +
        d.sources.slice(0, 8).map(x =>
          x.type === 'pdf'
            ? `📄 PDF p.${x.page}`
            : `🔗 <a href="${x.url}" target="_blank" rel="noopener">${x.title || x.url}</a>`
        ).join(' &nbsp;|&nbsp; ');
      pending.body.appendChild(src);
    }

    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: d.answer }
    );
    $('remove').click(); // clear image
  } catch (err) {
    pending.text.innerHTML = `<span style="color:#fb7185">⚠ ${err.message}</span>`;
  } finally {
    $('send').disabled = false;
    $('messages').scrollTop = $('messages').scrollHeight;
  }
});

// ── Voice recording ──
$('mic').onclick = async () => {
  const btn = $('mic');
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
    btn.classList.remove('recording');
    btn.title = 'Voice input';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => audioChunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: recorder.mimeType });
      const data = new FormData();
      data.append('file', blob, 'voice.webm');
      btn.classList.remove('recording');
      try {
        const r = await fetch('/api/transcribe', { method: 'POST', headers: getHeaders(), body: data });
        const out = await r.json();
        if (!r.ok) throw new Error(out.detail);
        $('message').value = out.text;
        $('message').dispatchEvent(new Event('input'));
      } catch (e) { alert(e.message); }
    };
    recorder.start();
    btn.classList.add('recording');
    btn.title = 'Stop recording…';
  } catch (e) { alert('Microphone unavailable: ' + e.message); }
};

// ── Read answer aloud ──
$('listen').onclick = async () => {
  if (!lastAnswer) return alert('Ask a question first');
  $('listen').disabled = true;

  // Try backend TTS first
  try {
    const r = await fetch('/api/speak', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lastAnswer })
    });
    if (r.ok) {
      const url = URL.createObjectURL(await r.blob());
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); $('listen').disabled = false; };
      await audio.play();
      return;
    }
  } catch {}

  // Fallback to browser TTS
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(lastAnswer);
    utter.onend = () => { $('listen').disabled = false; };
    window.speechSynthesis.speak(utter);
  } else {
    alert('Text-to-speech is not available');
    $('listen').disabled = false;
  }
};

// ── Camera ──
$('camera').onclick = async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    $('video').srcObject = cameraStream;
    $('video').hidden = false;
    $('cameraActions').hidden = false;
  } catch (e) { alert('Camera unavailable: ' + e.message); }
};

$('closeCamera').onclick = () => {
  cameraStream?.getTracks().forEach(t => t.stop());
  cameraStream = null;
  $('video').hidden = true;
  $('cameraActions').hidden = true;
};

$('snap').onclick = () => {
  const v = $('video'), c = $('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  c.toBlob(b => setImage(new File([b], 'camera.jpg', { type: 'image/jpeg' })), 'image/jpeg', .85);
  $('closeCamera').click();
};