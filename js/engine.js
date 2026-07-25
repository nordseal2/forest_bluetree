// js/engine.js – чистые функции, изменяющие состояние
import {
  state,
  getPerson, getItem, getRel, setRel,
  addLog, addJournalEntry, addScale, scaleName,
  hasTrait, hasItem, getActiveChar, activeHasItem,
  getActiveOd, getRandomExpeditionMember, getCycleTier,
  dominantScale, useConsumable, ecosystemDestroyed,
  allLinksDiscovered, allLinksIntact, getActionScaleType,
  actionChangesObject, checkActionAvailable, getRelForGroup,
  getTreeDescription, getTreeBark, getProgressBark,
  checkPattern, getPatternFeedback, collectData,
  JOINT_REL_THRESHOLD, FOREST_RESPONSE_THRESHOLD, MAX_CYCLE,
  SECOND_EVENT_THRESHOLD, AGGRESSION_OD_PENALTY, KINDNESS_OD_BONUS
} from './state.js';
import {
  getEncounter, tryDiscoverLinks, markLinkSeen, showLinkDiscovery,
  updateJournalLinks, updateJournalTask, getLinkedObjectText,
  addLinkHint, checkHarmonyHint
} from './locations.js';
import {
  getReactionType, getReactionBark, getTraitForReaction, triggerReaction,
  getDialog, getNightEvent, getNightConsequence, applyNightConsequence,
  getNightDream, getNightReactionText
} from './events.js';

// ---------- утро ----------
export function processMorningState() {
  if (state.dropPodArrived && state.dropPodResources) {
    state.baseResources.food += state.dropPodResources.food;
    state.dropPodArrived = false;
    state.dropPodResources = null;
  }
  state.persons.forEach(p => {
    if (p.status && p.status.includes('Голод') && state.baseResources.food > 0) {
      p.status = null;
      p.maxOd = Math.min(7, p.baseOd);
      p.od = Math.min(p.od, p.maxOd);
      addJournalEntry(`${p.name} больше не голодает.`, 'info');
    }
  });
  if (!state._aggressionOdTriggered && state.scales.aggression >= AGGRESSION_OD_PENALTY) {
    state._aggressionOdTriggered = true;
    state.persons.forEach(p => {
      p.status = 'Давление Леса (-1 ОД)';
      p.maxOd = Math.max(1, p.baseOd - 1);
      p.od = Math.min(p.od, p.maxOd);
    });
  }
  if (!state._kindnessOdTriggered && state.scales.kindness >= KINDNESS_OD_BONUS) {
    state._kindnessOdTriggered = true;
    state.persons.forEach(p => {
      p.status = 'Благословение Леса (+1 ОД)';
      p.maxOd = Math.min(7, p.baseOd + 1);
      p.od = p.maxOd;
    });
  }
  if (state._restedPerson) {
    const p = getPerson(state._restedPerson);
    if (p) {
      p.maxOd = Math.min(7, p.maxOd + 2);
      p.od = Math.min(p.maxOd, p.od + 2);
    }
    state._restedPerson = null;
  }
}

