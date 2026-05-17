# 🐺 Sistema de IA — Pueblo Duerme

Módulo de agentes autónomos para rellenar los huecos de partida cuando no hay suficientes jugadores humanos.

---

## Estructura de archivos

```
ai/
├── agentManager.js          ← Punto de entrada. Orquesta a todos los agentes.
├── USAGE_EXAMPLE.js         ← Pseudocódigo de integración con tu juego
│
├── roles/
│   ├── baseAgent.js         ← Clase base: personalidad, sospecha, votación
│   ├── villagerAgent.js     ← Aldeano (hereda todo de base, sin acción nocturna)
│   ├── wolfAgent.js         ← Lobo: elige víctimas, vota estratégicamente
│   ├── witchAgent.js        ← Bruja: gestiona pociones de curar y envenenar
│   └── cupidAgent.js        ← Cupido: elige pareja de enamorados en noche 1
│
├── hooks/
│   └── useAIAgents.js       ← Hook de React para integrar el manager
│
└── utils/
    ├── weightedRandom.js    ← Selección aleatoria ponderada
    ├── suspicionEngine.js   ← Sistema de sospecha entre agentes
    └── knowledgeFilter.js   ← Filtra gameState según el rol del agente
```

---

## Instalación

Copia la carpeta `ai/` dentro de `src/` de tu proyecto React. No requiere ninguna dependencia externa.

```
src/
└── ai/   ← aquí
```

---

## Uso rápido

```jsx
import { useAIAgents } from './ai/hooks/useAIAgents';

// En tu componente de juego:
const aiPlayers = players.filter(p => !p.isHuman);

const { resolveNight, generateAccusations, resolveVotes, broadcastEvent, killAgent } =
  useAIAgents(aiPlayers);

// Fase nocturna
const nightActions = resolveNight(gameState);

// Fase de debate
const accusations = generateAccusations(gameState);

// Fase de votación
const votes = resolveVotes({ ...gameState, currentVotes });
```

Consulta `USAGE_EXAMPLE.js` para el flujo completo con todos los eventos.

---

## Estructura de `gameState` esperada

```js
{
  players: [
    { id: 'p1', name: 'Ana', role: 'wolf', isHuman: false },
    { id: 'p2', name: 'Tú',  role: 'villager', isHuman: true },
    // ...
  ],
  deadPlayers: ['p3'],            // IDs de jugadores muertos
  phase: 'night',                 // 'night' | 'day' | 'vote'
  round: 2,
  currentNightVictimId: 'p2',    // quién atacaron los lobos esta noche
  loversIds: ['p1', 'p4'],       // pareja de Cupido ([] si no hay)
  currentVotes: { p2: 3, p5: 1 } // votos acumulados (para la fase de voto)
}
```

---

## Personalidades de agentes

Cada agente recibe una personalidad aleatoria al crearse:

| Personalidad | Comportamiento |
|---|---|
| `cautious` | Solo acusa cuando está seguro. Ahorra pociones. |
| `aggressive` | Acusa rápido. Usa pociones con más frecuencia. |
| `follower` | Copia la opinión mayoritaria. |
| `random` | Aleatoriedad ponderada, impredecible. |

Puedes forzar una personalidad pasándola en la config del jugador:

```js
{ id: 'bot1', name: 'Bot', role: 'wolf', personality: 'aggressive' }
```

---

## Sistema de sospecha

Cada agente mantiene un `suspicionMap`: un mapa `{ playerId → 0..100 }`.

Se actualiza automáticamente al llamar a `broadcastEvent(event)`:

```js
// Tras un voto
broadcastEvent({ type: 'VOTED_AGAINST', subjectId: 'p1', objectId: 'p2', round: 2 });

// Tras revelar un lobo muerto
broadcastEvent({ type: 'WOLF_REVEALED', objectId: 'p3', defenderId: 'p1', round: 3 });

// Tras ejecutar a un inocente
broadcastEvent({ type: 'INNOCENT_KILLED', objectId: 'p2', accuserId: 'p5', round: 2 });
```

---

## Eventos disponibles

| `type` | Campos | Efecto |
|---|---|---|
| `VOTED_AGAINST` | `subjectId`, `objectId` | Sube sospecha sobre `subjectId` |
| `VOTED_WITH` | `subjectId` | Baja sospecha sobre `subjectId` |
| `WOLF_REVEALED` | `objectId`, `defenderId?` | Sube sospecha sobre quien lo defendía |
| `INNOCENT_KILLED` | `objectId`, `accuserId?` | Sube sospecha sobre quien lo acusó |

---

## Debug

```js
const { debugSnapshot } = useAIAgents(aiPlayers);
console.table(debugSnapshot());
// Muestra: id, name, role, personality, isAlive, suspicionMap de cada agente
```
