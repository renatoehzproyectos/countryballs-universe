import './ui/styles.css';
import { store } from './core/store.js';
import { GameManager } from './core/manager.js';
import { checkAchievements } from './core/economy.js';

/** Entry point: load the shared profile, start straight in the 3D hub (no 2D start screen). */
store.load();
const manager = new GameManager(document.getElementById('stage'));
window.__cb = { store, manager }; // handy for debugging in the console
manager.boot().then(() => {
  checkAchievements();
  const boot = document.getElementById('boot'); boot.style.opacity = 0; setTimeout(() => boot.remove(), 600);
}).catch(err => { console.error(err); document.querySelector('#boot p').textContent = 'Failed to start: ' + err.message; });