// ---------- действия ----------
export function executeAction(action) {
  if (!action.effect) return;
  action.effect.forEach(eff => {
    switch (eff.type) {
      case 'addScale':
        addScale(eff.scale, eff.amount);
        break;
      case 'collectData':
        collectData(eff.actionId, eff.amount);
        break;
      case 'addLinkHint':
        addLinkHint(eff.linkId, eff.text);
        break;
      case 'log':
        state.resultText = (action.flavor || '') + ' ' + eff.text;
        addLog(eff.text);
        break;
      case 'useCharge':
        if (eff.charge === 'scannerCharge') state.scannerCharge = 0;
        if (eff.charge === 'droneCharge') state.droneCharge = 0;
        break;
      case 'changeEcosystem':
        state.ecosystem[eff.key] = eff.value;
        break;
      case 'breakLink':
        state.links[eff.linkId].intact = false;
        state.links[eff.linkId].discovered = true;
                if (eff.linkId === 'bird_bugs') {
          state.riverState = 'muddy';
          state.links.river_tree.intact = false;   // <-- добавить
          addJournalEntry('Вода в ручье помутнела из-за нашествия жуков.', 'info');
        }
        updateJournalLinks();
        checkHarmonyHint();
        break;
      case 'addJournal':
        addJournalEntry(eff.text, eff.type || 'info');
        break;
      case 'discoverLink':
        if (!state.links[eff.linkId].discovered) {
          state.links[eff.linkId].discovered = true;
          addJournalEntry('Пульс Хвоща синхронизирован с мерцанием Грибницы. Это единый организм — вы уверены в этом.', 'discovery');
        }
        break;
      case 'addFood':
        state.baseResources.food += eff.amount;
        break;
      case 'setResourceCollected':
        state.resourceCollectedThisRoute[eff.loc] = true;
        break;
      case 'setTrapped':
        state.trappedLocations[eff.loc] = true;
        state.trapJustSet[eff.loc] = true;
        break;
      case 'addItem':
        state.inventory.push({ id: eff.itemId, name: eff.name, tags: eff.tags || [], inGeneral: true, count: eff.count || 1 });
        break;
      case 'setRiverState':
        state.riverState = eff.value;
        // Обновляем связь Ручей → Хвощ: цела, только если вода чистая
        state.links.river_tree.intact = (state.riverState === 'clean');
        updateJournalLinks();
        break;
      case 'setFlowersRegrow':
        state._flowersRegrow = eff.cycle;
        break;
              case 'consumeItem':
        useConsumable(eff.itemId);
        break;
      case 'setMushroomRegrow':
        state._mushroomRegrow = eff.cycle;
        break;
      case 'addItem':   // уже должен быть с прошлого раза, но проверьте
        state.inventory.push({ id: eff.itemId, name: eff.name, tags: eff.tags || [], inGeneral: true, count: eff.count || 1 });
        break;
      case 'setBirdReturn':
        state.birdReturn = eff.cycle;
        break;
      case 'restoreBugsRiver':
        if (!state.links.bugs_river.intact) {
          state.links.bugs_river.intact = true;
          addLog('Популяция жуков сократилась. Ручей начинает очищаться.');
        }
        break;
      case 'scheduleEcosystemChange':
        if (!state._pendingEcosystemChanges) state._pendingEcosystemChanges = {};
        state._pendingEcosystemChanges[eff.key] = eff.value;
        break;
    }
  });
}

export function performAction(actionId, cost, locId) {
  const enc = getEncounter(state.routeProgress);
  const action = enc.actions.find(a => a.id === actionId);
  if (!action) return;
  const ac = getActiveChar();
  if (!ac) return;
  ac.od -= (cost + state.extraOdCost);
  if (ac.od < 0) ac.od = 0;

  // новый декларативный вызов
if (typeof action.result === 'function') {
  const r = action.result();
  state.resultText = (action.flavor || '') + ' ' + (r || '');
  addLog(r);
} else {
  executeAction(action);
  state.resultText = state.resultText || (action.flavor || '');
}

  state.actionsThisStep.push(actionId);
  state.actionsThisLocation.push({
    pid: state.activeChar,
    scaleType: action.scaleType || getActionScaleType(actionId),
    loc: locId,
    id: actionId
  });
  state.actionsThisRoute.push({
    pid: state.activeChar,
    scaleType: action.scaleType || getActionScaleType(actionId),
    loc: locId,
    id: actionId
  });
  if (cost > 0) state.odSpentThisLocation = true;
  const st = action.scaleType || getActionScaleType(actionId);
  if (st) triggerReaction(st);
  const patternResult = checkPattern(actionId, locId);
  if (patternResult) {
    const fb = getPatternFeedback();
    if (fb) {
      state.resultText += ` <span style="color:#a371f7;">${fb.bark}</span>`;
      if (fb.react) {
        const otherPid = state.selectedExpedition.find(pid => pid !== state.activeChar);
        if (otherPid) state.reactionData = { reactor: getPerson(otherPid).name, bark: fb.react, trait: '', type: 'positive' };
      }
    }
  }
  try { tryDiscoverLinks(); } catch (e) { console.error(e); }
  window.renderJournal();
  window.render();
}

