// js/render.js
import {
  state,
  getPerson, getItem, getRel, setRel,
  addLog, addJournalEntry, addScale, scaleName,
  hasTrait, hasItem,
  getActiveChar, activeHasTrait, activeHasItem, getActiveOd,
  getRandomExpeditionMember, getCycleTier, dominantScale, getRouteMood,
  useConsumable, ecosystemDestroyed, allLinksDiscovered, allLinksIntact,
  getActionScaleType, actionChangesObject, getTooltip,
  canDoJointAction, checkActionAvailable, getNodeIcon, getRelForGroup,
  getTreeDescription, getTreeBark, getProgressBark,
  checkPattern, getPatternFeedback, collectData,
  JOINT_REL_THRESHOLD, FOREST_RESPONSE_THRESHOLD, AGGRESSION_OD_PENALTY, KINDNESS_OD_BONUS, MAX_CYCLE,
  SECOND_EVENT_THRESHOLD, RANDOM_ENCOUNTER_CHANCE, CRITICAL_NIGHT_THRESHOLD
} from './state.js';
import {
  getEncounter, getFinalEncounter, tryDiscoverLinks, markLinkSeen, showLinkDiscovery,
  updateJournalLinks, updateJournalTask, getLinkedObjectText, getLoc1, getLoc2, getLoc3, getLoc4
} from './locations.js';
import {
  renderAggroBug, renderKindCaterpillar,
  showTraitPopup, setActiveChar,
  getReactionType, getReactionBark, getTraitForReaction, triggerReaction,
  getDialog, renderEvening, startEveningDialog,
  getNightEvent, getNightConsequence, applyNightConsequence,
  getNightDream, getNightReactionText, renderNight
} from './events.js';
import {
  processMorningState,
  performAction,
  performJointAction,
  performCamtrapAction,
  skipLocation,
  forcedReturnToBase,
  advanceRoute,
  applyForestResponseChoice,
  resolveAggroBug,
  resolveKindCaterpillar,
  resolveEvening,
  endNight
} from './engine.js';

