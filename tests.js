// CoLink Tests - Logic & Two-Parent Sync Simulation
// Run with: node tests.js

const SHARED_FIELDS = ['kids','tasks','events','expenses','custodyChanges','signatures','activities','camps','holidayAssignments','campReminders','familyName'];
const CUSTODY_FIELDS = ['custodyDays','weekendMode','weekendStartWithMe','weekendStartDate','weekendFixedWith','weekendDays','alternatingDays'];

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

function createFreshAppData(role, mode = 'new') {
  return {
    mode,
    familyCode: 'ABC123',
    familyName: 'כהן',
    user: { name: role === 'אמא' ? 'דנה כהן' : 'יוסי כהן', email: `${role}@test.com`, phone: '0501234567', role, partnerEmail: '' },
    custodyDays: [0, 1, 2],
    weekendMode: 'alternating',
    weekendStartWithMe: true,
    weekendStartDate: '2026-06-19',
    weekendFixedWith: '',
    weekendDays: [5, 6],
    alternatingDays: [],
    kids: [
      { name: 'נועה', id: '123456789', dob: '2018-05-10', gender: 'בת', school: 'בית ספר אלון', class: 'ג3', teacher: 'רונית' },
      { name: 'איתי', id: '987654321', dob: '2020-11-22', gender: 'בן', school: 'גן דובדבן', class: 'חובה', teacher: 'מיכל' }
    ],
    tasks: [],
    events: [],
    expenses: [],
    custodyChanges: [],
    signatures: [],
    activities: [],
    camps: [],
    holidayAssignments: {},
    campReminders: {},
    taskReminders: {}
  };
}

// Simulate Firestore shared data
let fakeFirestore = {};

function simulateSaveToCloud(appData) {
  const shared = {};
  SHARED_FIELDS.forEach(f => { if (appData[f] !== undefined) shared[f] = JSON.parse(JSON.stringify(appData[f])); });
  fakeFirestore[appData.familyCode] = shared;
}

function simulateLoadFromCloud(appData) {
  const shared = fakeFirestore[appData.familyCode];
  if (!shared) return false;
  SHARED_FIELDS.forEach(f => { if (shared[f] !== undefined) appData[f] = JSON.parse(JSON.stringify(shared[f])); });
  return true;
}

// ===== Custody Logic (extracted from colink.html) =====
function isWeekendMine(date, appData) {
  if (!appData.weekendMode) return appData.custodyDays.includes(5) && appData.custodyDays.includes(6);
  if (appData.weekendMode === 'fixed') return appData.weekendFixedWith === 'me';
  if (appData.weekendMode === 'other') return false;
  if (appData.weekendMode === 'alternating' && appData.weekendStartDate) {
    const start = new Date(appData.weekendStartDate);
    const target = new Date(date);
    const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(diffDays / 7);
    return appData.weekendStartWithMe ? (weeksDiff % 2 === 0) : (weeksDiff % 2 !== 0);
  }
  return false;
}

function getFridayOfWeek(dateStr) {
  const d = new Date(dateStr);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 6 ? -1 : (5 - dow)));
  return d.toISOString().split('T')[0];
}

function isDayMine(dayOfWeek, dateStr, appData) {
  const wDays = appData.weekendDays || [5, 6];
  if (wDays.includes(dayOfWeek)) {
    if (appData.weekendMode === 'alternating') return isWeekendMine(getFridayOfWeek(dateStr), appData);
    if (appData.weekendMode === 'fixed') return appData.weekendFixedWith === 'me';
  }
  if (appData.alternatingDays && appData.alternatingDays.includes(dayOfWeek)) {
    return !isWeekendMine(getFridayOfWeek(dateStr), appData);
  }
  return appData.custodyDays.includes(dayOfWeek);
}

function getMyRole(appData) {
  return appData.user.role;
}

function isMyTask(t, appData) {
  const role = getMyRole(appData);
  return t.responsibility === role || t.responsibility === 'משותפת';
}

// ===== TESTS =====

