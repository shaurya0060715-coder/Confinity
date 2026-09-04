Developer notes — Confinity Companion extension

Files:
- manifest.json: MV3 manifest; includes options_ui and declarativeNetRequest permission
- background.js: service worker — loads dNR rules and creates context menu for AI
- declarative_rules.json: curated blocking rules (small subset derived from common EasyList entries)
- options.html: stores AI API key in chrome.storage.local

Testing (Chrome / Edge Developer Mode):
1. Open chrome://extensions (or edge://extensions) and enable Developer mode (top-right).
2. Click 'Load unpacked' and choose the folder: c:\Users\prabh\OneDrive\Documents\Confinity_Dashboard\confinity-extension
3. After loading, open the extension Details and verify that "Site access" and "Allow access to file URLs" are set as required.
4. Open the Options (click the extension action -> Settings or from chrome://extensions click 'Details' -> 'Extension options') and set an AI API key if you plan to test the AI integration.
5. Verify dNR rules applied: in the extension's page in chrome://extensions click 'Service worker' -> 'Inspect views' (or open DevTools for the extension background) and check console for the "Failed to load dNR rules" error or success messages. Alternatively, open chrome://net-internals or use the extension UI to attempt blocking a known tracker domain from the list.

Notes on declarativeNetRequest and rule lists:
- Chrome MV3 limits dynamic + static dNR rules to a platform-dependent limit (commonly 30k rules but can be lower depending on manifest). Large EasyList files will exceed the limits. Use a curated subset or a remote service.
- Recommended workflow to incorporate EasyList segments safely:
  1. Identify the most-impactful host patterns (top ad/tracker domains) and convert them into dNR JSON rules as shown in declarative_rules.json.
  2. Use a build-time script to convert a trimmed EasyList file into a set of dNR rules and split into smaller groups if needed.
  3. Consider delegating large-scale blocking to a native solution (system-level hosts file, local proxy) or use an external native messaging host if you need full EasyList coverage.

Example small Python transform (trim + convert to dNR entries):

```python
# read easylist.txt (pre-filtered), convert lines like ||example.com^ to dNR rules
import json
rules=[]
with open('easylist.filtered.txt') as f:
    i=1
    for line in f:
        line=line.strip()
        if not line or line.startswith('!'):
            continue
        if line.startswith('||'):
            domain=line.split('^')[0]
            rules.append({
                'id': i,
                'priority': 1,
                'action': {'type': 'block'},
                'condition': {'urlFilter': domain+'^','resourceTypes':['script','image','xmlhttprequest']}
            })
            i+=1
with open('declarative_rules.json','w') as out:
    json.dump(rules, out, indent=2)
```

Warnings and best practices:
- Test rules carefully — overly broad urlFilter values may block legitimate content.
- MV3 has a size limit for the extension package — very large rule files increase package size and may slow loading.
- Consider enabling an options toggle to let users opt into a "strict blocking" pack which you download dynamically (via permission and user consent) and apply in chunks.

Next steps I can take for you:
- Create a build-time converter that downloads a curated EasyList slice and converts it into dNR rules (implemented as scripts\easylist_to_dnr.py; you must run it locally).
- Provide sample trimmed EasyList slices suitable for inclusion in declarative_rules.json (I can prepare small, high-impact lists).
- Add UI in the extension for updating/refreshing rule packs with user consent (implemented as rule_manager.html).

Usage examples:
- Trim and convert a local EasyList extract:
  python scripts\easylist_to_dnr.py --input easylist.filtered.txt --max 2000 --output confinity-extension\declarative_rules.json
- Validate existing rules:
  python scripts\validate_dnr.py confinity-extension\declarative_rules.json
- Load the extension in Chrome/Edge dev mode and open the rule manager (Options -> Manage rule packs) to install larger packs with consent.