// ---------- общие функции рендера ----------
export function showPhaseTransition(phaseName, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'phase-transition';
  overlay.innerHTML = `<div class="phase-label">${phaseName}</div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    document.body.removeChild(overlay);
    if (callback) callback();
  }, 500);
}

export function render() {
  const app = document.getElementById('app');
  document.getElementById('cycleInfo').textContent = `Цикл ${state.cycle}`;
  switch (state.phase) {
    case 'narrative_intro': app.innerHTML = renderNarrativeIntro(); break;
    case 'morning': app.innerHTML = renderMorning(); break;
    case 'expedition': app.innerHTML = renderExpedition(); break;
    case 'evening': app.innerHTML = renderEvening(); break;
    case 'night': app.innerHTML = renderNight(); break;
    case 'final': app.innerHTML = renderFinalScreen(); break;
  }
  setupDragDrop();
  renderJournal();
}

export function renderLogSection() {
  let h = '<div class="log-area">';
  state.log.slice(-8).forEach(l => {
    h += `<p>${l}</p>`;
  });
  h += '</div>';
  return h;
}

export function renderJournal() {
  const panel = document.getElementById('journalPanel');
  if (!panel) return;
  let h = '<h3>📓 Журнал</h3><div class="tabs">';
  h += `<button class="tab-btn active" onclick="switchJournalTab('entries')">Записи</button>`;
  h += `<button class="tab-btn" onclick="switchJournalTab('links')">Связи</button>`;
  h += `<button class="tab-btn" onclick="switchJournalTab('relations')">Отношения</button>`;
  h += `<button class="tab-btn" onclick="switchJournalTab('resources')">Ресурсы</button>`;
  h += `<button class="tab-btn" onclick="switchJournalTab('task')">Задача</button>`;
  h += '</div>';

  h += `<div class="tab-content active" id="jt-entries">`;
  state.journalEntries.slice(-20).forEach(e => {
    h += `<div class="journal-entry ${e.type}">${e.text}</div>`;
  });
  if (state.journalEntries.length === 0) h += '<div class="journal-entry">Пусто.</div>';
  h += '</div>';

  h += `<div class="tab-content" id="jt-links"><table class="links-mini">`;
  const ln = { tree_mushrooms: 'Хвощ → Грибница', flowers_bees: 'Цветы → Пчёлы', mush_bird: 'Грибница → Птица', bird_bugs: 'Птица → Жуки' };
  Object.entries(state.links).forEach(([k, v]) => {
    if (!v.discovered) return;
    const s = v.intact ? 'ЦЕЛА' : 'РАЗОРВАНА';
    const c = v.intact ? 'link-intact' : 'link-broken';
    h += `<tr><td>${ln[k] || k}</td><td class="${c}">${s}</td></tr>`;
  });
  if (!Object.values(state.links).some(l => l.discovered)) h += '<tr><td colspan="2">Связей пока нет.</td></tr>';
  h += '</table></div>';

  h += `<div class="tab-content" id="jt-relations">`;
  [['biolog', 'tech'], ['biolog', 'blogger'], ['tech', 'blogger']].forEach(([a, b]) => {
    const r = getRel(a, b);
    const pct = ((r + 5) / 10) * 100;
    h += `<div class="rel-mini">${getPerson(a).name} — ${getPerson(b).name} <div class="rel-bar-inline"><div class="rel-fill-inline ${r >= 0 ? 'rel-positive' : 'rel-negative'}" style="width:${pct}%"></div></div> ${r > 0 ? '+' : ''}${r}</div>`;
  });
  h += '</div>';

  h += `<div class="tab-content" id="jt-resources"><div class="journal-entry">🍖 Пища: ${state.baseResources.food}</div><div class="journal-entry">📡 Данные: ${state.dataCount}/10</div></div>`;

  h += `<div class="tab-content" id="jt-task"><div class="journal-entry">${state.currentGoal}</div>`;
  const pb = getProgressBark();
  h += `<div class="barks" style="margin-top:8px;">${pb}</div>`;
  if (state.cycle >= 6) {
    h += `<div class="deadline-banner" style="margin-top:8px;"><h4>⚠ Лес сгущается</h4><p>${state.cycle >= 9 ? 'Последний шанс.' : (state.cycle >= 8 ? 'Время на исходе. Нужно пройти скорее.' : 'Вы чувствуете — время не бесконечно.')}</p></div>`;
  }
  h += '</div>';

  panel.innerHTML = h;
}

export function switchJournalTab(t) {
  document.querySelectorAll('#journalPanel .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#journalPanel .tab-content').forEach(c => c.classList.remove('active'));
  const idx = { entries: 1, links: 2, relations: 3, resources: 4, task: 5 }[t] || 1;
  const btn = document.querySelector(`#journalPanel .tab-btn:nth-child(${idx})`);
  if (btn) btn.classList.add('active');
  const content = document.getElementById(`jt-${t}`);
  if (content) content.classList.add('active');
}

export function renderNarrativeIntro() {
  const t = getCycleTier();
  let text = '';
  if (t === 'recon') {
    text = '<p style="font-size:12px;color:#8b949e;margin-bottom:16px;font-style:italic;">Корпорация SUR отправляет малую исследовательскую группу на планетоид KDVA-100216. Они станут первопроходцами в загадочном Лесу, куда не ступала нога человека.</p><p><span class="speaker">Биолог:</span></p><p>«Мы только что высадились. Первый день — только наблюдение. Мы должны понять, куда мы попали. Осмотритесь, прикоснитесь. Инструменты и агрессивные действия — позже.»</p>';
  } else if (t === 'tools') {
    text = '«Я разрешаю использовать инструменты. Но никакого яда, никакого добивания. Изучаем глубже.»';
    state.currentGoal = 'Познать экосистему и её связи, чтобы найти дорогу дальше.';
  } else {
    text = '«Все ограничения сняты. Действуйте решительно — но помните: каждый выбор оставит след.»';
  }
  let h = '<div class="narrative-intro">';
  if (t === 'recon') h += text;
  else h += `<p><span class="speaker">Биолог:</span></p><p>${text}</p>`;
  h += `<button class="btn primary" onclick="showPhaseTransition('🌅 Утро',()=>{state.phase='morning';render();})">Продолжить</button></div>`;
  if (t === 'tools') {
    h += '<div class="narrative-intro" style="margin-top:12px;"><p><span class="speaker">После возвращения:</span></p>';
    h += '<p><b>Биолог:</b> «Это сложная система. Разгадаем её — поймём, как пройти через Древо.»</p>';
    h += '<p><b>Техник:</b> «Да сломать её, и всё!»</p>';
    h += '<p><b>Биолог:</b> «Нет. Сегодня — без агрессии.»</p></div>';
  }
  return h;
}

