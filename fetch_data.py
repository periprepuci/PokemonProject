#!/usr/bin/env python3
"""
Descarga todos los datos de PokeAPI y los guarda en JSON locales.
Uso: python fetch_data.py
Requiere Python 3.8+, sin dependencias externas.
"""

import json, os, sys, time
from urllib.request import urlopen, Request
from urllib.error import HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed

DATA_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
WORKERS    = 16
BATCH_SIZE = 64
DELAY      = 0.08
TIMEOUT    = 12

def fetch_json(url, retries=3):
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers={'User-Agent': 'Pokedex/1.0'})
            with urlopen(req, timeout=TIMEOUT) as r:
                return json.loads(r.read())
        except HTTPError as e:
            if e.code == 429:
                wait = 2 ** (attempt + 1)
                print('\n  Rate-limit, esperando {}s...'.format(wait))
                time.sleep(wait)
            elif attempt == retries:
                raise
            else:
                time.sleep(0.4 * (attempt + 1))
        except Exception:
            if attempt == retries:
                raise
            time.sleep(0.4 * (attempt + 1))

def fetch_concurrent(urls, transform=None):
    results, errors = {}, []
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(fetch_json, url): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                data = future.result()
                results[url] = transform(data) if transform else data
            except Exception as e:
                errors.append((url, str(e)))
    return results, errors

def trim_pokemon(d):
    sprites = d.get('sprites') or {}
    other   = sprites.get('other') or {}
    return {
        'id':    d['id'],
        'name':  d['name'],
        'types': [{'type': {'name': t['type']['name']}} for t in d['types']],
        'stats': [{'base_stat': s['base_stat'], 'stat': {'name': s['stat']['name']}} for s in d['stats']],
        'abilities': [
            {'name': a['ability']['name'], 'is_hidden': a['is_hidden']}
            for a in d.get('abilities', [])
        ],
        'species': {'url': d['species']['url']} if d.get('species') else None,
        'sprites': {
            'front_default': sprites.get('front_default'),
            'other': {
                'official-artwork': {'front_default': (other.get('official-artwork') or {}).get('front_default')},
                'home':             {'front_default': (other.get('home') or {}).get('front_default')},
            }
        }
    }

def trim_species(d):
    return {
        'name': d['name'],
        'varieties': [
            {'pokemon': {'name': v['pokemon']['name'], 'url': v['pokemon']['url']}}
            for v in d['varieties']
        ]
    }

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def kb(path):
    return os.path.getsize(path) / 1024

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    t0 = time.time()

    # 1 -- Lista completa
    list_file = os.path.join(DATA_DIR, 'pokemon-list.json')
    if os.path.exists(list_file):
        all_pokemon = load_json(list_file)
        print('[1/4] Lista: {} Pokemon (ya descargada)'.format(len(all_pokemon)))
    else:
        print('[1/4] Descargando lista de Pokemon...')
        data = fetch_json('https://pokeapi.co/api/v2/pokemon?limit=10000')
        all_pokemon = [
            {'name': p['name'], 'url': p['url'],
             'id': int([x for x in p['url'].split('/') if x][-1])}
            for p in data['results']
        ]
        save_json(list_file, all_pokemon)
        print('     OK {} Pokemon  ({:.0f} KB)'.format(len(all_pokemon), kb(list_file)))

    # 2 -- Detalles
    detail_file = os.path.join(DATA_DIR, 'pokemon-details.json')
    details = load_json(detail_file) if os.path.exists(detail_file) else {}
    missing = [p['url'] for p in all_pokemon if p['url'] not in details or 'abilities' not in details[p['url']]]

    if missing:
        print('[2/4] Detalles: {} pendientes de {}...'.format(len(missing), len(all_pokemon)))
        done = 0
        for i in range(0, len(missing), BATCH_SIZE):
            batch = missing[i:i + BATCH_SIZE]
            results, errors = fetch_concurrent(batch, trim_pokemon)
            details.update(results)
            done += len(results)
            for url, err in errors:
                print('\n  ERR {}: {}'.format(url.split('/')[-2], err))
            sys.stdout.write('\r  {} / {}'.format(done, len(missing)))
            sys.stdout.flush()
            save_json(detail_file, details)
            time.sleep(DELAY)
        print('\n     OK {} detalles  ({:.0f} KB)'.format(done, kb(detail_file)))
    else:
        print('[2/4] Detalles: {} ya descargados  ({:.0f} KB)'.format(len(details), kb(detail_file)))

    # 3 -- Species
    species_file = os.path.join(DATA_DIR, 'species.json')
    species_map = load_json(species_file) if os.path.exists(species_file) else {}
    all_sp_urls = list({
        d['species']['url'] for d in details.values()
        if d.get('species') and d['species'].get('url')
    })
    missing_sp = [url for url in all_sp_urls if url not in species_map]

    if missing_sp:
        print('[3/4] Species: {} pendientes de {}...'.format(len(missing_sp), len(all_sp_urls)))
        done = 0
        for i in range(0, len(missing_sp), BATCH_SIZE):
            batch = missing_sp[i:i + BATCH_SIZE]
            results, _ = fetch_concurrent(batch, trim_species)
            species_map.update(results)
            done += len(results)
            sys.stdout.write('\r  {} / {}'.format(done, len(missing_sp)))
            sys.stdout.flush()
            save_json(species_file, species_map)
            time.sleep(DELAY)
        print('\n     OK {} species  ({:.0f} KB)'.format(done, kb(species_file)))
    else:
        print('[3/4] Species: {} ya descargadas  ({:.0f} KB)'.format(len(species_map), kb(species_file)))

    # 4 -- Tipos
    types_file = os.path.join(DATA_DIR, 'types.json')
    if not os.path.exists(types_file):
        print('[4/4] Descargando tipos...')
        data = fetch_json('https://pokeapi.co/api/v2/type?limit=100')
        save_json(types_file, data['results'])
        print('     OK {} tipos  ({:.0f} KB)'.format(len(data['results']), kb(types_file)))
    else:
        print('[4/4] Tipos: ya descargados  ({:.0f} KB)'.format(kb(types_file)))

    elapsed = time.time() - t0
    total_kb = sum(kb(os.path.join(DATA_DIR, f)) for f in os.listdir(DATA_DIR) if f.endswith('.json'))
    print('\nListo! {:.0f}s  |  Total: {:.0f} KB en ./data/'.format(elapsed, total_kb))

if __name__ == '__main__':
    main()
