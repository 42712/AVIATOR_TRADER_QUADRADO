// content.js - VR5 Connector v3 (Seletores corrigidos para TipMiner atual)
console.log('🔍 VR5 Connector v3 ativo na página do TipMiner');

const HISTORY_KEY = 'aviator_vr5_historico_tipminer';

function tentarSeletores() {
    const tentativas = [
        '.round-history .cell',
        '.cell.cell--crash',
        '.cell',
        '.round-history [class*="cell"]',
        '[class*="round-history"] [class*="cell"]',
        '[class*="data-temperature"]',
    ];
    for(const sel of tentativas){
        const els = document.querySelectorAll(sel);
        if(els.length > 0){
            console.log(`✅ Seletor funcionou: "${sel}" → ${els.length} elementos`);
            return { seletor: sel, elementos: els };
        }
    }
    return null;
}

function extrairMultiplicador(el){
    // Seletor principal do TipMiner atual
    const main = el.querySelector('.cell__multiplier');
    if(main && main.innerText){
        let txt = main.innerText.trim().replace(',','.').replace(/[xX]\s*$/, '').replace(/^\s*[xX]/, '');
        const v = parseFloat(txt);
        if(!isNaN(v) && v > 0) return v;
    }
    // Fallbacks
    const sels = ['.cell__result','.result','.multiplier','[class*="result"]','[class*="mult"]','[class*="multiplier"]'];
    for(const s of sels){
        const d = el.querySelector(s);
        if(d && d.innerText){
            let txt = d.innerText.trim().replace(',','.').replace(/[xX]\s*$/, '');
            const v = parseFloat(txt);
            if(!isNaN(v) && v > 0) return v;
        }
    }
    // Fallback: pega o primeiro número do texto do elemento
    const txt = el.innerText || '';
    const m = txt.match(/(\d+[,.]?\d*)\s*[xX]/);
    if(m) return parseFloat(m[1].replace(',','.'));
    return null;
}

