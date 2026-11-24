/* 꼬북이 웹 껍데기 (shell)
   - 기록지(index.html 본문) 내용은 하나도 바꾸지 않고, 그 위에 화면 3개를 얹는다:
     ① 환자 선택  ② 목차(1 검진 ~ 7 결과)  ③ 영역 보기(선택한 단계만 보여 줌)
   - 단계 숨기기는 display:none 대신 '화면 밖으로 빼기'(+inert)로 한다 → 기존 스크립트가 글자를 읽는 데 지장 없음
   - 환자마다 기록 전체를 기존 JSON 백업 형식(ptBackupData / ptRestoreText)으로 localStorage 에 따로 보관 */
(function () {
  'use strict';
  if (window.__ggobugiShell) return; window.__ggobugiShell = true;

  var LS_P = 'ggobugi_web_patients', LS_SNAP = 'ggobugi_web_snap_', SS_CUR = 'ggobugi_web_cur';
  var BASE_ID = 'kms';
  var STAGE_IDS = ['historyStart', 'evaluationStage', 'diagnosisStage', 'treatmentPlanStage', 'interventionStage', 'ixStage', 'oxStage'];
  /* 이 파일은 <head> 에서 바로 실행된다 → 기록지(2MB)를 그리기 전에 첫 화면부터 띄움.
     기록지가 필요한 부분(main, 단계 이름표 등)은 문서를 다 읽은 뒤(init) 준비한다. */
  var main = null;
  var HTML = document.documentElement;
  HTML.classList.add('ws-screen');

  var $ = function (q, r) { return (r || document).querySelector(q); };
  var $$ = function (q, r) { return [].slice.call((r || document).querySelectorAll(q)); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var T = function (e) { return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { } }

  /* ---------- 단계 정보 (이름·설명은 기록지의 단계 목차 글자를 그대로 씀) ---------- */
  var STAGES = [];
  function readStages() {
    STAGES = STAGE_IDS.map(function (id, i) {
      var a = $('.stage-nav a[href="#' + id + '"]');
      var small = a && a.querySelector('small');
      var title = a ? T(a).replace(small ? T(small) : '', '').trim() : (i + 1) + '.';
      return { n: i + 1, id: id, title: title, desc: small ? T(small) : '' };
    });
  }

  /* main 의 직계 칸마다 단계 번호 붙이기 */
  function mapStages() {
    var st = 1, list = [];
    [].slice.call(main.children).forEach(function (c) {
      if (c.id === 'wsStageNav') return;
      var k = STAGE_IDS.indexOf(c.id);
      if (k >= 0) st = k + 1;
      var ws = String(st);
      if (c.id === 'scenarioPicker') ws = 'all';
      else if (c.classList.contains('stage-nav')) ws = 'nav';
      c.setAttribute('data-ws', ws);
      list.push(c);
    });
    return list;
  }
  function stageOf(el) {
    var c = el; while (c && c.parentElement !== main) c = c.parentElement;
    if (!c) return 0;
    var ws = c.getAttribute('data-ws') || (mapStages(), c.getAttribute('data-ws'));
    return /^\d$/.test(ws) ? +ws : 0;
  }

  /* 목차 세부 항목 (기록지 제목 글자 그대로) */
  function cleanLabel(t) { return t.replace(/✔\s*작성됨/g, '').replace(/\s+/g, ' ').trim(); }
  function stageItems(n) {
    mapStages();
    var kids = $$('main > [data-ws="' + n + '"]');
    var items = [];
    var add = function (el, group) {
      var raw = T(el); if (!raw) return;
      items.push({ el: el, label: cleanLabel(raw), done: /✔\s*작성됨/.test(raw), group: group || '' });
    };
    if (n === 1) {
      var group = '';
      kids.forEach(function (c) {
        if (c.classList.contains('substage-banner')) { group = cleanLabel(T(c.querySelector('h2,h3,b,strong') || c)).slice(0, 60); return; }
        if (c.classList.contains('step-banner')) return;
        var h = c.querySelector('h2'); if (h) add(h, group);
      });
    } else if (n === 6) {
      kids.forEach(function (c) { $$('.ix-tabs button', c).forEach(function (b) { add(b); }); });
    } else {
      var sel = { 2: 'h2, h4', 3: 'h3', 4: 'h2', 5: 'h2, h4', 7: 'h2' }[n] || 'h2';
      kids.forEach(function (c) {
        if (c.classList.contains('step-banner')) return;
        $$(sel, c).forEach(function (h) { if (!h.closest('.scenario-modal')) add(h); });
      });
    }
    return items;
  }

  /* ---------- 환자 목록 ---------- */
  function defaultBase() {
    return { id: BASE_ID, fixed: true, base: 'fhp', name: '김민수(가상)', age: '22', sex: '남성', job: '대학생 / 과거 축구선수', updated: '' };
  }
  function patients() {
    var a = lsGet(LS_P, []); if (!Array.isArray(a)) a = [];
    if (!a.some(function (p) { return p.id === BASE_ID; })) a.unshift(defaultBase());
    return a;
  }
  function savePatients(a) { lsSet(LS_P, a); }
  function getP(id) { return patients().filter(function (p) { return p.id === id; })[0]; }
  function cur() { return ssGet(SS_CUR); }
  function scenarioInfo() {
    /* 기록지의 '가상 시나리오 선택' 카드 글자 그대로 */
    var map = {};
    $$('#scenarioPicker .scenario-card').forEach(function (b) {
      var m = /confirmApplyScenario\('(\w+)'\)/.exec(b.getAttribute('onclick') || ''); if (!m) return;
      map[m[1]] = { no: T(b.querySelector('.scenario-number')), title: T(b.querySelector('.scenario-title')), desc: T(b.querySelector('.scenario-desc')) };
    });
    return map;
  }
  function fieldVal(n) { var e = document.querySelector('[name="' + n + '"]'); return e ? String(e.value || '').trim() : ''; }
  function setField(n, v) {
    var e = document.querySelector('[name="' + n + '"]'); if (!e || v == null || v === '') return;
    if (e.tagName === 'SELECT' && ![].some.call(e.options, function (o) { return o.value === v; })) return;
    e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* 지금 화면의 기록을 그 환자 칸에 보관 */
  function saveSnap(id) {
    /* 기록지가 저장본·예시 환자를 다 채우기 전에 보관하면 빈 기록으로 덮어쓰므로, 준비된 뒤에만 */
    id = id || cur(); if (!id || !pageReady || !restoreDone || typeof window.ptBackupData !== 'function') return false;
    var ok = false;
    try { ok = lsSet(LS_SNAP + id, window.ptBackupData()); } catch (e) { ok = false; }
    var a = patients();
    a.forEach(function (p) {
      if (p.id !== id) return;
      p.name = fieldVal('name') || p.name; p.age = fieldVal('age') || p.age; p.sex = fieldVal('sex') || p.sex; p.job = fieldVal('job') || p.job;
      p.updated = new Date().toISOString();
    });
    savePatients(a);
    if (!ok) toast('저장 공간이 부족해 이 환자 기록을 보관하지 못했습니다. 상단 💾 JSON 백업으로 파일 저장을 권장합니다.');
    return ok;
  }

  /* 알림창 없이 실행 */
  var quietDepth = 0, realAlert = window.alert, realConfirm = window.confirm;
  function quietOn() { if (quietDepth++ === 0) { window.alert = function () { }; window.confirm = function () { return true; }; } }
  function quietOff() { if (--quietDepth <= 0) { quietDepth = 0; window.alert = realAlert; window.confirm = realConfirm; } }

  var busy = false;
  function openPatient(id) {
    if (busy) return;
    var p = getP(id); if (!p) return;
    if (cur() === id) {
      if (!restoreDone) { loading(true, p.name); (restoreP || whenReady()).then(function () { loading(false); navigate('#/toc'); }); }
      else navigate('#/toc');
      return;
    }
    busy = true; loading(true, p.name);
    var before = cur();
    (async function () {
      quietOn();
      try {
        await whenReady();
        if (restoreP) await restoreP;
        if (before) saveSnap(before);
        var snap = lsGet(LS_SNAP + id, null);
        if (snap) {
          window.ptRestoreText(JSON.stringify(snap));
          await wait(900);
        } else if (!before && id === BASE_ID) {
          /* 처음 연 기본 환자: 기록지가 이미 김민수(가상)로 채워져 있으므로 그대로 씀 */
          await wait(200);
        } else {
          try { localStorage.removeItem('ggobugi_ix_v1'); } catch (e) { }
          var K = typeof KEY !== 'undefined' ? KEY : null;
          if (K) { ssSet(K + '_plan', null); ssSet(K + '_planExtra', null); }
          if (p.gen && window.GGGEN) {
            /* 랜덤 가상환자: 환자 유형 틀로 기록지 전체 채우기 */
            await window.GGGEN.fill(p.gen);
          } else {
            if (typeof window.applyScenario === 'function') window.applyScenario(p.base || 'blank');
            await wait(1400);
            if (!p.fixed) { setField('name', p.name); setField('age', p.age); setField('sex', p.sex); setField('job', p.job); }
          }
          try { if (window.ptIxReload) window.ptIxReload(); } catch (e) { }
        }
        ssSet(SS_CUR, id);
        try { if (window.ptAutoAnalyze) window.ptAutoAnalyze(); } catch (e) { }
        /* 새 가상환자: 추천 설문도 자동 채우기(만들 때 체크한 경우, 처음 열 때 한 번만) */
        if (!snap && p.gen && p.autoQuest && window.GGQ && window.GGQ.autoFill) {
          try {
            var qd = window.GGQ.autoFill({ pid: id, patient: p, ui: { util: ukUtil, foot: ukFoot, toast: toast } });
            if (qd.length) setTimeout(function () { toast('추천 설문 ' + qd.join('·') + '도 가상 환자 응답으로 채웠습니다.'); }, 600);
          } catch (e) { console.warn('[ggobugi] auto quest', e); }
        }
        await wait(500);
        saveSnap(id);
      } catch (e) { console.error('[ggobugi] patient open', e); }
      finally { quietOff(); busy = false; loading(false); }
      navigate('#/toc');
    })();
  }

  /* ---------- 랜덤 가상환자 만들기 (web/gen/gen.js) ---------- */
  function genForm() {
    var G = window.GGGEN; if (!G) return '<p class="ws-foot">생성기를 불러오는 중입니다…</p>';
    var opt = function (list, rand) { return '<option value="">' + (rand || '🎲 랜덤') + '</option>' + list.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>'; }).join(''); };
    var conds = Object.keys(G.CONDS).map(function (k) { return [k, G.CONDS[k].t]; }).concat([['blank', '빈 양식(직접 작성)']]);
    var jobs = G.JOBS.map(function (j) { return '<option value="' + esc(j.t) + '">'; }).join('');
    var ex = G.EXTRAS.map(function (x) { return '<label class="ws-xchip"><input type="checkbox" name="wsX" value="' + x[0] + '"><span>' + esc(x[1]) + '</span></label>'; }).join('') + '<label class="ws-xchip none"><input type="checkbox" name="wsX" value="none"><span>없음</span></label>';
    return '<form class="ws-addform ws-gen" autocomplete="off" onsubmit="return false">' +
      '<p class="ws-genhint">원하는 칸만 고르세요. <b>비워 둔 칸은 랜덤</b>으로 채워집니다.</p>' +
      '<div class="ws-row"><label>이름<input name="wsName" placeholder="🎲 랜덤 (자동으로 (가상) 붙음)"></label><label>나이<input name="wsAge" inputmode="numeric" placeholder="🎲 질환에 맞게"></label>' +
      '<label>성별<select name="wsSex">' + opt([['남성', '남성'], ['여성', '여성']]) + '</select></label></div>' +
      '<div class="ws-row two"><label>직업<input name="wsJob" list="wsJobList" placeholder="🎲 랜덤 또는 직접 입력"><datalist id="wsJobList">' + jobs + '</datalist></label>' +
      '<label>질환(환자 유형)<select name="wsCond">' + opt(conds) + '</select></label></div>' +
      '<div class="ws-row"><label>심한 정도<select name="wsSev">' + opt(G.SEV) + '</select></label><label>발병 시기<select name="wsDur">' + opt(G.DUR) + '</select></label><label>아픈 쪽<select name="wsSide">' + opt(G.SIDE) + '</select></label></div>' +
      '<fieldset class="ws-xset"><legend>기타사항 <small>(아무것도 안 고르면 랜덤 · "없음"을 고르면 없음)</small></legend><div class="ws-xgrid">' + ex + '</div></fieldset>' +
      '<label class="ws-autoq"><input type="checkbox" name="wsAutoQ" checked><span><b>추천 설문도 자동 채우기</b><small>8번 설문도구에서 이 환자에게 맞는 설문만(예: 목 통증 → NDI·FABQ, 기록지에 허리 불편이 있으면 ODI·RMDQ도) 기록지와 맞게 채웁니다. 맞지 않는 설문은 빈칸으로 둡니다. 직접 연습하려면 끄세요.</small></span></label>' +
      '<div class="ws-genprev" id="wsGenPrev"></div>' +
      '<div class="ws-formbtns"><button type="button" class="ws-btn ghost" data-genrand>🎲 전부 랜덤으로 채우기</button><button type="button" class="ws-btn ghost" data-genclear>비우기</button><button type="button" class="ws-btn" data-add>환자 만들기</button></div>' +
      '</form>';
  }
  function readGenForm(form) {
    var g = function (n) { var e = form.querySelector('[name="' + n + '"]'); return e ? String(e.value || '').trim() : ''; };
    var xs = [].slice.call(form.querySelectorAll('[name="wsX"]:checked')).map(function (e) { return e.value; });
    var aq = form.querySelector('[name="wsAutoQ"]');
    return { autoQ: aq ? aq.checked : true, name: g('wsName'), age: g('wsAge'), sex: g('wsSex'), job: g('wsJob'), cond: g('wsCond'), sev: g('wsSev'), dur: g('wsDur'), side: g('wsSide'), extras: xs.indexOf('none') >= 0 ? [] : xs.length ? xs : null };
  }
  function genRandomFill(form) {
    var G = window.GGGEN; if (!G) return;
    var cur0 = readGenForm(form); var r = G.resolve(cur0);
    var set = function (n, v) { var e = form.querySelector('[name="' + n + '"]'); if (e) e.value = v; };
    set('wsName', r.name); set('wsAge', r.age); set('wsSex', r.sex); set('wsJob', r.job); set('wsCond', r.cond); set('wsSev', r.sev); set('wsDur', r.dur); set('wsSide', r.side);
    [].forEach.call(form.querySelectorAll('[name="wsX"]'), function (e) { e.checked = r.extras.length ? r.extras.indexOf(e.value) >= 0 : e.value === 'none'; });
    genPreview(form);
  }
  function genPreview(form) {
    var G = window.GGGEN, box = form.querySelector('#wsGenPrev'); if (!G || !box) return;
    var f = readGenForm(form);
    if (f.cond === 'blank') { box.innerHTML = '<b>빈 양식</b> — 이름·나이·성별·직업만 채우고 나머지는 직접 작성합니다.'; return; }
    var parts = [f.name || '이름 🎲', f.age ? f.age + '세' : '나이 🎲', f.sex || '성별 🎲', f.job || '직업 🎲', f.cond ? G.CONDS[f.cond].t : '질환 🎲'];
    box.innerHTML = '<b>만들 환자</b> ' + parts.map(esc).join(' · ');
  }
  function addPatient(form) {
    var G = window.GGGEN, f = readGenForm(form), p;
    if (f.cond === 'blank' || !G) {
      var nm = f.name || '새 환자'; if (!/가상/.test(nm)) nm += '(가상)';
      p = { id: 'p' + Date.now().toString(36), base: 'blank', name: nm, age: f.age, sex: f.sex, job: f.job, updated: '' };
    } else {
      var r = G.resolve(f);
      delete r.autoQ;
      p = { id: 'p' + Date.now().toString(36), gen: r, autoQuest: f.autoQ, name: r.name, age: String(r.age), sex: r.sex, job: r.job, updated: '' };
    }
    var a = patients(); a.push(p); savePatients(a);
    renderPatients();
    toast('「' + p.name + '」 환자를 만들었습니다. 카드를 누르면 기록지가 채워집니다.');
  }
  function deletePatient(id) {
    var p = getP(id); if (!p || p.fixed) return;
    if (!realConfirm.call(window, '「' + p.name + '」 환자와 이 환자의 기록을 지울까요? 되돌릴 수 없습니다.')) return;
    savePatients(patients().filter(function (x) { return x.id !== id; }));
    try { localStorage.removeItem(LS_SNAP + id); } catch (e) { }
    if (window.GGQ && window.GGQ.removePatient) window.GGQ.removePatient(id);
    try { localStorage.removeItem('ggobugi_web_neuro_' + id); } catch (e) { }
    if (cur() === id) ssSet(SS_CUR, null);
    renderPatients();
  }

  /* ---------- 화면 틀 ---------- */
  var shell = document.createElement('div');
  shell.id = 'wsShell'; shell.className = 'no-print'; shell.setAttribute('data-ix-own', '');
  HTML.appendChild(shell);

  var load = document.createElement('div');
  load.id = 'wsLoading'; load.className = 'no-print'; load.innerHTML = '<div class="ws-load-box"><div class="ws-spin"></div><b id="wsLoadName"></b><span>환자 기록을 준비하고 있습니다…</span></div>';
  HTML.appendChild(load);
  function loading(on, name) { load.classList.toggle('on', !!on); if (name) $('#wsLoadName').textContent = name; }

  var tst = document.createElement('div'); tst.id = 'wsToast'; tst.className = 'no-print'; HTML.appendChild(tst);
  var tstT = null;
  function toast(msg) { tst.textContent = msg; tst.classList.add('on'); clearTimeout(tstT); tstT = setTimeout(function () { tst.classList.remove('on'); }, 3200); }

  /* 학과 테마 키트(univ-kit) 모양: 상단 띠 · 캠퍼스 배너 · 하단 정보 (키트 CSS 의 .uk-* 를 이 화면 안에서만 씀) */
  var UNIV = { univ: '청암대학교', dept: '물리치료과', app: '꼬북이 · 물리치료 평가 기록지', site: 'https://www.ca.ac.kr', portal: 'https://pt-portal-eta.vercel.app/' };
  function ukUtil() {
    return '<div class="uk-util"><div class="uk-in"><span><b>' + esc(UNIV.univ) + '</b> · ' + esc(UNIV.dept) + ' · ' + esc(UNIV.app) + '</span><span class="uk-links"><a href="' + UNIV.portal + '" target="_blank" rel="noopener">학습 포털</a><a href="' + UNIV.site + '" target="_blank" rel="noopener">대학 홈페이지 ↗</a></span></div></div>';
  }
  function ukFoot() {
    return '<footer class="uk-foot"><div class="uk-in"><div class="uk-fb"><span class="uk-logo"><img src="web/univ-kit/logo.png" alt="' + esc(UNIV.univ) + ' 로고"></span><div><b>' + esc(UNIV.univ + ' ' + UNIV.dept) + '</b><small>' + esc(UNIV.app) + ' · 수업용 학습 웹앱</small></div></div>' +
      '<nav><a href="' + UNIV.portal + '" target="_blank" rel="noopener">물리치료과 학습 포털</a><a href="' + UNIV.site + '" target="_blank" rel="noopener">대학 홈페이지</a></nav><small class="uk-copy">© ' + new Date().getFullYear() + ' ' + esc(UNIV.univ + ' ' + UNIV.dept) + ' · 모든 가상 환자는 교육·실습용입니다.</small></div></footer>';
  }
  function ukHero(title, text) {
    return '<section class="uk-hero"><div class="uk-hin"><span class="uk-kick">' + esc(UNIV.univ + ' ' + UNIV.dept) + '</span><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div></section>';
  }

  /* 설문도구(교수님 설문도구 구성을 우리 화면으로 새로 만든 것, web/quest/) — 목차 8번 칸 */
  function questCtx() { return { pid: cur(), patient: getP(cur()) || defaultBase(), ui: { util: ukUtil, foot: ukFoot, toast: toast } }; }
  function renderQuest(open) {
    var G = window.GGQ;
    if (!G || !G.tocGroups) return '';
    var groups = G.tocGroups(questCtx());
    var n = 0, done = 0;
    var sub = groups.map(function (g) {
      return '<li class="ws-grp' + (g.pick ? ' pick' : '') + '"><a href="#/q/' + g.k + '">' + esc(g.t) + '</a></li>' + g.items.map(function (it) {
        n++; if (it.done) done++;
        return '<li><a href="' + it.href + '" class="ws-sub' + (it.done ? ' done' : '') + '"><span class="ws-dot"></span>' + esc(it.label) + '</a></li>';
      }).join('');
    }).join('');
    return '<div class="ws-stage ws-stage-q' + (open ? ' open' : '') + '" data-n="q">' +
      '<div class="ws-shead">' +
      '<a class="ws-sgo" href="#/q"><span class="ws-num">8</span><span class="ws-stxt"><b>설문도구</b><small>부위별 표준 설문 · 채점·해석 · 운동 처방 · 임상의사결정 (기록지와 따로 저장)</small></span></a>' +
      '<button type="button" class="ws-toggle" data-toggle="q" aria-expanded="' + (open ? 'true' : 'false') + '"><span>세부 ' + n + '</span>' + (done ? '<em>✔ ' + done + '</em>' : '') + '<i>▾</i></button>' +
      '</div><ul class="ws-subs">' + sub + '</ul></div>';
  }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function renderPatients() {
    var sc = scenarioInfo(), c = cur();
    var list = patients();
    var cards = list.map(function (p) {
      var as = [p.age ? p.age + '세' : '', p.sex].filter(Boolean).join(' / ');
      var base = p.gen && window.GGGEN ? window.GGGEN.label(p.gen) : sc[p.base] ? sc[p.base].title : (p.base === 'blank' ? '빈 양식' : '');
      return '<div class="ws-pcard' + (p.id === c ? ' cur' : '') + '">' +
        '<button type="button" class="ws-popen" data-open="' + esc(p.id) + '">' +
        '<span class="ws-avatar">' + esc((p.name || '?').slice(0, 1)) + '</span>' +
        '<span class="ws-pinfo"><b>' + esc(p.name) + '</b>' +
        '<span>' + esc(as || '나이·성별 미입력') + (p.job ? ' · ' + esc(p.job) : '') + '</span>' +
        (base ? '<small>' + esc(base) + '</small>' : '') +
        '<em>' + (p.id === c ? '지금 열려 있는 환자' : (p.updated ? '마지막 저장 ' + esc(fmtDate(p.updated)) : '아직 작성 전')) + '</em></span>' +
        '<span class="ws-go">열기 →</span></button>' +
        (p.fixed ? '<span class="ws-fixed">기본 환자</span>' : '<button type="button" class="ws-pdel" data-del="' + esc(p.id) + '" title="환자 지우기" aria-label="환자 지우기">×</button>') +
        '</div>';
    }).join('');
    var form = genForm();
    shell.innerHTML = ukUtil() +
      '<div class="ws-page ws-patients">' +
      ukHero('물리치료 평가 기록지', '환자를 고르면 그 환자의 검진부터 결과까지 모든 기록이 준비되고 목차가 열립니다.') +
      '<div class="ws-sechead"><b>어떤 환자의 기록지를 열까요?</b><span class="ws-step">1 / 2 · 환자 선택</span></div>' +
      '<div class="ws-pgrid">' + cards +
      '<details class="ws-add"><summary><span class="ws-plus">🎲</span><span><b>가상 환자 만들기</b><small>나이·성별·직업·질환·기타사항을 고르면(빈칸은 랜덤) 그 환자 유형으로 기록지를 자동으로 채웁니다</small></span></summary>' +
      form + '</details>' +
      '</div>' +
      '<p class="ws-foot">환자마다 기록은 이 브라우저에 따로 보관됩니다. 다른 컴퓨터로 옮길 때는 기록지 위쪽의 💾 JSON 백업을 쓰세요. · 모든 가상 환자는 교육·실습용입니다.</p>' +
      '</div>' + ukFoot();
  }

  function renderToc() {
    var p = getP(cur()) || defaultBase();
    var as = [p.age ? p.age + '세' : '', p.sex].filter(Boolean).join(' / ');
    var open = lsGet('ggobugi_web_tocopen', {}) || {};
    var html = STAGES.map(function (s) {
      var items = stageItems(s.n);
      var done = items.filter(function (x) { return x.done; }).length;
      var lastG = null;
      var sub = items.map(function (it, i) {
        var g = '';
        if (it.group && it.group !== lastG) { g = '<li class="ws-grp">' + esc(it.group) + '</li>'; lastG = it.group; }
        return g + '<li><a href="#/s/' + s.n + '/' + i + '" class="ws-sub' + (it.done ? ' done' : '') + '"><span class="ws-dot"></span>' + esc(it.label) + '</a></li>';
      }).join('');
      return '<div class="ws-stage' + (open[s.n] ? ' open' : '') + '" data-n="' + s.n + '">' +
        '<div class="ws-shead">' +
        '<a class="ws-sgo" href="#/s/' + s.n + '"><span class="ws-num">' + s.n + '</span><span class="ws-stxt"><b>' + esc(s.title.replace(/^\d+\.\s*/, '')) + '</b><small>' + esc(s.desc) + '</small></span></a>' +
        (items.length ? '<button type="button" class="ws-toggle" data-toggle="' + s.n + '" aria-expanded="' + (open[s.n] ? 'true' : 'false') + '"><span>세부 ' + items.length + '</span>' + (done ? '<em>✔ ' + done + '</em>' : '') + '<i>▾</i></button>' : '') +
        '</div>' +
        (items.length ? '<ul class="ws-subs">' + sub + '</ul>' : '') +
        '</div>';
    }).join('');
    shell.innerHTML = ukUtil() +
      '<div class="ws-page ws-toc">' +
      '<header class="ws-top"><a class="ws-back" href="#/">← 환자 선택</a><div class="ws-toptitle"><b>목차</b><small>물리치료 평가 기록지</small></div><span class="ws-step">2 / 2 · 목차</span></header>' +
      '<section class="ws-pbar"><span class="ws-avatar">' + esc((p.name || '?').slice(0, 1)) + '</span><div><b>' + esc(p.name) + '</b><span>' + esc(as) + (p.job ? ' · ' + esc(p.job) : '') + '</span></div>' +
      '<div class="ws-tocbtns"><button type="button" class="ws-btn ghost" data-all="open">모두 펼치기</button><button type="button" class="ws-btn ghost" data-all="close">모두 접기</button></div></section>' +
      '<div class="ws-stages">' + html + renderQuest(open.q) + '</div>' +
      '<p class="ws-foot">단계 이름을 누르면 그 단계 기록지가 열리고, <b>세부</b>를 누르면 항목이 펼쳐져 원하는 곳으로 바로 갈 수 있습니다. 기록지 안에서는 맨 위 <b>← 목차</b> 단추로 돌아옵니다.</p>' +
      '</div>' + ukFoot();
  }

  shell.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'); if (o) { openPatient(o.getAttribute('data-open')); return; }
    var d = e.target.closest('[data-del]'); if (d) { deletePatient(d.getAttribute('data-del')); return; }
    if (e.target.closest('[data-add]')) { addPatient(e.target.closest('form')); return; }
    if (e.target.closest('[data-genrand]')) { genRandomFill(e.target.closest('form')); return; }
    if (e.target.closest('[data-genclear]')) { var fm = e.target.closest('form'); fm.reset(); genPreview(fm); return; }
    var t = e.target.closest('[data-toggle]');
    if (t) {
      var st = t.closest('.ws-stage'); var on = !st.classList.contains('open'); st.classList.toggle('open', on); t.setAttribute('aria-expanded', on ? 'true' : 'false');
      var open = lsGet('ggobugi_web_tocopen', {}) || {}; open[t.getAttribute('data-toggle')] = on; lsSet('ggobugi_web_tocopen', open); return;
    }
    var all = e.target.closest('[data-all]');
    if (all) {
      var on2 = all.getAttribute('data-all') === 'open', o2 = {};
      $$('.ws-stage', shell).forEach(function (s) { s.classList.toggle('open', on2); o2[s.getAttribute('data-n')] = on2; var b = s.querySelector('.ws-toggle'); if (b) b.setAttribute('aria-expanded', on2 ? 'true' : 'false'); });
      lsSet('ggobugi_web_tocopen', o2);
    }
  });
  shell.addEventListener('change', function (e) {
    var fm = e.target.closest && e.target.closest('.ws-gen'); if (!fm) return;
    if (e.target.name === 'wsX') { /* '없음'과 다른 항목은 함께 고르지 않음 */
      [].forEach.call(fm.querySelectorAll('[name="wsX"]'), function (x) { if (e.target.checked && x !== e.target && (x.value === 'none' || e.target.value === 'none')) x.checked = false; });
    }
    genPreview(fm);
  });
  shell.addEventListener('input', function (e) { var fm = e.target.closest && e.target.closest('.ws-gen'); if (fm) genPreview(fm); });
  shell.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('.ws-addform') && e.target.tagName === 'INPUT') { e.preventDefault(); addPatient(e.target.closest('form')); }
  });

  /* ---------- 영역 보기 ---------- */
  var curStage = 0;
  var backWrap = document.createElement('nav');
  backWrap.className = 'ws-bannerback no-print'; backWrap.setAttribute('data-ix-own', '');
  backWrap.innerHTML = '<a href="#/toc" class="ws-tocbtn" title="목차로 돌아가기">← 목차</a><span class="ws-curstage" id="wsCurStage"></span>';
  var stageNav = document.createElement('nav');
  stageNav.id = 'wsStageNav'; stageNav.className = 'no-print'; stageNav.setAttribute('data-ix-own', ''); stageNav.setAttribute('data-ws', 'all');
  function isView() { return !!document.body && document.body.classList.contains('web-view'); }

  function renderStageNav(n) {
    var prev = STAGES[n - 2], next = STAGES[n];
    stageNav.innerHTML =
      (prev ? '<a class="ws-pn prev" href="#/s/' + prev.n + '"><small>이전 단계</small><b>← ' + esc(prev.title) + '</b></a>' : '<span></span>') +
      '<a class="ws-pn mid" href="#/toc"><small>목차</small><b>☷ 전체 목차</b></a>' +
      (next ? '<a class="ws-pn next" href="#/s/' + next.n + '"><small>다음 단계</small><b>' + esc(next.title) + ' →</b></a>' : '<span></span>');
  }

  function setStage(n) {
    curStage = n;
    var kids = mapStages();
    document.body.setAttribute('data-ws-stage', String(n));
    document.documentElement.style.setProperty('--ws-mainw', main.clientWidth + 'px');
    kids.forEach(function (c) {
      var ws = c.getAttribute('data-ws');
      var on = ws === 'all' || ws === String(n);
      c.classList.toggle('ws-off', !on);
      if (!on) { c.setAttribute('inert', ''); c.setAttribute('aria-hidden', 'true'); }
      else { c.removeAttribute('inert'); c.removeAttribute('aria-hidden'); }
    });
    var s = STAGES[n - 1];
    var lab = $('#wsCurStage'); if (lab) lab.textContent = s ? s.title : '';
    renderStageNav(n);
    if (document.body.classList.contains('mode-patient') && n > 1 && typeof window.setMode === 'function') { try { window.setMode('all'); } catch (e) { } }
  }

  function headOffset() {
    var b = $('.pt-banner'); var r = b ? b.getBoundingClientRect() : null;
    return (r && r.bottom > 0 ? r.bottom : 60) + 12;
  }
  function reveal(el) {
    try { if (window.ptCfoldOpen) window.ptCfoldOpen(el); } catch (e) { }
    var p = el;
    while (p && p !== document.body) {
      if (p.tagName === 'DETAILS' && !p.open) p.open = true;
      if (p.classList) p.classList.remove('collapsed');
      p = p.parentElement;
    }
  }
  function scrollToEl(el) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var y = el.getBoundingClientRect().top + window.scrollY - headOffset();
        window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
      });
    });
    /* 펼친 칸·늦게 채워지는 표 때문에 자리가 밀리면 한 번 더 맞춤 */
    [500, 1300].forEach(function (ms) {
      setTimeout(function () {
        var d = el.getBoundingClientRect().top - headOffset();
        if (Math.abs(d) > 8 && Math.abs(d) < 4000) window.scrollTo({ top: Math.max(0, window.scrollY + d), behavior: 'instant' });
      }, ms);
    });
  }

  function showView(n, idx) {
    document.body.classList.add('web-view');
    HTML.classList.remove('ws-screen');
    setStage(n);
    if (idx != null) {
      var it = stageItems(n)[idx];
      if (it) {
        if (n === 6 && it.el.tagName === 'BUTTON') {
          it.el.click();
          scrollToEl($('#ixStage') || it.el);
        } else { reveal(it.el); scrollToEl(it.el); }
      } else window.scrollTo({ top: 0, behavior: 'instant' });
    } else window.scrollTo({ top: 0, behavior: 'instant' });
    clampSoon();
  }
  function showScreen(kind, args) {
    if (cur()) saveSnap(cur());
    if (document.body) { document.body.classList.remove('web-view'); document.body.removeAttribute('data-ws-stage'); }
    HTML.classList.add('ws-screen');
    if (kind === 'quest' && window.GGQ && window.GGQ.render) window.GGQ.render(shell, args || [], questCtx());
    else if (kind === 'toc') renderToc(); else renderPatients();
    shell.scrollTop = 0;
  }

  /* ---------- 주소(#/…)로 화면 바꾸기 → 브라우저 뒤로가기도 동작 ---------- */
  function route() {
    var h = location.hash || '';
    if (h.indexOf('#/') !== 0) { if (!isView()) showScreen('patients'); return; }
    var parts = h.slice(2).split('/');
    if (parts[0] === 's' && /^[1-7]$/.test(parts[1] || '')) {
      if (!cur()) { navigate('#/', true); return; }
      showView(+parts[1], parts[2] != null && parts[2] !== '' ? +parts[2] : null); return;
    }
    if (parts[0] === 'toc') { if (!cur()) { navigate('#/', true); return; } showScreen('toc'); return; }
    if (parts[0] === 'q') { if (!cur()) { navigate('#/', true); return; } showScreen('quest', parts.slice(1).filter(Boolean)); return; }
    showScreen('patients');
  }
  function navigate(h, replace) {
    if (location.hash === h) { route(); return; }
    if (replace) { history.replaceState(null, '', h); route(); } else location.hash = h;
  }
  window.addEventListener('hashchange', route);

  /* 기록지 안의 다른 단계로 가는 링크·목차(2번 키)·이동 단추 → 그 단계로 먼저 바꿈 */
  function ensureStageFor(el) {
    if (!isView() || !el) return;
    var n = stageOf(el);
    if (n && n !== curStage) { setStage(n); history.replaceState(null, '', '#/s/' + n); clampSoon(); }
  }
  document.addEventListener('click', function (e) {
    if (!isView()) return;
    var a = e.target.closest && e.target.closest('a[href^="#"],[data-target],[data-goto]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('#/') === 0) return;
    var id = href.slice(1) || a.getAttribute('data-target') || a.getAttribute('data-goto');
    if (!id || /[^\w\-]/.test(id)) return;
    var el = document.getElementById(id); if (!el) return;
    if (href) {
      e.preventDefault();
      ensureStageFor(el); reveal(el); scrollToEl(el);
    } else ensureStageFor(el);
  }, true);
  var origSIV = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function () {
    try { if (this !== document.body) ensureStageFor(this); } catch (e) { }
    return origSIV.apply(this, arguments);
  };

  /* ---------- 긴 글·긴 칸 접기 ---------- */
  var CLAMP_H = 320;
  var BLOCK_SEL = 'p, div, blockquote, ul, ol';
  var STOP_SEL = 'input,select,textarea,button,table,details,summary,h1,h2,h3,canvas,svg,img,iframe,video,[contenteditable="true"]';
  function clampNow() {
    if (!isView()) return;
    $$('main > [data-ws]:not(.ws-off):not(#wsStageNav)').forEach(function (root) {
      $$(BLOCK_SEL, root).forEach(function (el) {
        if (el.hasAttribute('data-ws-clamp') || el.closest('[data-ws-clamp]') || el.closest('.wa-fitt')) return;
        if (el.offsetHeight < CLAMP_H || el.querySelector(STOP_SEL)) return;
        if (T(el).length < 300) return;
        var cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky' || cs.display === 'inline' || cs.overflowY === 'auto' || cs.overflowY === 'scroll') return;
        /* 표·격자 모양(문제목록 표 등)은 접지 않고, 글 문단만 접음 */
        if (/grid|flex|table/.test(cs.display) || el.getElementsByTagName('*').length > 60) return;
        el.setAttribute('data-ws-clamp', 'shut');
        el.title = '눌러서 펼치기';
      });
      $$('textarea', root).forEach(function (ta) {
        if (ta.hasAttribute('data-ws-ta')) return;
        if (ta.scrollHeight > 210) { ta.setAttribute('data-ws-ta', ''); ta.title = '눌러서 펼치기 · 다른 곳을 누르면 다시 접힘'; }
      });
    });
  }
  var clampT = null;
  function clampSoon() { clearTimeout(clampT); clampT = setTimeout(clampNow, 450); }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-ws-clamp]'); if (!el) return;
    if (e.target.closest('a,button,input,select,textarea,label')) return;
    var st = el.getAttribute('data-ws-clamp');
    if (st === 'shut') { el.setAttribute('data-ws-clamp', 'open'); el.title = '아래쪽 ▲ 접기를 누르면 다시 접힘'; return; }
    var r = el.getBoundingClientRect();
    if (e.clientY > r.bottom - 34) { el.setAttribute('data-ws-clamp', 'shut'); el.title = '눌러서 펼치기'; var y = r.top + window.scrollY - headOffset(); if (r.top < 0) window.scrollTo(0, y); }
  });
  document.addEventListener('focusin', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-ws-ta')) e.target.classList.add('ws-ta-open'); });
  document.addEventListener('focusout', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-ws-ta')) e.target.classList.remove('ws-ta-open'); });

  /* ---------- 자동 보관 ---------- */
  var dirty = false;
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('main')) dirty = true; }, true);
  document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('main')) dirty = true; }, true);
  setInterval(function () { if (dirty && cur() && !busy && isView()) { dirty = false; saveSnap(cur()); } }, 15000);
  window.addEventListener('pagehide', function () { if (cur() && !busy) saveSnap(cur()); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && cur() && !busy) saveSnap(cur()); });

  /* 기록지 스크립트가 다 준비될 때까지 */
  var pageReady = false;
  var readyP = new Promise(function (res) {
    var go = function () { setTimeout(function () { pageReady = true; res(); }, 1600); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  });
  function whenReady() { return readyP; }

  window.ggobugiShell = { open: openPatient, save: saveSnap, patients: patients, stageItems: stageItems, go: navigate };

  var restoreP = null, restoreDone = false;
  function restoreCurrent() {
    var id = cur(), snap = id ? lsGet(LS_SNAP + id, null) : null;
    if (!snap || typeof window.ptRestoreText !== 'function') { restoreDone = true; return Promise.resolve(); }
    quietOn();
    try { window.ptRestoreText(JSON.stringify(snap)); } catch (e) { console.error('[ggobugi] restore', e); }
    return wait(900).then(function () {
      quietOff();
      try { if (window.ptAutoAnalyze) window.ptAutoAnalyze(); } catch (e) { }
      restoreDone = true;
    });
  }

  /* 1) 지금 바로: 첫 화면(환자 선택) 띄우기. 기록지는 그 뒤에서 마저 읽힘 */
  var booted = false;
  var h0 = location.hash || '';
  var NEEDS_RECORD = /^#\/(s\/|toc|q)/;
  if (NEEDS_RECORD.test(h0)) loading(true, (getP(cur()) || {}).name || '꼬북이');
  else renderPatients();

  /* 2) 기록지를 다 읽은 뒤: 단계 이름표·목차 단추 준비하고 주소대로 화면 열기 */
  function init() {
    if (booted) return; booted = true;
    main = document.querySelector('main');
    if (!main) { console.warn('[ggobugi] main 없음'); return; }
    readStages();
    var banner = $('.pt-banner');
    if (banner) banner.insertBefore(backWrap, banner.firstChild);
    main.appendChild(stageNav);
    if (document.body) [shell, load, tst].forEach(function (el) { document.body.appendChild(el); });
    if (typeof MutationObserver !== 'undefined') new MutationObserver(function () { if (isView()) clampSoon(); }).observe(main, { childList: true, subtree: true });
    /* 교수님 안내서 보완 기능(근거 직접 추가, 7 결과 신경학적 재검사) — index.html 은 그대로 두고 여기서 불러옴 */
    try { var ad = document.createElement('script'); ad.src = 'web/addons.js'; ad.defer = true; document.head.appendChild(ad); } catch (e) { }
    /* 새로고침해도 지금 환자의 마지막 기록으로 되돌림 (기록지는 열 때 예시 환자로 다시 채워지므로) */
    restoreP = whenReady().then(restoreCurrent);
    var h = location.hash || '';
    if (NEEDS_RECORD.test(h)) {
      restoreP.then(function () { loading(false); route(); });
    } else if (!shell.querySelector('.ws-add[open]')) {
      route(); /* 시나리오 이름표 등 기록지 글자를 넣어 다시 그림 */
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
