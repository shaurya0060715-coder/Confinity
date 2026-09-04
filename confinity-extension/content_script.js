// Content script placeholder for limited UI customizations (won't change main GUI)
console.log('Confinity content script loaded');
// Example: add a small toolbar button in page (not changing browser chrome)
const btn = document.createElement('button');
btn.textContent = 'Ask AI';
btn.style.position = 'fixed';
btn.style.bottom = '12px';
btn.style.right = '12px';
btn.style.zIndex = 2147483647;
btn.addEventListener('click', () => { chrome.runtime.sendMessage({ action: 'aiRequest', url: location.href }); });
document.documentElement.appendChild(btn);