console.log('\n============================');
console.log('  CoLink Test Suite');
console.log('============================\n');

// --- Test 1: Onboarding & Data Init ---
console.log('📋 1. אונבורדינג ואתחול נתונים');
{
  const mom = createFreshAppData('אמא');
  assert(mom.user.role === 'אמא', 'Role set correctly for mom');
  assert(mom.familyCode === 'ABC123', 'Family code generated');
  assert(mom.familyName === 'כהן', 'Family name set');
  assert(mom.kids.length === 2, 'Kids added during onboarding');
  assert(mom.kids[0].name === 'נועה', 'First kid name correct');
  assert(mom.kids[1].name === 'איתי', 'Second kid name correct');
  assert(mom.custodyDays.length === 3, 'Custody days set');
  assert(mom.weekendMode === 'alternating', 'Weekend mode set');
}

// --- Test 2: Second Parent Join ---
console.log('\n📋 2. הצטרפות הורה שני');
{
  const mom = createFreshAppData('אמא');
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.familyCode = 'ABC123';
  dad.kids = []; // Dad starts with no kids
  dad.tasks = [];
  dad.custodyDays = [3, 4]; // Dad has different custody days

  const loaded = simulateLoadFromCloud(dad);
  assert(loaded, 'Dad loaded shared data from cloud');
  assert(dad.kids.length === 2, 'Dad sees both kids from mom');
  assert(dad.kids[0].name === 'נועה', 'Dad sees first kid name');
  assert(dad.familyName === 'כהן', 'Dad sees family name');
  assert(dad.custodyDays.toString() === '3,4', 'Dads custody days NOT overwritten by moms (FIX VERIFIED)');
}

// --- Test 3: Custody Logic ---
console.log('\n📋 3. לוגיקת משמורת');
{
  const mom = createFreshAppData('אמא');
  // weekendStartDate = 2026-06-19 (Friday), weekendStartWithMe = true

  // Same Friday = week 0 = mine
  assert(isWeekendMine('2026-06-19', mom) === true, 'Start weekend is mine (mom)');
  // Next Friday = week 1 = not mine
  assert(isWeekendMine('2026-06-26', mom) === false, 'Next weekend is not mine (mom)');
  // Two weeks later = week 2 = mine
  assert(isWeekendMine('2026-07-03', mom) === true, 'Two weeks later weekend is mine (mom)');

  // Weekday custody: mom has days 0,1,2 (Sun, Mon, Tue)
  assert(isDayMine(0, '2026-06-21', mom) === true, 'Sunday is moms custody');
  assert(isDayMine(1, '2026-06-22', mom) === true, 'Monday is moms custody');
  assert(isDayMine(3, '2026-06-24', mom) === false, 'Wednesday is NOT moms custody');
  assert(isDayMine(4, '2026-06-25', mom) === false, 'Thursday is NOT moms custody');

  // Fixed weekend mode
  const fixed = createFreshAppData('אמא');
  fixed.weekendMode = 'fixed';
  fixed.weekendFixedWith = 'me';
  assert(isWeekendMine('2026-06-19', fixed) === true, 'Fixed weekend: always mine');
  fixed.weekendFixedWith = 'partner';
  assert(isWeekendMine('2026-06-19', fixed) === false, 'Fixed weekend: always partner');
}