// ---------- drag & drop ----------
export let draggedItem = null;
export function setupDragDrop() {
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedItem = card.dataset.item;
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', e => {
      card.style.opacity = '1';
      draggedItem = null;
    });
  });
  document.querySelectorAll('.slot:not(.locked)').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('hover'); });
    slot.addEventListener('dragleave', e => { slot.classList.remove('hover'); });
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('hover');
      if (!draggedItem) return;
      const item = getItem(draggedItem);
     if(item&&!item.inGeneral)return;
     if(state.cycle <= 1) return; // в первом цикле перетаскивание запрещено
      const pid = slot.dataset.person;
      const si = parseInt(slot.dataset.slot);
      const p = getPerson(pid);
      if (!p) return;
      if (p.slots[si] && getItem(p.slots[si]) && !getItem(p.slots[si]).inGeneral) return;
      state.persons.forEach(pp => { pp.slots = pp.slots.map(s => s === draggedItem ? null : s); });
      p.slots[si] = draggedItem;
      render();
    });
  });
}

// ---------- утро (только рендер) ----------
export function renderMorning() {
  processMorningState(); // вызов из engine
  let h = `<div class="phase-title">🌅 Утро — Цикл ${state.cycle}</div>`;
  h += `<div class="goal-box"><h3>🎯 Цель</h3><p>${state.currentGoal}</p></div>`;
  if (state.modifier) {
    h += `<div class="modifier-banner"><h4>⚠ Сегодня: ${state.modifier.name}</h4><p>${state.modifier.desc}</p></div>`;
  }
  if (state.dropPodArrived && state.dropPodResources) {
    h += `<div class="drop-pod-announce"><h4>📦 Дроп-под от Корпорации</h4><p>Корпорация прислала дроп-под: +${state.dropPodResources.food} еды.</p></div>`;
    // сброс произойдёт в processMorningState, но визуально уже отобразим
  }
  if (state._restedPerson) {
    const p = getPerson(state._restedPerson);
    if (p) h += `<div class="modifier-banner"><h4>🛌 Отдых на базе</h4><p>${p.name} отдохнул на базе (+2 ОД на следующий день).</p></div>`;
  }
  if (state.cycle >= MAX_CYCLE) { state.phase = 'final'; render(); return ''; }
  if (state.nightBarks.length > 0) {
    h += '<div class="section"><h3>💬 Утренние разговоры</h3>';
    state.nightBarks.forEach(b => { h += `<div class="barks">— ${b}</div>`; });
    h += '</div>';
    state.nightBarks = [];
  }
  h += renderRouteMap();
  h += renderCharacterSelection();
  if (state.cycle > 1) h += renderInventorySection();
  else h += '<div class="section"><h3>🎒 Общий инвентарь</h3><p style="color:#8b949e;font-size:12px;">Недоступен в первом цикле.</p></div>';
  const canGo = state.selectedExpedition.length === 2;
  h += `<button class="btn primary" ${canGo ? '' : 'disabled'} onclick="showPhaseTransition('🌲 День',()=>{startExpedition();})">Отправиться в Лес</button>`;
  h += renderLogSection();
  return h;
}

export function renderRouteMap() {
  const locNames = { loc1: 'Хвощ', loc2: 'Ручей', loc3: 'Гриб', loc4: 'Птица', final: 'Древо' };
  let h = '<div class="section"><h3>🗺️ Карта маршрута</h3><div class="mini-map">';
  Object.entries(locNames).forEach(([id, name], i) => {
    h += `<div class="mini-node" title="${name}">${getNodeIcon(id)}</div>`;
    if (i < 4) h += '<div class="mini-map-arrow">→</div>';
  });
  h += '</div>';
  if (state.cycle >= 2) {
    h += '<div class="mini-map-labels">';
    Object.entries(locNames).forEach(([id, name], i) => {
      h += `<div class="mini-map-label">${name}</div>`;
      if (i < 4) h += '<div class="mini-map-arrow"></div>';
    });
    h += '</div>';
  }
  h += `<div class="route-mood">Состояние: ${getRouteMood()}</div></div>`;
  return h;
}

