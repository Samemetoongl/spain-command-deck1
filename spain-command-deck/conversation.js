const config = JSON.parse(localStorage.getItem('spain-deck-v1') || '{}');
const el = id => document.getElementById(id);
const data = config;
const scopeKey = 'spain-project:' + (config.assistantUrl || '');
let activeProject;
try { activeProject = JSON.parse(localStorage.getItem(scopeKey)); } catch {}
function showScope() {
  el('projectIndicator').textContent = activeProject ? 'Project · ' + activeProject.name : 'General chat';
}
function applyContext(result) {
  if (!Object.hasOwn(result,'project')) return;
  activeProject = result.project;
  localStorage.setItem(scopeKey, JSON.stringify(activeProject));
  showScope();
  chat.replaceChildren();
  for(const [role,text] of result.history || []) addMessage(role,text);
}
showScope();
function apiFetch(path, options = {}) {
  if (!config.assistantUrl) throw Error('Set the chat endpoint in SPAIN Settings.');
  const url = new URL(config.assistantUrl);
  url.pathname = path;
  return fetch(url, {cache:'no-store', credentials:'omit', redirect:'error', ...options});
}
async function refreshWorkspace(history) {
  try {
    const response = await apiFetch('/api/state');
    if (!response.ok) throw Error();
    const state = await response.json();
    el('projects').textContent = state.projects || 'No projects';
    el('tasks').textContent = state.tasks || 'No tasks';
    if (history && !chat.children.length)
      for (const [role,text] of state.history || []) addMessage(role,text);
    el('connection').textContent = 'CONNECTED';
  } catch {
    el('projects').textContent = el('tasks').textContent = 'Workspace unavailable. Check the laptop bridge.';
  }
}
function deviceVoice(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Number(data.speechRate) || 1;
  const voice = speechSynthesis.getVoices().find(v => v.voiceURI === data.voiceURI);
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
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

  if (!voiceEnabled) return;
  if(!data.kokoroUrl) return deviceVoice(message);
  const controller=new AbortController();
  speechRequest=controller;
  const timer=setTimeout(()=>controller.abort(),commandReply ? 120000 : 15000);
  try {
    const started = performance.now();
    const seconds = ms => (ms / 1000).toFixed(1) + 's';
    const status = el('commandVoiceStatus');
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
  } catch {if(generation===speechGeneration) { if(commandReply) el('commandVoiceStatus').textContent='SPAIN audio failed. Trying device voice.'; el('commandVoiceStatus').textContent='SPAIN voice unreachable. Using the device voice.'; deviceVoice(message); }}
  finally {clearTimeout(timer);}
}
el('form').onsubmit = async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (pending || !message) return;
  prepareCommandAudio();
  pending = send.disabled = true;
  input.value = '';
  showChat();
  addMessage('user', message);
  mode.textContent = 'PROCESSING';
  try {
    const response = await apiFetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message, project_id:activeProject?.id}), signal:AbortSignal.timeout(120000)});
    if (!response.ok) throw Error('Chat returned HTTP ' + response.status);
    const result = await response.json();
    if (typeof result.reply !== 'string' || !result.reply.trim()) throw Error('Empty reply');
    applyContext(result);
    addMessage('assistant', result.reply);
    say(result.reply, true);
    refreshWorkspace(false);
  } catch (error) {
    addMessage('assistant', 'Could not reach SPAIN. ' + error.message);
  } finally {
    mode.textContent = 'READY';
    pending = send.disabled = false;
  }
};
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
el('mic').disabled = !Recognition;
let recognition;
el('mic').onclick = () => {
  if (recognition) { recognition.stop(); return; }
  prepareCommandAudio();
  recognition = new Recognition();
  recognition.lang = navigator.language;
  recognition.onresult = event => { input.value = event.results[0][0].transcript; el('form').requestSubmit(); };
  recognition.onerror = event => { el('commandVoiceStatus').textContent = 'Microphone: ' + event.error; };
  recognition.onend = () => { recognition = null; el('mic').classList.remove('listening'); };
  recognition.start();
  el('mic').classList.add('listening');
};
async function restoreChat() {
  pending = send.disabled = true;
  try {
    if (activeProject) {
      const r = await apiFetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:'Restore project conversation',project_action:'history',project_id:activeProject.id}),signal:AbortSignal.timeout(10000)});
      if(!r.ok) throw Error();
      const result = await r.json();
      if (!Object.hasOwn(result,'project')) throw Error();
      applyContext(result);
    }
  } catch {
    el('commandVoiceStatus').textContent = 'Could not restore this project history. Check the laptop connection.';
  } finally {
    pending = send.disabled = false;
  }
  refreshWorkspace(!activeProject);
}
restoreChat();

const voicePreferenceKey = 'spain-spoken-replies';
let voiceEnabled = true;
function updateVoiceToggle() {
  el('spokenReplies').checked = voiceEnabled;
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
