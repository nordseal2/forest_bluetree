// js/locations.js
import {
  state,
  getCycleTier,
  getActiveChar,
  activeHasItem,
  hasItem,
  getRelForGroup,
  allLinksDiscovered,
  allLinksIntact,
  ecosystemDestroyed,
  addScale,
  addLog,
  addJournalEntry,
  useConsumable,
  collectData,
  checkPattern,
  getPatternFeedback,
  actionChangesObject,
  getPerson,
  getItem
} from './state.js';

export function makeAction(id, label, cost, check, scaleType, ecosystem, flavor, result, extra) {
  const a = { id, label, cost, check, scaleType, ecosystem, flavor, result };
  if (extra) Object.assign(a, extra);
  return a;
}

// ---------- связи ----------
export function markLinkSeen(locId) {
  if (locId === 'loc1') {
    if (!state.links.tree_mushrooms.seenA) {
      state.links.tree_mushrooms.seenA = true;
      addJournalEntry('Вы увидели Хвощ. Кора пульсирует — в этом есть ритм.', 'new');
    if (!state.links.river_tree.seenA) { state.links.river_tree.seenA = true; };
    }
  }
  if (locId === 'loc2') {
    if (!state.links.flowers_bees.seenA) {
      state.links.flowers_bees.seenA = true;
      addJournalEntry('Вы увидели Светящиеся цветы. Пчёлы собирают нектар.', 'new');
    }
    if (!state.links.bird_bugs.seenB) state.links.bird_bugs.seenB = true;
    if (!state._riverSeen) {
      state._riverSeen = true;
      addJournalEntry('Вы увидели Ручей. Вода кристально чистая.', 'new');
    if (!state.links.bugs_river.seenB) { state.links.bugs_river.seenB = true; };
    if (!state.links.river_tree.seenB) { state.links.river_tree.seenB = true; };
    }
  }
  if (locId === 'loc3') {
    if (!state.links.tree_mushrooms.seenB) state.links.tree_mushrooms.seenB = true;
    if (!state.links.mush_bird.seenA) {
      state.links.mush_bird.seenA = true;
      addJournalEntry('Вы увидели Гриб-фигуру. Она возвышается над поляной.', 'new');
    }
  }
  if (locId === 'loc4') {
    if (!state.links.mush_bird.seenB) state.links.mush_bird.seenB = true;
    if (!state.links.bird_bugs.seenA) {
      state.links.bird_bugs.seenA = true;
      addJournalEntry('Вы увидели Птицу-ящера. Она охотится — пикирует в сторону ручья.', 'new');
     if (!state.links.bugs_river.seenA) { state.links.bugs_river.seenA = true; };
    if (!state._bugsSeen) {
      state._bugsSeen = true;
      addJournalEntry('Вы заметили ядовитых жуков. Они копошатся у гнезда.', 'new');
    }
    }
  }
  if (locId === 'final') {
    if (!state.links.flowers_bees.seenB) state.links.flowers_bees.seenB = true;
    if (!state._treeSeen) {
      state._treeSeen = true;
      addJournalEntry('Вы увидели Древо. Оно преграждает путь.', 'new');
    }
  }
  tryDiscoverLinks();
}

export function addLinkHint(id, text) {
  const lk = state.links[id];
  if (!lk || lk.discovered) return;
  lk.hint = text;
  addLog(`${text}`);
  updateJournalLinks();
}

export function tryDiscoverLinks() {
  const experiments = {
    tree_mushrooms: () => {
      const a = state.actionsThisRoute.some(a => a.scaleType === 'symbiosis' && a.loc === 'loc1');
      const b = state.actionsThisRoute.some(a => a.scaleType === 'symbiosis' && a.loc === 'loc3');
      if (a && b) state._treeMushroomDiscoveryText = 'Пульс Хвоща синхронизирован с мерцанием Грибницы. Это единый организм — вы уверены в этом.';
      return a && b;
    },
    flowers_bees: () => state.ecosystem.flowers === 'picked' || state.ecosystem.flowers === 'poisoned' || state._droneBeesUsed,
    mush_bird: () => {
      const watched = state.actionsThisRoute.some(a => (a.id === 'watch_bird' || a.id === 'calm_bird') && a.loc === 'loc4');
      const killed = state.actionsThisRoute.some(a => a.id === 'kill_bird' && a.loc === 'loc4');
      return (watched || killed) && state.links.mush_bird.seenA && state.links.mush_bird.seenB;
    },
    bird_bugs: () => state.ecosystem.bird === 'killed' || state._droneBirdUsed
  };
  let newlyDiscovered = false;
  const discoveryTexts = {
    tree_mushrooms: 'Пульс Хвоща синхронизирован с мерцанием Грибницы. Это единый организм.',
    flowers_bees: 'Пчёлы не просто кружат над цветами — они несут нектар к Древу. Это не случайность, это система.',
    mush_bird: 'Споры на клюве птицы — такие же, как на грибе. Птица кормится здесь.',
    bird_bugs: 'Птица — не просто хищник. Она — регулятор. Без неё жуки заполонят ручей.'
  };
  Object.entries(state.links).forEach(([id, lk]) => {
    if (lk.discovered) return;
    if (!lk.seenA || !lk.seenB) return;
    if (experiments[id] && experiments[id]()) {
      lk.discovered = true;
      const dt = (id === 'tree_mushrooms' && state._treeMushroomDiscoveryText) ? state._treeMushroomDiscoveryText : discoveryTexts[id] || `Обнаружена СВЯЗЬ: ${getLinkName(id)}!`;
      addJournalEntry(dt, 'discovery');
      showLinkDiscovery(dt);
      newlyDiscovered = true;
    }
  });
  if (newlyDiscovered) {
    updateJournalLinks();
    checkHarmonyHint();
  }
}

