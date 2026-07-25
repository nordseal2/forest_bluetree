import * as engineModule from './engine.js';
Object.assign(window, engineModule);
import * as stateModule from './state.js';
import * as locationsModule from './locations.js';
import * as eventsModule from './events.js';
import * as renderModule from './render.js';

// Делаем всё глобальным для обратной совместимости
Object.assign(window, stateModule, locationsModule, eventsModule, renderModule);
window.state = stateModule.state;

renderModule.resetGame();