export function renderCharacterSelection() {
  let h = '<div class="section"><h3>Кто идёт в Лес? (выберите 2)</h3><div class="row">';
  state.persons.forEach(p => {
    const sel = state.selectedExpedition.includes(p.id);
    h += `<div class="card${sel ? ' selected' : ''}" onclick="toggleExpedition('${p.id}')"><div class="name">${p.name}</div><div class="role">${p.role}</div><div class="od">ОД: ${p.od}/${p.maxOd}</div><div class="traits">${p.traits.join(', ')}</div>${p.status ? `<div class="status" title="Получено при вынужденном возвращении из-за нехватки ОД">${p.status}</div>` : ''}<div class="slots">`;
    for (let i = 0; i < p.slots.length; i++) {
      h += renderSlot(p.slots[i], p.id, i);
    }
    h += '</div></div>';
  });
  h += '</div></div>';
  return h;
}

export function renderSlot(slotContent, personId, slotIndex) {
  let display = 'пусто';
  let cls = 'slot';
  if (slotContent) {
    const item = getItem(slotContent);
    if (item) {
      display = item.name;
      cls += ' filled';
      if ((item.id === 'scanner' && state.scannerCharge === 0) || (item.id === 'drone' && state.droneCharge === 0)) cls += ' depleted';
    } else {
      display = slotContent;
    }
  }
  const locked = (slotContent && getItem(slotContent) && !getItem(slotContent).inGeneral) || (state.cycle === 1 && slotIndex === 1);
  if (locked) cls += ' locked';
  return `<div class="${cls}" data-person="${personId}" data-slot="${slotIndex}" onclick="event.stopPropagation();${locked ? '' : `clearSlot('${personId}',${slotIndex})`}">${display}</div>`;
}

export function renderInventorySection() {
  let h = '<div class="section"><h3>🎒 Общий инвентарь</h3><div class="inventory">';
  state.inventory.filter(i => i.inGeneral).forEach(item => {
    const cnt = item.count || 1;
    h += `<div class="item-card" draggable="true" data-item="${item.id}"><div>${item.name}${cnt > 1 ? ` (${cnt})` : ''}</div><div class="tags">${item.tags.join(', ')}</div></div>`;
  });
  h += '</div></div>';
  return h;
}

export function toggleExpedition(id) {
  if (state.selectedExpedition.includes(id)) state.selectedExpedition = state.selectedExpedition.filter(x => x !== id);
  else if (state.selectedExpedition.length < 2) state.selectedExpedition.push(id);
  render();
}

export function clearSlot(pid, si) {
  const p = getPerson(pid);
  if (p && p.slots[si] && getItem(p.slots[si]).inGeneral && state.cycle > 1) {
    p.slots[si] = null;
    render();
  }
}

export function startExpedition() {
  if (state.selectedExpedition.length !== 2) return;
  state.basePerson = state.persons.find(p => !state.selectedExpedition.includes(p.id));
  state.routeProgress = 0;
  state.locationDone = false;
  state.actionsThisStep = [];
  state.activeChar = null;
  state.jointActionUsed = false;
  state.actionsThisLocation = [];
  state.actionsThisRoute = [];
  state.odSpentThisLocation = false;
  state.encounterTriggered = false;
  state.droneCharge = 1;
  state.scannerCharge = 1;
  state.reactionData = null;
  state._droneBeesUsed = false;
  state._droneBirdUsed = false;
  state.extraOdCost = 0;
  state.patternType = null;
  state.patternProgress = 0;
  state.patternActions = [];
  state.resourceCollectedThisRoute = { loc1: false, loc2: false, loc3: false, loc4: false };
  state.phase = 'expedition';
  addLog(`В Лес: ${state.selectedExpedition.map(id => getPerson(id).name).join(' и ')}.`);
  render();
}