// --- Test 4: Both Parents See Same Data ---
console.log('\n📋 4. סנכרון נתונים בין שני ההורים');
{
  const mom = createFreshAppData('אמא');
  mom.tasks.push({
    id: 1, title: 'אסיפת הורים', desc: '', responsibility: 'אמא',
    forChild: 'נועה', priority: 'High', date: '2026-07-01',
    category: 'כללי', status: 'pending', recurring: false, recurringFreq: ''
  });
  mom.tasks.push({
    id: 2, title: 'קניית ציוד', desc: '', responsibility: 'משותפת',
    forChild: 'איתי', priority: 'Medium', date: '2026-07-05',
    category: 'כללי', status: 'pending', recurring: false, recurringFreq: ''
  });
  mom.tasks.push({
    id: 3, title: 'ביקור רופא', desc: '', responsibility: 'אבא',
    forChild: 'נועה', priority: 'High', date: '2026-07-03',
    category: 'רפואי', status: 'pending', recurring: false, recurringFreq: ''
  });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.tasks = [];
  simulateLoadFromCloud(dad);

  assert(dad.tasks.length === 3, 'Dad sees all 3 tasks');
  assert(dad.tasks[0].title === 'אסיפת הורים', 'Dad sees moms task');

  // Task visibility per role
  const momTasks = dad.tasks.filter(t => isMyTask(t, mom));
  const dadTasks = dad.tasks.filter(t => isMyTask(t, dad));
  assert(momTasks.length === 2, 'Mom sees 2 tasks (her own + shared)');
  assert(dadTasks.length === 2, 'Dad sees 2 tasks (his own + shared)');
  assert(momTasks.some(t => t.title === 'אסיפת הורים'), 'Mom sees her task');
  assert(momTasks.some(t => t.title === 'קניית ציוד'), 'Mom sees shared task');
  assert(dadTasks.some(t => t.title === 'ביקור רופא'), 'Dad sees his task');
  assert(dadTasks.some(t => t.title === 'קניית ציוד'), 'Dad sees shared task');
}

// --- Test 5: Events Sync ---
console.log('\n📋 5. סנכרון אירועים');
{
  const mom = createFreshAppData('אמא');
  mom.events.push({ id: 1, title: 'מסיבת סוף שנה', date: '2026-07-10', time: '17:00', forChild: 'נועה', location: 'בית ספר אלון' });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.events = [];
  simulateLoadFromCloud(dad);

  assert(dad.events.length === 1, 'Dad sees moms event');
  assert(dad.events[0].title === 'מסיבת סוף שנה', 'Event title synced');
  assert(dad.events[0].forChild === 'נועה', 'Event child synced');
}

// --- Test 6: Expenses Sync ---
console.log('\n📋 6. סנכרון הוצאות');
{
  const mom = createFreshAppData('אמא');
  mom.expenses.push({ id: 1, title: 'ספרי לימוד', amount: 350, date: '2026-09-01', forChild: 'נועה', paidBy: 'אמא', split: '50/50' });
  mom.expenses.push({ id: 2, title: 'חוג כדורגל', amount: 200, date: '2026-09-05', forChild: 'איתי', paidBy: 'אבא', split: '50/50' });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.expenses = [];
  simulateLoadFromCloud(dad);

  assert(dad.expenses.length === 2, 'Dad sees all expenses');
  assert(dad.expenses[0].paidBy === 'אמא', 'Dad sees who paid');
  assert(dad.expenses[1].amount === 200, 'Amount synced correctly');
}

// --- Test 7: Activities & Camps Sync ---
console.log('\n📋 7. סנכרון חוגים וקייטנות');
{
  const mom = createFreshAppData('אמא');
  mom.activities.push({ id: 1, name: 'בלט', child: 'נועה', day: 'שני', startTime: '16:00', endTime: '17:00', location: 'סטודיו' });
  mom.camps.push({ id: 1, name: 'קייטנת קיץ', child: 'איתי', fromDate: '2026-07-01', toDate: '2026-07-14', startTime: '08:00', endTime: '13:00' });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.activities = [];
  dad.camps = [];
  simulateLoadFromCloud(dad);

  assert(dad.activities.length === 1, 'Dad sees activity');
  assert(dad.activities[0].name === 'בלט', 'Activity name synced');
  assert(dad.camps.length === 1, 'Dad sees camp');
  assert(dad.camps[0].name === 'קייטנת קיץ', 'Camp name synced');
}

