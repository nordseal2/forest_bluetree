// js/events.js
import {
  state,
  addScale,
  addLog,
  addJournalEntry,
  getPerson,
  getItem,
  hasItem,
  getActiveChar,
  getRandomExpeditionMember,
  dominantScale,
  scaleName,
  getRel,
  setRel,
  SECOND_EVENT_THRESHOLD,
  RANDOM_ENCOUNTER_CHANCE,
  FOREST_RESPONSE_THRESHOLD,
  CRITICAL_NIGHT_THRESHOLD,
  AGGRESSION_OD_PENALTY,
  KINDNESS_OD_BONUS
} from './state.js';
import { endNight, processEveningData } from './engine.js';

// ---------- реакции ----------
export function getReactionType(reactorId, scaleType) {
  const p = getPerson(reactorId);
  if (p.id === 'biolog') {
    if (scaleType === 'symbiosis' || scaleType === 'kindness') return 'positive';
    if (scaleType === 'aggression') return 'negative';
    return 'neutral';
  }
  if (p.id === 'tech') {
    if (scaleType === 'aggression' || scaleType === 'expansion') return 'positive';
    if (scaleType === 'symbiosis') return 'negative';
    return 'neutral';
  }
  if (p.id === 'blogger') {
    if (scaleType === 'kindness') return 'positive';
    if (scaleType === 'aggression') return 'negative';
    return 'neutral';
  }
  return 'neutral';
}

export function getReactionBark(reactorId, reactionType, scaleType) {
  const barks = {
    biolog: {
      positive: {
        symbiosis: [
          '«Да... чувствуешь? Оно отвечает.»',
          '«Тепло. Как будто узнаёт.»',
          '«Правильно. Так и надо — слушать.»',
          '«Это язык, которому мы только учимся.»'
        ],
        kindness: [
          '«Доброта — это язык, который понимают все.»',
          '«Мы помогли. И это важно.»',
          '«Спасибо. Ты сделал правильный выбор.»'
        ]
      },
      negative: {
        aggression: [
          '«Зачем?! Мы могли бы изучать его неделями.»',
          '«Ты только что уничтожил данные. Данные!»',
          '«Это не тот путь.»',
          '«Пожалуйста, не надо.»'
        ]
      }
    },
    tech: {
      positive: {
        aggression: [
          '«Наконец-то. Меньше сомнений — больше дела.»',
          '«Вот это я понимаю. Без соплей.»',
          '«Кто-то должен делать грязную работу.»',
          '«Эффективно. Быстро. Без лишних слов.»'
        ],
        expansion: [
          '«Так, данные пошли. Это уже похоже на науку.»',
          '«Чётко, быстро, без лишних движений.»',
          '«Снимай-снимай. Это пригодится.»'
        ]
      },
      negative: {
        symbiosis: [
          '«Ты серьёзно? Разговаривать с грибом?»',
          '«Пока ты медитируешь, я проверю периметр.»',
          '«Это не наука, это шаманство.»',
          '«Мы теряем время.»'
        ]
      }
    },
    blogger: {
      positive: {
        kindness: [
          '«Это правильно. Люди должны видеть — мы здесь не враги.»',
          '«Доброта — это редкость. Особенно здесь.»',
          '«Красивый кадр. Оставлю в монтаже.»'
        ]
      },
      negative: {
        aggression: [
          '«Ты это снимать будешь? Я — нет.»',
          '«Это не тот контент, который я хочу создавать.»',
          '«Мы не за этим сюда прилетели.»'
        ]
      }
    }
  };

  const pb = barks[reactorId];
  if (!pb) return '«...»';
  const rb = pb[reactionType];
  if (!rb) return '«Хм.»';
  const sb = rb[scaleType] || Object.values(rb)[0];
  if (!sb) return '«...»';
  return sb[Math.floor(Math.random() * sb.length)];
}

export function getTraitForReaction(reactorId, reactionType) {
  const p = getPerson(reactorId);
  if (reactionType === 'positive') return p.traits[0];
  if (reactionType === 'negative') return p.traits[1];
  return null;
}

export function triggerReaction(scaleType) {
  if (state.jointActionUsed) return;
  const otherPid = state.selectedExpedition.find(pid => pid !== state.activeChar);
  if (!otherPid) return;
  const rType = getReactionType(otherPid, scaleType);
  const bark = getReactionBark(otherPid, rType, scaleType);
  const trait = getTraitForReaction(otherPid, rType);
  if (rType === 'positive') setRel(state.activeChar, otherPid, getRel(state.activeChar, otherPid) + 1);
  else if (rType === 'negative') setRel(state.activeChar, otherPid, getRel(state.activeChar, otherPid) - 1);
  state.reactionData = { reactor: getPerson(otherPid).name, bark, trait, type: rType };
}