// ---------- экспедиция (рендер) ----------
export function renderExpedition() {
  const total = 5;
  const step = state.routeProgress;
  const stepLabels = ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Финальная'];
  const locNames = ['Поляна Хвоща', 'Берег ручья', 'Грибная поляна', 'Гнездо птицы-ящера', 'Древо'];
  let html = '<div class="phase-title">🌲 День — Экспедиция</div>';

  const canHaveEncounter = !(state.patternType && state.patternProgress >= 2);
  if (!state.encounterTriggered && canHaveEncounter && state.scales.aggression >= 3 && Math.random() < RANDOM_ENCOUNTER_CHANCE) {
    state.encounterTriggered = true;
    return renderAggroBug();
  }
  if (step === 0 && !state.encounterTriggered && canHaveEncounter) {
    state.encounterTriggered = true;
    if (state.scales.aggression >= 3 && state.scales.aggression >= state.scales.kindness) return renderAggroBug();
    if (state.scales.kindness >= 3 && state.scales.kindness > state.scales.aggression) return renderKindCaterpillar();
  }
  if (state.patternType && state.patternProgress >= 2 && !state.encounterTriggered) {
    state.encounterTriggered = true;
    html += '<div class="barks" style="color:#a371f7;margin-bottom:8px;">Лес чувствует вашу цель и не мешает.</div>';
  }

  html += `<div class="section"><h3>Маршрут: ${getRouteMood()}</h3><div class="route-map">`;
  stepLabels.forEach((s, i) => {
    let cls = 'route-node';
    if (i < step) cls += ' done';
    if (i === step) cls += ' current';
    html += `<div class="${cls}" title="${locNames[i]}">${s}</div>`;
    if (i < stepLabels.length - 1) html += '<div class="route-arrow">→</div>';
  });
  html += '</div></div>';

  if (state.patternType && state.patternProgress > 0 && state.patternProgress < 4) {
    const nm = state.patternType === 'resonance' ? 'Резонанс' : 'Диссонанс';
    html += `<div class="pattern-progress">${nm}: ${'●'.repeat(state.patternProgress)}${'○'.repeat(4 - state.patternProgress)} (${state.patternProgress}/4)</div>`;
  }

  if (step === total - 1) {
    html += `<div class="section"><h3>Древо</h3><div class="tree-description">${getTreeDescription()}</div><div class="barks">${getTreeBark()}</div></div>`;
  }

  html += '<div class="section"><h3>Персонажи</h3>';
  state.selectedExpedition.forEach(pid => {
    const p = getPerson(pid);
    const active = state.activeChar === pid;
    html += `<div class="char-mini${active ? ' active-char' : ''}" onclick="setActiveChar('${pid}')"><span>${p.name}</span>`;
    if (p.status) html += ` <span class="mini-status">[${p.status}]</span>`;
    html += ` <span class="mini-traits">${p.traits.join(', ')}</span>`;
    html += ' <div class="slots" style="display:inline-flex;gap:2px;margin:0 4px;">';
    for (let i = 0; i < p.slots.length; i++) {
      const s = p.slots[i];
      let display = '—';
      let slotCls = 'slot';
      if (s) {
        const item = getItem(s);
        if (item) {
          display = item.name;
          slotCls += ' filled';
          if ((item.id === 'scanner' && state.scannerCharge === 0) || (item.id === 'drone' && state.droneCharge === 0)) slotCls += ' depleted';
        } else {
          display = s;
        }
      }
      html += `<div class="${slotCls}" style="width:28px;height:22px;font-size:6px;">${display}</div>`;
    }
    html += '</div>';
    html += ' ОД: ';
    for (let i = 0; i < p.maxOd; i++) html += `<span class="od-dot${i >= p.od ? ' used' : ''}"></span>`;
    html += ` ${p.od}/${p.maxOd} ${active ? '◀' : ''}</div>`;
  });
  if (!state.activeChar) html += '<div class="char-select-hint">⚠ Выберите персонажа</div>';
  html += '</div>';

  if (!state.locationDone) {
    const enc = getEncounter(step);
    markLinkSeen(enc.id);
    const camActions = enc.actions.filter(a => a.id.startsWith('retrieve_camtrap'));
    const jointActions = enc.actions.filter(a => a.joint);
    const otherActions = enc.actions.filter(a => !camActions.includes(a) && !jointActions.includes(a));

    html += `<div class="section"><h3>Локация ${step + 1}: ${enc.name}</h3>`;
    html += `<div class="encounter-box"><p>${enc.desc}</p><div class="sense-text">${enc.sense || ''}</div><p class="obj-name">Объект: ${enc.objName}</p>`;
    if (enc.linkedText) html += enc.linkedText;

    if (state.resultText) {
      let cls = 'result-text';
      if (state.resultText.includes('РАЗОРВАНА') || state.resultText.includes('уничтож')) cls += ' aggressive';
      else if (state.resultText.includes('Резонанс') || state.resultText.includes('Диссонанс') || state.resultText.includes('настраивать') || state.resultText.includes('разрушать')) cls += ' pattern';
      html += `<div class="${cls}">${state.resultText}</div>`;
    }
    if (state.reactionData) {
      const rd = state.reactionData;
      html += `<div class="reaction-text ${rd.type}"><span class="trait-tag">${rd.reactor} (${rd.trait || ''}):</span> ${rd.bark} <span style="font-size:10px;color:#8b949e;">Отношения ${rd.type === 'positive' ? '+1' : rd.type === 'negative' ? '-1' : '0'}</span></div>`;
      state.reactionData = null;
    }

    if (jointActions.length > 0 && !state.jointActionUsed) {
      html += '<div class="actions">';
      jointActions.forEach(a => {
        const avail = checkActionAvailable(a);
        let cls = 'action-btn joint-act';
        const tip = avail.reason ? `data-tooltip="${avail.reason}"` : '';
        html += `<button class="${cls}${!avail.ok ? ' locked' : ''}" ${avail.ok ? '' : 'disabled'} ${tip} onclick="performJointAction('${a.id}',${a.cost})">${a.label} (${a.cost} ОД)</button>`;
      });
      html += '</div>';
    }

    if (otherActions.length > 0 || camActions.length > 0) {
      html += '<div class="actions">';
      otherActions.forEach(a => {
        const avail = checkActionAvailable(a);
        let cls = 'action-btn';
        const tip = avail.reason ? `data-tooltip="${avail.reason}"` : '';
        html += `<button class="${cls}${!avail.ok ? ' locked' : ''}" ${avail.ok ? '' : 'disabled'} ${tip} onclick="performAction('${a.id}',${a.cost},'${enc.id}')">${a.label} (${a.cost} ОД)${a.req ? ' 🔒' : ''}</button>`;
      });
      camActions.forEach(a => {
        const avail = checkActionAvailable(a);
        let cls = 'action-btn';
        const tip = avail.reason ? `data-tooltip="${avail.reason}"` : '';
        html += `<button class="${cls}${!avail.ok ? ' locked' : ''}" ${avail.ok ? '' : 'disabled'} ${tip} onclick="performCamtrapAction('${a.id}',${a.cost})">${a.label} (${a.cost} ОД)</button>`;
      });
      html += '</div>';
    }

        const allOdZero = state.selectedExpedition.every(pid => getPerson(pid).od <= 0);
    if (allOdZero) {
      html += `<button class="btn primary" style="margin-top:6px;" onclick="forcedReturnToBase()">Вернуться в лагерь (0 ОД)</button>`;
    } else {
      html += `<button class="action-btn" style="margin-top:6px;" onclick="skipLocation()">Пойти дальше (0 ОД)</button>`;
    }
    html += '</div></div>';
  } else {
    html += `<div class="section"><p>Действие выполнено.</p><button class="btn primary" onclick="advanceRoute()">${step >= total - 1 ? 'Завершить' : 'Дальше'}</button></div>`;
  }
  html += renderLogSection();
  return html;
}