export function performJointAction(actionId, cost) {
  const enc = getEncounter(state.routeProgress);
  const action = enc.actions.find(a => a.id === actionId);
  if (!action) return;
  const ac = getActiveChar();
  if (!ac) return;
  ac.od -= Math.ceil(cost / 2);
  const otherPid = state.selectedExpedition.find(pid => pid !== state.activeChar);
  if (otherPid) {
    const other = getPerson(otherPid);
    other.od -= Math.floor(cost / 2);
    if (other.od < 0) other.od = 0;
  }
  if (ac.od < 0) ac.od = 0;
if (typeof action.result === 'function') {
  const r = action.result();
  state.resultText = (action.flavor || '') + ' ' + (r || '');
  addLog(r);
} else {
  executeAction(action);
  state.resultText = state.resultText || (action.flavor || '');
}
  addLog(r);
  state.jointActionUsed = true;
  state.odSpentThisLocation = true;
  window.render();
}

export function performCamtrapAction(actionId, cost) {
  const enc = getEncounter(state.routeProgress);
  const action = enc.actions.find(a => a.id === actionId);
  if (!action) return;
  const ac = getActiveChar();
  if (!ac) return;
 if (typeof action.result === 'function') {
  const r = action.result();
  state.resultText = (action.flavor || '') + ' ' + (r || '');
  addLog(r);
} else {
  executeAction(action);
  state.resultText = state.resultText || (action.flavor || '');
}
  addLog(r);
  window.render();
}

export function skipLocation() {
  const allOdZero = state.selectedExpedition.every(pid => getPerson(pid).od <= 0);
  if (allOdZero) {
    forcedReturnToBase(); // теперь эта функция сама переключит фазу
    return;
  }
  // переход бесплатный, просто идём дальше
  addLog('Вы пошли дальше.');
  advanceRoute();
}

export function forcedReturnToBase() {
  addLog('Силы иссякли. Экспедиция вынуждена вернуться.');
  addJournalEntry('Силы иссякли. Экспедиция возвращается.', 'warning');
  if (state.selectedExpedition.length === 2) {
    setRel(state.selectedExpedition[0], state.selectedExpedition[1], getRel(state.selectedExpedition[0], state.selectedExpedition[1]) - 1);
  }
  const unlucky = state.selectedExpedition[Math.floor(Math.random() * state.selectedExpedition.length)];
  const p = getPerson(unlucky);
  if (p) {
    p.status = 'Истощение (-1 ОД)';
    p.maxOd = Math.max(1, p.baseOd - 1);
    p.od = Math.min(p.od, p.maxOd);
    addJournalEntry(`${p.name} истощён после вынужденного возвращения.`, 'warning');
  }
  state._restedPerson = state.basePerson?.id;
  state.phase = 'evening';
  window.showPhaseTransition('🌆 Вечер', () => { window.render(); });
}

export function advanceRoute() {
  state.routeProgress++;
  state.actionsThisStep = [];
  state.actionsThisLocation = [];
  state.locationDone = false;
  state.activeChar = null;
  state.resultText = null;
  state.reactionData = null;
  state.jointActionUsed = false;
  state.odSpentThisLocation = false;
  if (state.routeProgress >= state.totalRouteSteps) {
    addLog('Экспедиция завершена.');
    state._restedPerson = state.basePerson?.id;
    state.phase = 'evening';
    window.showPhaseTransition('🌆 Вечер', () => { window.render(); });
    return;
  }
  window.render();
}

export function applyForestResponseChoice(choice) {
  const dom = dominantScale();
  let effect = {};
  if (dom === 'symbiosis') {
    if (choice === 'allow') { effect.blockAggression = true; addScale('symbiosis', 1); }
  } else if (dom === 'expansion') {
    if (choice === 'explore') effect.discountScan = 1;
  } else if (dom === 'aggression') {
    if (choice === 'force') { effect.aggressionBonus = 1; effect.odPenalty = 1; }
    else effect.aggressionCostIncrease = 1;
  } else if (dom === 'kindness') {
    if (choice === 'accept') { effect.odHeal = 2; effect.blockNextAggro = true; }
    else effect.kindnessBonus = 1;
  }
  state.forestResponseEffect = effect;
  state.forestResponsePending = false;
  window.render();
}