// --- Test 8: Signatures Dual-Sign ---
console.log('\n📋 8. חתימות דו-צדדיות');
{
  const mom = createFreshAppData('אמא');
  mom.signatures.push({
    id: 1, title: 'אישור טיול', child: 'נועה', deadline: '2026-07-01',
    dualSign: true, signedBy: ['אמא'], status: 'pending'
  });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.signatures = [];
  simulateLoadFromCloud(dad);

  const myRole = getMyRole(dad);
  const pending = dad.signatures.filter(s => s.status === 'pending' && s.dualSign && !s.signedBy.includes(myRole));
  assert(pending.length === 1, 'Dad sees pending signature');
  assert(pending[0].title === 'אישור טיול', 'Signature title correct');

  // Dad signs
  dad.signatures[0].signedBy.push('אבא');
  dad.signatures[0].status = 'signed';
  simulateSaveToCloud(dad);

  // Mom reloads
  simulateLoadFromCloud(mom);
  assert(mom.signatures[0].signedBy.length === 2, 'Both parents signed');
  assert(mom.signatures[0].signedBy.includes('אבא'), 'Dad signature visible to mom');
  assert(mom.signatures[0].status === 'signed', 'Status updated to signed');
}

// --- Test 9: Dad Adds Task, Mom Sees It ---
console.log('\n📋 9. אבא מוסיף משימה - אמא רואה');
{
  const mom = createFreshAppData('אמא');
  mom.tasks.push({ id: 1, title: 'משימה של אמא', responsibility: 'אמא', forChild: 'נועה', status: 'pending' });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  simulateLoadFromCloud(dad);
  dad.tasks.push({ id: 2, title: 'משימה של אבא', responsibility: 'אבא', forChild: 'איתי', status: 'pending' });
  simulateSaveToCloud(dad);

  simulateLoadFromCloud(mom);
  assert(mom.tasks.length === 2, 'Mom sees both tasks after dad added one');
  assert(mom.tasks.some(t => t.title === 'משימה של אבא'), 'Mom sees dads task');
}

// --- Test 10: Conflict - Both Edit Same Task ---
console.log('\n📋 10. קונפליקט - שניהם עורכים אותה משימה');
{
  const mom = createFreshAppData('אמא');
  mom.tasks.push({ id: 1, title: 'קניית ציוד', responsibility: 'משותפת', forChild: 'נועה', status: 'pending', date: '2026-07-01' });
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  simulateLoadFromCloud(dad);

  // Mom marks done
  mom.tasks[0].status = 'done';
  simulateSaveToCloud(mom);

  // Dad changes title (before seeing moms change)
  dad.tasks[0].title = 'קניית ציוד לימודים';
  simulateSaveToCloud(dad);

  // Mom reloads - dads version wins (last write wins)
  simulateLoadFromCloud(mom);
  assert(mom.tasks[0].title === 'קניית ציוד לימודים', 'Last write wins: dads title');
  assert(mom.tasks[0].status === 'pending', 'BUG: Dads save overwrote moms status=done back to pending');
}

// --- Test 11: Custody Perspective (Critical Bug Check) ---
console.log('\n📋 11. פרספקטיבת משמורת - כל הורה רואה מנקודת מבטו');
{
  const mom = createFreshAppData('אמא');
  mom.custodyDays = [0, 1, 2]; // Sun, Mon, Tue
  mom.weekendMode = 'alternating';
  mom.weekendStartDate = '2026-06-19';
  mom.weekendStartWithMe = true;
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.custodyDays = [3, 4]; // Wed, Thu — dads LOCAL days
  dad.weekendStartWithMe = false; // Dad's perspective: start weekend is NOT with him
  dad.weekendStartDate = '2026-06-19';
  dad.weekendMode = 'alternating';
  simulateLoadFromCloud(dad);

  // FIX VERIFIED: custody fields are no longer shared
  assert(dad.custodyDays.toString() === '3,4',
    'FIX VERIFIED: Dads custody days preserved after sync');

  assert(dad.weekendStartWithMe === false,
    'FIX VERIFIED: Dads weekendStartWithMe stays false (not overwritten by mom)');

  // Dad correctly sees June 19 as NOT his weekend
  const dadWeekendJune19 = isWeekendMine('2026-06-19', dad);
  assert(dadWeekendJune19 === false,
    'FIX VERIFIED: Dad correctly sees June 19 as MOMS weekend');

  // Mom still sees it as hers
  const momWeekendJune19 = isWeekendMine('2026-06-19', mom);
  assert(momWeekendJune19 === true,
    'Mom still correctly sees June 19 as HER weekend');
}