// рендер ответа леса
export function renderForestResponse() {
  const dom = dominantScale();
  let desc = '', choice1 = '', choice2 = '', key = '';
  if (dom === 'symbiosis') {
    desc = 'Лес узнаёт вас. Ветви расступаются, воздух наполняется тихим ритмом.';
    choice1 = 'Позволить вести (агрессивные действия блокируются, +1 Симбиоз)';
    choice2 = 'Идти своим путём';
    key = 'allow';
  } else if (dom === 'expansion') {
    desc = 'Тропы сместились. Появились новые, короткие пути.';
    choice1 = 'Исследовать новые тропы (сканирование дешевле, риск агрессивного энкаунтера)';
    choice2 = 'Держаться известного (нет случайных энкаунтеров)';
    key = 'explore';
  } else if (dom === 'aggression') {
    desc = 'Лес ощетинился. Колючие ветви преграждают путь.';
    choice1 = 'Пробиться силой (агрессивные действия +1 к шкале, все теряют 1 ОД)';
    choice2 = 'Обойти, уважая границы (агрессивные действия дороже, без потерь ОД)';
    key = 'force';
  } else if (dom === 'kindness') {
    desc = 'Лес благодарит. Мягкий свет, цветы под ногами.';
    choice1 = 'Принять дар (+2 ОД одному персонажу, следующее агрессивное действие отменено)';
    choice2 = 'Скромно продолжить (добрые действия дают +1 к шкале)';
    key = 'accept';
  }
  return `<div class="phase-title">🌲 День — Экспедиция</div><div class="section"><h3>Лес реагирует</h3><div class="encounter-box"><p>${desc}</p><div class="actions"><button class="action-btn" onclick="applyForestResponseChoice('${key}')">${choice1}</button><button class="action-btn" onclick="applyForestResponseChoice('ignore')">${choice2}</button></div></div></div>`;
}

