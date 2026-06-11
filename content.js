// CAPTURADOR SORTENABET - AVIATOR 1 e 2
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
    const chave = painel + '_' + rodada + '_' + multNum.toFixed(2);
    if (enviadas.has(chave)) return;
    enviadas.add(chave);

    const horario = timestamp || new Date().toLocaleTimeString('pt-BR');

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            painel: painel,
            multiplicador: multNum,
            rodada: rodada.toString(),
            timestamp: horario,
            soma: calcularSoma(multNum),
            fonte: origem || "sortenabet"
        })
    })
    .then(r => r.json())
    .then(d => {
        if (d.ok) console.log(`✅ [AVIATOR ${painel}] ${multNum}x rodada ${rodada} enviada`);
    })
    .catch(err => console.log('❌ Erro ao enviar:', err));
}

let rodadaCache = null;
let ultimoMultEnviado = null;
let ultimaRodadaEnviada = null;

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

setInterval(() => {
    const r = extrairRodada();
    if (r) rodadaCache = r;
}, 300);
extrairRodada();

function formatarTimestamp(isoStr) {
    if (!isoStr) return null;
    try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
    } catch (e) {
        return null;
    }
}

// ===== WEBSOCKET =====
let ultimoEnvioWS = 0;

function conectarWS() {
    try {
        const ws = new WebSocket("wss://apiglobal.appbackend.tech/ws/signals/v2/aviator");
        ws.onopen = () => console.log("✅ WS Conectado ao Aviator");
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.casa !== 'sortenabet') return;

                const mult = parseFloat(msg.data?.valor);
                if (isNaN(mult) || mult <= 0) return;

                const rodada = rodadaCache || extrairRodada() || `ws-${Date.now()}`;
                const timestamp = formatarTimestamp(msg.data.createdAt);

                console.log(`🎯 SINAL WS: ${mult}x rodada ${rodada}`);
                enviarVela(mult, rodada, timestamp, "ws-sortenabet");
                ultimoEnvioWS = Date.now();
                ultimoMultEnviado = mult;
                ultimaRodadaEnviada = rodada;
            } catch (ex) {
                console.log('Erro WS:', ex);
            }
        };
        ws.onclose = () => {
            console.log("WS desconectado, reconectando em 5s...");
            setTimeout(conectarWS, 5000);
        };
        ws.onerror = (err) => {
            console.log("WS erro:", err);
            ws.close();
        };
    } catch (e) {
        console.log("Erro ao criar WS:", e);
        setTimeout(conectarWS, 5000);
    }
}
conectarWS();

// ===== DOM SCANNER (fallback) =====
let ultPayout = 0;
let maxPayoutRodada = 0;

setInterval(() => {
    const elements = document.querySelectorAll('.payout, [class*="multiplier"], [class*="Multiplier"], .bubble-multiplier');
    for (const el of elements) {
        const m = el.textContent.match(/(\d+\.?\d*)x/);
        if (!m) continue;
        const mult = parseFloat(m[1]);
        if (isNaN(mult)) continue;

        if (mult === 1.01 && maxPayoutRodada >= 1.01 && ultimoMultEnviado !== maxPayoutRodada) {
            const rodada = rodadaCache || extrairRodada() || `dom-${Date.now()}`;
            if (ultimaRodadaEnviada !== rodada) {
                console.log(`🎯 DOM SCANNER: ${maxPayoutRodada}x rodada ${rodada}`);
                enviarVela(maxPayoutRodada, rodada, null, "dom-scanner");
                ultimoMultEnviado = maxPayoutRodada;
                ultimaRodadaEnviada = rodada;
            }
            maxPayoutRodada = 0;
        }
        
        if (mult > maxPayoutRodada && mult > 1.01) {
            maxPayoutRodada = mult;
        }
        ultPayout = mult;
        break;
    }
}, 800);

// ===== PING INICIAL PARA TESTAR =====
fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        painel: 1,
        multiplicador: 1.01,
        rodada: "TESTE_CONEXAO",
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        soma: 2,
        fonte: "teste"
    })
})
.then(r => r.json())
.then(d => console.log('📡 Teste de conexão com servidor:', d.ok ? 'OK' : 'FALHOU'))
.catch(err => console.log('❌ Servidor não respondeu:', err));

console.log("🚀 Extensão Sortenabet Aviator INICIADA - Servidor:", API_URL);