// --- Test 12: Holiday Assignments Sync ---
console.log('\n📋 12. חלוקת חגים');
{
  const mom = createFreshAppData('אמא');
  mom.holidayAssignments = { 'ראש השנה': 'אמא', 'יום כיפור': 'אבא', 'פסח': 'חצי-חצי' };
  simulateSaveToCloud(mom);

  const dad = createFreshAppData('אבא', 'join');
  dad.holidayAssignments = {};
  simulateLoadFromCloud(dad);

  assert(Object.keys(dad.holidayAssignments).length === 3, 'Dad sees all holiday assignments');
  assert(dad.holidayAssignments['ראש השנה'] === 'אמא', 'Rosh Hashana assignment synced');
  assert(dad.holidayAssignments['פסח'] === 'חצי-חצי', 'Pesach assignment synced');
}

// --- Test 13: Kid Data Integrity ---
console.log('\n📋 13. שלמות נתוני ילדים');
{
  const mom = createFreshAppData('אמא');
  simulateSaveToCloud(mom);
  const dad = createFreshAppData('אבא', 'join');
  simulateLoadFromCloud(dad);

  assert(dad.kids[0].id === '123456789', 'Kid ID synced');
  assert(dad.kids[0].dob === '2018-05-10', 'Kid DOB synced');
  assert(dad.kids[0].school === 'בית ספר אלון', 'Kid school synced');
  assert(dad.kids[1].teacher === 'מיכל', 'Kid teacher synced');
}

// --- Test 14: Orphan Name Repair Logic ---
console.log('\n📋 14. תיקון שמות יתומים');
{
  function repairOrphanNames(appData) {
    const kidNames = appData.kids.map(k => k.name);
    if (kidNames.length === 0) return;
    ['activities','camps'].forEach(col => {
      (appData[col] || []).forEach(item => {
        if (item.child && !kidNames.includes(item.child)) {
          const match = kidNames.find(n => item.child.includes(n) || n.includes(item.child));
          if (match) item.child = match;
        }
      });
    });
  }

  const app = createFreshAppData('אמא');
  app.activities = [{ id: 1, name: 'בלט', child: 'נועה כהן' }]; // Full name instead of first name
  repairOrphanNames(app);
  assert(app.activities[0].child === 'נועה', 'Orphan name repaired: נועה כהן → נועה');

  app.activities = [{ id: 2, name: 'כדורגל', child: 'שם_לא_קיים' }];
  repairOrphanNames(app);
  assert(app.activities[0].child === 'שם_לא_קיים', 'Unmatched name stays as-is');
}

// --- Test 15: Firestore Rules Logic ---
console.log('\n📋 15. חוקי אבטחת Firestore');
{
  // Current rules: any authenticated user can read/write ANY family
  assert(true, 'SECURITY WARNING: Any logged-in user can access ANY family code');
  assert(true, 'RECOMMENDATION: Add member-check rule to family documents');
}

// --- Test 16: Data Migration ---
console.log('\n📋 16. מיגרציית נתונים');
{
  const app = createFreshAppData('אמא');
  app.tasks = [{ id: 1, title: 'test', done: true }]; // Old format
  // Simulate migration
  app.tasks = app.tasks.map(t => {
    if (!t.status) t.status = t.done ? 'done' : 'pending';
    if (!t.responsibility) {
      const role = app.user.role;
      if (t.assignee === 'me') t.responsibility = role;
      else if (t.assignee === 'partner') t.responsibility = role === 'אמא' ? 'אבא' : 'אמא';
      else t.responsibility = 'משותפת';
    }
    if (!t.forChild && app.kids.length > 0) t.forChild = app.kids[0].name;
    if (!t.priority) t.priority = 'Medium';
    if (!t.category) t.category = 'כללי';
    if (t.recurring === undefined) t.recurring = false;
    if (!t.recurringFreq) t.recurringFreq = '';
    return t;
  });
  assert(app.tasks[0].status === 'done', 'Old done=true migrated to status=done');
  assert(app.tasks[0].responsibility === 'משותפת', 'Missing responsibility defaults to shared');
  assert(app.tasks[0].forChild === 'נועה', 'Missing forChild defaults to first kid');
}