// ---------- финал и сброс ----------
export function renderFinalScreen() {
  let path = 'expansion';
  if (allLinksDiscovered() && allLinksIntact()) path = 'symbiosis';
  else if (state.patternType === 'resonance') path = 'resonance';
  else if (state.patternType === 'dissonance') path = 'dissonance';
  const epilogues = {
    symbiosis: 'Вы прошли через Древо, и Лес принял вас. Вы стали частью экосистемы — не захватчиками, а гостями. Впереди — новая глава, и Лес будет вашим проводником.',
    expansion: 'Вы прошли через рану. Древо стонет за вашей спиной. Вы достигли цели — но Лес запомнит. Где-то глубоко под корнями уже зреет ответ.',
    resonance: 'Ритм Леса синхронизирован с вашим пульсом. Вы не просто прошли через Древо — вы стали его частью. То, что ждёт впереди, теперь знает вас по имени.',
    dissonance: 'Древо сломлено. Вы прошли через трещину в реальности. Но в тишине, которая наступила, вы слышите — Лес не умер. Он ждёт.'
  };
  let h = '<div class="final-screen"><h2>Вы прошли через Древо</h2>';
  h += `<p class="stat">Путь: <b>${path === 'symbiosis' || path === 'resonance' ? '🌿 Симбиоз' : '💥 Экспансия'}</b></p>`;
  h += `<p class="stat"><span>Циклов:</span> ${state.cycle}</p>`;
  h += `<p class="stat"><span>Связей познано:</span> ${Object.values(state.links).filter(l => l.discovered).length}/4</p>`;
  h += `<p class="stat"><span>Связей цело:</span> ${Object.values(state.links).filter(l => l.intact).length}/4</p>`;
  h += `<div class="epilogue">${epilogues[path]}</div>`;
  h += '<div class="actions" style="justify-content:center;margin-top:16px;"><button class="btn primary" onclick="resetGame()">Начать заново</button></div></div>';
  return h;
}

