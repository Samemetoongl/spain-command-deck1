'use strict';
function applyPreferences() {
  document.documentElement.dataset.coreSize = data.coreSize || 'normal';
  const reduced = data.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('reduced', reduced);
  dispatchEvent(new CustomEvent('spain-motion', {detail:reduced}));
  renderRecent();
}
for (const [id, fallback] of [['coreSize','normal'],['motion','system'],['recentCount','8'],['ownerName','Justin'],['speechRate','1']]) {
  el(id).value = data[id] ?? fallback;
  el(id).onchange = () => { data[id] = el(id).value; save(); applyPreferences(); };
}
function voices() {
  const select = el('voiceChoice');
  select.replaceChildren();
  const fallback = document.createElement('option');
  fallback.value = ''; fallback.textContent = 'Device default'; select.append(fallback);
  for (const voice of window.speechSynthesis?.getVoices() || []) {
    const option = document.createElement('option');
    option.value = voice.voiceURI; option.textContent = voice.name + ' · ' + voice.lang;
    select.append(option);
  }
  select.value = data.voiceURI || '';
}
el('voiceChoice').onchange = () => { data.voiceURI = el('voiceChoice').value; save(); };
voices();
window.speechSynthesis?.addEventListener('voiceschanged', voices);
el('testVoice').onclick = () => say('Good morning, ' + (data.ownerName || 'Justin') + '. Your SPAIN command deck is ready.');
const launchUrl = new URL('index.html', location.href);
launchUrl.search = ''; launchUrl.hash = 'battery=';
el('batteryLaunchUrl').value = launchUrl.href;
if (!el('powerStatus').textContent) el('powerStatus').textContent = 'Checking browser battery support. On iPhone, use the SPAIN Power shortcut.';
applyPreferences();
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyPreferences);