function extrairRodada(el){
    // Tenta data-attribute primeiro
    const dataRound = el.getAttribute('data-round') || el.getAttribute('data-id');
    if(dataRound) return dataRound;

    const sels = ['.cel__index_round','.round-number','[class*="round"]','[class*="index"]','.cell__index'];
    for(const s of sels){
        const d = el.querySelector(s);
        if(d && d.innerText) return d.innerText.trim();
    }

    // Tenta extrair número do próprio texto do elemento (ex: "Rodada 12345")
    const txt = el.innerText || '';
    const rm = txt.match(/[Rr]odada\s*[:#]?\s*(\d+)/);
    if(rm) return rm[1];
    return null;
}

function extrairHorario(el){
    const sels = ['.cell__date','time','.date','.hora','[class*="date"]','[class*="time"]','[class*="hora"]'];
    for(const s of sels){
        const d = el.querySelector(s);
        if(d && d.innerText) return d.innerText.trim();
    }
    // Fallback: procura padrão HH:MM no texto do elemento
    const txt = el.innerText || '';
    const hm = txt.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
    if(hm) return hm[1];
    return null;
}

function extrairRodadasCompletas() {
    const rodadas = [];

    const resultado = tentarSeletores();
    if(!resultado){
        console.warn('⚠️ Nenhum seletor encontrou rodadas. Tentando via texto da página...');
        return extrairFallbackTexto();
    }

    const { elementos } = resultado;
    const elementosArray = Array.from(elementos);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let timestampAtual = new Date(hoje);

    elementosArray.forEach((el, idx) => {
        const mult = extrairMultiplicador(el);
        const numRodada = extrairRodada(el);
        const horarioRaw = extrairHorario(el);

        let timestamp = null;
        if(horarioRaw){
            const partes = horarioRaw.split(':');
            if(partes.length >= 2){
                const t = new Date(hoje);
                t.setHours(parseInt(partes[0])||0, parseInt(partes[1])||0, parseInt(partes[2])||0, 0);
                if(!isNaN(t.getTime())) timestamp = t;
            }
        }
        if(!timestamp){
            timestamp = new Date(timestampAtual);
            timestampAtual = new Date(timestampAtual.getTime() + 45000);
        }

        if(mult && !isNaN(mult) && mult > 0){
            rodadas.push({
                val: mult,
                score: 0,
                delta: 0,
                time: timestamp.toISOString(),
                rodada: numRodada
            });
        }
    });

    if(rodadas.length === 0) return extrairFallbackTexto();

    calcularScoresVR5(rodadas);
    console.log(`✅ Extraídas ${rodadas.length} rodadas com scores VR5 (seletor: "${resultado.seletor}")`);
    return rodadas;
}

function extrairFallbackTexto(){
    const rodadas = [];
    const allText = document.body.innerText || '';
    const regex = /(\d{1,4}[,.]?\d{0,2})\s*[xX]/g;
    const matches = [...allText.matchAll(regex)];

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    let ts = new Date(hoje);

    matches.forEach((m, idx) => {
        const v = parseFloat(m[1].replace(',','.'));
        if(!isNaN(v) && v >= 1 && v <= 10000){
            rodadas.push({
                val: v, score: 0, delta: 0,
                time: new Date(ts.getTime() + idx*45000).toISOString(),
                rodada: null
            });
        }
    });

    if(rodadas.length > 0){
        console.warn(`⚠️ Fallback texto: ${rodadas.length} multiplicadores encontrados`);
        calcularScoresVR5(rodadas);
    } else {
        console.error('❌ Impossível extrair dados. O layout do TipMiner pode ter mudado.');
    }
    return rodadas;
}

function calcularScoresVR5(rodadas){
    let score = 0;
    let ultimoFoi10 = false;
    rodadas.forEach(r => {
        if(r.val >= 10){
            r.delta = ultimoFoi10 ? 1 : 10;
            ultimoFoi10 = true;
        } else {
            r.delta = -1;
            ultimoFoi10 = false;
        }
        score += r.delta;
        r.score = score;
    });
}

function salvarNoLocalStorage(rodadas) {
    const dados = rodadas.map(r => ({
        val: r.val,
        score: r.score,
        delta: r.delta,
        time: r.time,
        rodada: r.rodada
    }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(dados));
    localStorage.setItem('vr5_total_rodadas', String(dados.length));
    console.log(`💾 ${dados.length} rodadas salvas (chave: ${HISTORY_KEY})`);

    try{
        window.dispatchEvent(new CustomEvent('vr5_dados_atualizados', {
            detail: { total: dados.length, timestamp: new Date().toISOString() }
        }));
    }catch(e){}
    return dados;
}

function processarPagina() {
    console.log('🔄 Processando página do TipMiner...');
    const rodadas = extrairRodadasCompletas();
    if(rodadas.length === 0){
        console.error('❌ Nenhuma rodada encontrada!');
        mostrarNotificacao(0, true);
        return null;
    }
    const salvos = salvarNoLocalStorage(rodadas);

    try{
        chrome.runtime.sendMessage({ type: 'NOVAS_RODADAS', dados: salvos });
    }catch(e){}

    mostrarNotificacao(rodadas.length, false);
    return salvos;
}

function mostrarNotificacao(total, erro) {
    const notif = document.createElement('div');
    notif.textContent = erro
        ? '⚠️ VR5 Connector: nenhuma rodada encontrada. Recarregue a página.'
        : `✅ VR5 v3: ${total} rodadas salvas! Painel VR5 atualizado automaticamente.`;
    notif.style.cssText = `
        position:fixed;bottom:20px;right:20px;
        background:${erro?'#ef4444':'#10b981'};
        color:white;padding:10px 16px;border-radius:8px;
        font-family:monospace;font-size:12px;
        z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);
        transition:opacity .5s;
    `;
    document.body.appendChild(notif);
    setTimeout(()=>{ notif.style.opacity='0'; }, 3000);
    setTimeout(()=>{ notif.remove(); }, 3800);
}

// ─── Inicialização ───────────────────────────────────────────────
(function init(){
    // Aguarda a página carregar e os dados da API chegarem
    const tentarInicializar = (tentativa = 0) => {
        const resultado = tentarSeletores();
        if(resultado && resultado.elementos.length > 0){
            console.log(`🎯 Inicializando com ${resultado.elementos.length} células encontradas`);
            setTimeout(processarPagina, 500);
        } else if(tentativa < 20){
            // Tenta novamente em 1.5s (dados da API podem demorar)
            console.log(`⏳ Aguardando dados da API... tentativa ${tentativa+1}/20`);
            setTimeout(() => tentarInicializar(tentativa + 1), 1500);
        } else {
            console.warn('⚠️ Timeout: dados não encontrados após 30s. Tentando fallback...');
            processarPagina();
        }
    };

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', () => setTimeout(() => tentarInicializar(), 2000));
    } else {
        setTimeout(() => tentarInicializar(), 2000);
    }
})();

// Observa novas rodadas na página (mutation observer mais inteligente)
let _ultimoTotal = 0;
let _debounceTimer = null;
const observer = new MutationObserver(() => {
    // Debounce: espera 1s de inatividade antes de processar
    if(_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
        const resultado = tentarSeletores();
        const total = resultado ? resultado.elementos.length : 0;
        if(total > 0 && total !== _ultimoTotal){
            _ultimoTotal = total;
            console.log('🔄 Novas rodadas detectadas:', total);
            processarPagina();
        }
    }, 1000);
});
observer.observe(document.body, { childList: true, subtree: true });

// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if(request.action === 'extrairAgora'){
        const dados = processarPagina();
        sendResponse({ success: dados !== null, total: dados?.length || 0 });
    }
    return true;
});
