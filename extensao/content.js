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
const MAX_ENVIADAS = 500;

function enviarVela(mult, rodada, timestamp, origem) {
    const multNum = parseFloat(mult);
    if (isNaN(multNum) || multNum <= 0) return;
    const painel = detectarAviator();
    const chave = painel + '_' + rodada;
    if (enviadas.has(chave)) return;
    enviadas.add(chave);
    // Limpa set antigo
    if (enviadas.size > MAX_ENVIADAS) {
        const it = enviadas.values();
        for (let i = 0; i < 200; i++) { enviadas.delete(it.next().value); }
    }

    const horario = timestamp || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            painel, multiplicador: multNum,
            rodada: rodada.toString(), timestamp: horario,
            soma: calcularSoma(multNum), fonte: origem || "sortenabet"
        })
    }).then(r => r.json()).then(d => {
        if (d.ok) console.log(`✅ [AVIATOR ${painel}] ${multNum}x rodada ${rodada}`);
    }).catch(() => {});
}

let rodadaCache = null;

function extrairRodada() {
    const modalSpan = document.querySelector('app-fairness span.text-uppercase');
    if (modalSpan) {
        const match = modalSpan.textContent.match(/Rodada\s+(\d+)/);
        if (match) return match[1];
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        const match = node.textContent.match(/Rodada\s+(\d+)/);
        if (match) return match[1];
    }
    for (const iframe of document.querySelectorAll('iframe')) {
        try {
            if (!iframe.contentDocument) continue;
            const w = iframe.contentDocument.createTreeWalker(iframe.contentDocument.body, NodeFilter.SHOW_TEXT, null, false);
            let n;
            while ((n = w.nextNode())) {
                const m = n.textContent.match(/Rodada\s+(\d+)/);
                if (m) return m[1];
            }
        } catch(e) {}
    }
    const roundEl = document.querySelector('[class*="round" i], [data-round], game-round-id');
    if (roundEl) return roundEl.getAttribute('data-round') || roundEl.textContent.trim();
    return null;
}

setInterval(() => { const r = extrairRodada(); if (r) rodadaCache = r; }, 300);
extrairRodada();

// ═══ LISTENER para eventos do main-world.js (WebSocket proxy + DOM scan) ═══
window.addEventListener('aviator-ws-data', (e) => {
    try {
        const msg = JSON.parse(e.detail);
        const mult = parseFloat(msg.data?.valor || msg.valor || msg.multiplier);
        if (isNaN(mult) || mult <= 0) return;
        const rodada = msg.data?.rodada || msg.rodada || rodadaCache || `ws-${Date.now()}`;
        enviarVela(mult, rodada, null, "ws-page");
    } catch(ex) {}
});

// ═══ DOM SCANNER (fallback) ═══
let ultPayout = 0, maxPayoutRodada = 0;

setInterval(() => {
    const el = document.querySelector('.payout');
    if (!el) return;
    const m = el.textContent.match(/(\d+\.?\d*)x/);
    if (!m) return;
    const mult = parseFloat(m[1]);
    if (isNaN(mult)) return;
    if (ultPayout >= 1.01 && mult <= 1.00 && maxPayoutRodada >= 1.01) {
        const rodada = rodadaCache || extrairRodada() || `dom-${Date.now()}`;
        enviarVela(maxPayoutRodada, rodada, null, "dom");
    }
    if (mult > maxPayoutRodada) maxPayoutRodada = mult;
    ultPayout = mult;
}, 1000);
