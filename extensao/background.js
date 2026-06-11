const API_URL = "https://aviator-trader-quadrado.onrender.com/api/nova-vela";
const WS_URL = "wss://apiglobal.appbackend.tech/ws/signals/v2/aviator";

let ws = null;
let ultimoEnvioWS = 0;

function calcularSoma(mult) {
  const str = mult.toFixed(2).replace('.', '');
  let soma = 0;
  for (let i = 0; i < str.length && i < 3; i++) soma += parseInt(str[i]) || 0;
  return soma;
}

function enviarVela(mult, rodada, timestamp) {
  const multNum = parseFloat(mult);
  if (isNaN(multNum) || multNum <= 0) return;
  const agora = Date.now();
  if (agora - ultimoEnvioWS < 500) return;
  ultimoEnvioWS = agora;

  const horario = timestamp || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });

  [1, 2].forEach(painel => {
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        painel, multiplicador: multNum,
        rodada: String(rodada) + (painel === 2 ? '_2' : ''),
        timestamp: horario,
        soma: calcularSoma(multNum),
        fonte: "ws-sortenabet"
      })
    }).then(r => r.json()).then(d => {
      if (d.ok) console.log(`[BG] ✅ Painel ${d.painel}: ${multNum}x`);
    }).catch(e => console.warn('[BG] Erro envio:', e.message));
  });

  // Keep-alive: pinga o servidor a cada envio bem-sucedido
  chrome.alarms.get('wsPing', () => {});
}

function conectarWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => console.log('[BG] ✅ WS conectado');
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.casa !== 'sortenabet') return;
        const mult = parseFloat(msg.data?.valor);
        if (isNaN(mult) || mult <= 0) return;
        const rodada = msg.data?.rodada || msg.data?.id || `ws-${Date.now()}`;
        const timestamp = msg.data?.createdAt
          ? new Date(msg.data.createdAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })
          : null;
        console.log(`[BG] 🎯 SINAL: ${mult}x rodada ${rodada}`);
        enviarVela(mult, rodada, timestamp);
      } catch (ex) { console.warn('[BG] Erro parse:', ex); }
    };
    ws.onclose = () => { console.log('[BG] WS fechado'); ws = null; };
    ws.onerror = () => { if (ws) { ws.close(); ws = null; } };
  } catch (e) { console.warn('[BG] Erro WS:', e); ws = null; }
}

// ── ALARMS: keep-alive + reconexão WS ──
chrome.alarms.create('wsPing', { periodInMinutes: 4 });
chrome.alarms.create('wsCheck', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wsPing') {
    fetch("https://aviator-trader-quadrado.onrender.com/api/status").catch(() => {});
  }
  if (alarm.name === 'wsCheck') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[BG] WS offline — reconectando');
      conectarWS();
    }
  }
});

// Inicia na instalação e no startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[BG] Extensão Sortenabet Aviator instalada');
  conectarWS();
});

chrome.runtime.onStartup.addListener(() => {
  conectarWS();
});

// Inicia imediatamente
conectarWS();
console.log('[BG] Service Worker ativo');