// ---------- энкаунтеры (только рендер) ----------
export function renderAggroBug() {
  let h = '<div class="phase-title">⚠ Агрессивный энкаунтер!</div>';
  const secondBug = state.scales.aggression >= SECOND_EVENT_THRESHOLD;
  h += `<div class="section"><div class="encounter-box"><p>${secondBug ? 'Ещё один жук, крупнее первого, выползает из подлеска. Его хитин покрыт шрамами — этот уже дрался.' : 'Из чащи выползает огромный жук. Хитин лязгает — он чувствует вашу агрессию.'}</p><div class="actions">`;
  const bloggerInExp = state.selectedExpedition.includes('blogger');
  const droneOk = bloggerInExp && hasItem('blogger', 'drone') && state.droneCharge > 0;
  h += `<button class="action-btn" onclick="resolveAggroBug('fight')">${secondBug ? 'Отбиться (1 ОД, риск Травмы)' : 'Отбиться (1 ОД, риск Ранен)'}</button>`;
  const ac = getActiveChar() || getPerson(state.selectedExpedition[0]);
  const hasGenItem = ac && ac.slots.some(s => s && getItem(s) && getItem(s).inGeneral);
  if (hasGenItem) h += `<button class="action-btn" onclick="resolveAggroBug('pay')">Откупиться предметом</button>`;
  if (droneOk) h += `<button class="action-btn" onclick="resolveAggroBug('drone')">Отвлечь дроном (0 ОД)</button>`;
  h += `<button class="action-btn" onclick="resolveAggroBug('flee')">Бежать (${secondBug ? 'Травма' : 'Ранен'})</button></div></div></div>`;
  return h;
}

export function renderKindCaterpillar() {
  let h = '<div class="phase-title">🐛 Добрый энкаунтер!</div>';
  const secondCat = state.scales.kindness >= SECOND_EVENT_THRESHOLD;
  h += `<div class="section"><div class="encounter-box"><p>${secondCat ? 'Вторая гусеница, крупнее и ярче первой, появляется на тропе. Она светится золотым светом.' : 'Гусеница светится мягким светом. Она оставляет за собой мерцающий след.'}</p><div class="actions">`;
  h += `<button class="action-btn" onclick="resolveKindCaterpillar()">${secondCat ? 'Принять благословение (снимает статусы, +1 ко всем отношениям)' : 'Принять слизь (убирает статусы)'}</button></div></div></div>`;
  return h;
}

