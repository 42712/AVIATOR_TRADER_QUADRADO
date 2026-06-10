// popup.js - VR5 Connector v3
document.addEventListener('DOMContentLoaded', () => {
    const btnAbrirPainel = document.getElementById('btnAbrirPainel');
    const btnExtrair = document.getElementById('btnExtrair');
    const btnExportar = document.getElementById('btnExportar');
    const btnCopiar = document.getElementById('btnCopiar');
    const btnLimparStorage = document.getElementById('btnLimparStorage');
    const successMsg = document.getElementById('successMsg');

    carregarStatus();
    setInterval(carregarStatus, 2000);

    // ─── ABRIR PAINEL ─────────────────────────────────────────
    btnAbrirPainel.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'ABRIR_PAINEL' }, (resp) => {
            if(resp?.success){
                mostrarMensagem('🖥️ Painel VR5 aberto em nova aba!', '#22c55e');
            } else {
                // fallback: abre o painel diretamente como href
                const url = chrome.runtime.getURL('painel_vr5_v15_CORRIGIDO.html');
                chrome.tabs.create({ url: url });
                mostrarMensagem('🖥️ Painel aberto!', '#22c55e');
            }
        });
    });

    // ─── EXTRAIR ───────────────────────────────────────────────
    btnExtrair.addEventListener('click', () => {
        mostrarMensagem('⏳ Extraindo dados do TipMiner...', '#f59e0b');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url || '';
            if(!url.includes('tipminer.com')){
                mostrarMensagem('⚠️ Abra tipminer.com/br/historico primeiro!', '#ef4444');
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { action: 'extrairAgora' }, (response) => {
                if(chrome.runtime.lastError || !response){
                    // Tenta injetar o content script
                    chrome.scripting.executeScript(
                        { target: { tabId: tabs[0].id }, files: ['content.js'] },
                        () => {
                            setTimeout(()=>{
                                chrome.tabs.sendMessage(tabs[0].id, { action: 'extrairAgora' }, (r2) => {
                                    if(r2?.success){
                                        mostrarMensagem(`✅ ${r2.total} rodadas extraídas!`, '#22c55e');
                                        setTimeout(carregarStatus, 800);
                                    } else {
                                        mostrarMensagem('❌ Falhou. Recarregue a página do TipMiner.', '#ef4444');
                                    }
                                });
                            }, 1500);
                        }
                    );
                    return;
                }
                if(response?.success){
                    mostrarMensagem(`✅ ${response.total} rodadas extraídas!`, '#22c55e');
                    setTimeout(carregarStatus, 800);
                } else {
                    mostrarMensagem('❌ Erro. Recarregue a página do TipMiner.', '#ef4444');
                }
            });
        });
    });

    // ─── EXPORTAR JSON ─────────────────────────────────────────
    btnExportar.addEventListener('click', () => {
        chrome.storage.local.get(['vr5_dados'], (result) => {
            const dados = result.vr5_dados || [];
            if(!dados.length){
                mostrarMensagem('⚠️ Extraia os dados primeiro!', '#f59e0b');
                return;
            }
            const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vr5_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            mostrarMensagem('✅ JSON exportado!', '#22c55e');
        });
    });

    // ─── COPIAR ARRAY ──────────────────────────────────────────
    btnCopiar.addEventListener('click', () => {
        chrome.storage.local.get(['vr5_dados'], (result) => {
            const dados = result.vr5_dados || [];
            if(!dados.length){
                mostrarMensagem('⚠️ Nenhum dado. Extraia primeiro!', '#f59e0b');
                return;
            }
            navigator.clipboard.writeText(JSON.stringify(dados)).then(() => {
                mostrarMensagem('✅ Copiado! Cole no Painel VR5 → botão 🔌 VR5 CONNECTOR', '#22c55e');
            });
        });
    });

    // ─── LIMPAR ────────────────────────────────────────────────
    btnLimparStorage.addEventListener('click', () => {
        if(confirm('Apagar todos os dados salvos?')){
            chrome.storage.local.set({ vr5_dados: [], vr5_total: 0, vr5_ultima_atualizacao: null }, () => {
                mostrarMensagem('🗑️ Dados removidos!', '#ef4444');
                setTimeout(carregarStatus, 500);
            });
        }
    });

    // ─── STATUS ────────────────────────────────────────────────
    function carregarStatus() {
        chrome.storage.local.get(['vr5_dados', 'vr5_ultima_atualizacao'], (result) => {
            const dados = result.vr5_dados || [];
            const total = dados.length;

            document.getElementById('totalRodadas').textContent = total;

            if(total > 0){
                const ultimo = dados[dados.length - 1];
                document.getElementById('scoreFinal').textContent = ultimo.score ?? 0;
                document.getElementById('ultimaVela').textContent = (parseFloat(ultimo.val)||0).toFixed(2) + 'x';

                const ult10 = dados.slice(-10);
                const ganhos = ult10.filter(r => (r.delta||0) > 0).length;
                document.getElementById('tendencia').textContent =
                    ganhos >= 7 ? '🚀 ALTA' : ganhos >= 5 ? '📈 SUBINDO' : ganhos >= 3 ? '➡️ NEUTRO' : '📉 BAIXA';

                document.getElementById('statusLed').className = 'led on';
                const t = result.vr5_ultima_atualizacao
                    ? new Date(result.vr5_ultima_atualizacao).toLocaleTimeString('pt-BR')
                    : '';
                document.getElementById('statusText').innerHTML = `✅ ${total} rodadas — ${t}`;
            } else {
                document.getElementById('scoreFinal').textContent = '0';
                document.getElementById('ultimaVela').textContent = '—';
                document.getElementById('tendencia').textContent = '—';
                document.getElementById('statusLed').className = 'led wait';
                document.getElementById('statusText').innerHTML = '⏳ Vá ao TipMiner e clique Extrair';
            }
        });
    }

    function mostrarMensagem(msg, cor) {
        successMsg.textContent = msg;
        successMsg.style.borderColor = cor;
        successMsg.style.color = cor;
        successMsg.style.background = cor + '18';
        successMsg.style.display = 'block';
        setTimeout(() => { successMsg.style.display = 'none'; }, 4000);
    }
});