// Alarm schedules are local calendar times. Audio must be armed by a user gesture.
if (!Array.isArray(data.alarms)) data.alarms = [];
let audioContext, armed = false, activeAlarm = null, chimeTimer;
let lastAlarmCheck = Date.now();
function nextAlarmTime(time, now = Date.now()) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours,minutes,0,0);
  if (date.getTime() <= now) date.setDate(date.getDate()+1);
  return date.getTime();
}
function renderAlarms() {
  el('alarmList').replaceChildren();
  for (const alarm of data.alarms) {
    const r = row(), label = document.createElement('div');
    label.textContent = alarm.time + ' · ' + alarm.label;
    const status = document.createElement('span');
    status.textContent = alarm.enabled ? 'Next: ' + dateLabel(new Date(alarm.nextAt)) : 'Off';
    label.append(status);
    r.append(label, button(alarm.enabled ? 'Turn off' : 'Enable', () => {
      alarm.enabled = !alarm.enabled;
      if (alarm.enabled) alarm.nextAt = nextAlarmTime(alarm.time);
      save(); renderAlarms();
    }), button('Remove', () => {
      data.alarms = data.alarms.filter(a => a !== alarm); save(); renderAlarms();
    }));
    el('alarmList').append(r);
  }
}
function chime() {
  if (!audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;
  for (const [index,frequency] of [523.25,659.25,783.99].entries()) {
    const tone = audioContext.createOscillator(), gain = audioContext.createGain();
    tone.type = 'sine'; tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now+index*.18);
    gain.gain.linearRampToValueAtTime(.1,now+index*.18+.03);
    gain.gain.exponentialRampToValueAtTime(.001,now+index*.18+.8);
    tone.connect(gain); gain.connect(audioContext.destination);
    tone.start(now+index*.18); tone.stop(now+index*.18+.85);
  }
}
async function armAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) { el('alarmStatus').textContent = 'Alarm audio is unavailable in this browser.'; return false; }
  try {
    audioContext ||= new Audio();
    await audioContext.resume();
    armed = audioContext.state === 'running';
    el('alarmStatus').textContent = armed ? 'Sound armed. Keep the deck visible and screen awake.' : 'Tap Arm sound again to enable audio.';
    return armed;
  } catch {
    armed = false;
    el('alarmStatus').textContent = 'Audio could not start. Tap Arm sound again.';
    return false;
  }
}
function alarmText(label) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const pending = data.tasks.filter(t => !t.done);
  const event = nextEvent();
  return greeting + ', ' + (data.ownerName || 'Justin') + '. ' + label + '. It is ' +
    new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) + '. ' +
    (pending.length ? 'You have ' + pending.length + ' open tasks. ' + pending.slice(0,3).map(t => t.text).join('. ') + '. ' : 'Your task list is clear. ') +
    (event ? 'Your next event is ' + event.name + ', ' + dateLabel(new Date(event.time)) + '. ' : '') +
    (weather ? 'Weather: ' + weather + '. ' : '') + ['I checked your schedule. Hiding under the covers is still unofficial.', 'Your pillow has submitted an appeal. I have denied it.', 'Systems online. Coffee remains a manual operation.'][new Date().getDate()%3];
}
function stopAlarm() {
  clearInterval(chimeTimer);
  silenceVoice();
  el('ringing').hidden = true;
  activeAlarm = null;
}
function ringAlarm(alarm) {
  stopAlarm();
  activeAlarm = alarm;
  el('ringTitle').textContent = alarm.label;
  const text = alarmText(alarm.label);
  el('alarmBriefing').textContent = text;
  el('ringing').hidden = false;
  el('dismissAlarm').focus();
  alarmBeat(); speakBriefing(alarm.label, true);
  chimeTimer = setInterval(alarmBeat, data.alarmSound === 'soft' ? 4000 : 1600);
}
el('armAlarms').onclick = async () => { if (await armAudio()) chime(); };
el('testAlarm').onclick = async () => { if (await armAudio()) ringAlarm({label:'SPAIN briefing preview'}); };
el('dismissAlarm').onclick = () => { stopAlarm(); el('testAlarm').focus(); };
el('snoozeAlarm').onclick = () => {
  if (!activeAlarm) return;
  data.alarms.push({id:Date.now()+':snooze',time:new Date(Date.now()+300000).toTimeString().slice(0,5),
    label:activeAlarm.label,repeat:'once',enabled:true,nextAt:Date.now()+300000});
  save(); stopAlarm(); renderAlarms();
};
el('alarmForm').onsubmit = async event => {
  event.preventDefault();
  const time = el('alarmTime').value;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  data.alarms.push({id:Date.now()+':'+Math.random(),time,label:el('alarmLabel').value.trim() || 'Morning briefing',
    repeat:el('alarmRepeat').value,enabled:true,nextAt:nextAlarmTime(time)});
  save(); renderAlarms(); await armAudio();
};
function checkAlarms() {
  const now = Date.now();
  if (document.hidden) { lastAlarmCheck = now; return; }
  let due;
  for (const alarm of data.alarms) {
    if (!alarm.enabled || alarm.nextAt > now) continue;
    const recentlyDue = now-alarm.nextAt < 90000 && now-lastAlarmCheck < 90000;
    if (alarm.repeat === 'daily') alarm.nextAt = nextAlarmTime(alarm.time,now);
    else alarm.enabled = false;
    if (recentlyDue && armed && audioContext?.state === 'running' && !activeAlarm && !due) due = alarm;
    else el('alarmStatus').textContent = 'Missed alarm: ' + alarm.label + '. Keep the deck visible and arm sound for the next alarm.';
    save(); renderAlarms();
  }
  lastAlarmCheck = now;
  if (due) ringAlarm(due);
}
setInterval(checkAlarms,1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { armed = false; stopAlarm(); }
  else { lastAlarmCheck = 0; checkAlarms(); el('alarmStatus').textContent = 'Tap Arm sound after returning to the deck.'; }
});
renderAlarms();

