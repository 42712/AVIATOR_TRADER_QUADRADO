const API_URL = "https://aviator-trader-quadrado.onrender.com/api/nova-vela";
const WS_URL = "wss://apiglobal.appbackend.tech/ws/signals/v2/aviator";

let ws = null;
let reconnectTimer = null;
let ultimoEnvioWS = 0;

function calcularSoma(mult) {
  const str = mult.toFixed(2).replace('.', '');
  let soma = 0;
  for (let i = 0; i < str.length && i < 3; i++) soma += parseInt(str[i]) || 0;
  return soma;
}

function enviarVela(mult, rodada, timestamp, origem) {
  const multNum = parseFloat(mult);
  if (isNaN(multNum) || multNum <= 0) return;
  if (Date.now() - ultimoEnvioWS < 500) return; // anti-duplicata 500ms
  ultimoEnvioWS = Date.now();

  const horario = timestamp || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      painel: 1, multiplicador: multNum,
      rodada: String(rodada), timestamp: horario,
      soma: calcularSoma(multNum), fonte: origem || "sortenabet"
    })
  }).then(r => r.json()).then(d => {
    if (d.ok) console.log(`[BG] ✅ Painel ${d.painel}: ${multNum}x rodada ${rodada}`);
  }).catch(e => console.warn('[BG] Erro envio:', e.message));

  // Tenta também painel 2 com rodada diferente
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      painel: 2, multiplicador: multNum,
      rodada: String(rodada) + '_2', timestamp: horario,
      soma: calcularSoma(multNum), fonte: origem || "sortenabet"
    })
  }).then(r => r.json()).then(d => {
    if (d.ok) console.log(`[BG] ✅ Painel ${d.painel}: ${multNum}x`);
  }).catch(() => {});
}

function conectarWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => console.log('[BG] ✅ WS conectado — capturando sinais');
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
        enviarVela(mult, rodada, timestamp, "ws-sortenabet");
      } catch (ex) { console.warn('[BG] Erro parse WS:', ex); }
    };
    ws.onclose = () => { console.log('[BG] WS fechado — reconectando em 5s'); ws = null; if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = setTimeout(conectarWS, 5000); };
    ws.onerror = () => { if (ws) ws.close(); };
  } catch (e) { console.warn('[BG] Erro WS:', e); if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = setTimeout(conectarWS, 5000); }
}

// Inicia WebSocket
conectarWS();

// Keep-alive: pinga servidor a cada 4 minutos
setInterval(() => {
  fetch("https://aviator-trader-quadrado.onrender.com/api/status").catch(() => {});
}, 4 * 60 * 1000);

// Reconecta WS se ficar parado por 2min
setInterval(() => {
  if (Date.now() - ultimoEnvioWS > 120000 && (!ws || ws.readyState !== WebSocket.OPEN)) {
    console.log('[BG] WS inativo — reconectando');
    conectarWS();
  }
}, 60 * 1000);

chrome.runtime.onInstalled.addListener(() => {
  console.log('[BG] Extensão Sortenabet Aviator iniciada — capturando dados 24h');
});

console.log('[BG] Service Worker ativo — aguardando sinais do WebSocket');
