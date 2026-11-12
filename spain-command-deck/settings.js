'use strict';
function applyPreferences() {
  document.documentElement.dataset.coreSize = data.coreSize || 'normal';
  const reduced = data.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('reduced', reduced);
  dispatchEvent(new CustomEvent('spain-motion', {detail:reduced}));
  renderRecent();
}
for (const [id, fallback] of [['coreSize','normal'],['motion','system'],['recentCount','4'],['ownerName','Justin'],['speechRate','1']]) {
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
    (weather ? 'Weather: ' + weather + '. ' : '') + 'Ready when you are.';
}
function stopAlarm() {
  clearInterval(chimeTimer);
  window.speechSynthesis?.cancel();
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
  chime(); say(text);
  chimeTimer = setInterval(chime,15000);
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
