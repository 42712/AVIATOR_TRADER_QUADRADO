// background.js - VR5 Connector v3
let dadosAtuais = [];

chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ VR5 Connector v3 instalado!');
    chrome.storage.local.set({
        vr5_dados: [],
        vr5_ultima_atualizacao: null,
        vr5_total: 0,
        vr5_painel_url: ''
    });
});

// ─── Injeta dados no painel (aberto como página da extensão) ──────────
function injetarNoPainel(dados) {
    chrome.tabs.query({}, (tabs) => {
        const painelTab = tabs.find(t =>
            t.url && (t.url.includes('painel_vr5') || t.url.includes('vr5-connector') || t.url.startsWith('chrome-extension://'))
        );
        if(painelTab) {
            chrome.tabs.sendMessage(painelTab.id, {
                type: 'VR5_DADOS_ATUALIZADOS',
                dados: dados
            }).catch(() => {
                // fallback: tenta via scripting
                chrome.scripting.executeScript({
                    target: { tabId: painelTab.id },
                    func: (d) => {
                        localStorage.setItem('aviator_vr5_historico_tipminer', JSON.stringify(d));
                        window.dispatchEvent(new CustomEvent('vr5_dados_atualizados', { detail: { total: d.length } }));
                    },
                    args: [dados]
                }).catch(() => {});
            });
        }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message.type === 'NOVAS_RODADAS'){
        dadosAtuais = message.dados;
        chrome.storage.local.set({
            vr5_dados: dadosAtuais,
            vr5_ultima_atualizacao: new Date().toISOString(),
            vr5_total: dadosAtuais.length
        }, () => {
            console.log(`💾 ${dadosAtuais.length} rodadas salvas`);
        });
        // ✅ CORRIGIDO: injeta automaticamente no painel a cada novo lote de dados
        injetarNoPainel(dadosAtuais);
        sendResponse({ success: true, total: dadosAtuais.length });
        return true;
    }

    if(message.type === 'SOLICITAR_DADOS'){
        sendResponse({ dados: dadosAtuais });
        return true;
    }

    if(message.type === 'INJETAR_NO_PAINEL'){
        injetarNoPainel(dadosAtuais);
        sendResponse({ success: true, total: dadosAtuais.length });
        return true;
    }

    if(message.type === 'ABRIR_PAINEL'){
        const painelUrl = chrome.runtime.getURL('painel_vr5_v15_CORRIGIDO.html');
        chrome.tabs.create({ url: painelUrl }, () => {
            sendResponse({ success: true, url: painelUrl });
        });
        return true;
    }

    return true;
});
