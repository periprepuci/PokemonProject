# Pokédex

Buscador de Pokémon con todas sus formas, stats, tipos y tabla de efectividad, construido con HTML, CSS y JavaScript puro.

## Demo

🌐 **[periprepuci.github.io/PokemonProject](https://periprepuci.github.io/PokemonProject)**

## Características

- **Búsqueda en tiempo real** por nombre con debounce
- **Filtro por tipo** (18 tipos, Gen 6+) y **por generación** (Gen I – Gen IX)
- **Todas las formas** — Mega evoluciones, formas regionales, Gigantamax, etc. (+1300 entradas)
- **Scroll infinito** — carga 40 Pokémon por página automáticamente
- **Caché en `localStorage`** — la segunda visita carga al instante sin red
- **Clic en tarjeta** → modal con:
  - Artwork oficial en alta resolución
  - Stats base con barras de color dinámico (rojo → verde → turquesa según el valor)
  - Total de stats base
  - Tabla de **efectividad defensiva** (×4 / ×2 / ×1 / ×½ / ×¼ / ×0)
  - Tabla de **efectividad ofensiva** combinada
- **Reseteo** haciendo clic en el logo

## Stack

| Capa | Tecnología |
|------|-----------|
| Datos | [PokéAPI](https://pokeapi.co) (REST, gratuita) |
| Frontend | HTML5 · CSS3 · JavaScript ES2020 |
| Hosting | GitHub Pages |

> Sin frameworks, sin dependencias, sin build step.

## Uso local

```bash
# Clona el repo
git clone https://github.com/periprepuci/PokemonProject.git
cd PokemonProject

# Ábrelo directamente en el navegador
start index.html   # Windows
open index.html    # macOS
```

No requiere servidor — es estático puro.

## Estructura

```
PokemonProject/
├── index.html   # Estructura HTML y modal
├── style.css    # Estilos y animaciones
└── script.js    # Lógica, caché y renderizado
```

## Créditos

- Datos e imágenes: [PokéAPI](https://pokeapi.co)
- Pokémon y todos los nombres relacionados son marca registrada de Nintendo / Game Freak.
