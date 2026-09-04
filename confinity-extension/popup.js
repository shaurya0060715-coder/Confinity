document.getElementById('go').addEventListener('click', () => {
  const q = encodeURIComponent((document.getElementById('search') || {}).value || '');
  if (!q) return;
  const url = `https://search.brave.com/search?q=${q}`;
  chrome.tabs.create({ url });
});

document.getElementById('openTabGroup').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const ids = tabs.map(t=>t.id).slice(0,4).filter(Boolean);
  chrome.runtime.sendMessage({ action: 'createGroup', tabIds: ids, title: 'Confinity' });
});

document.getElementById('openOptions').addEventListener('click', ()=>{
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); else window.open('options.html');
});
