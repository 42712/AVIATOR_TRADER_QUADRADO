const API_URL = "https://aviator-trader-quadrado.onrender.com/api/nova-vela";

function detectarAviator() {
    return window.location.href.includes('aviator2') ? 2 : 1;
}

function calcularSoma(mult) {
    const str = mult.toFixed(2).replace('.', '');
    let soma = 0;
    for (let i = 0; i < str.length && i < 3; i++) soma += parseInt(str[i]) || 0;
    return soma;
}

const enviadas = new Set();

function enviarVela(mult, rodada, timestamp, origem) {
    const multNum = parseFloat(mult);
    if (isNaN(multNum) || multNum <= 0) return;
    const painel = detectarAviator();
    const chave = painel + '_' + rodada;
    if (enviadas.has(chave)) return;
    enviadas.add(chave);

    // Timestamp sempre ISO completo — nunca HH:MM:SS simples
    let tsISO = null;
    if (timestamp) {
        try {
            // Se é só HH:MM:SS, adiciona data de hoje
            if (/^\d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                const hoje = new Date().toISOString().split('T')[0];
                tsISO = `${hoje}T${timestamp}`;
            } else {
                const d = new Date(timestamp);
                tsISO = isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
            }
        } catch(e) {
            tsISO = new Date().toISOString();
        }
    } else {
        tsISO = new Date().toISOString();
    }

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            painel,
            multiplicador: multNum,
            rodada: rodada.toString(),
            timestamp: tsISO,
            soma: calcularSoma(multNum),
            fonte: origem || "sortenabet"
        })
    }).then(r => r.json()).then(d => {
        if (d.ok) console.log(`✅ [AVIATOR ${painel}] ${multNum}x rodada ${rodada} @ ${tsISO}`);
    }).catch(e => console.warn(`❌ Erro ao enviar vela: ${e.message}`));
}

let rodadaCache = null;

function extrairRodada() {
    // 1. Modal fairness
    const modalSpan = document.querySelector('app-fairness span.text-uppercase');
    if (modalSpan) {
        const match = modalSpan.textContent.match(/Rodada\s+(\d+)/i);
        if (match) return match[1];
    }
    // 2. TreeWalker no documento
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        const match = node.textContent.match(/[Rr]odada\s+#?(\d+)/);
        if (match) return match[1];
    }
    // 3. iFrames
    for (const iframe of document.querySelectorAll('iframe')) {
        try {
            if (!iframe.contentDocument) continue;
            const w = iframe.contentDocument.createTreeWalker(
                iframe.contentDocument.body, NodeFilter.SHOW_TEXT, null, false);
            let n;
            while ((n = w.nextNode())) {
                const m = n.textContent.match(/[Rr]odada\s+#?(\d+)/);
                if (m) return m[1];
            }
        } catch(e) {}
    }
    // 4. Atributos
    const roundEl = document.querySelector('[class*="round" i], [data-round], game-round-id');
    if (roundEl) return roundEl.getAttribute('data-round') || roundEl.textContent.trim();
    return null;
}

function atualizarCacheRodada() {
    const r = extrairRodada();
    if (r) rodadaCache = r;
}
setInterval(atualizarCacheRodada, 300);
atualizarCacheRodada();

function formatarTimestamp(isoStr) {
    if (!isoStr) return new Date().toISOString();
    try {
        const d = new Date(isoStr);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch (e) { return new Date().toISOString(); }
}

// ===== WEBSOCKET (fonte principal) =====
let ultimoEnvioWS = 0;

function conectarWS() {
    try {
        const ws = new WebSocket("wss://apiglobal.appbackend.tech/ws/signals/v2/aviator");
        ws.onopen = () => console.log("✅ [AVIATOR] WS conectado ao apiglobal");
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.casa !== 'sortenabet') return;
                const mult = parseFloat(msg.data?.valor);
                if (isNaN(mult) || mult <= 0) return;
                const rodada = rodadaCache || extrairRodada() || `ws-${Date.now()}`;
                const timestamp = formatarTimestamp(msg.data?.createdAt || msg.data?.timestamp);
                console.log(`🎯 [WS] ${mult}x rodada ${rodada}`);
                enviarVela(mult, rodada, timestamp, "ws-sortenabet");
                ultimoEnvioWS = Date.now();
            } catch (ex) {
                console.warn('[WS] Erro ao processar mensagem:', ex);
            }
        };
        ws.onclose = () => {
            console.log('[WS] Desconectado, reconectando em 5s...');
            setTimeout(conectarWS, 5000);
        };
        ws.onerror = () => ws.close();
    } catch (e) { setTimeout(conectarWS, 5000); }
}
conectarWS();

// ===== DOM SCANNER (fallback quando WS parado por >60s) =====
let ultPayout = 0;
let maxPayoutRodada = 0;

setInterval(() => {
    // Só usa DOM se WS ficou >60s sem enviar
    if (Date.now() - ultimoEnvioWS <= 60000) return;

    const el = document.querySelector('.payout, [class*="payout"], [class*="multiplier"]');
    if (!el) return;
    const m = el.textContent.match(/(\d+[.,]\d*)x?/);
    if (!m) return;
    const mult = parseFloat(m[1].replace(',', '.'));
    if (isNaN(mult)) return;

    // Detecta transição: estava subindo, agora voltou a 1.xx = rodada acabou
    if (ultPayout >= 1.01 && mult <= 1.01 && maxPayoutRodada >= 1.01) {
        const rodada = rodadaCache || extrairRodada() || `dom-${Date.now()}`;
        console.log(`🔍 [DOM] ${maxPayoutRodada}x rodada ${rodada}`);
        enviarVela(maxPayoutRodada, rodada, null, "dom");
        maxPayoutRodada = 0;
    }
    if (mult > maxPayoutRodada) maxPayoutRodada = mult;
    ultPayout = mult;
}, 1000);
