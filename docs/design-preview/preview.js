"use strict";

const icons = {
  mark: '<path d="M5 24V13m8 11V5m8 19V10"/><path d="M3 27h20"/>',
  check: '<path d="m5 10 4 4L19 4"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  water: '<path d="M10 2S4 8 4 12a6 6 0 0 0 12 0c0-4-6-10-6-10Z"/><path d="M7 12a3 3 0 0 0 3 3"/>',
  book: '<path d="M3 3h5c2 0 2 1 2 1s0-1 2-1h5v13h-5c-2 0-2 1-2 1s0-1-2-1H3Z"/><path d="M10 4v13"/>',
  sun: '<circle cx="10" cy="10" r="4"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.5 3.5 5 5m10 10 1.5 1.5m-13 0L5 15M15 5l1.5-1.5"/>',
  moon: '<path d="M17 12A7 7 0 0 1 8 3a7 7 0 1 0 9 9Z"/>',
  home: '<path d="m3 9 7-6 7 6v8h-5v-5H8v5H3Z"/>',
  chart: '<path d="M3 17h14M5 13V9m5 4V4m5 9V7"/>',
  settings: '<path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="2"/><circle cx="13" cy="10" r="2"/><circle cx="8" cy="15" r="2"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 5v5l3 2"/>',
  pending: '<path d="M16 7a6 6 0 0 0-10-2L3 8m0-5v5h5m-4 5a6 6 0 0 0 10 2l3-3m0 5v-5h-5"/>',
  streak: '<path d="M11 2c1 4-3 5-3 8 0 2 3 2 4-1 3 3 4 7 0 9-4 2-8 0-8-4 0-4 4-6 7-12Z"/>',
};
const icon = (name) => `<svg viewBox="0 0 ${name === 'mark' ? '26 30' : '20 20'}" aria-hidden="true">${icons[name] || icons.clock}</svg>`;
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const samples = () => [
  {id:'wake', name:'Wake up gently', type:'time', target:360, tolerance:30, evaluation:365, offset:0, value:370, occurred:'2026-11-13', pending:false, baseStreak:11, longestStreak:21},
  {id:'water', name:'Drink enough water', type:'quantity', target:2000, tolerance:300, unit:'ml', evaluation:720, value:1800, pending:false, baseStreak:7, longestStreak:12},
  {id:'read', name:'Read a chapter', type:'binary', target:1, tolerance:0, evaluation:1200, value:0, pending:false, baseStreak:5, longestStreak:9},
  {id:'sleep', name:'Get to bed earlier', type:'time', target:1260, tolerance:30, evaluation:360, offset:-1, value:null, occurred:'2026-11-12', pending:false, baseStreak:14, longestStreak:18},
];
const storageKey = 'streaxie.design-preview.v1';
let habits = samples();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && Array.isArray(saved.habits) && saved.habits.length <= 20 && saved.habits.every((h) => h && typeof h.id === 'string' && typeof h.name === 'string' && ['binary','quantity','time'].includes(h.type) && Number.isFinite(h.target) && Number.isFinite(h.tolerance))) {
    const defaults=new Map(samples().map(h=>[h.id,h]));
    habits=saved.habits.map(h=>({...h,baseStreak:Number.isSafeInteger(h.baseStreak)&&h.baseStreak>=0?h.baseStreak:defaults.get(h.id)?.baseStreak||0,longestStreak:Number.isSafeInteger(h.longestStreak)&&h.longestStreak>=0?h.longestStreak:defaults.get(h.id)?.longestStreak||0}));
  }
} catch { /* The preview still works if browser storage is unavailable. */ }
const params = new URLSearchParams(location.search);
let view = ['landing','today','onboarding'].includes(params.get('view')) ? params.get('view') : 'today';
let editor = null;
let offline = false;
let readonly = false;
let verified = false;
let empty = false;
let loading = false;
let selected = 'water';
let onboardingStep = 0;
let flow = freshFlow();
let timer;
let syncTimer;
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
if (params.get('mobile') === '1') document.body.classList.add('mobile');
if (params.get('readonly') === '1') readonly = true;

