/* 꼬북이 설문도구 — 화면
   주소: #/q (부위 고르기) · #/q/<부위> · #/q/<부위>/<도구|ex|cdm|sum>
   - 기록지 내용은 바꾸지 않고 '읽기만' 함(레드플래그·CVA·DNF·발병 계기·의뢰 진단명)
   - 응답은 환자마다 localStorage 'ggobugi_web_q_<환자id>' 에 따로 보관 */
(function () {
  'use strict';
  var G = window.GGQ; if (!G || !G.TOOLS) return;
  var T = G.TOOLS, AREAS = G.AREAS;
  var $ = function (q, r) { return (r || document).querySelector(q); };
  var $$ = function (q, r) { return [].slice.call((r || document).querySelectorAll(q)); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var TXT = function (e) { return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  var today = function () { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

  /* ---------- 환자별 저장 ---------- */
  var ctx = null; /* { pid, patient, shell, ui } */
  function key() { return 'ggobugi_web_q_' + (ctx && ctx.pid || 'none'); }
  function load() { try { var s = JSON.parse(localStorage.getItem(key()) || '{}'); s.ans = s.ans || {}; s.find = s.find || {}; s.red = s.red || {}; s.when = s.when || {}; s.lv = s.lv || {}; s.part = s.part || {}; return s; } catch (e) { return { ans: {}, find: {}, red: {}, when: {}, lv: {}, part: {} }; } }
  var S = null;
  function save() { try { localStorage.setItem(key(), JSON.stringify(S)); } catch (e) { } }
  function ans(id) { return S.ans[id] = S.ans[id] || {}; }

  /* ---------- 기록지에서 읽기(바꾸지 않음) ---------- */
  function fv(n) { var e = document.querySelector('main [name="' + n + '"]'); if (!e) return ''; if (e.type === 'radio' || e.type === 'checkbox') { var c = $$('main [name="' + n + '"]').filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); return c.join(', '); } return String(e.value || '').trim(); }
  function recArea() { var dx = fv('ref_medical_dx'), best = null, bi = 1e9; AREAS.forEach(function (a) { var m = a.re.exec(dx); if (m && m.index < bi) { bi = m.index; best = a.k; } }); return best; }
  function recPart() {
    var dx = fv('ref_medical_dx');
    var map = [['neck', /목|경추/], ['thoracic', /등뼈|흉추|등 /], ['lumbar', /허리|요추/], ['sij', /엉치|천장|골반/], ['shoulder', /어깨|회전근/], ['elbow', /팔꿈치|테니스|골프/], ['wrist', /손목|손가락|손/], ['hip', /엉덩관절|고관절/], ['knee', /무릎/], ['ankle', /발목|발바닥|아킬레스|족저|발/], ['pelvic', /임신|산전|산후|출산/]];
    var best = null, bi = 1e9; map.forEach(function (m) { var x = m[1].exec(dx); if (x && x.index < bi) { bi = x.index; best = m[0]; } }); return best;
  }
  function recordRedFlags() {
    /* 기록지 A-4 레드플래그 22문항(rf_ces·fx·ca·inf·cv + 번호)만 */
    var names = {}; $$('main input[type="radio"][name^="rf_"]').forEach(function (r) { if (/^rf_(ces|fx|ca|inf|cv)\d+$/.test(r.name)) names[r.name] = 1; });
    var out = { yes: [], unknown: [], answered: 0, total: Object.keys(names).length };
    Object.keys(names).forEach(function (n) {
      var rs = $$('main input[name="' + n + '"]'), c = rs.filter(function (r) { return r.checked; })[0];
      if (!c) return; out.answered++;
      if (/예/.test(c.value) && !/아니/.test(c.value)) out.yes.push(qText(rs));
      else if (/모르/.test(c.value)) out.unknown.push(qText(rs));
    });
    return out;
  }
  function qText(rs) {
    var p = rs[0].parentElement; while (p && rs.some(function (r) { return !p.contains(r); })) p = p.parentElement;
    if (!p) return '레드플래그 문항';
    var t = TXT(p).replace(/예|아니요|아니오|잘 모르겠음|잘 모르겠습니다/g, '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 90);
  }
  function num(n) { var v = parseFloat(fv(n)); return isNaN(v) ? null : v; }

  /* ---------- 점수 ---------- */
  function scoreOf(id) { var t = T[id]; if (!t) return null; try { return t.score(ans(id)); } catch (e) { console.warn('[quest] score', id, e); return null; } }
  function progress(id) { var t = T[id], a = ans(id), n = 0; t.items.forEach(function (it, i) { var v = a[i]; if (v !== undefined && v !== null && !(Array.isArray(v) && !v.length)) n++; }); return { n: n, of: t.items.length }; }
  function complete(id) { var p = progress(id), t = T[id]; var need = t.items.filter(function (it) { return !it.multi; }).length; var n = 0; t.items.forEach(function (it, i) { if (!it.multi && ans(id)[i] !== undefined && ans(id)[i] !== null) n++; }); return n >= need; }
  function lvKey(level) { return level >= 3 ? 'high' : level === 2 ? 'mod' : 'low'; }

  /* ---------- 공통 틀 ---------- */
  function shellTop(area, tab) {
    var p = ctx.patient || {};
    var as = [p.age ? p.age + '세' : '', p.sex].filter(Boolean).join(' / ');
    var rA = recArea();
    var areaChips = AREAS.map(function (a) { return '<a class="q-achip' + (area && a.k === area.k ? ' on' : '') + '" href="#/q/' + a.k + '"><span>' + a.icon + '</span>' + esc(a.t) + (a.k === rA ? ' <em>추천</em>' : '') + '</a>'; }).join('');
    return '<header class="ws-top q-top"><a class="ws-back" href="#/toc">← 목차</a><div class="ws-toptitle"><b>설문도구' + (area ? ' · ' + esc(area.t) : '') + '</b><small>부위별 표준 설문 · 채점·해석 · 운동 처방 · 임상의사결정</small></div></header>' +
      '<section class="q-pbar"><span class="ws-avatar">' + esc((p.name || '?').slice(0, 1)) + '</span><div><b>' + esc(p.name || '') + '</b><span>' + esc(as) + (p.job ? ' · ' + esc(p.job) : '') + (fv('ref_medical_dx') ? ' · ' + esc(fv('ref_medical_dx')) : '') + '</span></div><span class="q-date">평가일 ' + today() + '</span></section>' +
      '<nav class="q-areas">' + areaChips + '</nav>';
  }
  function tabsRow(area, tab) {
    var rel = simProfile().rel;
    var tools = area.tools.map(function (id) { var t = T[id], pr = progress(id); return '<a class="q-tab' + (tab === id ? ' on' : '') + (rel.indexOf(id) >= 0 ? ' rec' : '') + '" href="#/q/' + area.k + '/' + id + '"><b>' + esc(t.short) + (rel.indexOf(id) >= 0 ? ' <u>추천</u>' : '') + '</b><small>' + esc(t.name) + '</small><i class="' + (complete(id) ? 'ok' : pr.n ? 'part' : '') + '">' + pr.n + '/' + pr.of + '</i></a>'; }).join('');
    var extra = [['ex', '🏃 운동 안내문', '부위별 운동 그림 · 인쇄'], ['cdm', '🧭 임상의사결정', '위험신호 · 분류 · 치료 방향'], ['sum', '📋 결과 요약', '전체 점수 · 복사 · 인쇄']].map(function (x) { return '<a class="q-tab q-tab2' + (tab === x[0] ? ' on' : '') + '" href="#/q/' + area.k + '/' + x[0] + '"><b>' + x[1] + '</b><small>' + x[2] + '</small></a>'; }).join('');
    return '<nav class="q-tabs" aria-label="설문 탭">' + tools + extra + '</nav>';
  }

  /* ---------- 허브 ---------- */
  function renderHub() {
    var rA = recArea();
    var cards = AREAS.map(function (a) {
      var done = a.tools.filter(complete).length;
      return '<a class="q-hcard' + (a.k === rA ? ' pick' : '') + '" href="#/q/' + a.k + '"><span class="q-hicon">' + a.icon + '</span><b>' + esc(a.t) + (a.k === rA ? ' <em>이 환자 추천</em>' : '') + '</b><small>' + a.tools.map(function (id) { return esc(T[id].short); }).join(' · ') + '</small><span class="q-hfoot"><i>완료 ' + done + ' / ' + a.tools.length + '</i>열기 ›</span></a>';
    }).join('');
    return shellTop(null) + '<section class="q-hgrid">' + cards + '</section>' +
      '<div class="q-note">각 부위에서 할 수 있는 일: 설문 응답과 자동 채점 · 결과 해석과 위험신호 안내 · 결과에 맞는 운동지침과 운동 그림 · 환자용 운동 안내문 · 임상의사결정 흐름(위험신호 → 심리사회 요인 → 분류 → 치료 방향 → 재평가) · 빈 설문지·안내문·결과 보고서 인쇄</div>' + disclaimer();
  }
  function disclaimer() { return '<p class="q-disc">교육용 도구입니다. 실제 환자의 개인정보는 넣지 마세요. 설문 문항은 원 논문을 바탕으로 새로 쓴 교육용 번역이며, 연구·공식 사용 때는 각 도구의 공식 한국어판과 사용 허가를 확인하세요. 기록지 내용은 바꾸지 않고 읽기만 합니다.</p>'; }

  /* ---------- 설문 화면 ---------- */
  function scoreBox(id) {
    var s = scoreOf(id), pr = progress(id), t = T[id], full = complete(id);
    if (!s) return '<div class="q-score empty"><div class="q-sleft"><small>' + esc(t.short) + ' 점수</small><b>–</b></div><div class="q-sright"><span>아직 응답이 없습니다</span><small>' + esc(t.items.length) + '문항</small></div></div>';
    return '<div class="q-score lv' + s.level + '"><div class="q-sleft"><small>' + esc(t.short) + ' 점수</small><b>' + esc(s.main) + '<em>' + esc(s.unit) + '</em></b></div><div class="q-sright"><span class="q-badge lv' + s.level + '">' + esc(s.label) + '</span><small>' + (full ? '모든 문항 응답 완료' : '응답 진행 중 — 지금까지의 응답으로 계산 (' + pr.n + '/' + pr.of + ')') + '</small><ul>' + s.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div><p class="q-formula">' + esc(s.formula) + '</p></div>';
  }
  function itemHtml(id, it, i) {
    var a = ans(id), v = a[i];
    var opts;
    if (it.multi) {
      var arr = Array.isArray(v) ? v : [];
      opts = it.o.map(function (o) { return '<button type="button" class="q-opt multi' + (arr.indexOf(o[0]) >= 0 ? ' on' : '') + '" data-qa="' + id + '" data-qi="' + i + '" data-qm="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('');
    } else {
      opts = it.o.map(function (o) { return '<button type="button" class="q-opt' + (it.scale ? ' sc' : '') + (it.yn ? ' yn' : '') + (v !== undefined && v !== null && v !== 'na' && +v === o[0] ? ' on' : '') + '" data-qa="' + id + '" data-qi="' + i + '" data-qv="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('');
      if (it.na) opts += '<button type="button" class="q-opt na' + (v === 'na' ? ' on' : '') + '" data-qa="' + id + '" data-qi="' + i + '" data-qv="na">해당 없음</button>';
    }
    var done = it.multi ? (Array.isArray(v) && v.length) : (v !== undefined && v !== null);
    return '<div class="q-item' + (done ? ' done' : '') + (it.danger ? ' danger' : '') + '" id="qi-' + id + '-' + i + '"><div class="q-qt"><span class="q-n">' + (i + 1) + '</span><b>' + esc(it.t) + '</b></div><div class="q-opts' + (it.scale ? ' scale' : '') + (it.yn ? ' yn' : '') + '">' + opts + '</div></div>';
  }
  function itemsHtml(id) {
    var t = T[id], out = '', gi = 0;
    t.items.forEach(function (it, i) {
      if (t.groups) t.groups.forEach(function (g) { if (g.from === i) out += '<h4 class="q-group">' + esc(g.t) + '</h4>'; });
      out += itemHtml(id, it, i);
    });
    return out;
  }
  function recordSpecPos() {
    var seen = {}, pos = {};
    $$('main #specialTable tbody tr').forEach(function (tr) {
      var n = (tr.querySelector('select[name="spec_name"]') || {}).value, r = (tr.querySelector('select[name="pn_result"]') || {}).value;
      if (!n) return; seen[n] = (seen[n] || 0) + 1; var k = seen[n] > 1 ? n + '#' + seen[n] : n;
      if (r === 'Positive') pos[k] = true;
    });
    return pos;
  }
  function recordNdi() {
    var rows = $$('main #ndi select[name="ndi_score"]'); if (!rows.length) return null;
    var vals = rows.map(function (s) { return s.value === '' ? null : +s.value; });
    return vals.some(function (v) { return v !== null; }) ? vals : null;
  }
  /* ---------- 가상 환자 응답: 기록지(진단·통증·수면·기능·직업)와 맞게 답 만들기 ---------- */
  var REL = { neck: ['ndi', 'fabq'], lbp: ['odi', 'rmdq', 'fabq'], lumbar: ['odi', 'rmdq', 'fabq'], thoracic: ['fri', 'fabq'], sij: ['pgq', 'odi'], shoulder: ['spadi', 'qdash'], elbow: ['prtee', 'qdash'], wrist: ['prwe', 'bctq', 'qdash'], hip: ['ohs', 'lefs'], knee: ['oks', 'lefs'], ankle: ['faam', 'lefs'], pelvic: ['pgq', 'odi', 'iciq', 'epds'], stroke: ['lefs', 'sf36'], sci: ['lefs', 'sf36'] };
  function simProfile() {
    var g = (ctx.patient || {}).gen || null;
    var key = g ? g.cond : recPart();
    var nrsEl = $('main input[name="nowpain"]:checked'), wEl = $('main input[name="worstpain"]:checked');
    var nrs = nrsEl ? +nrsEl.value : null, worst = wEl ? +wEl.value : null;
    var f = g && !/stroke|sci/.test(g.cond) ? { 1: 0.18, 2: 0.33, 3: 0.55 }[g.sev] || 0.33 : g ? 0.55 : nrs !== null ? Math.max(0.12, Math.min(0.7, nrs / 10 * 0.85)) : 0.3;
    var funcs = fv('function'), prov = fv('provocation'), tw = fv('time_worse');
    var job = fv('job') || (g && g.job) || '';
    /* 기록지에 체크된 아픈 부위(region)로 보조 추천 — 예: 목 환자인데 등·허리도 불편 → FRI·ODI·RMDQ (점수는 주 증상보다 가볍게) */
    var main = REL[key] || [], reg = fv('region'), sec = [];
    var addSec = function (ids) { ids.forEach(function (x) { if (main.indexOf(x) < 0 && sec.indexOf(x) < 0) sec.push(x); }); };
    if (/허리/.test(reg)) addSec(['odi', 'rmdq']);
    if (/(^|, )등($|,)/.test(reg)) addSec(['fri']);
    if (/어깨/.test(reg) && key !== 'neck') addSec(['spadi']);
    if (/무릎/.test(reg)) addSec(['lefs']);
    if (/발목/.test(reg)) addSec(['faam']);
    return {
      key: key, rel: main.concat(sec), sec: sec, f: f, nrs: nrs === null ? Math.round(f * 10) : nrs, worst: worst === null ? Math.min(10, Math.round(f * 10) + 2) : worst,
      mood: !!(g && g.extras && g.extras.indexOf('mood') >= 0), chronic: g ? g.dur === 'chronic' : /달|1년/.test(fv('onset_time')),
      sleepBad: fv('sleep') === '5시간 미만' || /밤/.test(tw) || /수면/.test(prov) || /수면/.test(funcs),
      funcs: funcs, drives: /버스|택배|운전/.test(job) || /운전/.test(funcs), desk: /대학생|사무|프로그래머|교사/.test(job), lift: /택배|건설|간호|요리|농업|운동선수|주부/.test(job)
    };
  }
  function seeded(str) { var h = 1779033703 ^ str.length; for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return function () { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  function optBad(id, it, idx, v) {
    var U = G.util || {};
    if ((id === 'sf36' || id === 'sf12') && U.rec36) {
      var n = id === 'sf36' ? idx + 1 : +Object.keys(U.sf12map).filter(function (k) { return U.sf12map[k] === idx; })[0];
      var r = U.rec36(n, v); return r === null || r === undefined ? 0.5 : 1 - r / 100;
    }
    var vals = it.o.map(function (o) { return o[0]; }), mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
    var b = (v - mn) / ((mx - mn) || 1);
    return T[id].better === 'high' ? 1 - b : b;
  }
  function simulate(id) {
    var t = T[id], pr = simProfile(), rnd = seeded((ctx.pid || '') + ':' + id), out = {};
    if (pr.sec.indexOf(id) >= 0) { pr.f = pr.f * 0.55; pr.nrs = Math.max(1, Math.round(pr.nrs * 0.6)); pr.worst = Math.max(pr.nrs + 1, Math.round(pr.worst * 0.6)); } /* 보조 부위는 가볍게 */
    var noise = function (k) { return (rnd() - 0.5) * 2 * (k || 0.08); };
    var rn = id === 'ndi' ? recordNdi() : null;
    t.items.forEach(function (it, i) {
      if (rn && rn[i] !== null && rn[i] !== undefined) { out[i] = rn[i]; return; } /* 기록지 C-14 NDI 와 같게 */
      var tx = it.t, b = pr.f;
      if (it.multi) { out[i] = id === 'iciq' ? (pr.f > 0.2 ? ['stress', 'exercise'] : ['never']) : []; return; }
      if (id === 'fabq') { b = 0.22 + (pr.mood ? 0.3 : 0) + (pr.chronic ? 0.1 : 0) + (pr.f > 0.5 ? 0.12 : 0); if (i >= 5) b += pr.lift ? 0.08 : -0.05; if (i === 7) b = 0.05; }
      else if (id === 'epds' || (id === 'dram' && i < 23)) { b = pr.mood ? 0.5 : 0.15; if (id === 'epds' && i === 9) { out[i] = 0; return; } } /* 자해 문항은 자동으로 만들지 않음 */
      else if (id === 'dram') b = pr.mood ? 0.35 : 0.1;
      else if (id === 'sf36' || id === 'sf12') { var n0 = id === 'sf36' ? i + 1 : +Object.keys(G.util.sf12map).filter(function (k) { return G.util.sf12map[k] === i; })[0]; b = (n0 >= 17 && n0 <= 19) || (n0 >= 23 && n0 <= 31) ? (pr.mood ? 0.5 : 0.2) : n0 === 2 ? 0.5 : pr.f * 0.9; }
      else {
        if (/통증 강도|평소.*통증|쉬고 있을 때|지금.*통증/.test(tx)) b = pr.nrs / 10;
        else if (/가장 심할 때|가장 심함/.test(tx)) b = pr.worst / 10;
        else if (/가장 덜 아플/.test(tx)) b = Math.max(0, pr.nrs - 2) / 10;
        if (/수면|잠|밤/.test(tx)) b += pr.sleepBad ? 0.15 : -0.12;
        if (/계단/.test(tx)) b += /계단/.test(pr.funcs) ? 0.12 : -0.05;
        if (/옷|양말|스타킹|셔츠|바지|씻|목욕|머리 감기/.test(tx)) b += /옷|샤워/.test(pr.funcs) ? 0.1 : -0.06;
        if (/걷|보행/.test(tx)) b += /걷기/.test(pr.funcs) ? 0.1 : 0;
        if (/달리|뛰|점프|착지|스포츠|운동|격렬|방향/.test(tx)) b += 0.15;
        if (/읽기|집중/.test(tx)) b += pr.desk ? 0.06 : -0.04;
        if (/두통/.test(tx)) b -= pr.key === 'neck' ? 0.05 : 0.25;
        if (/들기|나르기|무거운/.test(tx)) b += pr.lift ? 0.08 : 0;
        if (it.na && (/운전/.test(tx) && !pr.drives || /성생활/.test(tx) || /보조기/.test(tx))) { out[i] = 'na'; return; }
        if (it.yn) { out[i] = rnd() < Math.min(0.95, b * 1.15 + noise(0.05)) ? 1 : 0; return; }
      }
      b = Math.max(0, Math.min(1, b + noise()));
      var best = it.o[0][0], bd = 9; it.o.forEach(function (o) { var d = Math.abs(optBad(id, it, i, o[0]) - b); if (d < bd) { bd = d; best = o[0]; } });
      out[i] = best;
    });
    S.ans[id] = out; S.when[id] = today(); S.auto = S.auto || {}; S.auto[id] = 'auto'; save();
  }
  function simBox(id) {
    var pr = simProfile(), rel = pr.rel.indexOf(id) >= 0, st = (S.auto || {})[id];
    if (!rel) return '<div class="q-sim off"><span>🧑‍⚕️ 이 환자(' + esc(((ctx.patient || {}).gen || {}).condLabel || fv('ref_medical_dx') || '현재 환자') + ')에게 우선 쓰는 설문이 아니어서 가상 환자 응답을 만들지 않습니다. 직접 답해 볼 수 있어요.' + (pr.rel.length ? ' 추천: ' + pr.rel.map(function (x) { return T[x].short; }).join('·') : '') + '</span></div>';
    var secNote = pr.sec.indexOf(id) >= 0 ? ' <b>보조 추천</b>: 기록지에 이 부위 불편도 체크되어 있어 주 증상보다 가볍게 채웁니다.' : '';
    return '<div class="q-sim"><span>🧑‍⚕️ <b>가상 환자 응답 불러오기</b> — 기록지의 진단·통증(NRS ' + pr.nrs + ')·수면·기능 제한·직업에 맞게 이 환자가 답했을 법한 응답을 채웁니다.' + secNote + (id === 'ndi' && recordNdi() ? ' NDI는 기록지 C-14 값과 같게 넣습니다.' : '') + (st ? ' <em>' + (st === 'edited' ? '자동 응답 · 수정함' : '자동으로 채운 답') + '</em>' : '') + '</span><button type="button" class="ws-btn" data-qsim="' + id + '">' + (st ? '다시 불러오기' : '불러오기') + '</button></div>';
  }
  function renderTool(area, id) {
    var t = T[id], idx = area.tools.indexOf(id), next = area.tools[idx + 1];
    var rn = id === 'ndi' ? recordNdi() : null;
    return '<section class="q-card q-intro"><h2>' + esc(t.short) + ' · ' + esc(t.name) + '</h2><p class="q-full">' + esc(t.full) + '</p><p>' + esc(t.intro) + '</p>' + simBox(id) +
      (rn ? '<div class="q-import"><span>기록지 <b>C-14 NDI</b>에 답이 있습니다 (' + rn.filter(function (v) { return v !== null; }).length + '/10). 같은 도구이므로 그대로 불러올 수 있어요. 기록지는 바뀌지 않습니다.</span><button type="button" class="ws-btn ghost" data-qimport="ndi">기록지 값 불러오기</button></div>' : '') + '</section>' +
      '<section class="q-card q-sticky" id="qScore">' + scoreBox(id) + '</section>' +
      '<section class="q-card q-items">' + itemsHtml(id) + '</section>' +
      '<div class="q-actions"><button type="button" class="ws-btn" data-qgo="result">결과 보기</button>' + (next ? '<a class="ws-btn ghost" href="#/q/' + area.k + '/' + next + '">다음 도구 (' + esc(T[next].short) + ') ›</a>' : '<a class="ws-btn ghost" href="#/q/' + area.k + '/ex">운동 안내문 ›</a>') +
      '<button type="button" class="ws-btn ghost" data-qgo="missing">미응답 문항으로 이동</button><button type="button" class="ws-btn ghost" data-qprint="blank" data-qid="' + id + '">🖨 빈 설문지 인쇄</button><button type="button" class="ws-btn ghost warn" data-qclear="' + id + '">이 도구 응답 지우기</button></div>' +
      '<section class="q-card q-result" id="qResult">' + resultHtml(area, id) + '</section>' +
      '<p class="q-cite">출처: ' + esc(t.cite) + '</p>';
  }

  /* ---------- 결과 해석 ---------- */
  var MEAN = {
    0: '제한이 거의 없는 범위입니다. 예방·유지 운동과 자세 교육 중심으로 관리합니다.',
    1: '일부 활동에서 불편이 있지만 대부분의 일상생활을 할 수 있는 범위입니다. 운동치료와 교육 중심으로 관리합니다.',
    2: '여러 활동에서 뚜렷한 제한이 있는 범위입니다. 통증 조절과 함께 단계적인 운동·도수치료, 활동 조절이 필요합니다.',
    3: '일상생활 상당 부분이 제한되는 범위입니다. 통증 조절을 우선하고, 위험신호와 심리사회 요인을 꼭 확인합니다.',
    4: '매우 심한 범위입니다. 위험신호·의뢰 필요성을 먼저 확인하고, 다학제 접근을 고려합니다.'
  };
  function topItems(id) {
    var t = T[id], a = ans(id), out = [];
    t.items.forEach(function (it, i) {
      if (it.multi) return; var v = a[i]; if (v === undefined || v === null || v === 'na') return;
      var vals = it.o.map(function (o) { return o[0]; }), max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      var bad = t.better === 'high' ? (max - (+v)) / (max - min || 1) : ((+v) - min) / (max - min || 1);
      if (bad >= 0.6) out.push(it.t + ' (' + (it.o.filter(function (o) { return o[0] === +v; })[0] || [0, v])[1] + ')');
    });
    return out;
  }
  function resultHtml(area, id) {
    var t = T[id], s = scoreOf(id);
    if (!s) return '<p class="q-muted">▸ 문항에 답하면 여기에 결과 해석이 나타납니다.</p>';
    var full = complete(id), top = topItems(id);
    var extra = [];
    if (s.epdsHarm) extra.push('<div class="q-alert">⚠ 10번(자해 생각)에 응답했습니다. 점수와 상관없이 오늘 바로 안전을 확인하고 정신건강 전문가에게 연결하세요.</div>');
    if (s.iciqType) extra.push('<p><b>유형:</b> ' + esc(s.iciqType) + '</p>');
    if (id === 'fabq') extra.push('<p>공포회피신념이 높으면 통증이 오래갈 위험이 커집니다. 통증 신경과학 교육, 점진적 노출(두려워하는 동작을 조금씩), 활동 유지를 함께 계획하세요.</p>');
    var red = G.RED[area.k] || [];
    return '<h3>결과 해석' + (full ? '' : ' <small>(모든 문항에 답하면 확정)</small>') + '</h3>' +
      '<p class="q-big">' + esc(t.short) + ' ' + esc(s.main) + ' ' + esc(s.unit) + ' — <b>' + esc(s.label) + '</b></p>' + extra.join('') +
      '<h4>점수의 의미</h4><p>' + esc(MEAN[s.level] || '') + '</p>' +
      '<h4>제한이 큰 항목</h4>' + (top.length ? '<ul>' + top.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p>두드러지게 제한이 큰 항목이 없습니다.</p>') +
      '<h4>추적 평가</h4><p>4주 뒤 같은 설문으로 다시 평가합니다. 임상적으로 의미 있는 변화: ' + esc(t.mcid) + '.</p>' +
      '<div class="q-red"><b>위험신호 확인:</b> ' + esc(red.slice(0, 5).join(' · ')) + ' — 하나라도 있으면 물리치료 전에 의뢰를 고려합니다. <a href="#/q/' + area.k + '/cdm">임상의사결정에서 확인 ›</a></div>' +
      '<div class="q-next"><a class="ws-btn" href="#/q/' + area.k + '/ex">이 결과에 맞는 운동 안내문 보기 ›</a></div>';
  }

  /* ---------- 운동 안내문 ---------- */
  function partLevel(part) {
    var tools = (G.PART_TOOLS[part] || []).filter(function (id) { return progress(id).n; });
    if (S.lv[part]) return { k: S.lv[part], auto: false, from: '직접 고름' };
    if (!tools.length) return { k: 'mod', auto: true, from: '설문 결과 없음 — 보통 단계로 시작' };
    var s = scoreOf(tools[0]);
    return { k: lvKey(s ? s.level : 2), auto: true, from: T[tools[0]].short + ' ' + (s ? s.main + ' ' + s.unit + ' · ' + s.label : '') };
  }
  function curPart(area) {
    if (S.part[area.k]) return S.part[area.k];
    var rp = recPart(); if (rp && area.parts.some(function (p) { return p[0] === rp; })) return rp;
    var withData = area.parts.filter(function (p) { return (G.PART_TOOLS[p[0]] || []).some(function (id) { return progress(id).n; }); })[0];
    return (withData || area.parts[0])[0];
  }
  function exList(part, lk) {
    var setKey = part === 'lumbar' && dxResult('lumbar').some(function (r) { return r.k === 'dir' && r.n; }) ? 'lumbar_ext' : part;
    var idx = lk === 'high' ? 0 : lk === 'mod' ? 1 : 2;
    return (G.SETS[setKey] || G.SETS.neck)[idx];
  }
  function exCard(id, i) {
    var e = G.EX[id]; if (!e) return '';
    return '<article class="q-ex"><div class="q-exfig">' + G.svgPose(e[4], e[5]) + '</div><div class="q-exbody"><h5><span>' + (i + 1) + '</span>' + esc(e[0]) + '</h5><small>목적: ' + esc(e[1]) + '</small><p>' + esc(e[2]) + '</p><em>' + esc(e[3]) + '</em></div></article>';
  }
  function renderEx(area) {
    var part = curPart(area), lv = partLevel(part), g = G.GUIDE[lv.k];
    var partName = (area.parts.filter(function (p) { return p[0] === part; })[0] || ['', ''])[1];
    var chips = area.parts.map(function (p) { return '<button type="button" class="q-chip' + (p[0] === part ? ' on' : '') + '" data-qpart="' + p[0] + '">' + esc(p[1]) + '</button>'; }).join('');
    var lchips = [['high', '자극성 높음'], ['mod', '보통'], ['low', '낮음']].map(function (x) { return '<button type="button" class="q-chip' + (x[0] === lv.k ? ' on' : '') + '" data-qlv="' + x[0] + '" data-qp="' + part + '">' + x[1] + '</button>'; }).join('') + (S.lv[part] ? '<button type="button" class="q-chip ghost" data-qlv="auto" data-qp="' + part + '">자동으로</button>' : '');
    var list = exList(part, lv.k);
    return '<section class="q-card"><h2>운동 안내문 · ' + esc(partName) + '</h2>' +
      '<div class="q-row"><span class="q-lab">부위</span>' + chips + '</div>' +
      '<div class="q-row"><span class="q-lab">강도</span>' + lchips + '<small class="q-from">' + esc(lv.from) + '</small></div>' +
      '<h3>' + esc(g.t) + '</h3><ul class="q-guide">' + g.list.concat(G.TIPS[part] || []).concat(G.COMMON).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h3>운동 방법</h3><div class="q-exgrid">' + list.map(exCard).join('') + '</div>' +
      '<div class="q-actions"><button type="button" class="ws-btn" data-qprint="handout" data-qpart="' + part + '">🖨 환자용 운동 안내문 인쇄</button></div>' +
      '<p class="q-muted">운동 처방은 설문 결과에 따른 일반 예시입니다. 신체 검사 결과에 맞춰 조정하세요.</p></section>';
  }

  /* ---------- 임상의사결정 ---------- */
  function autoFinds(part) {
    var a = {}; /* 'k:i' → 이유 */
    /* 기록지 특수검사에서 양성인 검사 → 해당 소견 자동 체크 (기록지는 읽기만) */
    var pos = recordSpecPos(), addIf = function (tests, k) { tests.some(function (tn) { if (pos[tn]) { a[k] = '기록지 특수검사 ' + tn + ' 양성'; return true; } return false; }); };
    if (part === 'neck') { addIf(['Flexion-Rotation Test'], 'ha:1'); addIf(['Spurling test'], 'rad:1'); }
    if (part === 'shoulder') { addIf(['Neer', 'Hawkins-Kennedy'], 'sais:0'); addIf(['Empty Can / Jobe'], 'sais:1'); addIf(['Apprehension / Relocation'], 'ins:0'); }
    if (part === 'lumbar') addIf(['Straight Leg Raise', 'Slump'], 'trac:0');
    if (part === 'knee') { addIf(['McMurray'], 'men:1'); addIf(['Lachman'], 'acl:1'); }
    if (part === 'ankle') addIf(['Anterior drawer#2'], 'spr:1');
    if (part === 'wrist') addIf(['Phalen', 'Tinel'], 'cts:1');
    if (part === 'hip') addIf(['FADIR'], 'fai:0');
    /* 기록지 병력에서 읽는 소견 */
    var age = num('age'), dx = fv('ref_medical_dx');
    if (part === 'knee' && /무릎/.test(dx)) {
      if (age !== null && age >= 50 && /뻣뻣/.test(fv('time_detail'))) a['oa:0'] = '기록지 ' + age + '세 · 아침 뻣뻣함';
      if (/마찰음/.test(fv('quality_detail'))) a['oa:1'] = '기록지 마찰음';
    }
    if (part === 'ankle' && /발목/.test(dx) && /운동 중|넘어진/.test(fv('onset_context')) && /발목/.test(fv('region'))) a['spr:0'] = '기록지 발병 계기·부위';
    /* 다른 부위 자료만으로 판정하지 않도록: 그 부위 설문을 했거나(또는 이 환자의 부위일 때)만 자동 소견을 씀 */
    if (part === 'neck' && !(recPart() === 'neck' || progress('ndi').n)) return a;
    if (part === 'lumbar' && !(progress('odi').n || progress('rmdq').n)) return a;
    if (part === 'neck') {
      var cva = num('cva_mean'), dnf = num('dnf_endurance'), oc = fv('onset_context');
      if (cva !== null && cva < 50) a['fhp:0'] = '기록지 CVA ' + cva + '°';
      if (dnf !== null && dnf < 30) { a['fhp:1'] = '기록지 DNF 지구력 ' + dnf + '초'; a['mci:1'] = '기록지 DNF 지구력 ' + dnf + '초'; }
      if (/교통사고|외상/.test(oc)) a['mci:0'] = '기록지 발병 계기: ' + oc;
    }
    if (part === 'lumbar') { var f = scoreOf('fabq'); if (f && f.fabqW !== null && f.fabqW !== undefined && f.fabqW < 19) a['manip:1'] = 'FABQ 일 척도 ' + f.fabqW; }
    if (part === 'bladder') { var w = ans('iciq')[3] || []; if (w.indexOf('stress') >= 0 || w.indexOf('exercise') >= 0) a['sui:0'] = 'ICIQ 4번 응답'; if (w.indexOf('urge') >= 0) a['uui:1'] = 'ICIQ 4번 응답'; }
    if (part === 'mood') { var e = scoreOf('epds'); if (e && +e.main >= 13) a['ppd:0'] = 'EPDS ' + e.main + '점'; if (e && e.epdsHarm) a['harm:0'] = 'EPDS 10번 응답'; }
    return a;
  }
  function dxResult(part) {
    var D = G.DX[part]; if (!D) return [];
    var au = autoFinds(part), m = S.find[part] || {};
    return D.list.map(function (c) {
      var n = 0; c.f.forEach(function (f, i) { if (m[c.k + ':' + i] || au[c.k + ':' + i]) n++; });
      return { k: c.k, t: c.t, n: n, of: c.f.length, ref: !!c.ref, tx: c.tx, strong: n >= c.f.length };
    });
  }
  /* 여러 부위가 같이 쓰는 설문(LEFS·QuickDASH)만으로는 그 부위를 판정하지 않음 — 그 부위 전용 설문·소견이 있거나 이 환자의 부위일 때만 */
  var SHARED = ['lefs', 'qdash'];
  function partHasData(part) { return (G.PART_TOOLS[part] || []).some(function (id) { return SHARED.indexOf(id) < 0 && progress(id).n; }) || recPart() === part || Object.keys(S.find[part] || {}).some(function (k) { return S.find[part][k]; }) || Object.keys(autoFinds(part)).length > 0; }
  function renderCdm(area) {
    var rf = recordRedFlags(), man = S.red[area.k] || {};
    var redList = G.RED[area.k] || [];
    var manYes = redList.filter(function (x, i) { return man['r' + i]; });
    /* 기록지 A-4 레드플래그를 모두 답했고 '예'가 없으면 선별한 것으로 봄 (직접 체크한 항목이 있으면 그쪽이 우선) */
    var recClear = rf.total > 0 && rf.answered === rf.total && !rf.yes.length;
    var cleared = !!man.clear || (recClear && !manYes.length);
    var left = '<section class="q-card q-cl"><h3>① 위험신호(red flag)</h3>' +
      '<div class="q-auto">기록지 A-4 레드플래그: ' + (rf.total ? '응답 ' + rf.answered + '/' + rf.total + ' · "예" ' + rf.yes.length + '개' + (rf.unknown.length ? ' · "잘 모르겠음" ' + rf.unknown.length + '개' : '') : '문항 없음') + (rf.yes.length ? '<ul>' + rf.yes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
      redList.map(function (x, i) { return '<label class="q-check"><input type="checkbox" data-qred="' + area.k + '" data-qr="r' + i + '"' + (man['r' + i] ? ' checked' : '') + '><span>' + esc(x) + '</span></label>'; }).join('') +
      '<label class="q-check clear"><input type="checkbox" data-qred="' + area.k + '" data-qr="clear"' + (cleared ? ' checked' : '') + '><span>위험신호 선별 시행 — 해당 항목 없음 확인</span></label></section>';
    area.parts.forEach(function (p, pi) {
      var D = G.DX[p[0]]; if (!D) return;
      var au = autoFinds(p[0]), m = S.find[p[0]] || {};
      left += '<section class="q-card q-cl"><h3>' + (pi + 2 > 9 ? '' : ['', '', '②', '③', '④', '⑤', '⑥'][pi + 2] || '') + ' ' + esc(p[1]) + ' 검사 소견</h3><p class="q-muted">소견마다 해당 질환 의심으로 분류됩니다(질환별 소견을 모두 체크하면 가능성 높음).</p>' +
        D.list.map(function (c) {
          return '<div class="q-dxgrp' + (c.ref ? ' ref' : '') + '"><b>' + esc(c.t) + (c.ref ? ' <em>의뢰 대상</em>' : '') + '</b>' + c.f.map(function (f, i) {
            var k = c.k + ':' + i, auto = au[k];
            return '<label class="q-check' + (auto ? ' auto' : '') + '"><input type="checkbox" data-qfind="' + p[0] + '" data-qk="' + k + '"' + (m[k] || auto ? ' checked' : '') + (auto ? ' disabled' : '') + '><span>' + esc(f) + (auto ? ' <i>자동 · ' + esc(auto) + '</i>' : '') + '</span></label>';
          }).join('') + '</div>';
        }).join('') + '</section>';
    });

    /* 오른쪽 흐름 */
    var redPos = rf.yes.length + manYes.length > 0;
    var steps = [];
    steps.push(step(1, '위험신호(red flag)가 있는가?', redPos ? '있음' : cleared ? '없음' : '미확인', redPos ? 'bad' : cleared ? 'ok' : 'wait',
      redPos ? '<ul>' + rf.yes.concat(manYes).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p><b>→ 물리치료 전에 의뢰를 우선 고려합니다.</b></p>' : cleared ? '<p>위험신호가 없어 물리치료를 진행합니다.</p>' : '<p>왼쪽 체크리스트를 확인하고, 없으면 "해당 항목 없음 확인"에 체크하세요. 확인 전에는 아래 결정을 잠정적인 것으로 봅니다.</p>'));
    var yf = yellow(area);
    steps.push(step(2, '심리사회 위험요인(yellow flag)이 있는가?', yf.label, yf.cls, yf.html));
    area.parts.forEach(function (p, pi) {
      var D = G.DX[p[0]]; if (!D) return;
      var r = dxResult(p[0]), hit = r.filter(function (x) { return x.n; }).sort(function (a, b) { return (b.ref - a.ref) || (b.n / b.of - a.n / a.of); });
      var tools = (G.PART_TOOLS[p[0]] || []).filter(function (id) { return progress(id).n; }), sc = tools.length ? scoreOf(tools[0]) : null;
      var body = '', label = '자료 없음', cls = 'wait';
      if (hit.length) {
        label = hit[0].t; cls = hit.some(function (x) { return x.ref; }) ? 'bad' : 'ok';
        body = hit.map(function (x) { return '<div class="q-dxr' + (x.ref ? ' ref' : '') + '"><b>' + esc(x.t) + '</b> <span>' + (x.strong ? '가능성 높음' : '의심') + ' (' + x.n + '/' + x.of + ')</span><p>→ ' + esc(x.tx) + '</p></div>'; }).join('');
      } else if (sc && D.def && partHasData(p[0])) {
        var d = D.list.filter(function (c) { return c.k === D.def; })[0];
        label = d.t + ' (기본 분류)'; cls = 'ok';
        body = '<p>체크한 검사 소견이 없어 기본 분류를 적용했습니다.</p><div class="q-dxr"><b>' + esc(d.t) + '</b><p>→ ' + esc(d.tx) + '</p></div>';
      } else body = '<p>' + esc(p[1]) + ' 설문(' + (G.PART_TOOLS[p[0]] || []).map(function (id) { return T[id].short; }).join('·') + ')을 하거나 왼쪽 검사 소견을 체크하면 판정됩니다.</p>';
      if (sc) body = '<p class="q-sc">' + esc(T[tools[0]].short) + ' ' + esc(sc.main) + ' ' + esc(sc.unit) + ' — ' + esc(sc.label) + ' · 강도: ' + esc(G.GUIDE[lvKey(sc.level)].t.split(' — ')[0]) + '</p>' + body;
      steps.push(step(3 + pi, esc(D.t), label, cls, body));
    });
    var done = area.tools.filter(function (id) { return progress(id).n; });
    steps.push(step(3 + area.parts.length, '재평가 계획', '4주 후 재평가', 'ok', '<ul>' + (done.length ? done.map(function (id) { return '<li>' + esc(T[id].short) + ': 의미 있는 변화 ' + esc(T[id].mcid) + '</li>'; }).join('') : '<li>설문을 하면 도구별 의미 있는 변화 기준이 나타납니다.</li>') + '<li>4~6주 안에 의미 있는 호전이 없으면 분류를 다시 하거나 의뢰를 고려합니다.</li><li>증상이 바뀌면(새 신경 증상 등) 위험신호 선별부터 다시 합니다.</li></ul>'));

    var final = finalDecision(area, redPos, cleared, yf);
    return '<section class="q-card q-cdmhead"><h2>임상의사결정 · ' + esc(area.t) + '</h2><p>위험신호 선별 → 심리사회 요인 → 부위별 분류(질환 감별) → 재평가 순서로 치료 방향을 정합니다. 왼쪽에서 소견을 체크하면 오른쪽 흐름이 설문 결과와 함께 바로 다시 판정됩니다. <b>자동</b> 표시는 기록지·설문에서 읽어 온 소견입니다(기록지는 바뀌지 않음).</p></section>' +
      '<div class="q-cdm"><div class="q-cdml">' + left + '</div><div class="q-cdmr"><div class="q-flow">' + steps.join('<div class="q-arrow">↓</div>') + '</div>' + final + '</div></div>' +
      '<div class="q-actions"><button type="button" class="ws-btn" data-qprint="report">🖨 결과 보고서 인쇄(알고리즘 포함)</button><button type="button" class="ws-btn ghost warn" data-qclearfind="' + area.k + '">검사 소견 체크 모두 지우기</button></div>' +
      '<p class="q-muted">이 흐름은 설문 결과와 입력한 검사 소견을 바탕으로 한 임상 추론 보조 도구입니다. 최종 판단은 치료사의 종합적인 평가를 따릅니다.</p>';
  }
  function step(n, q, label, cls, body) { return '<div class="q-step ' + cls + '"><div class="q-sh"><span>' + n + '</span><b>◆ ' + q + '</b><em>' + esc(label) + '</em></div><div class="q-sb">' + body + '</div></div>'; }
  function yellow(area) {
    var parts = [], high = false, any = false;
    var f = scoreOf('fabq'); if (f && (f.fabqPA !== null || f.fabqW !== null)) { any = true; if (f.level >= 3) high = true; parts.push('FABQ 신체 ' + (f.fabqPA === null ? '–' : f.fabqPA) + ' · 일 ' + (f.fabqW === null ? '–' : f.fabqW) + ' → ' + f.label); }
    if (area.k === 'perinatal') {
      var e = scoreOf('epds'); if (e) { any = true; if (e.level >= 3) high = true; parts.push('EPDS ' + e.main + ' → ' + e.label + (e.epdsHarm ? ' (10번 응답 — 즉시 확인)' : '')); }
      var d = scoreOf('dram'); if (d) { any = true; if (d.level >= 3) high = true; parts.push('DRAM → ' + d.label); }
    }
    if (!any) return { label: '자료 없음', cls: 'wait', html: '<p>' + (area.k === 'perinatal' ? 'EPDS·DRAM' : 'FABQ(목·등·허리 탭)') + '를 하면 판정됩니다. 만성(12주 이상)이거나 회복이 더디면 시행을 권합니다.</p>' };
    return { label: high ? '있음' : '뚜렷하지 않음', cls: high ? 'bad' : 'ok', html: '<ul>' + parts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + (high ? '<p><b>→ 통증 신경과학 교육, 점진적 노출, 필요하면 심리 전문가 연계를 함께 계획합니다.</b></p>' : '') };
  }
  function finalDecision(area, redPos, cleared, yf) {
    var rows = [], refs = [];
    area.parts.forEach(function (p) {
      if (!G.DX[p[0]] || !partHasData(p[0])) return;
      var r = dxResult(p[0]).filter(function (x) { return x.n; });
      var tools = (G.PART_TOOLS[p[0]] || []).filter(function (id) { return progress(id).n; }), sc = tools.length ? scoreOf(tools[0]) : null;
      var D = G.DX[p[0]];
      var main = r.length ? r.map(function (x) { return x.t + '(' + (x.strong ? '가능성 높음' : '의심') + ')'; }).join(', ') : (sc && D.def ? D.list.filter(function (c) { return c.k === D.def; })[0].t + '(기본)' : '체크한 소견 없음');
      r.forEach(function (x) { if (x.ref) refs.push(x.t); });
      var dec = r.length ? r[0].tx : sc && D.def ? D.list.filter(function (c) { return c.k === D.def; })[0].tx : '경과 관찰';
      rows.push('<tr><td>' + esc(p[1]) + '</td><td>' + esc(main) + '</td><td>' + (sc ? esc(T[tools[0]].short + ' ' + sc.main + ' ' + sc.unit + ' — ' + sc.label) : '–') + '</td><td>' + esc(dec) + '</td></tr>');
    });
    var head = redPos ? '위험신호 있음 — 의뢰 우선' : refs.length ? '의뢰 대상 의심: ' + refs.join(', ') : rows.length ? '물리치료 진행' + (yf.cls === 'bad' ? ' + 심리사회 요인 관리' : '') : '설문 또는 검사 소견을 입력하세요';
    return '<section class="q-card q-final ' + (redPos || refs.length ? 'bad' : 'ok') + '"><h3>최종 임상의사결정 — 검사 소견 + 설문 결과 통합</h3><p class="q-big">' + esc(head) + '</p>' +
      (rows.length ? '<div class="q-tablewrap"><table class="q-table"><thead><tr><th>영역</th><th>검사 소견(의심 질환)</th><th>설문 결과</th><th>치료 방향</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '') +
      (!cleared && !redPos ? '<p class="q-warn">위험신호 선별 미확인 — 확인 후 결정을 확정하세요.</p>' : '') +
      '<p>4주 후 같은 설문으로 재평가합니다.</p></section>';
  }

  /* ---------- 결과 요약 ---------- */
  function summaryRows(area) {
    return area.tools.map(function (id) { var s = scoreOf(id), pr = progress(id); return { id: id, t: T[id], s: s, pr: pr, when: S.when[id] }; });
  }
  function summaryText(area) {
    var p = ctx.patient || {};
    var lines = ['[설문 결과 요약] ' + area.t, '환자: ' + (p.name || '') + ' · 평가일 ' + today()];
    summaryRows(area).forEach(function (r) { lines.push('- ' + r.t.short + ' (' + r.t.name + '): ' + (r.s ? r.s.main + ' ' + r.s.unit + ' — ' + r.s.label + (complete(r.id) ? '' : ' (응답 ' + r.pr.n + '/' + r.pr.of + ')') : '미시행')); });
    return lines.join('\n');
  }
  function renderSum(area) {
    var rows = summaryRows(area).map(function (r) {
      return '<tr><td><a href="#/q/' + area.k + '/' + r.id + '"><b>' + esc(r.t.short) + '</b></a><br><small>' + esc(r.t.name) + '</small></td><td>' + (r.s ? '<b>' + esc(r.s.main) + '</b> ' + esc(r.s.unit) : '–') + '</td><td>' + (r.s ? '<span class="q-badge lv' + r.s.level + '">' + esc(r.s.label) + '</span>' : '미시행') + '</td><td>' + r.pr.n + ' / ' + r.pr.of + '</td><td>' + esc(r.when || '') + '</td></tr>';
    }).join('');
    return '<section class="q-card"><h2>결과 요약 · ' + esc(area.t) + '</h2><div class="q-tablewrap"><table class="q-table"><thead><tr><th>도구</th><th>점수</th><th>판정</th><th>응답</th><th>마지막 응답</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="q-actions">' + (simProfile().rel.some(function (x) { return area.tools.indexOf(x) >= 0; }) ? '<button type="button" class="ws-btn" data-qsimall="1">🧑‍⚕️ 추천 설문 모두 가상 환자 응답으로 채우기</button>' : '') + '<button type="button" class="ws-btn ghost" data-qcopy="' + area.k + '">텍스트 복사</button><button type="button" class="ws-btn ghost" data-qprint="report">🖨 결과 보고서 인쇄</button></div><pre class="q-pre" id="qSumText">' + esc(summaryText(area)) + '</pre></section>';
  }

  /* ---------- 인쇄 ---------- */
  function printDoc(title, body) {
    var w = window.open('', '_blank'); if (!w) { alert('팝업이 막혀 인쇄 창을 열지 못했습니다. 팝업 허용 후 다시 눌러 주세요.'); return; }
    var p = ctx.patient || {};
    w.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
      'body{font-family:"Pretendard Variable","Malgun Gothic",sans-serif;color:#222;margin:24px;font-size:13px;line-height:1.55}h1{font-size:20px;margin:0 0 4px;color:#27417f}h2{font-size:16px;margin:18px 0 6px;color:#27417f;border-bottom:2px solid #27417f;padding-bottom:3px}h3{font-size:14px;margin:12px 0 4px}' +
      '.meta{color:#555;font-size:12px;margin-bottom:12px}.q{margin:8px 0;page-break-inside:avoid}.q b{display:block}.o{display:inline-block;margin:2px 10px 2px 0}.ex{display:flex;gap:12px;border:1px solid #ccc;border-radius:8px;padding:8px;margin:8px 0;page-break-inside:avoid}.ex svg{width:150px;flex:none}' +
      'table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}th{background:#eef2fa}.foot{margin-top:18px;color:#777;font-size:11px}</style></head><body>' +
      '<h1>' + esc(title) + '</h1><div class="meta">청암대학교 물리치료과 · 꼬북이 물리치료 평가 기록지 · 환자 ' + esc(p.name || '') + ' · ' + today() + '</div>' + body +
      '<div class="foot">교육용 도구 · 설문 문항은 원 논문을 바탕으로 쓴 교육용 번역입니다.</div><script>setTimeout(function(){print()},300)<\/script></body></html>');
    w.document.close();
  }
  function printBlank(id) {
    var t = T[id], body = '<p>' + esc(t.intro) + '</p>';
    t.items.forEach(function (it, i) {
      if (t.groups) t.groups.forEach(function (g) { if (g.from === i) body += '<h3>' + esc(g.t) + '</h3>'; });
      body += '<div class="q"><b>' + (i + 1) + '. ' + esc(it.t) + '</b>' + it.o.map(function (o) { return '<span class="o">☐ ' + esc(o[1]) + '</span>'; }).join('') + (it.na ? '<span class="o">☐ 해당 없음</span>' : '') + '</div>';
    });
    printDoc(t.short + ' · ' + t.name + ' (빈 설문지)', body + '<p class="foot">출처: ' + esc(t.cite) + '</p>');
  }
  function printHandout(area, part) {
    var lv = partLevel(part), g = G.GUIDE[lv.k], list = exList(part, lv.k);
    var partName = (area.parts.filter(function (p) { return p[0] === part; })[0] || ['', ''])[1];
    var body = '<h2>' + esc(g.t) + '</h2><ul>' + g.list.concat(G.TIPS[part] || []).concat(G.COMMON).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><h2>운동 방법</h2>' +
      list.map(function (id, i) { var e = G.EX[id]; return '<div class="ex">' + G.svgPose(e[4], e[5]) + '<div><b>' + (i + 1) + '. ' + esc(e[0]) + '</b><br><small>목적: ' + esc(e[1]) + '</small><p>' + esc(e[2]) + '</p><b>' + esc(e[3]) + '</b></div></div>'; }).join('');
    printDoc('환자용 운동 안내문 · ' + partName, body);
  }
  function printReport(area) {
    var body = '<h2>설문 결과</h2><table><tr><th>도구</th><th>점수</th><th>판정</th><th>응답</th></tr>' + summaryRows(area).map(function (r) { return '<tr><td>' + esc(r.t.short + ' ' + r.t.name) + '</td><td>' + (r.s ? esc(r.s.main + ' ' + r.s.unit) : '–') + '</td><td>' + (r.s ? esc(r.s.label) : '미시행') + '</td><td>' + r.pr.n + '/' + r.pr.of + '</td></tr>'; }).join('') + '</table>';
    var tmp = document.createElement('div'); tmp.innerHTML = renderCdm(area);
    var flow = tmp.querySelector('.q-flow'), fin = tmp.querySelector('.q-final');
    body += '<h2>임상의사결정 흐름</h2>' + (flow ? flow.innerHTML.replace(/<div class="q-arrow">↓<\/div>/g, '<div>↓</div>') : '') + (fin ? fin.innerHTML : '');
    printDoc('설문 결과 보고서 · ' + area.t, body);
  }

  /* ---------- 그리기 ---------- */
  var route = { area: null, tab: null };
  function render(shell, args, c) {
    ctx = c; ctx.shell = shell; S = load();
    var area = AREAS.filter(function (a) { return a.k === args[0]; })[0] || null;
    var html;
    if (!area) { route = { area: null, tab: null }; html = renderHub(); }
    else {
      var tab = args[1] || area.tools[0];
      if (['ex', 'cdm', 'sum'].indexOf(tab) < 0 && area.tools.indexOf(tab) < 0) tab = area.tools[0];
      route = { area: area, tab: tab };
      var body = tab === 'ex' ? renderEx(area) : tab === 'cdm' ? renderCdm(area) : tab === 'sum' ? renderSum(area) : renderTool(area, tab);
      html = shellTop(area, tab) + tabsRow(area, tab) + '<div class="q-body">' + body + '</div>' + disclaimer();
    }
    shell.innerHTML = c.ui.util() + '<div class="ws-page ws-quest-page">' + html + '</div>' + c.ui.foot();
    var on = shell.querySelector('.q-tab.on'); if (on && on.scrollIntoView) { var nav = on.parentElement; nav.scrollLeft = on.offsetLeft - 20; }
    bind(shell);
  }
  function rerenderBody() { if (ctx && ctx.shell) { var y = ctx.shell.scrollTop; render(ctx.shell, route.area ? [route.area.k, route.tab] : [], ctx); ctx.shell.scrollTop = y; } }
  function refreshTool(id, i) {
    var sh = ctx.shell, it = T[id].items[i], box = sh.querySelector('#qi-' + id + '-' + i);
    if (box) { var tmp = document.createElement('div'); tmp.innerHTML = itemHtml(id, it, i); box.replaceWith(tmp.firstChild); }
    var sc = sh.querySelector('#qScore'); if (sc) sc.innerHTML = scoreBox(id);
    var rs = sh.querySelector('#qResult'); if (rs) rs.innerHTML = resultHtml(route.area, id);
    var tab = sh.querySelector('.q-tab.on i'); if (tab) { var pr = progress(id); tab.textContent = pr.n + '/' + pr.of; tab.className = complete(id) ? 'ok' : pr.n ? 'part' : ''; }
  }
  var bound = null;
  function bind(shell) {
    if (bound === shell) return; bound = shell;
    shell.addEventListener('click', function (e) {
      if (!route) return;
      var b = e.target.closest('[data-qa]');
      if (b) {
        var id = b.getAttribute('data-qa'), i = +b.getAttribute('data-qi'), a = ans(id);
        if (b.hasAttribute('data-qm')) { var m = b.getAttribute('data-qm'), arr = Array.isArray(a[i]) ? a[i].slice() : []; var k = arr.indexOf(m); if (k >= 0) arr.splice(k, 1); else arr.push(m); a[i] = arr; }
        else { var v = b.getAttribute('data-qv'); a[i] = v === 'na' ? 'na' : +v; }
        S.when[id] = today(); if (S.auto && S.auto[id]) S.auto[id] = 'edited'; save(); refreshTool(id, i);
        if (!b.hasAttribute('data-qm')) { var nx = shell.querySelector('#qi-' + id + '-' + (i + 1)); if (nx && !nx.classList.contains('done')) { var r = nx.getBoundingClientRect(); if (r.top > window.innerHeight * 0.75) shell.scrollBy({ top: r.top - window.innerHeight * 0.35, behavior: 'smooth' }); } }
        return;
      }
      var g = e.target.closest('[data-qgo]');
      if (g) {
        var tgt = g.getAttribute('data-qgo') === 'result' ? shell.querySelector('#qResult') : shell.querySelector('.q-item:not(.done)');
        if (tgt) shell.scrollTo({ top: tgt.getBoundingClientRect().top - shell.getBoundingClientRect().top + shell.scrollTop - 80, behavior: 'smooth' });
        else if (g.getAttribute('data-qgo') === 'missing') ctx.ui.toast('모든 문항에 답했습니다.');
        return;
      }
      var cl = e.target.closest('[data-qclear]');
      if (cl) { var cid = cl.getAttribute('data-qclear'); if (confirm(T[cid].short + ' 응답을 모두 지울까요?')) { S.ans[cid] = {}; delete S.when[cid]; if (S.auto) delete S.auto[cid]; save(); rerenderBody(); } return; }
      var sm = e.target.closest('[data-qsim]');
      if (sm) { var sid = sm.getAttribute('data-qsim'); if (progress(sid).n && !(S.auto && S.auto[sid] === 'auto') && !confirm('지금 응답을 가상 환자 응답으로 바꿀까요?')) return; simulate(sid); rerenderBody(); ctx.ui.toast(T[sid].short + ' — 가상 환자 응답을 불러왔습니다.'); return; }
      var sa = e.target.closest('[data-qsimall]');
      if (sa) { var rel = simProfile().rel.filter(function (x) { return route.area.tools.indexOf(x) >= 0; }); var fill = rel.filter(function (x) { return !progress(x).n; }); fill.forEach(simulate); rerenderBody(); ctx.ui.toast(fill.length ? fill.map(function (x) { return T[x].short; }).join('·') + ' 응답을 불러왔습니다.' : '불러올 빈 추천 설문이 없습니다.'); return; }
      var im = e.target.closest('[data-qimport]');
      if (im) { var vals = recordNdi(); if (vals) { var na = ans('ndi'); vals.forEach(function (v, k) { if (v !== null) na[k] = v; }); S.when.ndi = today(); save(); rerenderBody(); ctx.ui.toast('기록지 C-14 NDI 값을 불러왔습니다.'); } return; }
      var pp = e.target.closest('[data-qpart]:not([data-qprint])'); if (pp) { S.part[route.area.k] = pp.getAttribute('data-qpart'); save(); rerenderBody(); return; }
      var lv = e.target.closest('[data-qlv]'); if (lv) { var pk = lv.getAttribute('data-qp'), lk = lv.getAttribute('data-qlv'); if (lk === 'auto') delete S.lv[pk]; else S.lv[pk] = lk; save(); rerenderBody(); return; }
      var cf = e.target.closest('[data-qclearfind]'); if (cf) { if (confirm('이 부위의 검사 소견·위험신호 체크를 모두 지울까요?')) { route.area.parts.forEach(function (p) { delete S.find[p[0]]; }); delete S.red[route.area.k]; save(); rerenderBody(); } return; }
      var cp = e.target.closest('[data-qcopy]'); if (cp) { var txt = summaryText(route.area); try { navigator.clipboard.writeText(txt).then(function () { ctx.ui.toast('결과 요약을 복사했습니다.'); }); } catch (x) { ctx.ui.toast('복사하지 못했습니다. 아래 글을 직접 복사하세요.'); } return; }
      var pr = e.target.closest('[data-qprint]');
      if (pr) { var k2 = pr.getAttribute('data-qprint'); if (k2 === 'blank') printBlank(pr.getAttribute('data-qid')); else if (k2 === 'handout') printHandout(route.area, pr.getAttribute('data-qpart')); else printReport(route.area); return; }
    });
    shell.addEventListener('change', function (e) {
      var f = e.target.closest('[data-qfind]'); if (f) { var p = f.getAttribute('data-qfind'); S.find[p] = S.find[p] || {}; S.find[p][f.getAttribute('data-qk')] = f.checked; save(); rerenderBody(); return; }
      var r = e.target.closest('[data-qred]'); if (r) { var a = r.getAttribute('data-qred'); S.red[a] = S.red[a] || {}; S.red[a][r.getAttribute('data-qr')] = r.checked; save(); rerenderBody(); }
    });
  }

  /* 목차 '8. 설문도구' 칸에 넣을 세부 항목 */
  function tocGroups(c) {
    ctx = c; S = load(); var rA = recArea();
    return AREAS.map(function (a) {
      return { k: a.k, t: a.icon + ' ' + a.t + (a.k === rA ? ' · 이 환자 추천' : ''), pick: a.k === rA, items: a.tools.map(function (id) { return { href: '#/q/' + a.k + '/' + id, label: T[id].short + ' · ' + T[id].name, done: complete(id) }; }).concat([{ href: '#/q/' + a.k + '/ex', label: '🏃 운동 안내문' }, { href: '#/q/' + a.k + '/cdm', label: '🧭 임상의사결정' }, { href: '#/q/' + a.k + '/sum', label: '📋 결과 요약' }]) };
    });
  }
  G.render = render; G.tocGroups = tocGroups;
  G.removePatient = function (pid) { try { localStorage.removeItem('ggobugi_web_q_' + pid); } catch (e) { } };
})();
