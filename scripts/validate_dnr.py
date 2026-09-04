#!/usr/bin/env python3
"""
Validate declarative_rules.json for schema sanity and duplicate IDs.
Usage: python scripts\validate_dnr.py path\to\declarative_rules.json
Exits with code 0 on success, 1 on failure.
"""
import sys, json, re

def load(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def validate(rules):
    ok = True
    ids = [r.get('id') for r in rules]
    if len(ids) != len(set(ids)):
        print('ERROR: Duplicate ids detected')
        ok = False
    for r in rules:
        if not isinstance(r.get('id'), int):
            print('ERROR: id must be int', r)
            ok = False
        if 'action' not in r or 'type' not in r['action']:
            print('ERROR: missing action.type', r.get('id'))
            ok = False
        cond = r.get('condition')
        if not cond or 'urlFilter' not in cond:
            print('ERROR: missing condition.urlFilter', r.get('id'))
            ok = False
        if 'resourceTypes' in cond and not isinstance(cond['resourceTypes'], list):
            print('ERROR: resourceTypes must be list', r.get('id'))
            ok = False
    return ok

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: validate_dnr.py path/to/declarative_rules.json')
        sys.exit(1)
    path = sys.argv[1]
    try:
        rules = load(path)
    except Exception as e:
        print('Failed to load JSON:', e)
        sys.exit(1)
    ok = validate(rules)
    if not ok:
        print('Validation failed')
        sys.exit(1)
    print('Validation succeeded')
    sys.exit(0)