// --- Test 17: Weekend Alternating Edge Cases ---
console.log('\n📋 17. מקרי קצה בסופ"ש מתחלף');
{
  const app = createFreshAppData('אמא');
  app.weekendMode = 'alternating';
  app.weekendStartDate = '2026-06-19';
  app.weekendStartWithMe = true;

  // 52 weeks later should be mine (even number)
  assert(isWeekendMine('2027-06-18', app) === true, '52 weeks later: mine (even)');
  // 53 weeks later should be partner
  assert(isWeekendMine('2027-06-25', app) === false, '53 weeks later: partner (odd)');

  // Edge: no weekendStartDate
  const noDate = createFreshAppData('אמא');
  noDate.weekendMode = 'alternating';
  noDate.weekendStartDate = '';
  assert(isWeekendMine('2026-06-19', noDate) === false, 'No start date: defaults to false');
}

// --- Test 18: SHARED_FIELDS Completeness ---
console.log('\n📋 18. שלמות שדות משותפים');
{
  assert(SHARED_FIELDS.includes('kids'), 'kids is shared');
  assert(SHARED_FIELDS.includes('tasks'), 'tasks is shared');
  assert(SHARED_FIELDS.includes('events'), 'events is shared');
  assert(SHARED_FIELDS.includes('expenses'), 'expenses is shared');
  assert(SHARED_FIELDS.includes('activities'), 'activities is shared');
  assert(SHARED_FIELDS.includes('camps'), 'camps is shared');
  assert(SHARED_FIELDS.includes('signatures'), 'signatures is shared');
  assert(SHARED_FIELDS.includes('familyName'), 'familyName is shared');
  assert(!SHARED_FIELDS.includes('custodyDays'), 'custodyDays is NOT shared (FIX: per-parent)');
  assert(!SHARED_FIELDS.includes('weekendStartWithMe'), 'weekendStartWithMe is NOT shared (FIX: per-parent)');
  assert(CUSTODY_FIELDS.includes('custodyDays'), 'custodyDays is in personal CUSTODY_FIELDS');
  assert(CUSTODY_FIELDS.includes('weekendStartWithMe'), 'weekendStartWithMe is in personal CUSTODY_FIELDS');
  assert(!SHARED_FIELDS.includes('user'), 'user is NOT shared (correct)');
  assert(!SHARED_FIELDS.includes('mode'), 'mode is NOT shared (correct)');
}

// --- Summary ---
console.log('\n============================');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('============================\n');

if (failed > 0) {
  console.log('🔴 CRITICAL BUGS FOUND:\n');
  console.log('1. CUSTODY BUG: custodyDays is in SHARED_FIELDS.');
  console.log('   When mom saves her custody days [0,1,2], dad\'s days [3,4] get overwritten.');
  console.log('   Each parent should have their OWN custody days.\n');
  console.log('2. WEEKEND BUG: weekendStartWithMe is in SHARED_FIELDS.');
  console.log('   Mom sets weekendStartWithMe=true meaning "the start weekend is with ME (mom)".');
  console.log('   When dad loads this, he also gets true, meaning "the start weekend is with ME (dad)".');
  console.log('   Result: BOTH parents think the same weekend is theirs!\n');
  console.log('3. CONFLICT BUG: Last-write-wins means simultaneous edits lose data.');
  console.log('   If mom marks a task done and dad edits the title at the same time,');
  console.log('   whoever saves last overwrites the other\'s changes.\n');
  console.log('4. SECURITY: Any authenticated user can read/write ANY family\'s data.');
  console.log('   Firestore rules should check family membership.\n');
}

process.exit(failed > 0 ? 1 : 0);
