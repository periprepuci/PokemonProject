"""
Descarga todos los movimientos e ítems de PokeAPI con nombres en ES e EN.
Genera: data/moves.json y data/items.json
"""
import requests, json, os
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = 'https://pokeapi.co/api/v2'

def get_names(url):
    r = requests.get(url, timeout=12)
    r.raise_for_status()
    data = r.json()
    names = data.get('names', [])
    en = next((n['name'] for n in names if n['language']['name'] == 'en'), data.get('name', ''))
    es = next((n['name'] for n in names if n['language']['name'] == 'es'), None)
    return en, es

def fetch_all(endpoint, out_file, label):
    # Resume: load existing
    existing = {}
    if os.path.exists(out_file):
        with open(out_file, encoding='utf-8') as f:
            existing = json.load(f)

    r = requests.get(f'{BASE}/{endpoint}?limit=3000', timeout=15)
    r.raise_for_status()
    results = r.json()['results']
    todo = [x for x in results if x['name'] not in existing]
    print(f'{label}: {len(existing)} ya descargados, {len(todo)} restantes')

    result = dict(existing)
    done = 0

    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(get_names, x['url']): x['name'] for x in todo}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                en, es = future.result()
                result[slug] = {'en': en or slug, 'es': es or en or slug}
            except Exception as e:
                result[slug] = {'en': slug, 'es': slug}
            done += 1
            if done % 100 == 0:
                print(f'  {label}: {done}/{len(todo)}...')
                with open(out_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, ensure_ascii=False)

    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)
    print(f'{label}: ¡listo! {len(result)} entradas → {out_file}')

if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)
    fetch_all('move', 'data/moves.json', 'Movimientos')
    fetch_all('item', 'data/items.json', 'Ítems')