export function showTraitPopup(traitName) {
  const overlay = document.createElement('div');
  overlay.className = 'phase-transition';
  overlay.innerHTML = `<div class="trait-popup"><h4>✨ Получен трейт: ${traitName}!</h4></div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.body.removeChild(overlay), 1500);
}

export function setActiveChar(pid) {
  state.activeChar = pid;
  state.resultText = null;
  state.reactionData = null;
  window.render();
}

// ---------- диалоги (только рендер) ----------
export function getDialog(mainId, secondId, rel) {
  const r = rel <= -3 ? 'low' : (rel >= 3 ? 'high' : 'mid');
  const key = `${mainId}_${secondId}_${r}`;
  const dialogs = {
    biolog_tech_low: [
      { text: '«Слушай, командир. Это уже не смешно. Ты ведёшь нас к гибели.»', opts: [
        { label: '«Я веду нас к пониманию.»', reaction: 'Техник отворачивается. «Понимание не спасёт, когда Лес решит ответить.»', rel: 1, scale: null },
        { label: '«Возможно, ты права. Я не знаю больше.»', reaction: '«Вот именно. Дай мне действовать — и мы выживем.»', rel: -1, scale: null }
      ]},
      { text: '«Ты хоть понимаешь, что мы здесь умрём? Из-за твоих экспериментов.»', opts: [
        { label: '«Мы здесь, чтобы понять. Если умрём — то со знанием.»', reaction: 'Техник качает головой. «Красиво говоришь. Но мёртвым знание не поможет.»', rel: -1, scale: null },
        { label: '«...Да. Понимаю. И мне страшно.»', reaction: 'Техник замирает. «...Вот чёрт. Я не ожидала такого ответа.»', rel: 2, scale: null }
      ]}
    ],
    biolog_tech_high: [
      { text: '«Знаешь... я была неправа насчёт тебя. Ты не просто учёный.»', opts: [
        { label: '«Спасибо. Это много значит.»', reaction: 'Техник улыбается. «Не зазнавайся.»', rel: 1, scale: 'kindness' },
        { label: '«Я просто делаю свою работу.»', reaction: '«Ну-ну. Скромничаешь.»', rel: -1, scale: null }
      ]},
      { text: '«Я тут подумала... может, этот Лес не враг. Может, он просто... не понимает нас.»', opts: [
        { label: '«Как и мы его. Но мы учимся.»', reaction: 'Техник кивает. «Учимся. Вместе.»', rel: 2, scale: 'symbiosis' },
        { label: '«Не враг? После всего, что было?»', reaction: '«Я не знаю. Просто... мысль.»', rel: -1, scale: null }
      ]}
    ],
    biolog_tech_mid: [
      { text: '«Ты реально веришь, что этот Лес можно понять?»', opts: [
        { label: '«Боюсь. Но страх не отменяет любопытства.»', reaction: '«Ладно. За это уважаю.»', rel: 1, scale: 'expansion' },
        { label: '«Я не верю. Я проверяю.»', reaction: '«Учёные... Вечно вам надо всё усложнить.»', rel: -1, scale: null }
      ]},
      { text: '«День прошёл. Мы ещё живы. Это победа?»', opts: [
        { label: '«Это процесс. Победа — когда мы пройдём через Древо.»', reaction: '«Древо... Ты правда веришь, что оно нас пропустит?»', rel: 1, scale: null },
        { label: '«Победа — это когда мы возвращаемся домой. Не раньше.»', reaction: '«Домой... Я уже забыла, как там.»', rel: -1, scale: 'kindness' }
      ]}
    ],
    biolog_blogger_low: [
      { text: '«Ты меня избегаешь. Что случилось?»', opts: [
        { label: '«Твоя камера. Иногда мне кажется, ты снимаешь мой провал.»', reaction: '«Я снимаю правду.»', rel: -1, scale: null },
        { label: '«Прости. Я просто устал.»', reaction: '«Мы все устали. Но мы ещё живы.»', rel: 1, scale: null }
      ]},
      { text: '«Ты знаешь, что люди говорят за твоей спиной? Что ты теряешь контроль.»', opts: [
        { label: '«Люди говорят. Я действую.»', reaction: 'Блогерка опускает камеру. «Действуй громче, чтобы они замолчали.»', rel: 1, scale: null },
        { label: '«...И что ты им отвечаешь?»', reaction: '«Что ты — лучший командир, который у нас есть. Но ты должен мне помочь.»', rel: -1, scale: null }
      ]}
    ],
    biolog_blogger_high: [
      { text: '«Что ты чувствуешь, прикасаясь к Лесу?»', opts: [
        { label: '«Тепло. И любопытство.»', reaction: '«Красиво сказано. Оставлю в монтаже.»', rel: 2, scale: 'symbiosis' },
        { label: '«Я чувствую себя идиотом.»', reaction: '«Закадровый смех — новый жанр.»', rel: -1, scale: null }
      ]},
      { text: '«Ты улыбаешься. Я заметила. Что случилось?»', opts: [
        { label: '«Мы ближе, чем вчера. Лес... отвечает.»', reaction: 'Блогерка улыбается в ответ. «Я так и знала. Ты — его любимчик.»', rel: 2, scale: 'symbiosis' },
        { label: '«Ничего. Просто хороший день.»', reaction: '«Хороший день здесь — это редкость. Запомню.»', rel: -1, scale: null }
      ]}
    ],
    biolog_blogger_mid: [
      { text: '«Дневник экспедиции. Что пошло не так?»', opts: [
        { label: '«Я делал выбор на основе данных.»', reaction: '«Это честно. Спасибо.»', rel: 1, scale: null },
        { label: '«Ты записываешь чтобы подловить?»', reaction: '«Я записываю правду.»', rel: -1, scale: null }
      ]},
      { text: '«Вопрос от подписчиков: если бы ты мог вернуться, ты бы согласился на эту экспедицию?»', opts: [
        { label: '«Не раздумывая.»', reaction: '«Я так и думала. Смело.»', rel: 1, scale: null },
        { label: '«...Я не знаю. Иногда мне кажется, что я веду людей на смерть.»', reaction: 'Блогерка выключает камеру. «Это не для эфира. Но спасибо за честность.»', rel: -1, scale: 'kindness' }
      ]}
    ],
    tech_biolog_low: [
      { text: '«Я знаю, ты меня не одобряешь. Но кто-то должен.»', opts: [
        { label: '«Грязная работа — одно. Уничтожение — другое.»', reaction: '«Данные не спасут.»', rel: -1, scale: null },
        { label: '«...Ты права. Иногда я слишком осторожен.»', reaction: '«Вот это разговор.»', rel: 2, scale: null }
      ]},
      { text: '«Ты меня боишься? Боишься, что я всё сломаю?»', opts: [
        { label: '«Я боюсь, что ты сломаешь то, что мы не сможем починить.»', reaction: '«Иногда починить нельзя. Иногда нужно строить заново.»', rel: 1, scale: 'expansion' },
        { label: '«Да. Боюсь. И это нормально.»', reaction: 'Техник отводит взгляд. «...Ладно. Я постараюсь быть... аккуратнее.»', rel: -1, scale: null }
      ]}
    ],
    tech_biolog_high: [
      { text: '«Ты был прав. Сегодня я не рубила — и мы узнали больше.»', opts: [
        { label: '«Я горжусь тобой.»', reaction: '«Не привыкай. Завтра может быть по-другому.»', rel: 1, scale: 'kindness' },
        { label: '«Ну наконец-то!»', reaction: '«Эй! Я всё ещё могу передумать.»', rel: -1, scale: null }
      ]},
      { text: '«Я смотрела на Хвощ сегодня. Просто смотрела. И знаешь... он красивый.»', opts: [
        { label: '«Ты меняешься. Это заметно.»', reaction: '«Не напоминай. Мне и так неловко.»', rel: 2, scale: 'symbiosis' },
        { label: '«Красивый? Ты точно Техник?»', reaction: '«Закрой рот. Бывает.»', rel: -1, scale: null }
      ]}
    ],
    tech_biolog_mid: [
      { text: '«Я боюсь, командир. И от этого злюсь.»', opts: [
        { label: '«Страх — это нормально.»', reaction: '«...Ладно. Попробую.»', rel: 1, scale: 'kindness' },
        { label: '«Злость — это топливо.»', reaction: '«Направлю на то, что нам угрожает.»', rel: -1, scale: 'aggression' }
      ]},
      { text: '«Если мы выживем — что ты сделаешь первым делом?»', opts: [
        { label: '«Напишу отчёт. А ты?»', reaction: '«Обниму дочь. И никогда не отпущу.»', rel: 2, scale: 'kindness' },
        { label: '«Высплюсь. Неделю. Может, две.»', reaction: 'Техник смеётся. «Это план. Я — за.»', rel: -1, scale: null }
      ]}
    ],
    tech_blogger_low: [
      { text: '«Твоя камера. Она всё ещё работает?»', opts: [
        { label: '«Работает. И ты будешь в кадре.»', reaction: '«Я не клоун.»', rel: -1, scale: null },
        { label: '«Хочешь — выключу.»', reaction: '«...Снимай. Но без комментариев.»', rel: 1, scale: null }
      ]},
      { text: '«Ты меня раздражаешь. Знаешь об этом?»', opts: [
        { label: '«Знаю. Но я всё равно буду снимать.»', reaction: '«...Уважаю.»', rel: 1, scale: null },
        { label: '«Это взаимно.»', reaction: 'Техник усмехается. «Ну хоть честно.»', rel: -1, scale: null }
      ]}
    ],
    tech_blogger_high: [
      { text: '«Сними меня. Как я работаю.»', opts: [
        { label: '«Сниму. Ты будешь героем.»', reaction: '«Герой... Скажешь тоже.»', rel: 2, scale: null },
        { label: '«Наконец-то ты это сказала.»', reaction: '«Не напоминай.»', rel: -1, scale: null }
      ]},
      { text: '«Твой дрон. Он красивый. Я такого не видела.»', opts: [
        { label: '«Хочешь — покажу, как он работает?»', reaction: '«...Давай. Но если сломаешь — я тебя убью.»', rel: 2, scale: null },
        { label: '«Спасибо. Он — моя гордость.»', reaction: '«Береги его. Он нам ещё пригодится.»', rel: -1, scale: null }
      ]}
    ],
    tech_blogger_mid: [
      { text: '«Опрос: насколько доверяешь Лесу? И мне?»', opts: [
        { label: '«Лесу — ноль. Тебе — шесть.»', reaction: '«Почти признание в любви.»', rel: 1, scale: null },
        { label: '«Тебе — четыре. Лесу — минус десять.»', reaction: '«Надо работать над пиаром.»', rel: -1, scale: null }
      ]},
      { text: '«Ты когда-нибудь устаёшь? От съёмок, от записей?»', opts: [
        { label: '«Устаю. Но если не я — кто расскажет?»', reaction: '«...Никто. Ты права. Продолжай.»', rel: 1, scale: null },
        { label: '«Постоянно. Но это моя работа.»', reaction: '«Работа... У каждого своя.»', rel: -1, scale: null }
      ]}
    ],
    blogger_biolog_low: [
      { text: '«Ты перестал со мной говорить. Я что-то сделала?»', opts: [
        { label: '«Твои вопросы подрывают авторитет.»', reaction: '«Я не подрываю. Я документирую.»', rel: -1, scale: null },
        { label: '«Нет. Это я. Просто устал.»', reaction: '«Мы все устали.»', rel: 1, scale: null }
      ]},
      { text: '«Я видела, как ты смотрел на Древо. Ты знаешь, что делать?»', opts: [
        { label: '«Догадываюсь. Но не уверен.»', reaction: '«Догадка — это больше, чем у нас было вчера.»', rel: 1, scale: null },
        { label: '«Нет. И это меня пугает.»', reaction: 'Блогерка кивает. «Меня тоже. Но мы справимся.»', rel: -1, scale: 'kindness' }
      ]}
    ],
    blogger_biolog_high: [
      { text: '«Ты сегодня без камеры. Что случилось?»', opts: [
        { label: '«Иногда нужно просто смотреть.»', reaction: '«Я знал, что ты поймёшь.»', rel: 2, scale: null },
        { label: '«Батарейка села.»', reaction: '«А я подумал, ты стала романтиком.»', rel: -1, scale: null }
      ]},
      { text: '«Я хочу записать твоё обращение. Для тех, кто придёт после нас.»', opts: [
        { label: '«Пусть знают: Лес не враг. Лес — загадка.»', reaction: '«Красиво. Я сохраню это.»', rel: 2, scale: null },
        { label: '«Скажи им: мы пытались. Этого достаточно.»', reaction: '«...Этого больше, чем достаточно.»', rel: -1, scale: 'kindness' }
      ]}
    ],
    blogger_biolog_mid: [
      { text: '«Вопрос герою: что чувствуешь, прикасаясь к Лесу?»', opts: [
        { label: '«Тепло. И любопытство.»', reaction: '«Красиво. Оставлю в монтаже.»', rel: 1, scale: 'symbiosis' },
        { label: '«Я чувствую себя идиотом.»', reaction: '«Закадровый смех — новый жанр.»', rel: -1, scale: null }
      ]},
      { text: '«Если бы ты мог взять интервью у Леса — что бы ты спросил?»', opts: [
        { label: '«"Кто ты?" Всего два слова.»', reaction: '«И если бы он ответил... это было бы величайшее интервью в истории.»', rel: 1, scale: 'symbiosis' },
        { label: '«"Почему ты нас не пускаешь?"»', reaction: '«Может, он ждёт, что мы сами поймём.»', rel: -1, scale: null }
      ]}
    ],
    blogger_tech_low: [
      { text: '«Ты меня ненавидишь. Я вижу.»', opts: [
        { label: '«Я не ненавижу. Я не понимаю.»', reaction: '«Чтобы рассказать историю.»', rel: 1, scale: null },
        { label: '«Может, и ненавижу.»', reaction: '«Я хроникёр.»', rel: -1, scale: null }
      ]},
      { text: '«Ты думаешь, я бесполезна? Просто камера на ножках?»', opts: [
        { label: '«Ты полезна. По-своему.»', reaction: '«По-своему... Сойдёт.»', rel: 1, scale: null },
        { label: '«Ты — наш голос. Без тебя нас никто не услышит.»', reaction: 'Техник отводит взгляд. «...Чёрт. Это почти красиво.»', rel: -1, scale: null }
      ]}
    ],
    blogger_tech_high: [
      { text: '«Сними меня завтра. Крупным планом.»', opts: [
        { label: '«Сниму. Ты будешь героем.»', reaction: '«Герой... Скажешь тоже.»', rel: 2, scale: null },
        { label: '«Ты серьёзно?»', reaction: '«Люди меняются.»', rel: -1, scale: null }
      ]},
      { text: '«Я видела твои записи. Ты рисуешь. Это красиво.»', opts: [
        { label: '«...Ты рылась в моих вещах?»', reaction: '«Прости. Они выпали.»', rel: -1, scale: null },
        { label: '«Спасибо. Это... хобби. Не для камер.»', reaction: '«Я никому не скажу. Обещаю.»', rel: 2, scale: null }
      ]}
    ],
    blogger_tech_mid: [
      { text: '«Опрос: насколько доверяешь Лесу? И мне?»', opts: [
        { label: '«Лесу — ноль. Тебе — шесть.»', reaction: '«Почти признание.»', rel: 1, scale: null },
        { label: '«Тебе — четыре. Лесу — минус десять.»', reaction: '«Поняла.»', rel: -1, scale: null }
      ]},
      { text: '«Что ты видишь, когда смотришь на Лес? Не как техник — как человек.»', opts: [
        { label: '«...Красоту. И опасность. Одновременно.»', reaction: '«Это лучшее, что ты говорила. Я запишу.»', rel: 1, scale: null },
        { label: '«Вижу работу. Много работы.»', reaction: '«Иногда ты безнадёжна.»', rel: -1, scale: null }
      ]}
    ]
  };

  const available = (dialogs[key] || dialogs[Object.keys(dialogs)[0]]).filter(d => !state.usedDialogs.includes(d.text));
  if (available.length === 0) {
    state.usedDialogs = state.usedDialogs.filter(t => !dialogs[key].some(d => d.text === t));
    return getDialog(mainId, secondId, rel);
  }
  const d = available[Math.floor(Math.random() * available.length)];
  state.usedDialogs.push(d.text);
  return d;
}

export function renderEvening() {
  const info = state._lastEveningFood || { before: state.baseResources.food, eaten: 0, hungry: [] };
  let html = '<div class="phase-title">🌆 Вечер — Диалог</div>';
  html += `<div class="food-info"><h4>🍖 Питание</h4><p>Запасы: было ${info.before}, съедено ${info.eaten}. ${info.hungry.length > 0 ? 'Голодают: ' + info.hungry.join(', ') + '. -1 ОД на завтра.' : 'Все сыты.'}</p></div>`;
  html += '<div class="section"><h3>Выберите разговор</h3><div class="row">';
  const pairs = [['biolog', 'tech'], ['biolog', 'blogger'], ['tech', 'blogger']];
  const themes = { biolog_tech: 'разговор о страхе и методе', biolog_blogger: 'интервью о прошедшем дне', tech_blogger: 'спор о том, как действовать' };
  pairs.forEach(([a, b]) => {
    const pa = getPerson(a), pb = getPerson(b);
    html += `<div class="card" onclick="startEveningDialog('${a}','${b}')"><div class="name">${pa.name} + ${pb.name}</div><div class="role">${themes[a + '_' + b] || 'разговор'}</div></div>`;
  });
  html += '</div></div>';
  return html;
}

export function startEveningDialog(mainId, secondId) {
  const main = getPerson(mainId), sec = getPerson(secondId);
  const d = getDialog(main.id, sec.id, getRel(main.id, sec.id));
  state._dialog = { mainId, secondId: sec.id, opts: d.opts, dialog: d };
  let h = '<div class="phase-title">🌆 Вечер — Диалог</div>';
  h += `<div class="section"><p>${d.text}</p><div class="actions">`;
  d.opts.forEach((o, i) => { h += `<button class="action-btn" onclick="resolveEvening(${i})">${o.label}</button>`; });
  h += '</div></div>';
  document.getElementById('app').innerHTML = h;
}

// ---------- ночь ----------
export function getNightEvent() {
  const dom = dominantScale();
  if (!dom || state.scales[dom] < FOREST_RESPONSE_THRESHOLD) {
    return { critical: false, opts: [{ label: 'Спокойная ночь', consequence: 'Ничего не происходит.', effect: () => {} }] };
  }
  const domVal = state.scales[dom];
  const critical = domVal >= CRITICAL_NIGHT_THRESHOLD && !state.criticalNightsTriggered.includes(dom) && state.criticalNightsTriggered.length < 2;
  const events = {
    aggression: {
      desc: 'Лес отвечает на агрессию. Где-то глубоко под землёй что-то движется — вы чувствуете дрожь. Ветви царапают стены базы.',
      criticalDesc: 'Лес идёт войной. Деревья вырывают корни из земли.',
      critical,
      opts: critical ? [
        {
          label: 'Выйти и сжечь подлесок',
          consequence: 'Модификатор «Выжженная земля»: агрессивные действия стоят 0 ОД. Симбиотические заблокированы.',
          effect: () => {
            state.modifier = { name: 'Выжженная земля', desc: 'Агрессивные действия 0 ОД. Симбиотические заблокированы.' };
            state.criticalNightsTriggered.push('aggression');
            state.nightBarks = ['Техник: «Инструменты сами идут в руки.»'];
            return 'Огненная стена создана.';
          }
        },
        {
          label: 'Принять удар',
          consequence: 'Упадок сил: -2 ОД случайному персонажу из экспедиции.',
          effect: () => {
            state.criticalNightsTriggered.push('aggression');
            const p = getRandomExpeditionMember();
            p.od = Math.max(1, p.baseOd - 2);
            p.maxOd = Math.max(1, p.baseOd - 2);
            addLog(`${p.name} потерял(-а) 2 ОД.`) ;
            state._modifiedOd.push(p.id);
            return 'Вы пережили ночь.';
          }
        }
      ] : [
        {
          label: 'Встретить рассвет',
          consequence: getNightConsequence('aggression'),
          effect: () => { applyNightConsequence('aggression'); return ''; }
        }
      ]
    },
    kindness: {
      desc: 'Лес благодарит. Ночь тиха — даже ветер замер, слушая ваше дыхание. Вокруг базы распускаются цветы.',
      criticalDesc: 'Лес раскрывается навстречу. Золотистая пыльца наполняет воздух. Вы чувствуете — сегодня всё возможно.',
      critical,
      opts: critical ? [
        {
          label: 'Принять благословение',
          consequence: 'Модификатор «Благословение»: симбиотические действия ×2 к шкалам.',
          effect: () => {
            state.modifier = { name: 'Благословение Леса', desc: 'Симбиотические действия ×2 к шкалам.' };
            state.criticalNightsTriggered.push('kindness');
            state.nightBarks = ['Биолог: «Воздух сладкий. Сегодня — особенный день.»'];
            return 'Лес благословил вас.';
          }
        },
        {
          label: 'Сохранить силы',
          consequence: '+3 ОД всем.',
          effect: () => {
            state.criticalNightsTriggered.push('kindness');
            state.persons.forEach(p => { p.maxOd = p.baseOd + 3; p.od = p.maxOd; state._modifiedOd.push(p.id); });
            state.nightBarks = ['Блогерка: «Прилив сил!»'];
            return 'Все получили +3 ОД.';
          }
        }
      ] : [
        {
          label: 'Встретить рассвет',
          consequence: getNightConsequence('kindness'),
          effect: () => { applyNightConsequence('kindness'); return ''; }
        }
      ]
    },
    expansion: {
      desc: 'Лес перестраивается. Вы слышите, как корни пробивают землю — ритмично, как дыхание. Тропы завтра будут другими.',
      criticalDesc: 'Лес перестраивается полностью. Реальность мерцает — вы видите тропы, которых не было, и те, что исчезнут навсегда.',
      critical,
      opts: critical ? [
        {
          label: 'Исследовать новое',
          consequence: 'Модификатор «Неизведанное»: все связи можно познать за один цикл.',
          effect: () => {
            state.modifier = { name: 'Неизведанное', desc: 'Все связи познаются за цикл.' };
            state.criticalNightsTriggered.push('expansion');
            state.nightBarks = ['Блогерка: «Аномалия!»'];
            return 'Новый маршрут открыт.';
          }
        },
        {
          label: 'Держаться известного',
          consequence: 'Модификатор «Тишина»: случайные энкаунтеры не происходят.',
          effect: () => {
            state.modifier = { name: 'Тишина', desc: 'Случайные энкаунтеры не происходят.' };
            state.criticalNightsTriggered.push('expansion');
            state.nightBarks = ['Техник: «Ничего не слышно.»'];
            return 'Маршрут затих.';
          }
        }
      ] : [
        {
          label: 'Встретить рассвет',
          consequence: getNightConsequence('expansion'),
          effect: () => { applyNightConsequence('expansion'); return ''; }
        }
      ]
    },
    symbiosis: {
      desc: 'Лес открывается. Вам снится, что вы идёте по лесу — но это не вы. Вы видите мир глазами Леса.',
      criticalDesc: 'Лес говорит напрямую. Голос звучит в голове каждого: «Вы хотите понять. Тогда смотрите.»',
      critical,
      opts: critical ? [
        {
          label: 'Принять видение',
          consequence: 'Модификатор «Откровение»: все действия двигают шкалы вдвое сильнее.',
          effect: () => {
            state.modifier = { name: 'Откровение', desc: 'Все действия двигают шкалы ×2.' };
            state.criticalNightsTriggered.push('symbiosis');
            state.nightBarks = ['Биолог: «Я видел всё...»'];
            return 'Видение принято.';
          }
        },
        {
          label: 'Задать вопрос',
          consequence: 'Все отношения +2.',
          effect: () => {
            state.criticalNightsTriggered.push('symbiosis');
            [['biolog', 'tech'], ['biolog', 'blogger'], ['tech', 'blogger']].forEach(([a, b]) => setRel(a, b, getRel(a, b) + 2));
            state.nightBarks = ['Блогерка: «Мы говорили с ним.»'];
            return 'Отношения выросли.';
          }
        }
      ] : [
        {
          label: 'Встретить рассвет',
          consequence: getNightConsequence('symbiosis'),
          effect: () => { applyNightConsequence('symbiosis'); return ''; }
        }
      ]
    }
  };
  return events[dom] || { critical: false, opts: [{ label: 'Спокойная ночь', consequence: 'Ничего не происходит.', effect: () => {} }] };
}

export function getNightConsequence(scale) {
  const consequences = {
    aggression: [
      () => { const p = getRandomExpeditionMember(); p.od = Math.max(1, p.baseOd - 2); p.maxOd = Math.max(1, p.baseOd - 2); state.nightOdWarning = `${p.name} потерял(-а) 2 ОД.`; state._modifiedOd.push(p.id); return `${p.name} потерял(-а) 2 ОД.`; },
      () => { [['biolog', 'tech'], ['biolog', 'blogger'], ['tech', 'blogger']].forEach(([a, b]) => setRel(a, b, getRel(a, b) - 1)); return 'Все отношения ухудшились на 1.'; }
    ],
    kindness: [
      () => { const p = getRandomExpeditionMember(); p.maxOd = Math.min(7, p.baseOd + 2); p.od = p.maxOd; state._modifiedOd.push(p.id); return `${p.name} получил(-а) +2 ОД.`; },
      () => { [['biolog', 'tech'], ['biolog', 'blogger'], ['tech', 'blogger']].forEach(([a, b]) => setRel(a, b, getRel(a, b) + 1)); return 'Все отношения улучшились на 1.'; }
    ],
    expansion: [
      () => { const p = getRandomExpeditionMember(); p.maxOd = Math.min(7, p.baseOd + 2); p.od = p.maxOd; state._modifiedOd.push(p.id); return `${p.name} получил(-а) +2 ОД.`; },
      () => { const p = getRandomExpeditionMember(); p.od = Math.max(1, p.baseOd - 2); p.maxOd = Math.max(1, p.baseOd - 2); state.nightOdWarning = `${p.name} потерял(-а) 2 ОД.`; state._modifiedOd.push(p.id); return `${p.name} потерял(-а) 2 ОД.`; }
    ],
    symbiosis: [
      () => 'Связь с Лесом усилилась.',
      () => { const p = getRandomExpeditionMember(); p.maxOd = Math.min(7, p.baseOd + 2); p.od = p.maxOd; state._modifiedOd.push(p.id); return `${p.name} получил(-а) +2 ОД.`; }
    ]
  };
  const opts = consequences[scale] || consequences.symbiosis;
  const fn = opts[Math.floor(Math.random() * opts.length)];
  return fn();
}

export function applyNightConsequence(scale) { getNightConsequence(scale); }

export function getNightDream() {
  const allDreams = [
    { char: 'biolog', text: 'Биологу снится его научный руководитель: «Ты всегда хотел понять то, что понимать не обязательно. Иногда достаточно просто... чувствовать.»' },
    { char: 'biolog', text: 'Биолог видит во сне поле с образцами — тысячи видов. Но все они — один и тот же вид. «Границы, которые мы проводим — условны», — шепчет кто-то.' },
    { char: 'tech', text: 'Техник видит во сне свою дочь. Она спрашивает: «Мам, а ты вернёшься?» Техник просыпается в холодном поту.' },
    { char: 'tech', text: 'Технику снится идеальный механизм. Шестерёнки, рычаги, приводы. Она тянется к нему — и просыпается от крика: механизм был живым.' },
    { char: 'blogger', text: 'Блогерке снится пустой экран. Она пытается что-то сказать, но микрофон не работает. Её никто не слышит.' },
    { char: 'blogger', text: 'Блогерка видит во сне свои записи — они оживают, превращаясь в существ, за которыми она наблюдает. «Ты стала частью истории», — говорит голос.' }
  ];
  const available = allDreams.filter(d => !state.dreamsUsed.includes(d.text));
  if (available.length === 0) {
    state.dreamsUsed = [];
    return allDreams[Math.floor(Math.random() * allDreams.length)];
  }
  const dream = available[Math.floor(Math.random() * available.length)];
  state.dreamsUsed.push(dream.text);
  return dream;
}

export function getNightReactionText() {
  const dom = dominantScale();
  const reactions = {
    aggression: 'После дня, полного конфликтов, сон кажется особенно хрупким. Вы просыпаетесь от каждого шороха.',
    kindness: 'После дня, полного сострадания, сон глубок и спокоен. Лес отвечает вам тем же.',
    expansion: 'После дня, полного исследований, разум продолжает работать даже во сне. Вы просыпаетесь с новыми идеями.',
    symbiosis: 'После дня, полного контактов с Лесом, сон кажется почти пророческим. Граница между вами и Лесом стирается.'
  };
  if (state.nightReaction === 'deep_contact') {
    state.nightReaction = '';
    return 'Вы коснулись Леса — и Лес коснулся вас в ответ. Сон наполнен образами, которые вы не можете расшифровать. Но вы чувствуете: что-то изменилось.';
  }
  return reactions[dom] || reactions.symbiosis;
}

export function renderNight() {
  const ev = getNightEvent();
  const dream = getNightDream();
  const reaction = getNightReactionText();
  let html = '<div class="phase-title">🌙 Ночь</div>';
  if (ev.critical) {
    html += `<div class="section"><div class="encounter-box"><h3>Критическая ночь!</h3><p>${ev.criticalDesc}</p><div class="actions">`;
    ev.opts.forEach(o => {
      html += `<button class="action-btn" onclick="resolveNight('${o.label}')">${o.label}</button><div class="night-consequence">Последствие: ${o.consequence}</div>`;
    });
    html += '</div></div></div>';
  } else {
    html += `<div class="section"><div class="night-dream">${dream.text}</div><p style="font-size:12px;color:#8b949e;margin:8px 0;">${reaction}</p><p style="font-size:12px;color:#d2991d;">${ev.opts[0].consequence}</p><button class="btn primary" onclick="resolveNight('${ev.opts[0].label}')">Встретить рассвет</button></div>`;
  }
  if (state.previousScales) {
    html += '<div class="section"><h3>Изменения за день</h3>';
    Object.entries(state.scales).forEach(([k, v]) => {
      const prev = state.previousScales[k] || 0;
      const diff = v - prev;
      if (diff !== 0) html += `<div class="night-delta">${scaleName(k)}: ${prev} → ${v} <span class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' + diff : diff}</span></div>`;
    });
    html += '</div>';
  }
  html += '<div class="log-area"></div>'; // лог будет вставлен позже через renderLogSection
  state._nightEvent = ev;
  return html;
}

export function resolveNight(label) {
  if (!state._nightEvent) return;
  const opt = state._nightEvent.opts.find(o => o.label === label);
  if (opt && opt.effect) { const t = opt.effect(); if (t) addLog(t); }
  if (!state._nightEvent.critical) {
    const dom = dominantScale();
    // Применяем ночной эффект, только если есть доминирующая шкала и её уровень ≥ 4
    if (dom && state.scales[dom] >= FOREST_RESPONSE_THRESHOLD) {
      applyNightConsequence(dom);
    }
  }
  document.querySelectorAll('.action-btn').forEach(b => b.disabled = true);
  setTimeout(() => { endNight(); }, 100);
}