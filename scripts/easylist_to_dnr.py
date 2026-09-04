#!/usr/bin/env python3
"""
Convert a filtered EasyList text file or remote URL into a declarativeNetRequest JSON pack.
Usage:
  python scripts\easylist_to_dnr.py --input easylist.filtered.txt --max 5000 --output confinity-extension\declarative_rules.json
  python scripts\easylist_to_dnr.py --url https://example.com/easylist.txt --max 1000 --output confinity-extension\declarative_rules.json

Notes:
- This script only extracts host-style rules beginning with ||domain^ and converts them to simple dNR rules.
- Large packs may exceed MV3 limits. Use --max to cap number of rules.
- Requires 'requests' for --url mode: pip install requests
"""
import argparse
import json
import re

try:
    import requests
except Exception:
    requests = None

LINE_RE = re.compile(r"^\|\|([\w.-]+)\^")


def parse_lines(lines, max_rules):
    rules = []
    seen = set()
    i = 1
    for line in lines:
        line = line.strip()
        if not line or line.startswith('!') or line.startswith('['):
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        domain = m.group(1).lower()
        if domain in seen:
            continue
        seen.add(domain)
        rule = {
            'id': i,
            'priority': 1,
            'action': {'type': 'block'},
            'condition': {'urlFilter': f'||{domain}^', 'resourceTypes': ['script','image','xmlhttprequest']}
        }
        rules.append(rule)
        i += 1
        if max_rules and i > max_rules:
            break
    return rules


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', help='Local EasyList filtered file')
    p.add_argument('--url', help='Remote EasyList URL (requires requests)')
    p.add_argument('--max', type=int, default=1000, help='Maximum number of rules to output')
    p.add_argument('--output', default='declarative_rules.json', help='Output path')
    args = p.parse_args()

    if not args.input and not args.url:
        p.error('Either --input or --url is required')

    if args.url:
        if not requests:
            print('requests not available. Install with pip install requests')
            return
        r = requests.get(args.url, timeout=30)
        r.raise_for_status()
        lines = r.text.splitlines()
    else:
        with open(args.input, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

    rules = parse_lines(lines, args.max)
    with open(args.output, 'w', encoding='utf-8') as out:
        json.dump(rules, out, indent=2)
    print(f'Wrote {len(rules)} rules to {args.output}')


if __name__ == '__main__':
    main()