// ---------- энкаунтеры ----------
export function resolveAggroBug(c) {
  const ac = getActiveChar() || getPerson(state.selectedExpedition[0]);
  const secondBug = state.scales.aggression >= SECOND_EVENT_THRESHOLD;
  if (c === 'fight') {
    ac.od = Math.max(0, ac.od - 1);
    if (Math.random() < 0.5) {
      ac.status = secondBug ? 'Травма (-2 ОД)' : 'Ранен (-1 ОД)';
      ac.maxOd = Math.max(1, ac.maxOd - (secondBug ? 2 : 1));
      ac.od = Math.min(ac.od, ac.maxOd);
      addLog(secondBug ? 'Жук нанёс травму!' : 'Жук ранил!');
    } else {
      addLog('Атака отбита.');
      if (!ac.traits.includes('Закалка')) {
        ac.traits.push('Закалка');
        addJournalEntry('Получен трейт: Закалка. Агрессивные действия с инструментами стоят -1 ОД.', 'trait');
        window.showTraitPopup('Закалка');
      }
    }
    addScale('aggression', secondBug ? 2 : 1);
  } else if (c === 'pay') {
    const gi = ac.slots.find(s => s && getItem(s) && getItem(s).inGeneral);
    if (gi) { ac.slots[ac.slots.indexOf(gi)] = null; addLog('Жук утащил предмет.'); }
    else addLog('Нечего отдать!');
  } else if (c === 'drone') {
    state.droneCharge = 0; addLog('Дрон отвлёк жука.');
  } else {
    ac.status = secondBug ? 'Травма (-2 ОД)' : 'Ранен (-1 ОД)';
    ac.maxOd = Math.max(1, ac.maxOd - (secondBug ? 2 : 1));
    ac.od = Math.min(ac.od, ac.maxOd);
    addLog('Бегство не удалось.');
  }
  window.render();
}

export function resolveKindCaterpillar() {
  const secondCat = state.scales.kindness >= SECOND_EVENT_THRESHOLD;
  state.persons.forEach(p => {
    if (p.status && (p.status.includes('Ранен') || p.status.includes('Тревога') || p.status.includes('Усталость') || p.status.includes('Травма'))) p.status = null;
  });
  const ac = getActiveChar() || getPerson(state.selectedExpedition[0]);
  if (!ac.traits.includes('Чуткость')) {
    ac.traits.push('Чуткость');
    addJournalEntry('Получен трейт: Чуткость. Открывает действие «Замереть» без Эмпата.', 'trait');
    window.showTraitPopup('Чуткость');
  }
  if (secondCat) {
    [['biolog', 'tech'], ['biolog', 'blogger'], ['tech', 'blogger']].forEach(([a, b]) => setRel(a, b, getRel(a, b) + 1));
    addLog('Все отношения улучшились на 1.');
  }
  addScale('kindness', secondCat ? 2 : 1);
  addLog('Статусы сняты.');
  window.render();
}

// ---------- вечер / ночь ----------
export function resolveEvening(idx) {
  if (!state._dialog) return;
  const opt = state._dialog.opts[idx];
  if (opt.rel) {
    setRel(state._dialog.mainId, state._dialog.secondId, getRel(state._dialog.mainId, state._dialog.secondId) + opt.rel);
  }
  if (opt.scale) {
    addScale(opt.scale, 1);
  }
  const reaction = opt.reaction || '';
  let h = '<div class="phase-title">🌆 Вечер — Диалог</div>';
  h += `<div class="section"><div class="dialog-final">«${reaction}»</div>`;
  const consequences = [];
  if (opt.rel) consequences.push(`Отношения: ${opt.rel > 0 ? '+' + opt.rel : opt.rel}`);
  if (opt.scale) consequences.push(`Шкала ${scaleName(opt.scale)}: +1`);
  if (consequences.length > 0) {
    h += `<div class="dialog-consequences">Последствия:<br>${consequences.map(c => `<div class="cons-item">• ${c}</div>`).join('')}</div>`;
  }
  h += `<button class="btn primary" onclick="window.showPhaseTransition('🌙 Ночь',()=>{window.state.phase='night';window.render();})">Лечь спать</button></div>`;
  document.getElementById('app').innerHTML = h;
}