function renderPins() {
  const area = el('pinChoices');
  area.replaceChildren();
  function choice(name, selected, update) {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type='checkbox'; input.checked=selected; input.style.width='auto';
    input.onchange=()=>{update(input.checked); save(); renderRecent();};
    label.append(input, name); area.append(label);
  }
  for (const app of data.links) choice(app.name,!!app.pinned,value=>app.pinned=value);
  for (const folder of data.folders) choice('Folder · '+folder,(data.pinnedFolders || []).includes(folder),value=>{
    data.pinnedFolders=(data.pinnedFolders || []).filter(f=>f!==folder);
    if(value) data.pinnedFolders.push(folder);
  });
}
renderPins();
el('citySearch').onclick=async()=>{
  const area=el('cityResults'); area.textContent='Searching…';
  try {
    const url=new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name',el('cityName').value.trim()); url.searchParams.set('count','5');
    const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
    if(!res.ok) throw Error();
    const cities=(await res.json()).results || [];
    area.textContent=cities.length?'':'No matches. Try a nearby city.';
    for(const city of cities) area.append(button([city.name,city.admin1,city.country].filter(Boolean).join(', '),()=>{
      data.city={name:city.name,latitude:city.latitude,longitude:city.longitude};
      save(); area.replaceChildren(); loadForecast(data.city);
    }));
  } catch {area.textContent='City search unavailable. Try again online.';}
};
function httpsAddress(raw) {
  if (!raw) return '';
  const url=new URL(raw);
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash) throw Error();
  return url.href;
}
for(const id of ['kokoroUrl','nsUrl','assistantUrl']) {
  el(id).value=data[id] || '';
  el(id).onchange=()=>{
    try { data[id]=httpsAddress(el(id).value.trim()); save(); el(id).setCustomValidity(''); }
    catch {el(id).setCustomValidity('Enter an HTTPS address without credentials or query parameters.');el(id).reportValidity();}
  };
}
let speechGeneration=0, speechRequest, voiceUnlocked=false;
const speechAudio = new Audio();
const silentClip = "data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
function prepareCommandAudio() {
  silenceVoice();
  if (!voiceEnabled || !data.kokoroUrl || voiceUnlocked) return;
  speechAudio.src = silentClip;
  speechAudio.play().then(() => { voiceUnlocked = true; }).catch(() => {});
}
el('playReply').onclick = async () => {
  const generation = speechGeneration;
  try {
    await speechAudio.play();
    if (generation === speechGeneration) el('playReply').hidden = true;
  } catch {
    if (generation === speechGeneration) el('commandVoiceStatus').textContent = 'Playback failed. Check your audio output and try again.';
  }
};
function silenceVoice() {
  speechGeneration++; speechRequest?.abort(); speechAudio?.pause();
  if(speechAudio.src.startsWith("blob:")) URL.revokeObjectURL(speechAudio.src);
  el("playReply").hidden=true; el("commandVoiceStatus").textContent=""; window.speechSynthesis?.cancel();
}
async function say(message, commandReply=false) {
  silenceVoice();
  const generation=speechGeneration;
  el('reply').textContent=message;
  if (!voiceEnabled) return;
  if(!data.kokoroUrl) return deviceVoice(message);
  const controller=new AbortController();
  speechRequest=controller;
  const timer=setTimeout(()=>controller.abort(),commandReply ? 120000 : 15000);
  try {
    const started = performance.now();
    const seconds = ms => (ms / 1000).toFixed(1) + 's';
    const status = el('voiceStatus');
    status.textContent = 'Requesting SPAIN audio…';
    if(commandReply) el('commandVoiceStatus').textContent = 'Preparing voice…';
    const response=await fetch(data.kokoroUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:message}),signal:controller.signal,redirect:'error'});
    if(!response.ok) throw Error();
    const headersAt = performance.now();
    const blob=await response.blob();
    const readyAt = performance.now();
    if(generation!==speechGeneration) return;
    speechAudio.src=URL.createObjectURL(blob); speechAudio.playbackRate=Number(data.speechRate)||1;
    status.textContent = 'Audio received. Starting playback…';
    try {
      await speechAudio.play();
    } catch (error) {
      if (generation !== speechGeneration) return;
      if (!commandReply || error.name !== 'NotAllowedError') throw error;
      el('playReply').hidden = false;
      el('commandVoiceStatus').textContent = 'Audio ready.';
      return;
    }
    if (generation === speechGeneration) {
      if(commandReply) el('commandVoiceStatus').textContent = '';
      status.textContent = 'Using SPAIN voice. Response ' + seconds(headersAt - started)
        + ' · Download ' + seconds(readyAt - headersAt)
        + ' · Playback start ' + seconds(performance.now() - readyAt);
    }
  } catch {if(generation===speechGeneration) { if(commandReply) el('commandVoiceStatus').textContent='SPAIN audio failed. Trying device voice.'; el('voiceStatus').textContent='SPAIN voice unreachable. Using the device voice.'; deviceVoice(message); }}
  finally {clearTimeout(timer);}
}
async function glucosePhrase() {
  if(!data.nsUrl) return '';
  try {
    const url=new URL(data.nsUrl.replace(/\/$/,'')+'/api/v1/entries/sgv.json');
    url.searchParams.set('count','1');
    if(el('nsToken').value) url.searchParams.set('token',el('nsToken').value.trim());
    const res=await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(5000)});
    if(!res.ok) throw Error();
    const [reading]=await res.json();
    const age=(Date.now()-reading.date)/60000;
    if(!Number.isFinite(age)||age<0||!Number.isFinite(reading.sgv)||reading.sgv<39) throw Error();
    if(age>10) return 'The last glucose reading is stale.';
    return 'Your sensor read '+reading.sgv+' milligrams per deciliter '+(age<1?'just now':Math.floor(age)+' minutes ago')+'.';
  } catch {return 'Glucose reading unavailable.';}
}
el('nsCheck').onclick=async()=>{el('nsState').textContent=(await glucosePhrase()) || 'Enter your Nightscout address.';};
async function speakBriefing(label,alarm=false) {
  silenceVoice();
  const generation=speechGeneration;
  const text=alarmText(label)+' '+await glucosePhrase();
  if(generation!==speechGeneration || (alarm&&!activeAlarm)) return;
  if(alarm) el('alarmBriefing').textContent=text;
  say(text.trim());
}
el('alarmSound').value=data.alarmSound||'beacon';
el('alarmSound').onchange=()=>{data.alarmSound=el('alarmSound').value;save();};
function alarmBeat() {
  if(data.alarmSound==='soft') return chime();
  if(audioContext?.state!=='running') return;
  const notes=data.alarmSound==='rise'?[392,494,587,784]:[480,700,480,700];
  notes.forEach((hz,i)=>{
    const start=audioContext.currentTime+i*.35, tone=audioContext.createOscillator(), gain=audioContext.createGain();
    tone.type='triangle';tone.frequency.value=hz;
    gain.gain.setValueAtTime(.001,start);gain.gain.linearRampToValueAtTime(.14,start+.035);gain.gain.exponentialRampToValueAtTime(.001,start+.31);
    tone.connect(gain);gain.connect(audioContext.destination);tone.start(start);tone.stop(start+.33);
  });
}

const voicePreferenceKey = 'spain-spoken-replies';
let voiceEnabled = true;
function updateVoiceToggle() {
  el('spokenReplies').checked = voiceEnabled;
  el('testVoice').disabled = !voiceEnabled;
  if (!voiceEnabled) silenceVoice();
}
function restoreVoicePreference() {
  try { voiceEnabled = localStorage.getItem(voicePreferenceKey) !== 'off'; } catch {}
  updateVoiceToggle();
}
el('spokenReplies').onchange = () => {
  voiceEnabled = el('spokenReplies').checked;
  try { localStorage.setItem(voicePreferenceKey, voiceEnabled ? 'on' : 'off'); } catch {}
  updateVoiceToggle();
};
restoreVoicePreference();
window.addEventListener('pageshow', restoreVoicePreference);
window.addEventListener('storage', event => {
  if (!event.key || event.key === voicePreferenceKey) restoreVoicePreference();
});