function freshFlow() {
  let timezone = 'UTC';
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch {}
  return {timezone, rollover:'00:00', customRollover:false, name:'', type:'binary', target:1, unit:'', tolerance:0, flexible:false, evaluation:'08:00', offset:0, operator:'EQ'};
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({habits})); }
  catch { notify('This browser cannot retain the sample changes after closing.'); }
}
function clock(minutes) {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2,'0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
function timeValue(minutes) { return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; }
function minutes(value) { const [h,m] = value.split(':').map(Number); return h*60+m; }
function evaluation(h) {
  if (h.value === null || h.type === 'binary' && !h.value) return {passed:false, label:'Not recorded yet', delta:0};
  const targetDate = Date.parse('2026-11-13T00:00:00Z')+(h.offset||0)*86400000;
  const dayOffset = h.type === 'time' ? Math.round((Date.parse((h.occurred||'2026-11-13')+'T00:00:00Z')-targetDate)/86400000) : 0;
  const actual = h.value + dayOffset*1440;
  const delta = actual-h.target;
  const operator = h.operator || (h.type === 'quantity'?'GTE':'LTE');
  const perfect = h.type === 'binary' ? h.value === 1 : operator === 'GTE' ? actual >= h.target : actual <= h.target;
  const tolerated = !perfect && h.type !== 'binary' && (operator === 'GTE' ? actual >= h.target-h.tolerance : actual <= h.target+h.tolerance);
  return {passed:perfect||tolerated, label:perfect ? 'Target met' : tolerated ? 'Within tolerance' : 'Not at target yet', delta};
}
function streakFor(h){return (h.baseStreak||0)+(evaluation(h).passed?1:0);}
function longestFor(h){return Math.max(h.longestStreak||0,streakFor(h));}
function streakBadge(h){
  const count=streakFor(h);
  const description=`${count} ${count===1?'day':'days'} current streak${h.pending?', pending sync confirmation':''}`;
  return `<span class="streak-badge ${count===0?'is-zero':''} ${h.pending?'is-pending':''}" aria-label="${description}" title="${description}">${icon('streak')}<strong>${count}</strong><span>${count===1?'day':'days'}</span></span>`;
}
function brand() { return `<a class="brand" href="#" data-action="view" data-destination="landing" aria-label="Streaxie home">${icon('mark')}<span>streaxie</span></a>`; }
function header(landing = false) {
  const pending = habits.filter((h)=>h.pending).length;
  return `<header class="site-header">${brand()}<nav class="desktop-nav" aria-label="Main navigation">${landing ? '<a href="#how-it-works">How it works</a><a href="#small-start">Why Streaxie</a>' : '<button class="active" data-action="view" data-destination="today">Today</button><button data-action="insights">Insights</button><button data-action="settings">Settings</button>'}</nav><div class="header-right">${landing ? '<button class="quiet" data-action="login">Log in</button>' : `<span class="connection ${pending ? 'pending':''}" role="status">${offline ? 'Offline' : pending ? `${pending} pending` : 'All changes saved'}</span><button class="account-button" data-action="settings" aria-label="Open account settings">ME</button>`}</div></header>`;
}
function bottomNav() { return `<nav class="mobile-nav" aria-label="Main navigation"><button class="active" data-action="view" data-destination="today">${icon('home')}Today</button><button data-action="insights">${icon('chart')}Insights</button><button data-action="settings">${icon('settings')}Settings</button></nav>`; }
function verificationBanner() {
  if (verified) return '';
  return `<div class="verification ${readonly ? 'expired':''}"><span>${readonly ? 'Your 7-day verification window has ended. You can still view your habits and history.' : 'Make this space yours. Please verify your email within 7 days.'}</span><button class="text-link" data-action="verification">Verify email</button></div>`;
}
function status(h) {
  if (h.pending) return `<span class="status">${icon('pending')}Pending sync</span>`;
  const result = evaluation(h);
  return `<span class="status ${!result.passed ? 'neutral':''}">${result.passed ? icon('check') : ''}${result.label}</span>`;
}
function habitCard(h) {
  const result = evaluation(h);
  const typeIcon = h.type === 'quantity' ? 'water' : h.type === 'binary' ? 'book' : h.offset === -1 ? 'moon' : 'sun';
  const target = h.type === 'quantity' ? `${h.operator==='LTE'?'At most':'At least'} ${h.target.toLocaleString('en')} ${escapeHTML(h.unit)} each day` : h.type === 'binary' ? 'One check-in each day' : `${h.offset === -1 ? 'Last night, ' : ''}${h.operator==='GTE'?'at or after':'by'} ${clock(h.target)}${h.tolerance ? ` · ${h.tolerance} min flexibility` : ''}`;
  const value = h.type === 'quantity' ? `<div class="habit-value">${Number(h.value||0).toLocaleString('en')}<span>/ ${h.target.toLocaleString('en')} ${escapeHTML(h.unit)}</span></div><div class="progress-track" role="progressbar" aria-label="${escapeHTML(h.name)} progress" aria-valuemin="0" aria-valuemax="${h.target}" aria-valuenow="${Math.min(h.value||0,h.target)}"><div class="progress-fill" style="width:${Math.min(100,Math.max(0,(h.value||0)/Math.max(1,h.target)*100))}%"></div></div>` : h.type === 'time' && h.value !== null ? `<div class="habit-value">${clock(h.value)}<span>${h.offset === -1 ? escapeHTML(h.occurred === '2026-11-13' ? 'Nov 13, after midnight' : 'Nov 12, last night') : result.delta > 0 ? `${result.delta} min after target` : 'Your recorded time'}</span></div>` : '';
  const accessibleAction=readonly?`View ${h.name}`:h.type==='binary'?`Mark ${h.name} ${h.value?'incomplete':'complete'}`:`${editor===h.id?'Close':'Open'} check-in editor for ${h.name}`;
  return `<article class="habit-card" data-habit="${escapeHTML(h.id)}" data-kind="${h.type}">
    <button type="button" class="habit-hit" data-action="habit" data-id="${escapeHTML(h.id)}" aria-label="${escapeHTML(accessibleAction)}. Current streak: ${streakFor(h)} days${h.pending?', pending sync confirmation':''}" ${!readonly&&h.type==='binary'?`aria-pressed="${!!h.value}"`:!readonly?`aria-expanded="${editor===h.id}" aria-controls="editor-${escapeHTML(h.id)}"`:''}></button>
    <div class="habit-top">
      ${h.type==='binary'?`<span class="check-button ${h.value?'done':''}" aria-hidden="true">${h.value?icon('check'):''}</span>`:`<span class="habit-icon">${icon(typeIcon)}</span>`}
      <div class="habit-main"><h3 class="habit-title">${escapeHTML(h.name)}</h3><p class="meta">${target}</p>${value}</div>
      <div class="habit-summary">${streakBadge(h)}<span class="card-chevron ${editor===h.id?'expanded':''}" aria-hidden="true">${h.type!=='binary'?'<svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4"/></svg>':''}</span></div>
    </div>
    <div class="habit-footer">${status(h)}</div>
    ${h.type!=='binary'?`<div class="editor-region" id="editor-${escapeHTML(h.id)}" ${editor===h.id?'':'hidden'}>${editor===h.id?editorMarkup(h):''}</div>`:''}
  </article>`;
}
function editorMarkup(h) {
  return `<form class="editor" data-save="${escapeHTML(h.id)}">${h.type === 'quantity' ? `<label for="actual-${h.id}">Amount so far (${escapeHTML(h.unit)})</label><div class="stepper"><button type="button" data-action="step" data-id="${h.id}" data-change="-250" aria-label="Subtract 250 ${escapeHTML(h.unit)}">−</button><input id="actual-${h.id}" name="actual" type="number" min="0" max="2147483647" step="1" value="${h.value||0}" required><button type="button" data-action="step" data-id="${h.id}" data-change="250" aria-label="Add 250 ${escapeHTML(h.unit)}">+</button></div><p class="helper">Add to your daily total, then save.</p>` : `<div class="field-grid"><div><label for="actual-${h.id}">Recorded time</label><input id="actual-${h.id}" name="actual" type="time" value="${timeValue(h.value === null ? h.target : h.value)}" required></div><div><label for="occurred-${h.id}">Date it happened</label><input id="occurred-${h.id}" name="occurred" type="date" value="${h.occurred||'2026-11-13'}" required></div></div><p class="helper">${h.offset === -1 ? 'This habit belongs to today. Its target was yesterday at '+clock(h.target)+'.' : 'Record the actual date and time, including after midnight.'}</p>`}<p class="error" hidden role="alert"></p><div class="form-actions"><button type="button" class="quiet" data-action="cancel-editor">Cancel</button><button type="submit" class="primary">Save</button></div></form>`;
}
function weekMarkup() {
  return `<div class="week" aria-label="Illustrative seven-day history">${['M','T','W','T','F','S','S'].map((day,i)=>`<div class="week-day">${day}<span class="week-mark ${i<3?'filled':i===3?'soft':''}">${i<4?icon('check'):''}</span></div>`).join('')}</div><p class="helper">Illustrative history for this design preview.</p>`;
}
function reflectionMarkup() {
  const done = habits.filter((h)=>evaluation(h).passed).length;
  const pending = habits.filter((h)=>h.pending).length;
  const h = habits.find((item)=>item.id===selected)||habits[0];
  const current=h?streakFor(h):0;const best=h?longestFor(h):0;
  return `<aside class="reflection" aria-label="Progress and habit details"><h2>A little progress<br>is still progress.</h2><p>Leave room for real life. Close-enough days count toward your streak, too.</p><div class="progress-total"><strong>${empty?0:done}</strong><span>of ${empty?0:habits.length} habits ${pending?'met locally':'met today'}</span></div><p class="helper">${pending?'Pending check-ins are not confirmed by the server yet.':'There is still room in your day.'}</p>${h&&!empty?`<div class="aside-divider"><p class="small muted">${escapeHTML(h.name)}</p><h3>Your week, one day at a time</h3>${weekMarkup()}<div class="stat-pair"><div><strong>${current} ${current===1?'day':'days'}</strong><span class="small muted">Current streak</span></div><div><strong>${best} ${best===1?'day':'days'}</strong><span class="small muted">Longest streak</span></div></div></div>`:''}<div class="aside-divider note"><p>Your day ends at midnight.</p><p>Need a later reset? You can change it in Settings.</p></div></aside>`;
}
function todayPage() {
  const pending = habits.filter((h)=>h.pending).length;
  return `<div class="shell">${header()}${verificationBanner()}<div class="page-heading"><div><span class="day-label">Friday, November 13</span><h1>Today, at your pace.</h1><p class="muted">A few small things worth coming back to.</p></div><button class="primary" data-action="new-habit" ${offline||readonly?'disabled':''} title="${offline?'Connect to create a habit':readonly?'Verify your email to make changes':'Create a habit'}">${icon('plus')}New habit</button></div><div class="app-grid"><section aria-label="Today's habits"><div class="section-heading"><h2>Your daily habits</h2><span class="small muted">${offline ? 'Check-ins stay on this device' : pending ? `${pending} waiting to sync` : 'A fresh start, every day'}</span></div>${loading ? '<div class="skeleton" aria-label="Loading habits"></div><div class="skeleton"></div><div class="skeleton"></div>' : empty||!habits.length ? '<div class="empty"><h2>Make room for<br>your first small habit.</h2><p>Start with something you would like to come back to each day. One is enough to begin.</p><button class="primary" data-action="new-habit">Create your first habit</button></div>' : `<div class="habit-list">${habits.map(habitCard).join('')}</div>`}</section>${reflectionMarkup()}</div>${bottomNav()}</div>`;
}
function productSheet() {
  return `<div class="product-sheet" aria-label="Illustrative preview of a daily habit list"><div class="sheet-heading"><strong>Today, at your pace.</strong><small class="muted">Friday</small></div><div class="sheet-row"><span class="check-button done">${icon('check')}</span><div><strong>Read a chapter</strong><small>A little time with a good book</small></div><small>Done</small></div><div class="sheet-row"><span class="check-button done">${icon('check')}</span><div><strong>Drink enough water</strong><small>1,800 / 2,000 ml</small></div><small>Within tolerance</small></div><div class="sheet-row"><span class="check-button"></span><div><strong>Get to bed earlier</strong><small>Last night, by 9:00 PM</small></div><small>Record time</small></div><p class="sheet-caption">An example day in Streaxie.</p></div>`;
}
function landingPage() {
  return `<div class="shell">${header(true)}<section class="hero"><div><h1>A simpler way<br>to track your<br>daily habits.</h1><p>A small place for the things you want to do more often. Check in, see your progress, and carry on with your day.</p><button class="primary" data-action="start">Start your first habit</button><p class="helper">Free to use. Start with just one habit.</p></div>${productSheet()}</section><section class="landing-section" id="how-it-works"><h2>A routine you can make your own.</h2><ol class="steps"><li><div><h3>Choose one small thing.</h3><p>A chapter to read, water to drink, a time to wind down. Set a target that makes sense for you.</p></div></li><li><div><h3>Give it a moment each day.</h3><p>Check it off, add an amount, or record a time. Your daily list keeps the next step close.</p></div></li><li><div><h3>See what keeps you going.</h3><p>Look back at your days. Find your rhythm, with room for a little flexibility along the way.</p></div></li></ol></section><section class="landing-section" id="small-start"><div><h2>Life does not always run to schedule.</h2></div><div><p class="muted">A little less water. A slightly later morning. If you choose to allow some flexibility, those days can still count.</p><p class="muted">Set your own daily reset and keep a clear history of what actually happened.</p><button class="text-link" data-action="view" data-destination="today">Take a look at an example day</button></div></section><section class="closing"><div><h2>Start small. Come back tomorrow.</h2><p>Your first habit is a good place to begin.</p></div><button class="primary" data-action="start">Create a free account</button></section><footer class="site-footer">Streaxie · A little room for your daily habits.</footer></div>`;
}
function onboardingPage() {
  const steps = ['Your time','Your habit','Your target'];
  return `<div class="shell">${header(true)}<section class="onboarding"><div class="flow-steps" aria-label="Onboarding progress">${steps.map((step,i)=>`<span ${i===onboardingStep?'class="current" aria-current="step"':''}>${step}</span>`).join('')}</div>${onboardingStep===0 ? `<h1>A day that fits<br>your life.</h1><p>Let us get your local time right. Then we will make a little space for your first habit.</p><form class="onboarding-form" id="flow-form"><div class="field"><label for="timezone">Your timezone</label><select id="timezone" name="timezone">${[...new Set([flow.timezone,'Asia/Jakarta','Asia/Makassar','Europe/London','America/New_York','UTC'])].map((zone)=>`<option ${flow.timezone===zone?'selected':''}>${escapeHTML(zone)}</option>`).join('')}</select><p class="helper">Suggested from this device. Choose a different timezone if needed.</p></div><label class="inline-choice"><input type="checkbox" id="custom-rollover" name="custom" ${flow.customRollover?'checked':''}>Adjust when my day ends</label><div class="field" id="rollover-field" ${flow.customRollover?'':'hidden'}><label for="rollover">Start a new day at</label><input id="rollover" type="time" name="rollover" value="${flow.rollover}"></div><p class="helper">By default, your day starts at midnight.</p><div class="form-actions"><button class="primary" type="submit">Continue</button></div></form>` : onboardingStep===1 ? `<h1>What would you like<br>to come back to?</h1><p>Something small is a good place to start.</p><form class="onboarding-form" id="flow-form"><div class="field"><label for="habit-name">Name your habit</label><input id="habit-name" name="name" placeholder="e.g. Read a chapter" value="${escapeHTML(flow.name)}" maxlength="120" required></div><label>How would you like to track it?</label><div class="type-options">${[['binary','book','Check it off','Something you do or do not do.'],['quantity','water','Reach an amount','Water, pages, steps, or another amount.'],['time','clock','Record a time','A time to wake up, wind down, or begin.']].map(([type,glyph,title,description])=>`<button type="button" class="type-choice ${flow.type===type?'selected':''}" data-action="choose-type" data-type="${type}" aria-pressed="${flow.type===type}">${icon(glyph)}<span><strong>${title}</strong><small>${description}</small></span></button>`).join('')}</div><div class="form-actions"><button type="button" class="quiet" data-action="flow-back">Back</button><button class="primary" type="submit">Continue</button></div></form>` : `<h1>A small goal.<br>A little room to grow.</h1><p>${escapeHTML(flow.name)}. Make the target your own.</p><form class="onboarding-form" id="flow-form">${flow.type==='binary' ? '<div class="note">One check-in means you did it. You can always undo it during your active day.</div>' : flow.type==='quantity' ? `<div class="field-grid"><div class="field"><label for="flow-target">Daily target</label><input id="flow-target" name="target" type="number" min="0" max="2147483647" value="${flow.target===1?2000:flow.target}" required></div><div class="field"><label for="flow-unit">Unit</label><input id="flow-unit" name="unit" placeholder="e.g. ml or pages" maxlength="20" value="${escapeHTML(flow.unit)}"></div></div>` : `<div class="field"><label for="flow-target">Target time</label><input id="flow-target" name="target" type="time" value="21:00" required></div><div class="field"><label for="target-day">This target is for</label><select name="offset" id="target-day"><option value="0">The same day</option><option value="-1" ${flow.offset===-1?'selected':''}>The previous evening</option></select><p class="helper">For last night's bedtime, choose the previous evening.</p></div>`}${flow.type!=='binary'?`<label class="inline-choice"><input type="checkbox" id="allow-flexibility" name="flexible" ${flow.flexible?'checked':''}>Allow some flexibility</label><div class="field" id="tolerance-field" ${flow.flexible?'':'hidden'}><label for="flow-tolerance">${flow.type==='time'?'Minutes of flexibility':'How much below your target can still count?'}</label><input id="flow-tolerance" name="tolerance" type="number" min="0" max="${flow.type==='time'?1439:2147483647}" value="${flow.tolerance||0}"></div>`:''}<div class="field"><label for="flow-evaluation">Where it fits in your day</label><input id="flow-evaluation" name="evaluation" type="time" value="${flow.evaluation}" required><p class="helper">Used to arrange your daily list. This preview does not send reminders.</p></div><div class="form-actions"><button type="button" class="quiet" data-action="flow-back">Back</button><button class="primary" type="submit">Create habit</button></div></form>`}</section></div>`;
}
function render() {
  const active=document.activeElement;
  const activeCard=active?.classList.contains('habit-hit')?active.dataset.id:null;
  const draftForm=main.querySelector('form[data-save]');
  const draft=draftForm?.dataset.save===editor?[...new FormData(draftForm).entries()]:null;
  const activeField=draft&&draftForm.contains(active)?active.id:null;
  main.classList.toggle('today-view',view==='today');
  main.innerHTML = view==='landing'?landingPage():view==='onboarding'?onboardingPage():todayPage();
  if(view==='today'&&draft){
    const replacement=main.querySelector('form[data-save]');
    if(replacement?.dataset.save===editor){
      draft.forEach(([name,value])=>{const field=replacement.elements.namedItem(name);if(field)field.value=value;});
      if(activeField)document.getElementById(activeField)?.focus({preventScroll:true});
    }
  }
  if(view==='today'&&activeCard)focusCard(activeCard);
  if(view==='onboarding'&&onboardingStep===2&&flow.type!=='binary'){
    const field=document.createElement('div');field.className='field';
    const options=flow.type==='quantity'?[['GTE','At least this amount'],['LTE','At most this amount']]:[['LTE','By this time'],['GTE','At or after this time']];
    field.innerHTML=`<label for="target-operator">Target direction</label><select id="target-operator" name="operator">${options.map(([value,label])=>`<option value="${value}" ${flow.operator===value?'selected':''}>${label}</option>`).join('')}</select>`;
    document.querySelector('#flow-form').insertBefore(field,document.querySelector('#allow-flexibility').closest('label'));
    document.querySelector('#flow-target').value=flow.type==='time'?timeValue(flow.target===1?1260:flow.target):(flow.target===1?2000:flow.target);
  }
  document.querySelectorAll('[data-view]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
  document.querySelector('#mobile-toggle').setAttribute('aria-pressed',String(document.body.classList.contains('mobile')));
  document.querySelector('#offline-toggle').setAttribute('aria-pressed',String(offline));
  document.querySelector('#readonly-toggle').setAttribute('aria-pressed',String(readonly));
  document.querySelector('#empty-toggle').setAttribute('aria-pressed',String(empty));
}
function notify(message) {
  const toast=document.querySelector('#toast');toast.textContent=message;toast.hidden=false;
  clearTimeout(timer);timer=setTimeout(()=>{toast.hidden=true;},3500);
}
function showDialog(title,body) {
  document.querySelector('#dialog-title').textContent=title;
  document.querySelector('#dialog-body').innerHTML=body;
  if (!dialog.open) dialog.showModal();
}
function startFlow(initial) {
  if (offline||readonly) { notify(offline?'Connect to create or change a habit.':'Verify your email to make changes.');return; }
  flow=freshFlow();onboardingStep=initial?0:1;view='onboarding';editor=null;render();window.scrollTo(0,0);
}
function syncPending() {
  if (offline||readonly) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{
    if (offline||readonly) return;
    if (!habits.some((h)=>h.pending)) return;
    habits.forEach((h)=>{h.pending=false;});persist();render();notify('Sample check-ins saved.');
  },1000);
}
function saveHabit(h,value,occurred) {
  h.value=value;if(occurred)h.occurred=occurred;h.pending=true;editor=null;persist();render();
  focusCard(h.id);
  notify(offline?'Kept on this device. We will retry when connected.':readonly?'Kept pending until you verify your email.':'Saving sample check-in…');syncPending();
}
function focusCard(id){[...main.querySelectorAll('.habit-hit')].find(button=>button.dataset.id===id)?.focus({preventScroll:true});}
function habitDetails(h){
  selected=h.id;render();
  if(innerWidth<=760||document.body.classList.contains('mobile'))showDialog(h.name,`<p class="muted">Your week, one day at a time.</p>${weekMarkup()}<p class="note">${h.type==='quantity'?`Target: ${h.target.toLocaleString('en')} ${escapeHTML(h.unit)}. Flexibility: ${h.tolerance} ${escapeHTML(h.unit)} below target.`:h.type==='time'?`Target: ${clock(h.target)}${h.offset===-1?' on the previous evening':''}. Flexibility: ${h.tolerance} minutes.`:'One check-in for each day you complete this habit.'}</p>`);
}
function settingsDialog() {
  showDialog('Settings',`<p class="muted">Timezone and daily reset</p><div class="note"><p>Asia/Jakarta</p><p>Your day starts at midnight.</p></div><p class="helper">The agreed product flow schedules later changes for the next day. Initial setup is shown in Onboarding.</p><div class="form-actions"><button class="quiet" data-action="archive">Archive</button><button class="secondary button" data-action="logout">Log out</button></div>`);
}

document.addEventListener('click',(event)=>{
  const button=event.target.closest('button,[data-action]');if(!button)return;
  if(button.dataset.view){view=button.dataset.view;if(view==='onboarding'){flow=freshFlow();onboardingStep=0;}editor=null;render();window.scrollTo(0,0);return;}
  if(button.id==='close-dialog'){dialog.close();return;}
  if(button.id==='mobile-toggle'){document.body.classList.toggle('mobile');render();return;}
  if(button.id==='offline-toggle'){offline=!offline;render();if(!offline)syncPending();return;}
  if(button.id==='readonly-toggle'){readonly=!readonly;if(readonly)verified=false;editor=null;render();if(!readonly)syncPending();return;}
  if(button.id==='empty-toggle'){empty=!empty;editor=null;render();return;}
  if(button.id==='loading-toggle'){view='today';loading=true;render();setTimeout(()=>{loading=false;render();},1400);return;}
  if(button.id==='reset-preview'){clearTimeout(syncTimer);habits=samples();offline=false;readonly=false;empty=false;verified=false;editor=null;selected='water';persist();view='today';render();notify('Sample day reset.');return;}
  const action=button.dataset.action;const h=habits.find((item)=>item.id===button.dataset.id);
  if(action==='view'){event.preventDefault();view=button.dataset.destination;render();window.scrollTo(0,0);}
  if(action==='new-habit')startFlow(false);
  if(action==='start')startFlow(true);
  if(action==='habit'&&h){
    selected=h.id;
    if(readonly){habitDetails(h);return;}
    if(h.type==='binary'){saveHabit(h,h.value?0:1);return;}
    editor=editor===h.id?null:h.id;render();
    if(editor)document.getElementById(`actual-${h.id}`)?.focus({preventScroll:true});else focusCard(h.id);
    return;
  }
  if(action==='cancel-editor'){const id=editor;editor=null;render();if(id)focusCard(id);}
  if(action==='step'&&h){const input=document.querySelector(`#actual-${h.id}`);input.value=Math.max(0,(Number(input.value)||0)+Number(button.dataset.change));}
  if(action==='insights')showDialog('Your days, a little clearer',`<p class="muted">The agreed Insights view includes a calendar, current and longest streaks, and the difference between target-met and tolerated days.</p>${weekMarkup()}<p class="helper">This panel is a preliminary layout. Its full page will follow the review of Today.</p>`);
  if(action==='settings')settingsDialog();
  if(action==='archive')showDialog('Archive',`<div class="empty"><h3>No archived habits yet.</h3><p>Habits you archive will remain available here with their history.</p></div>`);
  if(action==='verification')showDialog('A small step to keep your space',`<p>In the product, an email link confirms your address. You can use Streaxie for 7 days before verification is required to make changes.</p><p class="helper">This preview does not send an email or change an account.</p><div class="form-actions"><button class="primary" data-action="verify-preview">Preview verified state</button></div>`);
  if(action==='verify-preview'){verified=true;readonly=false;dialog.close();render();syncPending();notify('Showing the verified state.');}
  if(action==='login')showDialog('Welcome back',`<p class="muted">Login layout placeholder. Email and password authentication will use the existing API.</p><p class="helper">Do not enter real credentials into this design preview.</p><div class="form-actions"><button class="primary" data-action="login-preview">Continue preview</button></div>`);
  if(action==='login-preview'){dialog.close();view='today';render();syncPending();}
  if(action==='logout'){
    const count=habits.filter((item)=>item.pending).length;
    showDialog('Log out?',`<p>${count?`Your ${count} pending check-in${count>1?'s':''} will stay on this device for this account. Sending resumes when the same account signs back in.`:'Your saved habits will be here when you return.'}</p><p class="helper">Only sample data is involved in this preview.</p><div class="form-actions"><button class="quiet" data-action="cancel-logout">Stay here</button><button class="primary" data-action="confirm-logout">Log out</button></div>`);
  }
  if(action==='cancel-logout')dialog.close();
  if(action==='confirm-logout'){clearTimeout(syncTimer);dialog.close();view='landing';render();notify('Preview signed out. Sample pending data is retained.');}
  if(action==='flow-back'){
    const data=new FormData(document.querySelector('#flow-form'));
    if(onboardingStep===1)flow.name=data.get('name')||flow.name;
    if(onboardingStep===2){flow.target=flow.type==='time'?minutes(data.get('target')):Number(data.get('target')||1);flow.unit=data.get('unit')||'';flow.tolerance=Number(data.get('tolerance')||0);flow.flexible=!!data.get('flexible');flow.evaluation=data.get('evaluation');flow.offset=Number(data.get('offset')||0);flow.operator=data.get('operator')||'EQ';}
    onboardingStep=Math.max(0,onboardingStep-1);render();
  }
  if(action==='choose-type'){flow.name=document.querySelector('#habit-name').value;if(flow.type!==button.dataset.type){flow.type=button.dataset.type;flow.operator=flow.type==='binary'?'EQ':flow.type==='quantity'?'GTE':'LTE';flow.target=flow.type==='binary'?1:flow.type==='quantity'?2000:1260;flow.tolerance=0;flow.flexible=false;flow.offset=0;}render();}
});
document.addEventListener('input',(event)=>{if(event.target.id==='habit-name')event.target.setCustomValidity('');});
document.addEventListener('change',(event)=>{
  if(event.target.id==='custom-rollover'){flow.customRollover=event.target.checked;document.querySelector('#rollover-field').hidden=!flow.customRollover;}
  if(event.target.id==='allow-flexibility'){flow.flexible=event.target.checked;document.querySelector('#tolerance-field').hidden=!flow.flexible;}
});
document.addEventListener('submit',(event)=>{
  event.preventDefault();const form=event.target;const data=new FormData(form);
  if(form.dataset.save){
    if(readonly){notify('Verify your email before making changes.');return;}
    const h=habits.find((item)=>item.id===form.dataset.save);if(!h)return;
    const value=h.type==='time'?minutes(data.get('actual')):Number(data.get('actual'));
    if(!Number.isFinite(value)||value<0||value>(h.type==='time'?1439:2147483647)||!Number.isInteger(value)){
      const error=form.querySelector('.error');error.textContent='Enter a valid, nonnegative amount.';error.hidden=false;return;
    }
    saveHabit(h,value,data.get('occurred'));return;
  }
  if(form.id!=='flow-form')return;
  if(offline||readonly){notify(offline?'Connect to create or change a habit.':'Verify your email to make changes.');return;}
  if(onboardingStep===0){flow.timezone=data.get('timezone');flow.rollover=data.get('custom')?data.get('rollover'):'00:00';onboardingStep=1;render();return;}
  if(onboardingStep===1){flow.name=String(data.get('name')||'').trim();if(!flow.name){document.querySelector('#habit-name').setCustomValidity('Give your habit a name.');document.querySelector('#habit-name').reportValidity();return;}onboardingStep=2;render();return;}
  const target=flow.type==='binary'?1:flow.type==='time'?minutes(data.get('target')):Number(data.get('target'));
  const newHabit={id:'custom-'+Date.now(),name:flow.name,type:flow.type,target,tolerance:data.get('flexible')?Number(data.get('tolerance')||0):0,unit:data.get('unit')||'',evaluation:minutes(data.get('evaluation')),offset:Number(data.get('offset')||0),operator:data.get('operator')||(flow.type==='quantity'?'GTE':flow.type==='time'?'LTE':'EQ'),value:flow.type==='binary'?0:null,occurred:flow.type==='time'&&data.get('offset')==='-1'?'2026-11-12':'2026-11-13',pending:false,baseStreak:0,longestStreak:0};
  habits.push(newHabit);empty=false;persist();view='today';selected=newHabit.id;render();window.scrollTo(0,0);notify('Sample habit created. Initial timezone: '+flow.timezone+'.');
});

render();
if(habits.some((h)=>h.pending))syncPending();