export function processEveningData() {
  if (state.dataCount >= 10) {
    const reports = Math.floor(state.dataCount / 10);
    state.dataCount = state.dataCount % 10;
    state.reportReady = false;
    for (let i = 0; i < reports; i++) {
      addJournalEntry('Отчёт отправлен Корпорации. Ожидайте дроп-под.', 'info');
    }
    state.dropPodArrived = true;
    state.dropPodResources = { food: 4 * reports };
  }
}

export function processEveningFood() {
  // Сброс голода у всех, кого накормили
  state.persons.forEach(p => {
    if (p.status && p.status.includes('Голод')) {
      p.status = null;
      p.maxOd = Math.min(7, p.baseOd);
      p.od = Math.min(p.od, p.maxOd);
    }
  });

  const foodBefore = state.baseResources.food;
  const eaten = Math.min(foodBefore, 3);
  state.baseResources.food -= eaten;

  let hungryPeople = [];

  for (let i = 0; i < state.persons.length; i++) {
    if (i >= eaten) {
      const hungry = state.persons[i];
      hungry.status = 'Голод (-1 ОД)';
      hungry.maxOd = Math.max(1, hungry.baseOd - 1);
      hungry.od = Math.min(hungry.od, hungry.maxOd);
      hungryPeople.push(hungry.name);
      addJournalEntry(`${hungry.name} голодает. -1 ОД на завтра.`, 'warning');
    }
  }

  // Отдых на базе
  if (state._restedPerson) {
    const p = getPerson(state._restedPerson);
    if (p) {
      const bonus = p.status && p.status.includes('Голод') ? 1 : 2;
      p.maxOd = Math.min(7, p.maxOd + bonus);
      p.od = Math.min(p.maxOd, p.od + bonus);
      addLog(`${p.name} отдохнул на базе (+${bonus} ОД).`);
    }
    state._restedPerson = null;
  }

  // Сохраняем количество еды для рендера
  state._lastEveningFood = { before: foodBefore, eaten, hungry: hungryPeople };
}

export function endNight() {
  state.persons.forEach(p => {
    let newMax = p.baseOd;
    if (p.status && p.status.includes('Благословение Леса')) newMax += 1;
    if (p.status && p.status.includes('Давление Леса')) newMax -= 1;
    if (p.status && p.status.includes('Ранен')) newMax -= 1;
    if (p.status && p.status.includes('Истощение')) newMax -= 1;
    if (p.status && p.status.includes('Травма')) newMax -= 2;
    if (p.status && p.status.includes('Голод')) newMax -= 1;
    if (p.status && p.status.includes('Прилив сил')) { newMax += 2; p.status = null; }
    if (p.status && p.status.includes('Упадок сил')) { newMax -= 2; p.status = null; }
    if (p.status && p.status.includes('Истощение')) { p.status = null; }
    p.maxOd = Math.max(1, newMax);
    p.od = p.maxOd;
    if (!p.status || p.status === '') p.status = null;
  });
    // Применить запланированные изменения экосистемы
  if (state._pendingEcosystemChanges) {
    for (const [key, value] of Object.entries(state._pendingEcosystemChanges)) {
      state.ecosystem[key] = value;
    }
    state._pendingEcosystemChanges = {};
  }
  processEveningFood();
  processEveningData();
  state.previousScales = { ...state.scales };
  state.selectedExpedition = []; state.routeProgress = 0; state.locationDone = false;
  state.actionsThisStep = []; state.actionsThisLocation = []; state.actionsThisRoute = [];
  state.activeChar = null; state.resultText = null; state.reactionData = null;
  state.encounterTriggered = false; state.jointActionUsed = false; state.odSpentThisLocation = false;
  state.extraOdCost = 0; state.trapJustSet = {}; state._modifiedOd = [];
  if (state.ecosystem.bird === 'killed' && state.riverState !== 'clean') state.extraOdCost = 1;
  if (state.ecosystem.tree === 'cut') state.extraOdCost = 1;
  state.cycle++;
  state.phase = state.cycle > 3 ? 'morning' : 'narrative_intro';
  addLog(`Рассвет. Цикл ${state.cycle}.`);
  window.render();
}