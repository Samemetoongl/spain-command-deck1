'use strict';
const el = id => document.getElementById(id);
const key = 'spain-deck-v1';
const data = {tasks:[], events:[], accent:'#63d9f7'};
try { Object.assign(data, JSON.parse(localStorage.getItem(key) || '{}')); }
catch { el('storage').textContent = 'Local storage could not be read.'; }
function save() {
  try { localStorage.setItem(key, JSON.stringify(data)); }
  catch { el('storage').textContent = 'Storage unavailable. Changes last only for this session.'; }
}
const nativeApps = new Map([
  ['maps', 'maps://'],
  ['spotify', 'spotify:'],
  ['shortcuts', 'shortcuts://']
]);
function destination(kind, value) {
  if (kind === 'app') return nativeApps.get(value) || null;
  if (kind === 'shortcut' && value.trim()) return 'shortcuts://run-shortcut?name=' + encodeURIComponent(value.trim());
  if (kind !== 'web') return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {}
  return null;
}
if (!Array.isArray(data.links)) {
  data.links = [
    ['ChatGPT','web',data.chatUrl || 'https://chatgpt.com/'],
    ['Zoho Mail','web',data.mailUrl || 'https://mail.zoho.com/'],
    ['Routine','shortcut',data.routineName], ['SPAIN','web',data.spainUrl]
  ].filter(item => item[2]).map(([name,kind,value]) => ({name,kind,value}));
}
function count() {
  const n = data.tasks.filter(t => !t.done).length;
  el('taskCount').textContent = n + ' open';
  return n;
}
function go(view) {
  for (const id of ['dashboard','agenda','launcher']) el(id).hidden = id !== view;
  document.querySelectorAll('nav button').forEach(b => {
    if (b.dataset.go === view) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
}
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
go('dashboard');
function updateAccent() {
  el('accent').value = data.accent;
  if (el('accent').value) document.documentElement.style.setProperty('--accent', data.accent);
}
updateAccent();
el('accent').onchange = () => { data.accent = el('accent').value; save(); updateAccent(); };
const dateLabel = date => date.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function nextEvent() { return data.events.find(e => e.time >= Date.now()); }
function tick() {
  const now = new Date();
  el('clock').textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  el('date').textContent = now.toLocaleDateString([], {weekday:'short',month:'long',day:'numeric'});
  const event = nextEvent();
  el('next').textContent = event?.name || 'No upcoming events';
  el('nextTime').textContent = event ? dateLabel(new Date(event.time)) : 'Add a local calendar entry.';
  el('network').textContent = navigator.onLine ? 'NETWORK ONLINE' : 'OFFLINE';
}
function button(label, handler) {
  const b = document.createElement('button');
  b.textContent = label; b.onclick = handler; return b;
}
function row() {
  const r = document.createElement('div'); r.className = 'card entry'; return r;
}
function renderEvents() {
  data.events.sort((a,b) => a.time - b.time);
  el('events').replaceChildren();
  for (const event of data.events) {
    const r = row(), info = document.createElement('div'), when = document.createElement('span');
    info.textContent = event.name; when.textContent = dateLabel(new Date(event.time)); info.append(when);
    r.append(info, button('Remove', () => { data.events.splice(data.events.indexOf(event),1); save(); renderEvents(); }));
    el('events').append(r);
  }
  tick();
}
el('eventForm').onsubmit = e => {
  e.preventDefault();
  const name = el('eventName').value.trim(), time = new Date(el('eventWhen').value).getTime();
  if (!name || !Number.isFinite(time)) return;
  data.events.push({name,time}); save(); e.target.reset(); renderEvents();
};
renderEvents();
setInterval(() => { if (!document.hidden) tick(); },10000);
for (const event of ['online','offline','pageshow']) addEventListener(event,tick);
document.addEventListener('visibilitychange', () => { document.body.classList.toggle('paused',document.hidden); tick(); });
function shortcutPower() {
  const current = new URL(location.href);
  const returned = current.searchParams.get('deckPower') === '1';
  const onAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!onAppleMobile && !returned) return;

  let message = '';
  if (returned) {
    const raw = (current.searchParams.get('result') || '').trim();
    const match = /^(\d{1,3})\s*%?$/.exec(raw);
    if (match && Number(match[1]) <= 100) {
      data.powerReading = {level:Number(match[1]), time:Date.now()};
      save();
    } else {
      message = 'No percentage returned. End SPAIN Power with Get Battery Level.';
    }
    current.searchParams.delete('deckPower');
    current.searchParams.delete('result');
    history.replaceState(null, '', current.href);
  }
  const check = document.createElement('a');
  const callback = new URL('index.html', current);
  callback.searchParams.set('deckPower', '1');
  const launch = new URL('shortcuts://x-callback-url/run-shortcut');
  launch.searchParams.set('name', 'SPAIN Power');
  launch.searchParams.set('x-success', callback.href);
  check.href = launch.href;
  check.textContent = 'Check power';
  check.className = 'destination';
  const tile = el('powerTile');
  tile.hidden = false;
  const reading = data.powerReading;
  if (reading && Number.isInteger(reading.level) && Number.isFinite(reading.time)) {
    el('battery').textContent = reading.level + '%';
    const checked = document.createElement('div');
    checked.textContent = 'Checked ' + new Date(reading.time).toLocaleString();
    tile.append(checked);
  }
  if (message) {
    const status = document.createElement('div');
    status.textContent = message;
    tile.append(status);
  }
  tile.append(check);
}
if (navigator.getBattery) navigator.getBattery().then(b => {
  function power() { if (!Number.isFinite(b.level)) return; el('powerTile').hidden = false; el('battery').textContent = Math.round(b.level*100) + '%' + (b.charging ? ' · charging' : ''); }
  power(); b.addEventListener('levelchange',power); b.addEventListener('chargingchange',power);
}).catch(shortcutPower);
else shortcutPower();
let weather = '', weatherRequest = 0, controller;
el('clearWeather').onclick = () => {
  ++weatherRequest; controller?.abort(); weather = ''; el('weather').textContent = 'Location off';
  el('forecast').textContent = 'Use approximate coordinates with Open-Meteo for this forecast.';
  el('weatherBtn').disabled = false; el('clearWeather').hidden = true;
};
el('weatherBtn').onclick = () => {
  if (!navigator.geolocation) { el('forecast').textContent = 'Location is unavailable in this browser.'; return; }
  const id = ++weatherRequest;
  weather = ''; el('weather').textContent = 'Locating…'; el('clearWeather').hidden = false;
  el('weatherBtn').disabled = true;
  function failed(message) {
    if (id !== weatherRequest) return;
    el('weather').textContent = 'Weather unavailable'; el('forecast').textContent = message;
    el('weatherBtn').disabled = false;
  }
  navigator.geolocation.getCurrentPosition(async pos => {
    if (id !== weatherRequest) return;
    const query = new URLSearchParams({latitude:pos.coords.latitude.toFixed(1),longitude:pos.coords.longitude.toFixed(1),
      current:'temperature_2m,weather_code',temperature_unit:'fahrenheit',timezone:'UTC'});
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(),12000);
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?' + query,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
      if (!res.ok) throw Error();
      const {current} = await res.json();
      if (!Number.isFinite(current?.temperature_2m)) throw Error();
      if (id !== weatherRequest) return;
      const c = current.weather_code;
      const sky = c === 0 ? 'Clear' : c <= 3 ? 'Cloudy' : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Rain showers' : c <= 86 ? 'Snow showers' : 'Thunderstorms';
      weather = Math.round(current.temperature_2m) + '°F · ' + sky;
      el('weather').textContent = weather;
      el('forecast').textContent = 'Open-Meteo · ' + dateLabel(new Date(current.time+'Z'));
      el('weatherBtn').disabled = false;
    } catch { failed('Forecast request failed. Try again when online.'); }
    finally { clearTimeout(timer); }
  }, err => failed(err.code === 1 ? 'Permission denied. You can use the deck without location.' : 'Could not locate this device. Try again.'), {enableHighAccuracy:false,timeout:12000,maximumAge:300000});
};
let editing = null;
function editor(item) {
  editing = item;
  el('editorTitle').parentElement.open = !!item;
  el('editorTitle').textContent = item ? 'Edit destination' : 'Add destination';
  el('linkName').value = item?.name || '';
  el('target').value = item?.value || '';
  el('linkType').value = item?.kind || 'app';
  el('appPreset').value = item?.kind === 'app' ? item.value : 'maps';
  updateLinkFields();
}
function updateLinkFields() {
  const type = el('linkType').value;
  const preset = type === 'app' && el('appPreset').value !== 'other';
  el('appChoice').hidden = type !== 'app';
  el('targetField').hidden = preset;
  el('target').required = !preset;
  el('targetLabel').textContent = type === 'web' ? 'HTTPS address' : 'Exact Shortcut name';
  el('appHelp').hidden = type !== 'app' || preset;
}
el('linkType').onchange = updateLinkFields;
el('appPreset').onchange = updateLinkFields;
updateLinkFields();
function renderLinks() {
  el('confirm').hidden = true;
  el('links').replaceChildren();
  for (const item of data.links) {
    const r = row(), a = document.createElement('a'), url = destination(item.kind,item.value);
    a.className = 'destination'; a.textContent = item.name;
    if (url) a.href = url; else a.textContent += ' · update address';
    r.append(a,button('Edit', () => { editor(item); el('linkName').focus(); }),button('Remove', () => {
      data.links.splice(data.links.indexOf(item),1); editor(null); save(); renderLinks();
    }));
    el('links').append(r);
  }
}
el('cancelLink').onclick = () => editor(null);
el('linkForm').onsubmit = e => {
  e.preventDefault();
  const name = el('linkName').value.trim();
  let kind = el('linkType').value, value = el('target').value.trim();
  if (kind === 'app') {
    if (el('appPreset').value === 'other') kind = 'shortcut';
    else value = el('appPreset').value;
  }
  if (!name || data.links.some(i => i !== editing && i.name.toLowerCase() === name.toLowerCase())) { alert('Choose a unique destination name.'); return; }
  if (!destination(kind,value)) { alert('Enter an HTTPS address without embedded credentials, or choose Apple Shortcut.'); return; }
  if (editing) Object.assign(editing,{name,kind,value}); else data.links.push({name,kind,value});
  save(); editor(null); renderLinks();
};
renderLinks();
function say(message) {
  el('reply').textContent = message;
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(message); speech.rate = 1; speechSynthesis.speak(speech);
  }
}
function briefing() {
  el('confirm').hidden = true;
  const event = nextEvent(), n = count();
  say('It’s ' + el('clock').textContent + '. ' + n + ' open ' + (n === 1 ? 'task' : 'tasks') + '. ' +
    (event ? 'Next up: ' + event.name + ', ' + dateLabel(new Date(event.time)) + '. ' : 'No upcoming events. ') + (weather ? 'Weather: ' + weather + '.' : ''));
}
function consoleFocus() {
  go('dashboard'); el('console').scrollIntoView({block:'center'}); el('cmd').focus();
}
function command(input) {
  const phrase = input.trim().toLowerCase().replace(/[.!?]+$/,'');
  el('confirm').hidden = true;
  if (['brief me','briefing','give me a briefing'].includes(phrase)) return briefing();
  const views = {core:'dashboard',dashboard:'dashboard',launcher:'launcher',agenda:'agenda',calendar:'agenda',tasks:'dashboard'};
  const target = phrase.replace(/^(?:go to|show|open) /,'');
  if (Object.hasOwn(views,target)) {
    go(views[target]); if (target === 'tasks') el('tasks').scrollIntoView({block:'center'});
    el('reply').textContent = 'Opened ' + target + '.'; return;
  }
  const item = data.links.find(i => phrase === 'open ' + i.name.toLowerCase() || phrase === 'launch ' + i.name.toLowerCase());
  if (item && destination(item.kind,item.value)) {
    el('confirm').href = destination(item.kind,item.value); el('confirm').textContent = 'Open ' + item.name;
    el('confirm').hidden = false; el('reply').textContent = 'Tap below to launch.'; return;
  }
  el('reply').textContent = 'Try “brief me”, “show agenda”, “show tasks”, or “open” followed by a saved destination.';
}
el('commandForm').onsubmit = e => { e.preventDefault(); command(el('cmd').value); };
el('coreBtn').onclick = consoleFocus; el('briefBtn').onclick = briefing;
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
el('voiceHint').textContent = Recognition ? 'Tap to speak once. Your browser may send audio to its speech provider.' : 'Voice recognition unavailable here. Type a command above.';
el('mic').disabled = !Recognition;
let activeRecognition;
el('mic').onclick = () => {
  if (activeRecognition) { activeRecognition.abort(); return; }
  window.speechSynthesis?.cancel(); el('confirm').hidden = true;
  try {
    const rec = new Recognition(); activeRecognition = rec;
    rec.lang = navigator.language; rec.continuous = false; rec.interimResults = false;
    rec.onresult = e => { const input = e.results[0][0].transcript; el('cmd').value = input; command(input); };
    rec.onerror = e => { el('reply').textContent = 'Microphone stopped (' + e.error + '). You can type your command.'; };
    rec.onend = () => { activeRecognition = null; el('mic').textContent = 'Use microphone'; };
    rec.start(); el('mic').textContent = 'Stop listening'; el('reply').textContent = 'Listening…';
  } catch { activeRecognition = null; el('reply').textContent = 'Microphone unavailable. Type a command.'; }
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {
  el('storage').textContent = 'Offline shell unavailable in this browser.';
});