export function resetGame() {
  state.cycle = 1;
  state.phase = 'narrative_intro';
  state.selectedExpedition = [];
  state.basePerson = null;
  state.routeProgress = 0;
  state.locationDone = false;
  state.actionsThisStep = [];
  state.actionsThisLocation = [];
  state.actionsThisRoute = [];
  state.activeChar = null;
  state.treePassed = false;
  state.goalShown = false;
  state.visitedTree = false;
  state.trappedLocations = {};
  state.trapJustSet = {};
  state.encounterTriggered = false;
  state.droneCharge = 1;
  state.scannerCharge = 1;
  state.modifier = null;
  state.nightBarks = [];
  state.jointActionUsed = false;
  state.odSpentThisLocation = false;
  state.reactionData = null;
  state.previousScales = null;
  state.currentGoal = 'Исследовать маршрут и найти дорогу дальше.';
  state._droneBeesUsed = false;
  state._droneBirdUsed = false;
  state.deepContactUsed = false;
  state.nightReaction = '';
  state.nightOdWarning = '';
  state.avoidCounts = { loc1: 0, loc4: 0 };
  state.criticalNightsTriggered = [];
  state.dreamsUsed = [];
  state.journalEntries = [];
  state.extraOdCost = 0;
  state.riverState = 'clean';
  state._riverSeen = false;
  state._treeSeen = false;
  state._flowersRegrow = 0;
  state.treeRegrow = 0;
  state.birdReturn = 0;
  state._harmonyHintShown = false;
  state._mushroomRegrow = 0;
  state.usedDialogs = [];
  state._treeMushroomDiscoveryText = '';
  state.patternType = null;
  state.patternProgress = 0;
  state.patternActions = [];
  state._modifiedOd = [];
  state._aggressionOdTriggered = false;
  state._kindnessOdTriggered = false;
  state._restedPerson = null;
  state._dialog = null;
  state._nightEvent = null;
  state.baseResources = { food: 6 };
  state.dataCount = 0;
  state.dataCollectedActions = {};
  state.reportReady = false;
  state.dropPodArrived = false;
  state.dropPodResources = null;
  state.resourceCollectedThisRoute = { loc1: false, loc2: false, loc3: false, loc4: false };
  state._pendingEcosystemChanges = {};
  state._dialog = null;
  state._nightEvent = null;
  state.scales = { aggression: 0, kindness: 0, expansion: 0, symbiosis: 0 };
  state.relations = { 'biolog_tech': 0, 'biolog_blogger': 0, 'tech_blogger': 0 };
  state.ecosystem = { tree: 'intact', flowers: 'intact', mushrooms: 'intact', bird: 'intact' };
  state.links = {
    tree_mushrooms: { discovered: false, intact: true, type: 'structure', seenA: false, seenB: false, hint: '' },
    flowers_bees: { discovered: false, intact: true, type: 'behavior', seenA: false, seenB: false, hint: '' },
    mush_bird: { discovered: false, intact: true, type: 'mixed', seenA: false, seenB: false, hint: '' },
    bird_bugs: { discovered: false, intact: true, type: 'behavior', seenA: false, seenB: false, hint: '' },
    bugs_river: { discovered: false, intact: true, type: 'behavior', seenA: false, seenB: false, hint: '' },
    river_tree: { discovered: false, intact: true, type: 'structure', seenA: false, seenB: false, hint: '' }
  };
  state.journal = '';
  state.journalLinks = '';
  state.journalTask = '';
  state.journalNotes = '';
  state.log = [];
  state.inventory = [
    { id: 'medkit', name: 'Аптечка', tags: ['медикамент'], inGeneral: true, count: 2 },
    { id: 'camtrap', name: 'Фотоловушка', tags: ['инструмент', 'наблюдение'], inGeneral: true, count: 1 },
    { id: 'scanner', name: 'Щуп-сканер', tags: ['инструмент', 'исследование', 'структура'], inGeneral: false, owner: 'biolog' },
    { id: 'multitool', name: 'Мультитул', tags: ['инструмент', 'ремонт'], inGeneral: false, owner: 'tech' },
    { id: 'drone', name: 'Дрон', tags: ['инструмент', 'разведка', 'поведение'], inGeneral: false, owner: 'blogger' }
  ];
  state.persons.forEach(p => {
    p.baseOd = 5; p.maxOd = 5; p.od = 5;
    p.slots = [p.personalItem, null];
    p.status = null;
    p.traits = p.id === 'biolog' ? ['Эмпат', 'Наблюдательность'] : p.id === 'tech' ? ['Прагматик', 'Скептик'] : ['Связь с Лесом', 'Медийность'];
  });
  render();
}

// экспортируем для main.js
window.showPhaseTransition = showPhaseTransition;
window.render = render;
window.renderJournal = renderJournal;
window.resetGame = resetGame;
window.toggleExpedition = toggleExpedition;
window.clearSlot = clearSlot;
window.startExpedition = startExpedition;
window.performAction = performAction;
window.performJointAction = performJointAction;
window.performCamtrapAction = performCamtrapAction;
window.skipLocation = skipLocation;
window.forcedReturnToBase = forcedReturnToBase;
window.advanceRoute = advanceRoute;
window.applyForestResponseChoice = applyForestResponseChoice;
window.resolveAggroBug = resolveAggroBug;
window.resolveKindCaterpillar = resolveKindCaterpillar;
window.resolveEvening = resolveEvening;
window.endNight = endNight;
window.processMorningState = processMorningState;