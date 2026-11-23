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
          if (typeof window.applyScenario === 'function') window.applyScenario(p.base || 'blank');
          await wait(1400);
          if (!p.fixed) { setField('name', p.name); setField('age', p.age); setField('sex', p.sex); setField('job', p.job); }
          try { if (window.ptIxReload) window.ptIxReload(); } catch (e) { }
        }
        ssSet(SS_CUR, id);
        try { if (window.ptAutoAnalyze) window.ptAutoAnalyze(); } catch (e) { }
        await wait(500);
        saveSnap(id);
      } catch (e) { console.error('[ggobugi] patient open', e); }
      finally { quietOff(); busy = false; loading(false); }
      navigate('#/toc');
    })();
  }

  function addPatient(form) {
    var name = form.querySelector('[name="wsName"]').value.trim();
    if (!name) { form.querySelector('[name="wsName"]').focus(); toast('이름을 적어 주세요.'); return; }
    var p = {
      id: 'p' + Date.now().toString(36), base: (form.querySelector('[name="wsBase"]:checked') || {}).value || 'blank',
      name: name, age: form.querySelector('[name="wsAge"]').value.trim(), sex: form.querySelector('[name="wsSex"]').value,
      job: form.querySelector('[name="wsJob"]').value.trim(), updated: ''
    };
    var a = patients(); a.push(p); savePatients(a);
    renderPatients();
  }
  function deletePatient(id) {
    var p = getP(id); if (!p || p.fixed) return;
    if (!realConfirm.call(window, '「' + p.name + '」 환자와 이 환자의 기록을 지울까요? 되돌릴 수 없습니다.')) return;
    savePatients(patients().filter(function (x) { return x.id !== id; }));
    try { localStorage.removeItem(LS_SNAP + id); } catch (e) { }
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

  function brand() {
    return '<div class="ws-brand"><span class="ws-logo">🐢</span><div><b>꼬북이</b><small>물리치료 평가 기록지</small></div></div>';
  }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  function renderPatients() {
    var sc = scenarioInfo(), c = cur();
    var list = patients();
    var cards = list.map(function (p) {
      var as = [p.age ? p.age + '세' : '', p.sex].filter(Boolean).join(' / ');
      var base = sc[p.base] ? sc[p.base].title : (p.base === 'blank' ? '빈 양식' : '');
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
    var baseOpts = ['blank', 'fhp', 'stroke', 'sci'].map(function (k, i) {
      var s = sc[k]; var t = k === 'blank' ? '빈 양식' : (s ? s.no + ' · ' + s.title : k);
      var d = k === 'blank' ? '이름·나이·성별·직업만 채우고 나머지는 직접 작성' : (s ? s.desc : '');
      return '<label class="ws-base"><input type="radio" name="wsBase" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(t) + '</b><small>' + esc(d) + '</small></span></label>';
    }).join('');
    shell.innerHTML =
      '<div class="ws-page ws-patients">' +
      '<header class="ws-top">' + brand() + '<span class="ws-step">1 / 2 · 환자 선택</span></header>' +
      '<section class="ws-hero"><h1>어떤 환자의 기록지를 열까요?</h1><p>환자를 고르면 그 환자의 검진부터 결과까지 모든 기록이 준비되고 목차가 열립니다.</p></section>' +
      '<div class="ws-pgrid">' + cards +
      '<details class="ws-add"><summary><span class="ws-plus">+</span><span><b>가상 환자 추가</b><small>새 가상 환자를 만들어 따로 기록합니다</small></span></summary>' +
      '<form class="ws-addform" autocomplete="off" onsubmit="return false">' +
      '<div class="ws-row"><label>이름 <i>*</i><input name="wsName" placeholder="예: 이지은(가상)"></label><label>나이<input name="wsAge" inputmode="numeric" placeholder="예: 35"></label>' +
      '<label>성별<select name="wsSex"><option value="">선택</option><option>남성</option><option>여성</option></select></label></div>' +
      '<label class="ws-wide">직업<input name="wsJob" placeholder="예: 사무직"></label>' +
      '<fieldset><legend>기록지 시작 방법</legend>' + baseOpts + '</fieldset>' +
      '<div class="ws-formbtns"><button type="button" class="ws-btn" data-add>환자 추가</button></div>' +
      '</form></details>' +
      '</div>' +
      '<p class="ws-foot">환자마다 기록은 이 브라우저에 따로 보관됩니다. 다른 컴퓨터로 옮길 때는 기록지 위쪽의 💾 JSON 백업을 쓰세요. · 모든 가상 환자는 교육·실습용입니다.</p>' +
      '</div>';
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
    shell.innerHTML =
      '<div class="ws-page ws-toc">' +
      '<header class="ws-top"><a class="ws-back" href="#/">← 환자 선택</a>' + brand() + '<span class="ws-step">2 / 2 · 목차</span></header>' +
      '<section class="ws-pbar"><span class="ws-avatar">' + esc((p.name || '?').slice(0, 1)) + '</span><div><b>' + esc(p.name) + '</b><span>' + esc(as) + (p.job ? ' · ' + esc(p.job) : '') + '</span></div>' +
      '<div class="ws-tocbtns"><button type="button" class="ws-btn ghost" data-all="open">모두 펼치기</button><button type="button" class="ws-btn ghost" data-all="close">모두 접기</button></div></section>' +
      '<div class="ws-stages">' + html + '</div>' +
      '<p class="ws-foot">단계 이름을 누르면 그 단계 기록지가 열리고, <b>세부</b>를 누르면 항목이 펼쳐져 원하는 곳으로 바로 갈 수 있습니다. 기록지 안에서는 맨 위 <b>← 목차</b> 단추로 돌아옵니다.</p>' +
      '</div>';
  }

  shell.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]'); if (o) { openPatient(o.getAttribute('data-open')); return; }
    var d = e.target.closest('[data-del]'); if (d) { deletePatient(d.getAttribute('data-del')); return; }
    if (e.target.closest('[data-add]')) { addPatient(e.target.closest('form')); return; }
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
  function showScreen(kind) {
    if (cur()) saveSnap(cur());
    if (document.body) { document.body.classList.remove('web-view'); document.body.removeAttribute('data-ws-stage'); }
    HTML.classList.add('ws-screen');
    if (kind === 'toc') renderToc(); else renderPatients();
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
        if (el.hasAttribute('data-ws-clamp') || el.closest('[data-ws-clamp]')) return;
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
  if (h0.indexOf('#/s/') === 0 || h0 === '#/toc') loading(true, (getP(cur()) || {}).name || '꼬북이');
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
    /* 새로고침해도 지금 환자의 마지막 기록으로 되돌림 (기록지는 열 때 예시 환자로 다시 채워지므로) */
    restoreP = whenReady().then(restoreCurrent);
    var h = location.hash || '';
    if (h.indexOf('#/s/') === 0 || h === '#/toc') {
      restoreP.then(function () { loading(false); route(); });
    } else if (!shell.querySelector('.ws-add[open]')) {
      route(); /* 시나리오 이름표 등 기록지 글자를 넣어 다시 그림 */
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
