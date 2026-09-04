// Background service worker (placeholder)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ai-assist', title: 'Ask AI about this page', contexts: ['page'] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ai-assist') {
    // Placeholder: send page URL to AI API (requires API key from user)
    chrome.storage.local.get(['aiApiKey'], (res) => {
      if (!res.aiApiKey) {
        chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title: 'AI key missing', message: 'Configure AI API key in extension settings.' });
        return;
      }
      // implement AI call here
    });
  }
});

// Tab groups helper (uses chrome.tabs.group when available)
async function createTabGroup(tabIds, title) {
  if (chrome.tabs.group) {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title });
  }
}

// Load declarativeNetRequest rules on install
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const rules = await fetch(chrome.runtime.getURL('declarative_rules.json')).then(r=>r.json());
    chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds: rules.map(r=>r.id), addRules: rules});
    // store applied ids for later management
    chrome.storage.local.set({appliedRuleIds: rules.map(r=>r.id)});
  } catch (e) { console.error('Failed to load dNR rules', e) }
});

// Message-based rule pack installer/remover (triggered from rule_manager.html)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'applyRulePack' && msg.url){
    fetch(msg.url).then(r=>r.json()).then(async (rules) => {
      try {
        const newIds = rules.map(r=>r.id);
        // remove previously applied ids if any
        chrome.storage.local.get(['appliedRuleIds'], async (res) => {
          const prev = (res && res.appliedRuleIds) || [];
          try {
            await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: prev, addRules: rules });
            chrome.storage.local.set({ appliedRuleIds: newIds }, ()=> sendResponse({ success:true, installed: rules.length }));
          } catch (e){ console.error(e); sendResponse({ success:false, error: String(e) }); }
        });
      } catch (e){ console.error(e); sendResponse({ success:false, error: String(e) }); }
    }).catch(e=>{ sendResponse({ success:false, error: String(e) }) });
    return true; // indicate async response
  }
  if (msg.action === 'removeRulePack'){
    chrome.storage.local.get(['appliedRuleIds'], (res)=>{
      const prev = (res && res.appliedRuleIds) || [];
      chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: prev, addRules: [] });
      chrome.storage.local.set({ appliedRuleIds: [] }, ()=> sendResponse({ success:true }));
    });
    return true;
  }
});
