(function () {
  // Cache immediately — document.currentScript is only valid during sync execution.
  // For dynamically injected scripts (Vue/React) it may already be null.
  var script = document.currentScript;

  // Fallback: find the most recently added widget script tag
  if (!script) {
    var matches = document.querySelectorAll('script[src*="widget.js"]');
    if (matches.length) script = matches[matches.length - 1];
  }

  if (!script) { console.error('[ChatWidget] cannot find script tag'); return; }

  var parts         = script.src.split('?');
  var params        = new URLSearchParams(parts[1] || '');
  var merchantId    = params.get('merchantId');
  var primaryColor  = params.get('primaryColor')   || '#2563eb';
  var secondaryColor= params.get('secondaryColor') || primaryColor;
  var position      = params.get('position') === 'left' ? 'left' : 'right';
  var greeting      = params.get('greeting')   || 'Hi there! How can we help you today?';
  var brandName     = params.get('brandName')  || 'Chat with us';
  var customerId    = params.get('customerId')   || '';
  var customerName  = params.get('customerName') || '';
  var customerEmail = params.get('customerEmail')|| '';
  var customerRegion = params.get('customerRegion') || '';

  if (!merchantId) { console.error('[ChatWidget] merchantId is required'); return; }

  var BASE_URL = new URL(script.src).origin;
  var SIDE     = position;

  // ── Styles ──────────────────────────────────────────────────────────────
  var s = document.createElement('style');
  s.textContent = [
    '#__cw-root{position:fixed;' + SIDE + ':24px;bottom:24px;z-index:2147483647;font-family:-apple-system,sans-serif}',
    '#__cw-root *{box-sizing:border-box;margin:0;padding:0}',
    '#__cw-wrap{position:relative;display:inline-block}',
    '#__cw-btn{width:56px;height:56px;border-radius:50%;background:' + primaryColor + ';border:none;outline:none;',
    '  cursor:pointer;display:flex;align-items:center;justify-content:center;',
    '  box-shadow:0 4px 20px rgba(0,0,0,.2);transition:transform .2s}',
    '#__cw-btn:hover{transform:scale(1.08)}',
    '#__cw-btn svg{pointer-events:none}',
    '#__cw-badge{position:absolute;top:0;right:0;min-width:18px;height:18px;padding:0 4px;',
    '  border-radius:9px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;',
    '  display:none;align-items:center;justify-content:center;border:2px solid #fff}',
    '#__cw-badge.on{display:flex}',
    '#__cw-panel{position:absolute;' + SIDE + ':0;bottom:68px;width:360px;height:560px;',
    '  border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.18);',
    '  background:#fff;display:none;flex-direction:column;',
    '  opacity:0;transform:translateY(12px) scale(.97);transition:opacity .2s,transform .2s}',
    '#__cw-panel.open{display:flex;opacity:1;transform:none}',
    '#__cw-panel.show{display:flex}',
    '#__cw-iframe{width:100%;height:100%;border:none;display:block}',
    '@media(max-width:480px){#__cw-panel{width:calc(100vw - 32px);height:calc(100svh - 90px)}}'
  ].join('');
  document.head.appendChild(s);

  // ── DOM ──────────────────────────────────────────────────────────────────
  var root  = document.createElement('div'); root.id = '__cw-root';
  var wrap  = document.createElement('div'); wrap.id = '__cw-wrap';
  var panel = document.createElement('div'); panel.id = '__cw-panel';
  var badge = document.createElement('span'); badge.id = '__cw-badge';
  var btn   = document.createElement('button'); btn.id = '__cw-btn';
  btn.setAttribute('aria-label', 'Open chat');
  btn.innerHTML =
    '<svg id="ico-chat" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
    '<svg id="ico-x" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  var iframe = document.createElement('iframe');
  iframe.id = '__cw-iframe';
  iframe.setAttribute('title', 'Chat');

  panel.appendChild(iframe);
  wrap.appendChild(btn);
  wrap.appendChild(badge);
  root.appendChild(panel);
  root.appendChild(wrap);
  document.body.appendChild(root);

  // ── Helper: build iframe URL ─────────────────────────────────────────────
  function buildIframeUrl(apiUrl, whSecret) {
    var url = new URL('/widget-ui', BASE_URL);
    url.searchParams.set('merchantId',     merchantId);
    url.searchParams.set('primaryColor',   primaryColor);
    url.searchParams.set('secondaryColor', secondaryColor);
    url.searchParams.set('greeting',       greeting);
    url.searchParams.set('brandName',      brandName);
    if (apiUrl)        url.searchParams.set('apiUrl',        apiUrl);
    if (whSecret)      url.searchParams.set('whSecret',      whSecret);
    if (customerId)    url.searchParams.set('customerId',    customerId);
    if (customerName)  url.searchParams.set('customerName',  customerName);
    if (customerEmail) url.searchParams.set('customerEmail', customerEmail);
    if (customerRegion) url.searchParams.set('customerRegion', customerRegion);
    return url.toString();
  }

  // ── Fetch config from widget server, then build iframe URL ───────────────
  fetch(BASE_URL + '/widget-config')
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      iframe.src = buildIframeUrl(cfg.apiUrl, cfg.whSecret);
    })
    .catch(function () {
      iframe.src = buildIframeUrl('', '');
      console.error('[ChatWidget] Failed to load config from widget server');
    });

  // ── Toggle ───────────────────────────────────────────────────────────────
  var open   = false;
  var unread = 0;

  function openPanel() {
    open = true;
    panel.classList.add('show');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { panel.classList.add('open'); });
    });
    btn.querySelector('#ico-chat').style.display = 'none';
    btn.querySelector('#ico-x').style.display    = 'block';
    btn.setAttribute('aria-label', 'Close chat');
    unread = 0; badge.textContent = ''; badge.classList.remove('on');
    iframe.contentWindow && iframe.contentWindow.postMessage({ type: 'CW_OPENED' }, BASE_URL);
  }

  function closePanel() {
    open = false;
    panel.classList.remove('open');
    btn.querySelector('#ico-chat').style.display = 'block';
    btn.querySelector('#ico-x').style.display    = 'none';
    btn.setAttribute('aria-label', 'Open chat');
    setTimeout(function () { if (!open) panel.classList.remove('show'); }, 220);
  }

  btn.addEventListener('click', function () { open ? closePanel() : openPanel(); });

  window.addEventListener('message', function (e) {
    if (e.origin !== BASE_URL) return;
    var msg = e.data || {};
    if (msg.type === 'CW_CLOSE') closePanel();
    if (msg.type === 'CW_UNREAD' && !open) {
      unread++;
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.classList.add('on');
    }
  });
})();