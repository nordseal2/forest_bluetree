// js/state.js

// ---------- Константы ----------
export const SECOND_EVENT_THRESHOLD = 6;
export const RANDOM_ENCOUNTER_CHANCE = 0.2;
export const JOINT_REL_THRESHOLD = 3;
export const FOREST_RESPONSE_THRESHOLD = 4;
export const CRITICAL_NIGHT_THRESHOLD = 8;
export const AGGRESSION_OD_PENALTY = 4;
export const KINDNESS_OD_BONUS = 4;
export const BASE_FOOD_COST = 3;
export const MAX_CYCLE = 10;

// ---------- Состояние ----------
export const state = {
  cycle: 1, phase: 'narrative_intro', selectedExpedition: [], basePerson: null,
  routeProgress: 0, totalRouteSteps: 5, locationDone: false,
  actionsThisStep: [], actionsThisLocation: [], actionsThisRoute: [],
  activeChar: null, jointActionUsed: false, odSpentThisLocation: false,
  treePassed: false, visitedTree: false,
  trappedLocations: {}, trapJustSet: {},
  encounterTriggered: false, modifier: null, nightBarks: [],
  currentGoal: 'Исследовать маршрут и найти дорогу дальше.',
  criticalNightsTriggered: [], deepContactUsed: false,
  avoidCounts: { loc1: 0, loc4: 0 },
  scannerCharge: 1, droneCharge: 1, extraOdCost: 0,
  patternType: null, patternProgress: 0, patternActions: [],
  persons: [
    { id: 'biolog', name: 'Биолог', role: 'Исследователь', baseOd: 5, maxOd: 5, od: 5,
      traits: ['Эмпат','Наблюдательность'], personalItem: 'scanner', slots: ['scanner', null], status: null },
    { id: 'tech', name: 'Техник', role: 'Инженер', baseOd: 5, maxOd: 5, od: 5,
      traits: ['Прагматик','Скептик'], personalItem: 'multitool', slots: ['multitool', null], status: null },
    { id: 'blogger', name: 'Блогерка', role: 'Коммуникатор', baseOd: 5, maxOd: 5, od: 5,
      traits: ['Связь с Лесом','Медийность'], personalItem: 'drone', slots: ['drone', null], status: null }
  ],
  inventory: [
    { id: 'medkit', name: 'Аптечка', tags: ['медикамент'], inGeneral: true, count: 2 },
    { id: 'camtrap', name: 'Фотоловушка', tags: ['инструмент','наблюдение'], inGeneral: true, count: 1 },
    { id: 'scanner', name: 'Щуп-сканер', tags: ['инструмент','исследование','структура'], inGeneral: false, owner: 'biolog' },
    { id: 'multitool', name: 'Мультитул', tags: ['инструмент','ремонт'], inGeneral: false, owner: 'tech' },
    { id: 'drone', name: 'Дрон', tags: ['инструмент','разведка','поведение'], inGeneral: false, owner: 'blogger' }
  ],
  scales: { aggression: 0, kindness: 0, expansion: 0, symbiosis: 0 },
  relations: { 'biolog_tech': 0, 'biolog_blogger': 0, 'tech_blogger': 0 },
  ecosystem: { tree: 'intact', flowers: 'intact', mushrooms: 'intact', bird: 'intact' },
  links: {
    tree_mushrooms: { discovered: false, intact: true, type: 'structure', seenA: false, seenB: false, hint: '' },
    flowers_bees:   { discovered: false, intact: true, type: 'behavior', seenA: false, seenB: false, hint: '' },
    mush_bird:      { discovered: false, intact: true, type: 'mixed', seenA: false, seenB: false, hint: '' },
    bird_bugs:      { discovered: false, intact: true, type: 'behavior', seenA: false, seenB: false, hint: '' },
    bugs_river:  { discovered: false, intact: true, type: 'behavior', seenA: false, seenB: false, hint: '' },
    river_tree: { discovered: false, intact: true, type: 'structure', seenA: false, seenB: false, hint: '' }
  },
  journalEntries: [], log: [],
  _droneBeesUsed: false, _droneBirdUsed: false,
  dreamsUsed: [], nightReaction: '', 
  usedDialogs: [], _harmonyHintShown: false,
  _aggressionOdTriggered: false, _kindnessOdTriggered: false,
  _bugsSeen: false,
  _beesSeen: false,
  _restedPerson: null,
  baseResources: { food: 6 },
  dataCount: 0, dataCollectedActions: {}, reportReady: false,
  dropPodArrived: false, dropPodResources: null,
  resourceCollectedThisRoute: { loc1: false, loc2: false, loc3: false, loc4: false },
  _pendingEcosystemChanges: {},
  _dialog: null,
  _nightEvent: null
};