export function showLinkDiscovery(text) {
  const overlay = document.createElement('div');
  overlay.className = 'phase-transition';
  overlay.innerHTML = `<div class="trait-popup"><h4>🔗 Связь обнаружена!</h4><p>${text}</p></div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.body.removeChild(overlay), 2000);
}

export function updateJournalLinks() {
  const n = { tree_mushrooms: 'Хвощ → Грибница', flowers_bees: 'Цветы → Пчёлы', mush_bird: 'Грибница → Птица', bird_bugs: 'Птица → Жуки',   bugs_river: 'Жуки → Ручей', river_tree: 'Ручей → Хвощ' };
  state.journalLinks = '';
  Object.entries(state.links).forEach(([k, v]) => {
    if (!v.discovered) return;
    state.journalLinks += `${n[k] || k}: ${v.intact ? 'ЦЕЛА' : 'РАЗОРВАНА'}\n`;
  });
}

export function checkHarmonyHint() {
  if (!allLinksDiscovered()) return;
  if (!allLinksIntact() && !ecosystemDestroyed()) {
    if (!state._harmonyHintShown) {
      state._harmonyHintShown = true;
      addJournalEntry('Древо реагирует на баланс экосистемы. Все связи должны быть в одном состоянии — либо все целы, либо все разорваны.', 'warning');
    }
  }
}

export function getLinkedObjectText(locId) {
  if (!allLinksDiscovered()) return '';
  const map = { loc1: 'Питает Грибницу в Локации 3.', loc2: 'Пчёлы несут нектар к Древу.', loc3: 'Питается от Хвоща. Кормит Птицу.', loc4: 'Охотится на жуков у ручья.', final: 'Принимает нектар, пульс и споры.' };
  return map[locId] || '';
}

// ---------- локации ----------
export function getLoc1() {
  const name = 'Поляна Хвоща';
  const tier = getCycleTier();
  const sense = 'Пахнет влажной землёй. Кора Хвоща мерцает, пульсируя едва заметным ритмом.';

  // Декларативное описание действий (без лямбд)
  const actions = [
    { id: 'touch_tree', label: 'Прикоснуться', cost: 1, req: null, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'symbiosis', amount: 1 },
        { type: 'collectData', actionId: 'touch_tree', amount: 1 },
        { type: 'addLinkHint', linkId: 'tree_mushrooms', text: 'Под корой что-то ритмично движется — как сердцебиение.' },
        { type: 'log', text: 'Хвощ теплеет под пальцами.' }
      ],
      discount: false, joint: false, patternResonance: false
    },
    { id: 'scan_tree', label: 'Сканировать (щуп)', cost: 1, req: { item: 'scanner', charge: 'scannerCharge', tierMin: 2 }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'useCharge', charge: 'scannerCharge' },
        { type: 'addScale', scale: 'expansion', amount: 1 },
        { type: 'collectData', actionId: 'scan_tree', amount: 2 },
        { type: 'addLinkHint', linkId: 'tree_mushrooms', text: 'Щуп показывает: пульсация передаётся по корням в Локацию 3.' },
        { type: 'log', text: 'Пульсация передаётся по корням в Локацию 3.' }
      ],
      discount: false, joint: false, patternResonance: false
    },
    { id: 'cut_tree', label: 'Срубить', cost: 2, req: { item: 'multitool', tierMin: 2 }, scaleType: 'aggression', ecosystem: true,
      effect: [
        { type: 'addScale', scale: 'aggression', amount: 2 },
        { type: 'collectData', actionId: 'cut_tree', amount: 3 },
        { type: 'changeEcosystem', key: 'tree', value: 'cut' },
        { type: 'breakLink', linkId: 'tree_mushrooms' },
        { type: 'addJournal', text: 'Хвощ срублен. Из пня прорастёт росток.', type: 'info' },
        { type: 'addJournal', text: 'Пульс Хвоща синхронизирован с мерцанием Грибницы. Это единый организм — вы уверены в этом.', type: 'discovery' },
        { type: 'log', text: 'Хвощ рухнул.' }
      ],
      discount: true, joint: false, patternDissonance: true
    },
    { id: 'poison_tree', label: 'Отравить', cost: 2, req: { item: 'medkit', consume: true }, scaleType: 'aggression', ecosystem: true,
      effect: [
        { type: 'addScale', scale: 'aggression', amount: 2 },
        { type: 'changeEcosystem', key: 'tree', value: 'poisoned' },
        { type: 'breakLink', linkId: 'tree_mushrooms' },
        { type: 'addJournal', text: 'Хвощ отравлен. Нужна аптечка для исцеления.', type: 'info' },
        { type: 'log', text: 'Яд течёт по стволу.' }
      ],
      discount: false, joint: false, patternDissonance: false
    },
    { id: 'trap_tree', label: 'Фотоловушка', cost: 1, req: { item: 'camtrap', consume: true }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'expansion', amount: 1 },
        { type: 'collectData', actionId: 'trap_tree', amount: 4 },
        { type: 'setTrapped', loc: 'loc1' },
        { type: 'log', text: 'Ловушка установлена.' }
      ],
      discount: false, joint: false, patternResonance: false
    },
    { id: 'collect_food1', label: 'Собрать съедобную кору', cost: 1, req: { linkIntact: ['tree_mushrooms', 'river_tree'], resourceLoc: 'loc1' }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'addFood', amount: 1 },
        { type: 'setResourceCollected', loc: 'loc1' },
        { type: 'log', text: 'Пища собрана.' }
      ],
      discount: false, joint: false, patternResonance: false
    }
  ];

  // Совместные действия (пока оставим как есть, чтобы не усложнять)
  const joint = getRelForGroup() >= 3 ? [
    { id: 'joint_climb', label: '🤝 Подсадить (совм.)', cost: 3, req: null, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'addLinkHint', linkId: 'tree_mushrooms', text: 'С высоты видно: пульсация синхронизирована с мерцанием в Локации 3. Пчёлы летят к Древу — вы видите всю картину целиком.' },
        { type: 'discoverLink', linkId: 'tree_mushrooms' },
        { type: 'log', text: 'Вы увидели верхушки.' }
      ],
      joint: true
    }
  ] : [];

  // Состояния экосистемы обрабатываем по-старому (упрощаем)
  if (state.ecosystem.tree === 'cut') {
    if (state.treeRegrow === 0) state.treeRegrow = state.cycle + 2;
    if (state.cycle >= state.treeRegrow) {
      state.ecosystem.tree = 'intact';
      state.links.tree_mushrooms.intact = true;
      state.treeRegrow = 0;
      addJournalEntry('Хвощ вырос снова.', 'info');

  // Активный эксперимент: осмотреть корни Хвоща, если ручей загрязнён
  if (!state.links.river_tree.discovered && state.riverState !== 'clean') {
    actions.push({
      id: 'observe_roots_tree',
      label: 'Осмотреть корни',
      cost: 1,
      req: null,
      scaleType: 'symbiosis',
      ecosystem: false,
      effect: [
        { type: 'discoverLink', linkId: 'river_tree' },
        { type: 'log', text: 'Корни Хвоща уходят к руслу. Когда вода мутнеет, дерево страдает.' }
      ]
    });
  }

      return getLoc1();
    }
    // временно оставим старый код для cut/poisoned, чтобы не перегружать шаг
    return getLoc1_old(); // если нужна поддержка старых состояний
  }

  // Меняем описание, если связь Ручей→Хвощ разрушена
  let desc = 'Поляна с Хвощом. Кора мерцает в полумраке. Пчёлы кружат у ветвей.';
  if (state.links.river_tree && !state.links.river_tree.intact) {
    desc = 'Поляна с Хвощом. Кора потускнела и потрескалась, пульсации почти не видно.';
  }

  const linkedText = allLinksDiscovered() ? getLinkedObjectText('loc1') : '';

  return {
    id: 'loc1', name, desc: desc,
    sense, objName: 'Хвощ', actions: [...actions, ...joint],
    linkedText: linkedText ? `<div class="linked-object">🔗 ${linkedText}</div>` : ''
  };
}

export function getLoc2() {
  const name = 'Берег ручья';
  const tier = getCycleTier();
  const sense = 'Пахнет нектаром. Над цветами кружат пчёлы, собирая сладкую пыльцу.';

  // ---------- Действия для intact-состояния ----------
  const intactActions = [
    { id: 'watch_bees', label: 'Наблюдать за пчёлами', cost: 1, req: null, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'symbiosis', amount: 1 },
        { type: 'collectData', actionId: 'watch_bees', amount: 1 },
        { type: 'addLinkHint', linkId: 'flowers_bees', text: 'Пчёлы несут нектар к Древу.' },
        { type: 'log', text: 'Паттерн ясен: пчёлы связывают цветы и Древо.' }
      ],
      discount: false, joint: false, patternResonance: true
    },
    { id: 'pick_flowers', label: 'Собрать цветы', cost: 1, req: { tierMin: 2 }, scaleType: 'expansion', ecosystem: true,
      effect: [
        { type: 'addScale', scale: 'expansion', amount: 1 },
        { type: 'collectData', actionId: 'pick_flowers', amount: 1 },
        { type: 'breakLink', linkId: 'flowers_bees' },
        { type: 'scheduleEcosystemChange', key: 'flowers', value: 'picked' },
        { type: 'addJournal', text: 'Пчёлы не просто кружат над цветами — они несут нектар к Древу. Это не случайность, это система.', type: 'discovery' },
        { type: 'log', text: 'Цветы собраны.' }
      ],
      discount: false, joint: false, patternDissonance: true
    },
    { id: 'poison_flowers', label: 'Отравить цветы', cost: 2, req: { item: 'medkit', consume: true, tierMin: 3 }, scaleType: 'aggression', ecosystem: true,
      effect: [
        { type: 'addScale', scale: 'aggression', amount: 2 },
        { type: 'breakLink', linkId: 'flowers_bees' },
        { type: 'scheduleEcosystemChange', key: 'flowers', value: 'poisoned' },
        { type: 'addJournal', text: 'Цветы отравлены. Нужно прорыть новое русло.', type: 'info' },
        { type: 'log', text: 'Цветы умирают.' }
      ],
      discount: false, joint: false, patternDissonance: false
    },
    { id: 'drone_bees', label: 'Дрон: проследить за пчёлами', cost: 0, req: { item: 'drone', charge: 'droneCharge', tierMin: 2 }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'useCharge', charge: 'droneCharge' },
        { type: 'collectData', actionId: 'drone_bees', amount: 2 },
        { type: 'addLinkHint', linkId: 'flowers_bees', text: 'Дрон заснял: пчёлы несут нектар к Древу.' },
        { type: 'log', text: 'Дрон заснял танец пчёл.' }
      ],
      discount: false, joint: false, patternResonance: false
    }
  ];

  // Кнопка "Осмотреть воду" в intact-состоянии, если жуки расплодились
  if (!state.links.bugs_river.discovered && !state.links.bird_bugs.intact) {
    intactActions.push({
      id: 'observe_water_bugs',
      label: 'Осмотреть воду',
      cost: 0,
      req: null,
      scaleType: 'symbiosis',
      ecosystem: false,
      effect: [
        { type: 'discoverLink', linkId: 'bugs_river' },
        { type: 'log', text: 'Жуки, которых раньше сдерживала птица, теперь кишат в воде. Ручей страдает.' }
      ]
    });
  }

  const jointLive = getRelForGroup() >= 3 ? [
    { id: 'joint_nectar', label: '🤝 Собрать образцы нектара вдвоём (совм.)', cost: 2, req: null, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'expansion', amount: 3 },
        { type: 'addItem', itemId: 'nectar', name: 'Концентрированный нектар', tags: ['ресурс', 'ОД'], count: 1 },
        { type: 'log', text: 'Нектар собран.' }
      ],
      joint: true
    }
  ] : [];

  // ---------- Состояние "цветы собраны" (picked) ----------
  if (state.ecosystem.flowers === 'picked') {
    if (state.riverState === 'clean') { state.riverState = 'muddy'; addJournalEntry('Ручей помутнел. Цветы исчезли.', 'info'); }
    if (state._flowersRegrow > 0 && state.cycle >= state._flowersRegrow) {
      state.ecosystem.flowers = 'intact';
      state.links.flowers_bees.intact = true;
      state.riverState = 'clean';
      state._flowersRegrow = 0;
      return getLoc2();
    }
    if (!state._flowersRegrow) { state._flowersRegrow = state.cycle + 1; addJournalEntry('Цветы собраны. Они отрастут через цикл.', 'info'); }
    const pickedActions = [
      { id: 'clear_water', label: 'Очистить', cost: 2, req: { item: 'medkit', consume: true, tierMin: 2 }, scaleType: 'kindness', ecosystem: false,
        effect: [
          { type: 'addScale', scale: 'kindness', amount: 1 },
          { type: 'log', text: 'Вода стала чище.' }
        ]
      },
      { id: 'collect_food2', label: 'Собрать личинок из ручья', cost: 1, req: { linkBroken: 'flowers_bees', resourceLoc: 'loc2' }, scaleType: 'expansion', ecosystem: false,
        effect: [
          { type: 'addFood', amount: 1 },
          { type: 'setResourceCollected', loc: 'loc2' },
          { type: 'log', text: 'Пища собрана.' }
        ]
      }
    ];
    if (!state.links.bugs_river.discovered && !state.links.bird_bugs.intact) {
      pickedActions.push({
        id: 'observe_water_bugs',
        label: 'Осмотреть воду',
        cost: 0,
        req: null,
        scaleType: 'symbiosis',
        ecosystem: false,
        effect: [
          { type: 'discoverLink', linkId: 'bugs_river' },
          { type: 'log', text: 'Жуки, которых раньше сдерживала птица, теперь кишат в воде. Ручей страдает.' }
        ]
      });
    }
    return {
      id: 'loc2', name, desc: 'Цветов нет. Вода мутная.', sense: 'Запах сырости. Нектара больше нет.',
      objName: 'Мутный ручей', actions: pickedActions
    };
  }

  // ---------- Состояние "цветы отравлены" (poisoned) ----------
  if (state.ecosystem.flowers === 'poisoned') {
    if (state.riverState === 'clean' || state.riverState === 'muddy') { state.riverState = 'poisoned'; addJournalEntry('Ручей отравлен. Вода покрыта плёнкой.', 'info'); }
    const poisonedActions = [
      { id: 'restore_river', label: 'Прорыть новое русло', cost: 2, req: { item: 'multitool', tierMin: 2 }, scaleType: 'kindness', ecosystem: true,
        effect: [
          { type: 'addScale', scale: 'kindness', amount: 2 },
          { type: 'setRiverState', value: 'muddy' },
          { type: 'setFlowersRegrow', cycle: state.cycle + 1 },
          { type: 'log', text: 'Вода потекла по-новому.' }
        ]
      },
      { id: 'collect_food2', label: 'Собрать личинок из ручья', cost: 1, req: { linkBroken: 'flowers_bees', resourceLoc: 'loc2' }, scaleType: 'expansion', ecosystem: false,
        effect: [
          { type: 'addFood', amount: 1 },
          { type: 'setResourceCollected', loc: 'loc2' },
          { type: 'log', text: 'Пища собрана.' }
        ]
      }
    ];
    if (!state.links.bugs_river.discovered && !state.links.bird_bugs.intact) {
      poisonedActions.push({
        id: 'observe_water_bugs',
        label: 'Осмотреть воду',
        cost: 0,
        req: null,
        scaleType: 'symbiosis',
        ecosystem: false,
        effect: [
          { type: 'discoverLink', linkId: 'bugs_river' },
          { type: 'log', text: 'Жуки, которых раньше сдерживала птица, теперь кишат в воде. Ручей страдает.' }
        ]
      });
    }
    return {
      id: 'loc2', name, desc: 'Цветы почернели. Вода с плёнкой.', sense: 'Химический запах.',
      objName: 'Отравленный ручей', actions: poisonedActions
    };
  }

  // ---------- Нетронутое состояние (intact) ----------
  const linkedText = allLinksDiscovered() ? getLinkedObjectText('loc2') : '';
  const waterClean = state.riverState === 'clean';
  const desc = waterClean ? 'Ручей с кристальной водой. Заросли светящихся цветов.' : 'Ручей помутнел. Вода стала грязной.';
  const senseText = waterClean ? 'Пахнет нектаром. Над цветами кружат пчёлы, собирая сладкую пыльцу.' : 'Пахнет сыростью. Пчёлы кружат, но их гул звучит тревожно.';
  return {
    id: 'loc2', name, desc: desc,
    sense: senseText, objName: 'Светящиеся цветы', actions: [...intactActions, ...jointLive],
    linkedText: linkedText ? `<div class="linked-object">🔗 ${linkedText}</div>` : ''
  };
}

export function getLoc3() {
  const name = 'Грибная поляна';
  const tier = getCycleTier();
  const sense = 'Пахнет грибами. Споры мерцают — этот же ритм пульсации вы чувствовали у Хвоща.';

  // Декларативные действия (основные)
  const actions = [
    { id: 'study_mush', label: 'Изучить щупом', cost: 1, req: { item: 'scanner', charge: 'scannerCharge', tierMin: 2 }, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'useCharge', charge: 'scannerCharge' },
        { type: 'addScale', scale: 'symbiosis', amount: 1 },
        { type: 'collectData', actionId: 'study_mush', amount: 2 },
        { type: 'addLinkHint', linkId: 'mush_bird', text: 'Корни грибницы уходят глубоко под землю — туда, где пульсирует Хвощ.' },
        { type: 'log', text: 'Мицелий охватывает пол-леса.' }
      ],
      discount: false, joint: false, patternResonance: false
    },
    { id: 'pray_mush', label: 'Замереть и прислушаться', cost: 2, req: {tierMin: 2}, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'symbiosis', amount: 2 },
        { type: 'collectData', actionId: 'pray_mush', amount: 1 },
        { type: 'addLinkHint', linkId: 'mush_bird', text: 'На поверхности гриба — равномерные рытвины, будто кто-то долбил его острым предметом.' },
        { type: 'log', text: 'Лес пробует ваш силуэт.' }
      ],
      discount: false, joint: false, patternResonance: true
    },
    { id: 'burn_mush', label: 'Поджечь', cost: 2, req: { item: 'multitool', tierMin: 2 }, scaleType: 'aggression', ecosystem: true,
      effect: [
        { type: 'addScale', scale: 'aggression', amount: 2 },
        { type: 'changeEcosystem', key: 'mushrooms', value: 'burned' },
        { type: 'breakLink', linkId: 'mush_bird' },
        { type: 'setMushroomRegrow', cycle: state.cycle + 2 },
        { type: 'addJournal', text: 'Грибница сожжена. Нужен образец спор для восстановления.', type: 'info' },
        { type: 'addJournal', text: 'Споры на клюве птицы — такие же, как на грибе. Птица кормится здесь. Вы это поняли.', type: 'discovery' },
        { type: 'log', text: 'Поляна в огне.' }
      ],
      discount: true, joint: false, patternDissonance: true
    },
    { id: 'collect_food3', label: 'Собрать съедобные грибы', cost: 1, req: { linkIntact: 'mush_bird', resourceLoc: 'loc3' }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'addFood', amount: 1 },
        { type: 'setResourceCollected', loc: 'loc3' },
        { type: 'log', text: 'Пища собрана.' }
      ],
      discount: false, joint: false, patternResonance: false
    }
  ];

  // Добавляем сбор спор, только если образца ещё нет
  const hasSporesAlready = state.inventory.find(i => i.id === 'spore_sample');
  if (!hasSporesAlready) {
    actions.push({
      id: 'collect_spores', label: 'Собрать образец спор', cost: 1, req: null, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'addItem', itemId: 'spore_sample', name: 'Образец спор', tags: ['образец', 'восстановление'], count: 1 },
        { type: 'addScale', scale: 'expansion', amount: 1 },
        { type: 'log', text: 'Образец спор получен.' }
      ]
    });
  }

  // Совместное касание
  const joint = getRelForGroup() >= 3 ? [
    { id: 'joint_touch', label: '🤝 Синхронное касание (совм.)', cost: 4, req: null, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'symbiosis', amount: 3 },
        { type: 'addLinkHint', linkId: 'mush_bird', text: 'Гриб отзывается на касание двоих.' },
        { type: 'discoverLink', linkId: 'mush_bird' },
        { type: 'log', text: 'Гриб-фигура ожила.' }
      ],
      joint: true
    }
  ] : [];

  // Фотоловушка – пока оставим старый код (через временную makeAction)
  const base = [];
  if (state.trappedLocations['loc3'] && !state.trapJustSet['loc3']) {
    base.push(makeAction('retrieve_camtrap3', 'Снять фотоловушку', 0, () => true, 'expansion', false, 'Вы снимаете ловушку.', () => {
      state.trappedLocations['loc3'] = false;
      const ci = state.inventory.find(i => i.id === 'camtrap');
      if (ci) ci.count++; else state.inventory.push({ id: 'camtrap', name: 'Фотоловушка', tags: ['инструмент', 'наблюдение'], inGeneral: true, count: 1 });
      addLinkHint('mush_bird', 'Фотоловушка: птица кормится спорами гриба.');
      return 'Данные сохранены.';
    }));
  }

  // Обработка выжженной земли
  if (state.ecosystem.mushrooms === 'burned') {
    const hasSpores = state.inventory.find(i => i.id === 'spore_sample');
    if (!state._mushroomRegrow) state._mushroomRegrow = hasSpores ? state.cycle + 1 : state.cycle + 2;
    if (state.cycle >= state._mushroomRegrow) {
      state.ecosystem.mushrooms = 'intact';
      state.links.mush_bird.intact = true;
      state._mushroomRegrow = 0;
      addJournalEntry(hasSpores ? 'Грибница восстановилась.' : 'Грибница выросла снова сама.', 'info');
      return getLoc3();
    }
    const burnedActions = [...base];
    if (hasSpores) burnedActions.push({
      id: 'plant_spores', label: 'Посеять споры', cost: 2, req: null, scaleType: 'kindness', ecosystem: true,
      effect: [
        { type: 'consumeItem', itemId: 'spore_sample' },
        { type: 'setMushroomRegrow', cycle: state.cycle + 1 },
        { type: 'addScale', scale: 'kindness', amount: 2 },
        { type: 'log', text: 'Ростки пробиваются.' }
      ]
    });
    burnedActions.push({
      id: 'mourn', label: 'Почтить', cost: 1, req: { trait: 'Эмпат' }, scaleType: 'kindness', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'kindness', amount: 1 },
        { type: 'log', text: 'Лес помнит.' }
      ]
    });
    return {
      id: 'loc3', name, desc: 'Выжженная земля. Гриб-фигура расколот.',
      sense: 'Едкий запах гари.', objName: 'Руины грибницы', actions: burnedActions
    };
  }

  const linkedText = allLinksDiscovered() ? getLinkedObjectText('loc3') : '';
  return {
    id: 'loc3', name, desc: 'Поляна светящейся грибницы. Гриб-фигура в центре.',
    sense, objName: 'Гриб-фигура', actions: [...base, ...actions, ...joint],
    linkedText: linkedText ? `<div class="linked-object">🔗 ${linkedText}</div>` : ''
  };
}

export function getLoc4() {
  const name = 'Гнездо птицы-ящера';
  const tier = getCycleTier();
  const sense = 'Пахнет перьями. Птица охотится — пикирует в сторону ручья.';

  const intactActions = [
    { id: 'watch_bird', label: 'Наблюдать', cost: 1, req: null, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'symbiosis', amount: 1 },
        { type: 'collectData', actionId: 'watch_bird', amount: 1 },
        { type: 'addLinkHint', linkId: 'mush_bird', text: 'На клюве — светящиеся споры.' },
        { type: 'log', text: 'Птица склоняет голову.' }
      ],
      discount: false, joint: false, patternResonance: true
    },
    { id: 'calm_bird', label: 'Подозвать и погладить', cost: 2, req: { trait: 'Эмпат' }, scaleType: 'symbiosis', ecosystem: false,
      effect: [
        { type: 'addScale', scale: 'symbiosis', amount: 2 },
        { type: 'collectData', actionId: 'calm_bird', amount: 2 },
        { type: 'addLinkHint', linkId: 'mush_bird', text: 'Птица доверчиво касается вашей ладони клювом.' },
        { type: 'log', text: 'Птица касается ладони.' }
      ],
      discount: false, joint: false, patternResonance: false
    },
    { id: 'drone_bird', label: 'Дрон: проследить', cost: 0, req: { item: 'drone', charge: 'droneCharge', tierMin: 2 }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'useCharge', charge: 'droneCharge' },
        { type: 'collectData', actionId: 'drone_bird', amount: 2 },
        { type: 'addLinkHint', linkId: 'bird_bugs', text: 'Дрон заснял: птица охотится на жуков.' },
        { type: 'log', text: 'Дрон заснял охоту.' }
      ],
      discount: false, joint: false, patternResonance: false
    },
    { id: 'kill_bird', label: 'Убить', cost: 2, req: { item: 'multitool', tierMin: 2 }, scaleType: 'aggression', ecosystem: true,
      effect: [
        { type: 'addScale', scale: 'aggression', amount: 2 },
        { type: 'breakLink', linkId: 'bird_bugs' },
        { type: 'breakLink', linkId: 'mush_bird' },
        { type: 'scheduleEcosystemChange', key: 'bird', value: 'killed' },
        { type: 'addJournal', text: 'Птица убита. Жуки расплодятся.', type: 'info' },
        { type: 'addJournal', text: 'Птица — не просто хищник. Она — регулятор. Без неё жуки заполонят ручей. Вы это увидели.', type: 'discovery' },
        { type: 'log', text: 'Птица мертва.' }
      ],
      discount: true, joint: false, patternDissonance: true
    }
  ];

  const joint = getRelForGroup() >= 3 ? [
    { id: 'joint_drone', label: '🤝 Совместный полёт дрона (совм.)', cost: 1, req: { item: 'drone', charge: 'droneCharge', tierMin: 2 }, scaleType: 'expansion', ecosystem: false,
      effect: [
        { type: 'useCharge', charge: 'droneCharge' },
        { type: 'collectData', actionId: 'drone_bird', amount: 2 },
        { type: 'addLinkHint', linkId: 'bird_bugs', text: 'Дрон заснял пищевую цепь.' },
        { type: 'log', text: 'Дрон заснял пищевую цепь.' }
      ],
      joint: true
    }
  ] : [];

  // Состояние "птица убита" – еда только в следующем цикле
    if (state.ecosystem.bird === 'killed') {
    if (state.birdReturn === 0 && state.riverState === 'clean') state.birdReturn = state.cycle + 2;
    if (state.cycle >= state.birdReturn && state.birdReturn > 0) {
      state.ecosystem.bird = 'intact';
      state.links.bird_bugs.intact = true;
      state.birdReturn = 0;
      addJournalEntry('Новая птица прилетела. Она строит гнездо.', 'info');
      return getLoc4();
    }
    return {
      id: 'loc4', name, desc: 'Гнездо пусто. Ядовитые жуки.',
      sense: 'Запах гнили. Жуки атакуют — вы уклоняетесь, но это отнимает силы.',
      objName: 'Ядовитые жуки',
      actions: [
        { id: 'exterminate', label: 'Вытравить жуков', cost: 2, req: { item: 'medkit', consume: true, tierMin: 2 }, scaleType: 'aggression', ecosystem: true,
          effect: [
            { type: 'addScale', scale: 'aggression', amount: 2 },
            { type: 'setBirdReturn', cycle: state.cycle + 2 },
            { type: 'restoreBugsRiver' },
            { type: 'log', text: 'Жуки уничтожены.' },
            { type: 'restoreBugsRiver' }
          ]
        },
        { id: 'avoid_bugs', label: 'Обойти', cost: 1, req: null, scaleType: 'kindness', ecosystem: false,
          effect: [
            { type: 'addScale', scale: 'kindness', amount: 1 },
            { type: 'log', text: 'Вы избежали укусов.' }
          ]
        },
        { id: 'collect_food4', label: 'Собрать яйца из гнезда', cost: 1, req: { linkBroken: 'bird_bugs', resourceLoc: 'loc4' }, scaleType: 'expansion', ecosystem: false,
          effect: [
            { type: 'addFood', amount: 1 },
            { type: 'setResourceCollected', loc: 'loc4' },
            { type: 'log', text: 'Пища собрана.' }
          ]
        }
      ]
    };
  }

  const linkedText = allLinksDiscovered() ? getLinkedObjectText('loc4') : '';
  return {
    id: 'loc4', name, desc: 'Гнездо птицы-ящера. Птица охотится — пикирует в сторону ручья.',
    sense, objName: 'Птица-ящер', actions: [...intactActions, ...joint],
    linkedText: linkedText ? `<div class="linked-object">🔗 ${linkedText}</div>` : ''
  };
}

export function getFinalEncounter() {
  const name = 'Древо';
  const tier = getCycleTier();
  const canPass = (allLinksDiscovered() && allLinksIntact()) || ecosystemDestroyed() || (state.patternType === 'resonance' && state.patternProgress >= 4) || (state.patternType === 'dissonance' && state.patternProgress >= 4);
  const sense = 'Воздух густой. Пульс под ногами — тот же ритм, что у Хвоща и грибницы.';
  const joint = getRelForGroup() >= 4 ? [makeAction('joint_enter', '🤝 Войти вместе (совм.)', 0, () => canPass, 'symbiosis', false, 'Вы берётесь за руки.', () => { state.treePassed = true; addLog('✅ Древо пройдено вместе!'); state.phase = 'final'; window.render(); return 'Лес запомнил вашу связь.' }, { joint: true })] : [];
  const linkedText = getLinkedObjectText('final');
  if (tier === 'recon') return { id: 'final', name, desc: 'Огромное Древо. Кора плотная.', sense, objName: 'Древо (недоступно)', actions: [...joint, makeAction('observe_tree', 'Осмотреть', 1, () => true, 'expansion', false, 'Вы обходите Древо.', () => { if (!state.visitedTree) { state.visitedTree = true; state.currentGoal = 'Древо преграждает путь. Нужно понять экосистему.'; updateJournalTask(); } return 'Нужно вернуться позже.' })], linkedText: '' };
  if (canPass && tier !== 'recon') {
    let pf = '', pr = '';
    if (allLinksDiscovered() && allLinksIntact()) { pf = 'Древо принимает вас. Проход открыт.'; pr = 'Симбиоз. Вы в гармонии с Лесом.'; }
    else if (state.patternType === 'resonance') { pf = 'Ритм Леса синхронизирован с вашим пульсом. Древо открывается.'; pr = 'Резонанс. Вы настроились на Лес.'; }
    else if (state.patternType === 'dissonance') { pf = 'Древо трещит — и открывает проход.'; pr = 'Диссонанс. Вы сломали систему.'; }
    else { pf = 'Вы проходите через рану в коре.'; pr = 'Экспансия. Древо стонет, но проход открыт.'; }
    return { id: 'final', name, desc: 'Древо открыто. Проход перед вами.', sense, objName: 'Древо (открыто)', actions: [...joint, makeAction('pass_tree', 'Пройти', 0, () => true, 'symbiosis', false, pf, () => { state.treePassed = true; addLog('✅ Древо пройдено!'); state.phase = 'final'; window.render(); return pr; })], linkedText: linkedText ? `<div class="linked-object">🔗 ${linkedText}</div>` : '' };
  }
  return { id: 'final', name, desc: 'Огромное Древо. Кора плотная.', sense, objName: 'Древо (закрыто)', actions: [...joint, makeAction('observe_tree2', 'Осмотреть', 1, () => true, 'expansion', false, 'Вы изучаете отверстия.', () => 'Отверстия ждут.')], linkedText: linkedText ? `<div class="linked-object">🔗 ${linkedText}</div>` : '' };
}

export function getEncounter(step) {
  if (step === 4) return getFinalEncounter();
  return [getLoc1, getLoc2, getLoc3, getLoc4][step]();
}

export function updateJournalTask() {
  if (!state.visitedTree) return;
  state.journalTask = state.currentGoal;
}
// Временная старая версия getLoc1 для состояний cut/poisoned
function getLoc1_old() {
  const name = 'Поляна Хвоща';
  const tier = getCycleTier();
  const base = [];
  if (state.trappedLocations['loc1'] && !state.trapJustSet['loc1']) base.push(makeAction('retrieve_camtrap1', 'Снять фотоловушку', 0, () => true, 'expansion', false, 'Вы снимаете ловушку.', () => {
    state.trappedLocations['loc1'] = false;
    const ci = state.inventory.find(i => i.id === 'camtrap');
    if (ci) ci.count++; else state.inventory.push({ id: 'camtrap', name: 'Фотоловушка', tags: ['инструмент', 'наблюдение'], inGeneral: true, count: 1 });
    addLinkHint('tree_mushrooms', 'Фотоловушка: пульсация сока в направлении Локации 3.');
    return 'Данные сохранены.';
  }));
  const sense = 'Пахнет влажной землёй. Кора Хвоща мерцает, пульсируя едва заметным ритмом.';
  const joint = getRelForGroup() >= 3 ? [makeAction('joint_climb', '🤝 Подсадить (совм.)', 3, () => true, 'expansion', false, 'Один забирается на плечи другому.', () => {
    addLinkHint('tree_mushrooms', 'С высоты видно: пульсация синхронизирована с мерцанием в Локации 3. Пчёлы летят к Древу — вы видите всю картину целиком.');
    if (!state.links.tree_mushrooms.discovered) {
      state.links.tree_mushrooms.discovered = true;
      addJournalEntry('Пульс Хвоща синхронизирован с мерцанием Грибницы. Это единый организм — вы уверены в этом.', 'discovery');
    }
    return 'Вы увидели верхушки.';
  }, { joint: true })] : [];
  if (state.ecosystem.tree === 'cut') {
    if (state.treeRegrow === 0) state.treeRegrow = state.cycle + 2;
    if (state.cycle >= state.treeRegrow) {
      state.ecosystem.tree = 'intact';
      state.links.tree_mushrooms.intact = true;
      state.treeRegrow = 0;
      addJournalEntry('Хвощ вырос снова.', 'info');
      return getLoc1();
    }
    const extraText = state.cycle === state.treeRegrow - 1 ? 'Из пня пробивается росток Хвоща.' : 'Пень. Вокруг — ядовитая трава.';
    const extraFlavor = state.cycle === state.treeRegrow - 1 ? 'Росток можно срубить.' : 'Вы продираетесь через заросли. Острые листья цепляются за одежду.';
    return { id: 'loc1', name, desc: extraText, sense: 'Пульсация исчезла. ' + extraFlavor, objName: state.cycle === state.treeRegrow - 1 ? 'Росток Хвоща' : 'Ядовитая трава', actions: [...base, ...joint,
      state.cycle === state.treeRegrow - 1 ? makeAction('cut_sprout', 'Срубить росток', 1, () => tier !== 'recon' && activeHasItem('multitool'), 'aggression', true, 'Лезвие срезает росток.', () => { state.treeRegrow = 0; addScale('aggression', 1); addJournalEntry('Росток срублен. Хвощ не вырастет.', 'info'); return 'Росток уничтожен.' }, { req: 'Мультитул', discount: true }) : null,
      makeAction('avoid', 'Обойти', 1, () => true, 'kindness', false, 'Вы обходите заросли.', () => { state.avoidCounts.loc1++; const r = state.avoidCounts.loc1 === 2 ? 'Вы заметили: трава растёт только там, где почва пропитана соком Хвоща.' : (state.avoidCounts.loc1 > 2 ? 'Вы снова обошли траву.' : 'Вы миновали ловушку.'); if (state.avoidCounts.loc1 === 2) addLinkHint('tree_mushrooms', 'Трава растёт на соке Хвоща.'); addScale('kindness', 1); return r; })
    ].filter(a => a !== null) };
  }
  if (state.ecosystem.tree === 'poisoned') return { id: 'loc1', name, desc: 'Хвощ зачах — кора в пятнах.', sense: 'Пульсация едва слышна. Запах химии.', objName: 'Умирающий Хвощ', actions: [...base, ...joint,
    makeAction('end_suffering', 'Прекратить мучения', 1, () => tier !== 'recon' && activeHasItem('multitool'), 'aggression', true, 'Один надрез.', () => { addScale('aggression', 1); return 'Хвощ затих.' }, { req: 'Мультитул (Цикл 2+)', discount: true }),
    makeAction('try_heal', 'Исцелить', 3, () => tier !== 'recon' && activeHasItem('medkit'), 'kindness', true, 'Антидот в кору.', () => { useConsumable('medkit'); addScale('kindness', 2); state.ecosystem.tree = 'intact'; state.links.tree_mushrooms.intact = true; addJournalEntry('Хвощ исцелён.', 'info'); return 'Хвощ оживает.' }, { req: 'Аптечка (Цикл 2+)' })
  ] };
  // сюда не дойдём, но на всякий случай
  return getLoc1();
}