// ---------- Вспомогательные функции ----------
export function getPerson(id){ return state.persons.find(p=>p.id===id) }
export function getItem(id){ return state.inventory.find(i=>i.id===id) }
export function getRel(p1,p2){ const k=[p1,p2].sort().join('_'); return state.relations[k]??0 }
export function setRel(p1,p2,v){ const k=[p1,p2].sort().join('_'); state.relations[k]=Math.max(-5,Math.min(5,v)) }
export function addLog(m){ state.log.push(m) }
export function addJournalEntry(text, type='info'){ if(state.journalEntries.find(e=>e.text===text)) return; state.journalEntries.push({text, type}); renderJournal(); }
export function addScale(s,amt){ state.scales[s]=Math.min(10,Math.max(0,state.scales[s]+amt)); }
export function scaleName(s){ return {aggression:'Агрессивность',kindness:'Доброта',expansion:'Экспансия',symbiosis:'Симбиоз'}[s]||s }
export function hasTrait(pid,t){ const p=getPerson(pid); return p&&p.traits.includes(t) }
export function hasItem(pid,iid){ const p=getPerson(pid); return p&&p.slots.includes(iid) }
export function getActiveChar(){ return state.activeChar ? getPerson(state.activeChar) : null }
export function activeHasTrait(t){ const ac=getActiveChar(); return ac&&ac.traits.includes(t) }
export function activeHasItem(iid){ const ac=getActiveChar(); return ac&&ac.slots.includes(iid) }
export function getActiveOd(){ const ac=getActiveChar(); return ac?ac.od:0 }
export function getRandomExpeditionMember(){ 
  if(state.selectedExpedition.length===0) return state.persons[Math.floor(Math.random()*state.persons.length)]; 
  return getPerson(state.selectedExpedition[Math.floor(Math.random()*state.selectedExpedition.length)]); 
}
export function getCycleTier(){ if(state.cycle===1) return 'recon'; if(state.cycle===2) return 'tools'; if(state.cycle>=3) return 'decisive'; return 'final'; }
export function dominantScale(){ const s=state.scales; const entries = Object.entries(s).filter(([,v])=>v>0); if (entries.length===0) return null; return entries.sort((a,b)=>b[1]-a[1])[0][0]; }
export function getRouteMood(){ const d=dominantScale(); let m= {aggression:'Ощетинившаяся чаща',kindness:'Умиротворённая чаща',expansion:'Разведанная чаща',symbiosis:'Мерцающая чаща'}[d]||'Тёмная чаща'; if(state.scales.aggression>=7) m+='\nЛес ощетинился. Вы чувствуете враждебность.'; if(state.scales.kindness>=7) m+='\nЛес принимает вас. Вы чувствуете поддержку.'; return m; }
export function useConsumable(itemId){ const item=getItem(itemId); if(!item||item.count===undefined||item.count<=0) return false; item.count--; if(item.count<=0){ state.inventory=state.inventory.filter(i=>i.id!==itemId); state.persons.forEach(p=>{p.slots=p.slots.map(s=>s===itemId?null:s)}); } return true; }
export function ecosystemDestroyed(){ return !state.links.tree_mushrooms.intact&&!state.links.flowers_bees.intact&&!state.links.mush_bird.intact&&!state.links.bird_bugs.intact; }
export function allLinksDiscovered(){ return state.links.tree_mushrooms.discovered&&state.links.flowers_bees.discovered&&state.links.mush_bird.discovered&&state.links.bird_bugs.discovered; }
export function allLinksIntact(){ return state.links.tree_mushrooms.intact&&state.links.flowers_bees.intact&&state.links.mush_bird.intact&&state.links.bird_bugs.intact; }
export function getActionScaleType(actionId){
  const agg=['cut_tree','poison_tree','kill_bird','burn_mush','burn_grass','exterminate','fight','throw','end_suffering','finish','drink'];
  const kind=['heal','calm_bird','pray_mush','accept','mourn','plant_spores','clear_water','neutralize','try_heal','avoid','avoid_bugs','leave_poison','hide'];
  const exp=['scan_tree','scan','trap_tree','trap_flowers','trap_bird','drone_scout','drone_follow','drone_bees','drone_bird','collect','pick_flowers','push','study','observe','observe_wound','watch_bird','watch_bees'];
  const symb=['touch_tree','talk_tree','calm_bird','connect','study_mush','pray_mush','watch_bird','watch_bees','dive','wake'];
  if(agg.includes(actionId)) return 'aggression'; if(kind.includes(actionId)) return 'kindness';
  if(exp.includes(actionId)) return 'expansion'; if(symb.includes(actionId)) return 'symbiosis'; return null;
}
export function actionChangesObject(actionId){
  const changing=['cut_tree','poison_tree','kill_bird','burn_mush','burn_grass','end_suffering','finish','pick_flowers','collect','exterminate'];
  return changing.includes(actionId);
}
export function getTooltip(action){
  if(!action) return '';
  let p=[];
  if(action.req){
    if (typeof action.req === 'string') {
      p.push('Требуется: ' + action.req);
    } else {
      if (action.req.item) {
        let itemName = action.req.item;
        const it = getItem(itemName);
        if (it) itemName = it.name;
        p.push('Нужен: ' + itemName);
        if (action.req.consume) p.push('(расходуется)');
        if (action.req.charge) p.push('(заряд)');
      }
      if (action.req.trait) p.push('Трейт: ' + action.req.trait);
      if (action.req.linkIntact) p.push('Связь должна быть цела');
      if (action.req.linkBroken) p.push('Связь должна быть разрушена');
      if (action.req.tierMin) p.push('Цикл ≥ ' + action.req.tierMin);
    }
  }
  if(action.discount) p.push('Скидка -1 ОД');
  if(action.joint) p.push('Совместное (отношения ≥ +3)');
  if(action.ecosystem) p.push('Повлияет на экосистему');
  return p.join(' • ');
}

export function canDoJointAction(){
  if(!state.activeChar) return false;
  const otherPid = state.selectedExpedition.find(pid => pid !== state.activeChar);
  if (!otherPid) return false;
  const other = getPerson(otherPid);
  return other && other.od >= 1;
}
export function checkRequirements(action) {
  if (!action.req) return true;
  const ac = getActiveChar();
  if (!ac && (action.req.item || action.req.trait)) return false;

  // Проверка предмета
  if (action.req.item) {
    const item = action.req.item;
    if (!hasItem(state.activeChar, item)) return false;
    if (action.req.charge) {
      if (item === 'scanner' && state.scannerCharge <= 0) return false;
      if (item === 'drone' && state.droneCharge <= 0) return false;
    }
    if (action.req.consume) {
      const it = getItem(item);
      if (!it || it.count === undefined || it.count <= 0) return false;
    }
  }

  // Трейт
  if (action.req.trait) {
    if (!ac || !activeHasTrait(action.req.trait)) return false;
  }

  // Минимальный цикл
  if (action.req.tierMin) {
    const tier = getCycleTier();
    if (tier === 'recon' && action.req.tierMin >= 2) return false;
    if ((tier === 'recon' || tier === 'tools') && action.req.tierMin >= 3) return false;
  }

  // Связь цела?
  if (action.req.linkIntact) {
    const links = Array.isArray(action.req.linkIntact) ? action.req.linkIntact : [action.req.linkIntact];
    for (const linkId of links) {
      const link = state.links[linkId];
      if (!link || !link.intact) return false;
    }
  }

  // Связь разрушена?
  if (action.req.linkBroken) {
    const link = state.links[action.req.linkBroken];
    if (!link || link.intact) return false;   // если связь цела — не даём
  }

  // Флаг сбора ресурса на локации
  if (action.req.resourceLoc) {
    if (state.resourceCollectedThisRoute[action.req.resourceLoc]) return false;
  }

  return true;
}
export function checkActionAvailable(action){
  if(!state.activeChar) return {ok:false,reason:'Выберите персонажа'};
  if(action.joint && !canDoJointAction()) return {ok:false,reason:'Напарник без ОД'};
  if(action.joint && getRelForGroup()<JOINT_REL_THRESHOLD) return {ok:false,reason:'Нужны отношения ≥ +' + JOINT_REL_THRESHOLD};
if (typeof action.check === 'function') {
  if (!action.check()) return {ok:false, reason: 'Нет нужного предмета или трейта'};
} else {
  if (!checkRequirements(action)) return {ok:false, reason: 'Нет нужного предмета или трейта'};
}
  if(getActiveOd()<action.cost+state.extraOdCost) return {ok:false,reason:'Недостаточно ОД'};
  if(state.actionsThisStep.includes(action.id)&&actionChangesObject(action.id)) return {ok:false,reason:'Объект уже изменён'};
const nonRepeat=['touch_tree','watch_bird','watch_bees','pray_mush','calm_bird','study_mush','observe_tree','observe_tree2','biosample_tree','biosample_flowers','biosample_mush','biosample_bird','avoid'];  if(nonRepeat.includes(action.id) && state.actionsThisLocation.some(al=>al.id===action.id)) return {ok:false,reason:'Уже выполнено на этой локации'};
  return {ok:true,reason:getTooltip(action)};
}
export function getNodeIcon(locId){ const map={loc1:'tree_mushrooms',loc2:'flowers_bees',loc3:'mush_bird',loc4:'bird_bugs'}; const lk=state.links[map[locId]]; if(!lk) return ''; if(!lk.seenA&&!lk.seenB) return ''; if(!lk.discovered) return '👁️'; return lk.intact?'🌿':'🔥'; }
export function getRelForGroup(){ if(state.selectedExpedition.length<2) return 0; return getRel(state.selectedExpedition[0],state.selectedExpedition[1]); }
export function getTreeDescription(){
  const c=allLinksDiscovered(); const i=allLinksIntact(); const d=ecosystemDestroyed();
  if(!c) return state.visitedTree?'Древо по-прежнему закрыто. Нужно понять экосистему.':'Огромное Древо преграждает путь. Кора холодна и неподвижна.';
  if(i) return 'Древо открыто. Вы чувствуете — оно приняло вас.';
  if(d) return 'Древо стонет. Раны в коре — вы можете пройти.';
  return 'Древо колеблется. Вы чувствуете дисбаланс — экосистема в смешанном состоянии. Приведите связи к единому состоянию.';
}
export function getTreeBark(){
  const c=allLinksDiscovered(); const i=allLinksIntact(); const d=ecosystemDestroyed();
  if(!c) return '«Нужно понять, как всё связано.»';
  if(i) return '«Мы сделали это. Древо открыто.»';
  if(d) return '«Проход открыт. Но какой ценой...»';
  if(state.patternProgress>0&&state.patternProgress<4) return '«Видимо, мы ещё не всё делаем правильно...»';
  return '«Древо ждёт. Нужно выбрать путь.»';
}
export function getProgressBark(){
  const c=state.cycle; if(c<=2) return '«Мы только начали. Впереди много работы.»';
  if(c<=4) return '«Мы здесь уже несколько дней. Но я чувствую — проход где-то рядом.»';
  if(c<=5) return '«Лес начинает сгущаться. Вы чувствуете — время не бесконечно.»';
  if(c<=7) return '«Время уходит. Нужно решаться.»';
  if(c<=8) return '«Время на исходе. Нужно пройти скорее.»';
  return '«Последний шанс. Лес почти закрылся.»';
}
export function checkPattern(actionId, locId){
  if(!allLinksDiscovered()||state.patternType==='done') return null;
  const resonance={loc1:'touch_tree',loc2:'watch_bees',loc3:'pray_mush',loc4:'watch_bird'};
  const dissonance={loc1:'cut_tree',loc2:'pick_flowers',loc3:'burn_mush',loc4:'kill_bird'};
  const aggressiveActions=['cut_tree','poison_tree','kill_bird','burn_mush','pick_flowers','poison_flowers'];
  const symbioticActions=['touch_tree','watch_bird','pray_mush','calm_bird','watch_bees'];
  if(state.patternType==='resonance'&&aggressiveActions.includes(actionId)){ state.patternType=null;state.patternProgress=0;state.patternActions=[];addLog('Резонанс прерван.');return null; }
  if(state.patternType==='dissonance'&&symbioticActions.includes(actionId)){ state.patternType=null;state.patternProgress=0;state.patternActions=[];addLog('Диссонанс прерван.');return null; }
  if(!state.patternType){
    if(resonance[locId]===actionId){ state.patternType='resonance'; state.patternProgress=1; state.patternActions=[actionId]; addJournalEntry('Вы начинаете настраиваться на ритм Леса...','trait'); return'resonance'; }
    if(dissonance[locId]===actionId){ state.patternType='dissonance'; state.patternProgress=1; state.patternActions=[actionId]; addJournalEntry('Вы начинаете разрушать связи...','warning'); return'dissonance'; }
    return null;
  }
  if(state.patternType==='resonance'){ const expected=resonance[locId]; if(expected===actionId&&!state.patternActions.includes(actionId)){ state.patternProgress++; state.patternActions.push(actionId); return'resonance'; } }
  if(state.patternType==='dissonance'){ const expected=dissonance[locId]; if(expected===actionId&&!state.patternActions.includes(actionId)){ state.patternProgress++; state.patternActions.push(actionId); return'dissonance'; } }
  return null;
}
export function getPatternFeedback(){
  const barksR=['Что-то меняется. Вы чувствуете лёгкую дрожь под ногами.','Ритм Леса становится громче. Или это ваше сердце?','Ещё одно действие. Вы почти на одной волне с Лесом.','Резонанс. Вы чувствуете, как Древо... открывается.'];
  const barksD=['Первый удар. Лес вздрагивает.','Ещё один разрыв. Тишина становится громче.','Почти всё. Лес трещит по швам.','Диссонанс. Древо содрогается — и открывается.'];
  const reactR=['«Ты чувствуешь? Что это? Что-то меняется там, впереди!..»','«Я тоже это слышу. Как будто... музыка.»','«Мы на правильном пути. Я знаю.»','«Древо! Оно открывается!»'];
  const reactD=['«Что ты делаешь?! Лес... кричит!»','«Я чувствую, как связи рвутся. Это... больно.»','«Мы почти разрушили всё. Древо не выдержит.»','«Проход! Мы сломали его!»'];
  const idx=Math.min(state.patternProgress-1,3);
  if(state.patternType==='resonance') return {bark:barksR[idx],react:reactR[idx]};
  if(state.patternType==='dissonance') return {bark:barksD[idx],react:reactD[idx]};
  return null;
}
export function collectData(actionId, amount) {
  if (state.dataCollectedActions[actionId]) return;
  state.dataCollectedActions[actionId] = true;
  state.dataCount += amount;
  if (state.dataCount >= 10) state.reportReady = true;
  addLog(`Данные +${amount}`);
}