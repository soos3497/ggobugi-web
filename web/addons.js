/* 꼬북이 웹 — 교수님 안내서(AIDX 중재·결과) 보완 기능. 기록지 파일은 바꾸지 않고 화면에 덧붙임.
   1) ⑥ 중재 > ② 중재 근거 검색: [➕ 근거 직접 추가] — PMID·DOI로 실제 서지 불러오기 / 진료지침·교과서 등 직접 입력
   2) 7 결과: 신경학적 재검사(감각·반사·근력) 표 — 초기값은 기록지에서 읽고, 4주·8주는 직접 고름(자동으로 좋아진 값을 만들지 않음) */
(function () {
  'use strict';
  if (window.__ggobugiAddons) return; window.__ggobugiAddons = true;
  var $ = function (q, r) { return (r || document).querySelector(q); };
  var $$ = function (q, r) { return [].slice.call((r || document).querySelectorAll(q)); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fv = function (n) { var e = $('main [name="' + n + '"]'); return e ? String(e.value || '').trim() : ''; };
  function toast(m) { var t = $('#wsToast'); if (!t) { alert(m); return; } t.textContent = m; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 3200); }
  function tfetch(u, ms) { var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms || 15000); return fetch(u, { signal: c.signal }).finally(function () { clearTimeout(t); }); }
  function today() { return new Date().toLocaleDateString('ko-KR'); }

  /* ================= 1) 근거 직접 추가 ================= */
  var KINDS = ['진료지침', '체계적 문헌고찰·메타분석', '무작위 대조시험(RCT)', '관찰 연구', '교과서·전문서적', '학회·기관 권고', '기타'];
  function curProb() { var b = $('#ixProbChips .ix-chip.on'); return b ? b.textContent.replace(/^✓\s*/, '').replace(/^\d+\.\s*/, '').trim() : ''; }
  function addEvidence(ev) {
    if (typeof window.ptIxState !== 'function') { toast('중재 화면이 아직 준비되지 않았습니다.'); return false; }
    var S = window.ptIxState(); S.ev = S.ev || [];
    var dup = S.ev.filter(function (x) { return (ev.pmid && x.pmid === ev.pmid) || (ev.doi && x.doi && x.doi.toLowerCase() === ev.doi.toLowerCase()) || (!ev.pmid && !ev.doi && x.title === ev.title); })[0];
    if (dup) { toast('이미 근거 목록에 있는 자료입니다.'); return false; }
    ev.id = 'm' + Date.now(); ev.when = today(); ev.prob = curProb(); ev.f = ev.f || {};
    S.ev.push(ev);
    try { if (window.ptIxSave) window.ptIxSave(); if (window.ptIxReload) window.ptIxReload(); } catch (e) { console.warn('[addons] reload', e); }
    setTimeout(function () { var box = $('#ixEvidence'); if (box && box.scrollIntoView) box.scrollIntoView({ block: 'start' }); }, 300);
    toast('근거 목록에 추가했습니다: ' + (ev.title || '').slice(0, 40));
    return true;
  }
  /* PubMed: esummary + efetch(초록) */
  async function byPmid(pmid) {
    var b = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
    var s = await (await tfetch(b + 'esummary.fcgi?db=pubmed&retmode=json&id=' + encodeURIComponent(pmid))).json();
    var d = s && s.result && s.result[pmid]; if (!d || d.error) throw new Error('PubMed에서 PMID ' + pmid + ' 를 찾지 못했습니다.');
    var doi = ((d.articleids || []).filter(function (a) { return a.idtype === 'doi'; })[0] || {}).value || '';
    var pmc = ((d.articleids || []).filter(function (a) { return a.idtype === 'pmc'; })[0] || {}).value || '';
    var abs = '';
    try { abs = await (await tfetch(b + 'efetch.fcgi?db=pubmed&rettype=abstract&retmode=text&id=' + encodeURIComponent(pmid))).text(); abs = cleanAbs(abs); } catch (e) { }
    return { title: d.title || '', authors: (d.authors || []).map(function (a) { return a.name; }).slice(0, 6).join(', ') + ((d.authors || []).length > 6 ? ' 외' : ''), year: (d.pubdate || '').slice(0, 4), journal: d.fulljournalname || d.source || '', design: (d.pubtype || []).join(', '), pmid: String(pmid), pmcid: pmc, doi: doi, url: '', src: 'PubMed (PMID로 직접 추가)', query: 'PMID ' + pmid, abs: abs };
  }
  function cleanAbs(t) {
    /* efetch 텍스트에서 초록 본문만 대략 남김 (제목·저자·소속·DOI 줄 제외) */
    var parts = String(t || '').split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var body = parts.filter(function (p) { return p.length > 200 && !/^(Author information|DOI:|PMID:|Copyright|©)/.test(p); });
    return (body.join('\n\n') || '').slice(0, 6000);
  }
  /* DOI: Crossref (PubMed 에 있으면 PMID 도 찾음) */
  async function byDoi(doi) {
    doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
    try { var es = await (await tfetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=' + encodeURIComponent(doi + '[doi]'))).json(); var id = es && es.esearchresult && es.esearchresult.idlist && es.esearchresult.idlist[0]; if (id) { var r = await byPmid(id); r.src = 'PubMed (DOI로 직접 추가)'; r.query = 'DOI ' + doi; return r; } } catch (e) { }
    var j = await (await tfetch('https://api.crossref.org/works/' + encodeURIComponent(doi))).json();
    var m = j && j.message; if (!m) throw new Error('Crossref 에서 DOI ' + doi + ' 를 찾지 못했습니다.');
    var abs = String(m.abstract || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    var yr = ((m.issued || {})['date-parts'] || [[]])[0][0] || '';
    return { title: (m.title || [''])[0], authors: (m.author || []).map(function (a) { return [a.family, a.given].filter(Boolean).join(' '); }).slice(0, 6).join(', '), year: String(yr), journal: (m['container-title'] || [''])[0], design: m.type || '', pmid: '', doi: m.DOI || doi, url: m.URL || '', src: 'Crossref (DOI로 직접 추가)', query: 'DOI ' + doi, abs: abs };
  }
  var preview = null;
  function panelHtml() {
    return '<details class="wa-evadd" id="waEvAdd" data-ix-own><summary><b>➕ 근거 직접 추가</b><span>검색에 안 나온 논문을 PMID·DOI로 넣거나, 진료지침·교과서·학회 권고를 직접 넣습니다</span></summary>' +
      '<div class="wa-tabs"><button type="button" class="on" data-wt="id">PMID · DOI로 불러오기</button><button type="button" data-wt="man">직접 입력 (진료지침·교과서 등)</button></div>' +
      '<div class="wa-pane on" data-wp="id"><div class="wa-row"><input id="waId" placeholder="예: 29856244  또는  10.2519/jospt.2017.0302"><button type="button" class="ix-btn" id="waFetch">불러오기</button></div>' +
      '<p class="wa-hint">PMID 는 PubMed 에서, DOI 는 PubMed(있으면) 또는 Crossref 에서 실제 정보를 가져옵니다. 찾지 못하면 실패로 표시하고 지어내지 않습니다.</p><div id="waPrev"></div></div>' +
      '<div class="wa-pane" data-wp="man"><div class="wa-grid">' +
      '<label>자료 종류<select id="waKind">' + KINDS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></label>' +
      '<label class="wa-full">제목 <i>*</i><input id="waTitle" placeholder="예: Neck Pain: Revision 2017 Clinical Practice Guidelines"></label>' +
      '<label>저자·기관<input id="waAuth" placeholder="예: Blanpied PR, et al. / 대한물리치료학회"></label><label>연도<input id="waYear" inputmode="numeric" placeholder="예: 2017"></label>' +
      '<label>학술지·발행처<input id="waJour" placeholder="예: J Orthop Sports Phys Ther"></label><label>주소(URL) 또는 DOI<input id="waUrl" placeholder="https://… 또는 10.…"></label>' +
      '<label class="wa-full">핵심 내용(권고·결과 요약 또는 초록)<textarea id="waAbs" rows="4" placeholder="자료에 적힌 내용 그대로 요약해 주세요. 자료에 없는 내용은 쓰지 않습니다."></textarea></label>' +
      '</div><div class="wa-row end"><button type="button" class="ix-btn" id="waManAdd">근거 목록에 추가</button></div></div></details>';
  }
  function showPrev(r) {
    preview = r;
    $('#waPrev').innerHTML = '<div class="wa-card"><b>' + esc(r.title) + '</b><small>' + esc([r.authors, r.year, r.journal].filter(Boolean).join(' · ')) + '</small><small>' + esc(r.design || '') + (r.pmid ? ' · PMID ' + esc(r.pmid) : '') + (r.doi ? ' · DOI ' + esc(r.doi) : '') + ' · 출처 ' + esc(r.src) + '</small>' + (r.abs ? '<p>' + esc(r.abs.slice(0, 600)) + (r.abs.length > 600 ? '…' : '') + '</p>' : '<p class="wa-muted">초록이 제공되지 않았습니다(보고되지 않음/확인 필요).</p>') + '<div class="wa-row end"><button type="button" class="ix-btn" id="waAddPrev">근거 목록에 추가</button></div></div>';
  }
  async function doFetch() {
    var v = ($('#waId').value || '').trim(); if (!v) { toast('PMID 또는 DOI 를 넣어 주세요.'); return; }
    var box = $('#waPrev'); box.innerHTML = '<p class="wa-muted">불러오는 중…</p>';
    try { var r = /^\d{5,9}$/.test(v) ? await byPmid(v) : /10\.\d{3,}/.test(v) ? await byDoi(v) : null; if (!r) throw new Error('PMID(숫자) 또는 DOI(10.으로 시작) 형식이 아닙니다.'); showPrev(r); }
    catch (e) { box.innerHTML = '<p class="wa-fail">불러오기 실패 — ' + esc(e.message || '연결 오류') + ' (결과를 지어내지 않았습니다. 주소를 확인하거나 직접 입력을 쓰세요.)</p>'; }
  }
  function manAdd() {
    var g = function (id) { return ($('#' + id).value || '').trim(); };
    if (!g('waTitle')) { toast('제목을 넣어 주세요.'); $('#waTitle').focus(); return; }
    var u = g('waUrl'), isDoi = /^10\.\d{3,}\//.test(u.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''));
    var ok = addEvidence({ title: g('waTitle'), authors: g('waAuth'), year: g('waYear'), journal: g('waJour'), design: g('waKind'), pmid: '', doi: isDoi ? u.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : '', url: isDoi ? '' : u, src: '직접 입력 (' + g('waKind') + ')', query: '', abs: g('waAbs') });
    if (ok) ['waTitle', 'waAuth', 'waYear', 'waJour', 'waUrl', 'waAbs'].forEach(function (id) { $('#' + id).value = ''; });
  }
  function ensurePanel() {
    var kci = $('#ixKci'); if (!kci || $('#waEvAdd')) return;
    var wrap = document.createElement('div'); wrap.innerHTML = panelHtml();
    kci.parentNode.insertBefore(wrap.firstChild, kci.nextSibling);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#waEvAdd [data-wt]');
    if (t) { $$('#waEvAdd [data-wt]').forEach(function (b) { b.classList.toggle('on', b === t); }); $$('#waEvAdd [data-wp]').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-wp') === t.getAttribute('data-wt')); }); return; }
    if (e.target.id === 'waFetch') { doFetch(); return; }
    if (e.target.id === 'waAddPrev' && preview) { if (addEvidence(preview)) { $('#waPrev').innerHTML = ''; $('#waId').value = ''; preview = null; } return; }
    if (e.target.id === 'waManAdd') { manAdd(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'waId') { e.preventDefault(); doFetch(); } });

  /* ================= 2) 7 결과: 신경학적 재검사 ================= */
  function nkey() { var c = null; try { c = sessionStorage.getItem('ggobugi_web_cur'); } catch (e) { } return 'ggobugi_web_neuro_' + (c || 'none'); }
  function nload() { try { return JSON.parse(localStorage.getItem(nkey()) || '{}'); } catch (e) { return {}; } }
  function nsave(o) { try { localStorage.setItem(nkey(), JSON.stringify(o)); } catch (e) { } }
  function initNeuro() {
    /* 초기값은 기록지 C-6 감각, C-7 깊은힘줄반사, C-5 MMT 에서 읽음 */
    var sens = $$('main #sensoryTable select[name="sens_grade"], main #dermatomeTable select[name="sens_grade"]').filter(function (s) { return s.value !== '' && s.value !== 'NT'; });
    var sensAb = sens.filter(function (s) { return s.value !== '2'; }).length;
    var dtr = $$('main #dtrTable select[name="dtr_grade"]').filter(function (s) { return s.value !== '' && s.value !== 'NT'; });
    var dtrAb = dtr.filter(function (s) { return s.value !== '2+'; }).length, asym = $$('main #dtrTable select[name="dtr_sym"]').filter(function (s) { return s.value === '비대칭'; }).length;
    var weak = $$('main #mmtTable tbody tr').map(function (tr) { var g = $$('select[name="mmt_grade"]', tr).map(function (s) { return s.value; }); var nm = (tr.cells[1] || tr.cells[0] || {}).textContent || ''; return g.some(function (x) { return /^[0-4]$/.test(x); }) ? nm.trim() + ' ' + g.join('/') : null; }).filter(Boolean);
    return [
      { k: 'sens', t: '감각(감각 검사·피부절)', init: sens.length ? (sensAb ? '이상 ' + sensAb + '곳' : '정상 · 좌우 대칭') : '미측정', note: fv('sensory_summary') },
      { k: 'dtr', t: '깊은힘줄반사(DTR)', init: dtr.length ? (dtrAb || asym ? '이상 ' + dtrAb + '곳' + (asym ? ' · 비대칭 ' + asym : '') : '2+ 정상 · 대칭') : '미측정', note: fv('reflex_summary') },
      { k: 'mmt', t: '근력(약화된 근육 재검사)', init: weak.length ? weak.length + '개 근육 5 미만' : '모두 5(정상)', note: weak.slice(0, 6).join(', ') }
    ];
  }
  var OPTS = ['미측정', '정상 유지', '호전', '변화 없음(이상 지속)', '악화'];
  function neuroHtml() {
    var rows = initNeuro(), st = nload();
    return '<section class="card wa-neuro" id="waNeuro" data-ix-own data-ws="7"><h3>신경학적 재검사 — 감각·반사·근력 <small>(교수님 안내서: 목 통증 결과 지표)</small></h3>' +
      '<p class="wa-hint">초기값은 기록지 C-5 근력·C-6 감각·C-7 깊은힘줄반사에서 가져옵니다. 4주·8주 결과는 실제로 다시 검사한 뒤 고르세요. 고르지 않으면 "미측정"이며, 좋아진 값을 자동으로 만들지 않습니다. 악화되면 재검진 또는 의학적 평가 필요성을 검토합니다.</p>' +
      '<div class="wa-tw"><table class="wa-t"><thead><tr><th>검사</th><th>초기 (앞 단계에서 가져옴)</th><th>중간 (4주)</th><th>종료 (8주)</th><th>메모·해석</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var s = st[r.k] || {};
        var sel = function (w) { return '<select data-nk="' + r.k + '" data-nw="' + w + '">' + OPTS.map(function (o) { return '<option' + ((s[w] || '미측정') === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'; };
        var warn = /악화/.test((s.mid || '') + (s.end || '')) ? '<div class="wa-warn">⚠ 악화 — 재검진 또는 의학적 평가 필요성 검토</div>' : '';
        return '<tr><td><b>' + esc(r.t) + '</b></td><td>' + esc(r.init) + (r.note ? '<small>' + esc(r.note.slice(0, 120)) + '</small>' : '') + '</td><td>' + sel('mid') + '</td><td>' + sel('end') + '</td><td><textarea data-nk="' + r.k + '" data-nw="memo" rows="2" placeholder="재검사 결과·해석">' + esc(s.memo || '') + '</textarea>' + warn + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }
  function ensureNeuro() {
    var ox = $('#ptOx'); if (!ox) return;
    var old = $('#waNeuro');
    if (old && old.previousElementSibling === ox) return;
    if (old) old.remove();
    var w = document.createElement('div'); w.innerHTML = neuroHtml();
    ox.parentNode.insertBefore(w.firstChild, ox.nextSibling);
  }
  function refreshNeuro() { var old = $('#waNeuro'); if (!old) return; var w = document.createElement('div'); w.innerHTML = neuroHtml(); old.replaceWith(w.firstChild); }
  document.addEventListener('change', function (e) {
    var el = e.target.closest && e.target.closest('#waNeuro [data-nk]'); if (!el) return;
    var st = nload(), k = el.getAttribute('data-nk'); st[k] = st[k] || {}; st[k][el.getAttribute('data-nw')] = el.value; nsave(st);
    if (el.tagName === 'SELECT') refreshNeuro();
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('#waNeuro textarea[data-nk]'); if (!el) return;
    var st = nload(), k = el.getAttribute('data-nk'); st[k] = st[k] || {}; st[k].memo = el.value; nsave(st);
  });

  /* ================= 3) 연구 방법 정리: 연구대상 · 연구기간 · 실험·중재·연구 방법 · 통계 방법 =================
     AI 를 쓰지 않고 초록의 구분 제목과 문장 단서어로 나눔(자동 분류 — 정확하지 않을 수 있음). 없으면 '보고되지 않음/원문 확인 필요' */
  var RX = {
    pop: /\b(participants?|patients?|subjects?|volunteers?|adults?|individuals?|women|men|males?|females?|students?|athletes?|workers?|aged|years? old|mean age|age[ds]?\b|recruited|enrolled|eligible|inclusion|exclusion|n\s*=\s*\d+)|\d+\s+(patients|participants|subjects|individuals|adults|women|men|people|volunteers|students)|대상자?|참여자|참가자|환자|피험자|\d+\s*명|모집|선정 기준|포함 기준|제외 기준|연령|\d+\s*세/i,
    per: /\b(\d+[\s-]*(weeks?|months?|days?|years?|sessions?|visits?)|follow-?up|weekly|per week|times a week|twice|three times|period|duration|(from|between)\s+[A-Z]?[a-z]*\.?\s*\d{0,2},?\s*(19|20)\d\d|(19|20)\d\d\s*(to|and|–|-)\s*(19|20)\d\d|baseline and)|\d+\s*(주|개월|일|회기|년)|주\s*\d+\s*회|추적|기간|중재 전후|사전[·-]?사후/i,
    int: /\b(randomi[sz]ed|randomly|allocated|assigned|groups?|intervention|control|placebo|sham|received|underwent|exercise|training|therapy|treatment|programs?|programmes?|protocol|manual|mobili[sz]ation|education|design|trial|cohort|cross-sectional|case series|systematic review|meta-analysis|searched|databases?|measured|assessed|outcomes?|evaluated|instruments?|questionnaires?|scale)\b|무작위|배정|실험군|대조군|중재|운동|프로그램|치료|교육|설계|측정|평가|검색|데이터베이스|도구|설문/i,
    stat: /\b(statistic|statistical|analy[sz](is|ed|es)|anova|ancova|t-?tests?|regression|chi-?square|mann-?whitney|wilcoxon|kruskal|friedman|mixed[- ]?(effects?\s*)?models?|linear (mixed )?models?|generali[sz]ed estimating|spss|stata|sas\b|intention-to-treat|per-protocol|effect sizes?|cohen'?s d|standardi[sz]ed mean difference|smd|heterogeneity|i2|i²|random-effects?|fixed-effects?|pooled|correlation|pearson|spearman|icc|bonferroni|significance (level|was set))\b|통계|분석|검정|유의수준|회귀|분산분석|효과 크기|상관/i
  };
  var STAT_P = /\bp\s*[<≤=]\s*0?\.\d+/i;
  function splitS(t) { return String(t || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z가-힣(\d])/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 3; }); }
  function chipsOf(k, sents) {
    var re = k === 'pop' ? /(n\s*=\s*\d+|\d+\s+(patients|participants|subjects|individuals|adults|women|men|people|volunteers|students)|mean (\[SD\] )?age[^,;)]*\d+(\.\d+)?|\d+\s*명|\d+\s*세)/gi
      : k === 'per' ? /(\d+[\s-]*(weeks?|months?|days?|years?|sessions?)|follow-?up at [^.;]+?(months|weeks)|(from|between)\s+[A-Z][a-z]+\.?\s*\d{0,2},?\s*(19|20)\d\d,?\s*(to|and)\s*[A-Z][a-z]+\.?\s*\d{0,2},?\s*(19|20)\d\d|\d+\s*(주|개월|회기)|주\s*\d+\s*회)/gi : null;
    if (!re) return [];
    var out = []; sents.forEach(function (s) { (s.match(re) || []).forEach(function (m) {
      m = m.trim();
      /* 기간 칩에서 나이(예: aged 18 to 65 years)는 뺌 */
      if (k === 'per' && /^\d+\s*-?\s*years?$/i.test(m) && (parseInt(m, 10) >= 10 || new RegExp('aged[^.]{0,20}' + parseInt(m, 10) + '\\s*years?', 'i').test(s))) return;
      if (out.indexOf(m) < 0 && out.length < 6) out.push(m);
    }); });
    return out;
  }
  /* sections: [{label, sents:[...] , kind:'method'|'result'|'other'}] */
  function classify(sections) {
    var res = { pop: [], per: [], int: [], stat: [] };
    var add = function (k, s) { if (res[k].indexOf(s) < 0) res[k].push(s); };
    sections.forEach(function (sec) {
      var L = String(sec.label || '').toUpperCase(), lk = sec.label || '';
      var isMethod = sec.kind === 'method' || /METHOD|DESIGN|SETTING|PARTICIPANT|SUBJECT|PATIENT|INTERVENTION|MEASURE|OUTCOME|PROCEDURE|STATISTIC|ANALYSIS|DATA SOURCE|STUDY SELECTION|ELIGIB|방법|대상|중재|설계|측정|분석/.test(L + lk);
      var isResult = sec.kind === 'result' || /RESULT|FINDING|결과/.test(L + lk);
      sec.sents.forEach(function (s) {
        if (isMethod) {
          if (/PARTICIPANT|SUBJECT|PATIENT|ELIGIB|대상/.test(L + lk) || RX.pop.test(s)) add('pop', s);
          if (RX.per.test(s)) add('per', s);
          if (/STATISTIC|ANALYSIS|분석/.test(L + lk) || RX.stat.test(s)) add('stat', s);
          if (/INTERVENTION|DESIGN|MEASURE|OUTCOME|PROCEDURE|SETTING|DATA SOURCE|STUDY SELECTION|중재|설계|측정/.test(L + lk) || RX.int.test(s)) { if (!(/STATISTIC/.test(L)) ) add('int', s); }
        } else if (isResult) {
          /* 결과 문장 중 인원·성별·나이(연구대상 정보)와 통계 검정 이름만 */
          if (/\b(men|women|males?|females?|mean (\[SD\] )?age|aged|n\s*=\s*\d+)\b|\d+\s+(patients|participants|subjects)\s+(were|completed|enrolled|randomi)|\d+\s*명|남성|여성/i.test(s)) add('pop', s);
          if (/\b(anova|ancova|t-?test|regression|chi-?square|mann-?whitney|wilcoxon|mixed model|intention-to-treat)\b/i.test(s)) add('stat', s);
        }
      });
    });
    return res;
  }
  var MLAB = [['pop', '① 연구대상'], ['per', '② 연구기간'], ['int', '③ 실험·중재·연구 방법'], ['stat', '④ 통계 방법']];
  function methHtml(res, evIdx) {
    var empty = MLAB.every(function (m) { return !res[m[0]].length; });
    return '<div class="wa-meth" data-ix-own><div class="wa-meth-h"><b>연구 방법 정리</b> <span class="ix-tag">문장 단서어로 자동 분류 · 정확하지 않을 수 있음</span>' + (evIdx != null ? '<button type="button" class="ix-btn ghost sm wa-mfill" data-mfill="' + evIdx + '">근거 칸에 채우기(빈 칸만)</button>' : '') + '</div>' +
      (empty ? '<p class="wa-muted">초록에서 연구 방법 문장을 찾지 못했습니다 — 보고되지 않음/원문 확인 필요</p>' : '') +
      MLAB.map(function (m) {
        var list = res[m[0]], chips = chipsOf(m[0], list);
        return '<div class="wa-mrow"><div class="wa-mk">' + m[1] + '</div><div class="wa-mv">' + (chips.length ? '<div class="wa-chips">' + chips.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' : '') +
          (list.length ? list.slice(0, 4).map(function (s) { return /[가-힣]/.test(s) ? '<div class="ix-sent"><div class="en">' + esc(s) + '</div></div>' : '<div class="ix-sent"><div class="en">' + esc(s) + '</div><div class="ko wait hold" data-tr="' + esc(s) + '"></div></div>'; }).join('') + (list.length > 4 ? '<small class="wa-muted">외 ' + (list.length - 4) + '문장</small>' : '') : '<span class="wa-muted">초록에 보고되지 않음 · 원문 확인 필요</span>') + '</div></div>';
      }).join('') + '</div>';
  }
  /* 검색 결과·KCI 미리보기의 초록 표(.ix-abs) */
  function procAbs(abs) {
    if (abs.getAttribute('data-wa-meth')) return;
    var rows = [].slice.call(abs.querySelectorAll('.ix-abs-row'));
    if (!rows.length) return;
    var secs = rows.map(function (r) {
      var k = ((r.querySelector('.ix-abs-k') || {}).textContent || '').trim();
      var sents = [].slice.call(r.querySelectorAll('.ix-sent .en')).map(function (e) { return e.textContent.trim(); });
      if (!sents.length) sents = splitS(((r.querySelector('.ix-abs-v') || {}).textContent || ''));
      return { label: k, sents: [].concat.apply([], sents.map(splitS)), kind: /방법/.test(k) ? 'method' : /결과/.test(k) ? 'result' : 'other' };
    });
    var hasM = secs.some(function (s) { return s.kind === 'method'; });
    if (!hasM) secs.forEach(function (s) { if (s.kind === 'other') s.kind = 'method'; });
    var res = classify(secs);
    var w = document.createElement('div'); w.innerHTML = methHtml(res, null); var el = w.firstChild;
    /* 같은 문장이 두 번 보이지 않게: '연구 방법' 칸 안에 4갈래로 나눠 넣고, 원래 문장 목록은 [원래 순서로 보기]로 접어 둠 */
    var mrow = rows.filter(function (r) { return /방법/.test(((r.querySelector('.ix-abs-k') || {}).textContent || '')); }).pop();
    var mv = mrow && mrow.querySelector('.ix-abs-v');
    if (mv) {
      var orig = document.createElement('div'); orig.className = 'wa-morig';
      while (mv.firstChild) orig.appendChild(mv.firstChild);
      mv.appendChild(el);
      var tg = document.createElement('button'); tg.type = 'button'; tg.className = 'ix-btn ghost sm wa-morig-tg'; tg.textContent = '원래 순서로 보기 ▾';
      tg.addEventListener('click', function () { var o = orig.classList.toggle('open'); tg.textContent = o ? '원래 순서 접기 ▴' : '원래 순서로 보기 ▾'; });
      mv.appendChild(tg); mv.appendChild(orig);
    } else {
      var row = document.createElement('div'); row.className = 'ix-abs-row';
      row.innerHTML = '<div class="ix-abs-k">연구 방법</div><div class="ix-abs-v"></div>';
      row.lastChild.appendChild(el);
      var last = rows[rows.length - 1]; last.parentNode.insertBefore(row, last.nextSibling);
    }
    abs.setAttribute('data-wa-meth', '1');
  }
  /* 근거 목록 카드: 저장된 초록(구분 제목 포함)으로 정리 + 근거 칸 채우기 */
  function evSections(x) {
    var a = x.abs;
    if (Array.isArray(a)) return a.map(function (p) { return { label: p.label || '', sents: splitS(p.text), kind: /RESULT|FINDING/i.test(p.label || '') ? 'result' : /BACKGROUND|IMPORTANCE|INTRODUCTION|OBJECTIVE|PURPOSE|AIM|CONCLUSION|REGISTRATION|CONTEXT/i.test(p.label || '') ? 'other' : 'method' }; });
    var t = String(a || ''); if (!t.trim()) return [];
    /* 문자열 초록: 'METHODS:' 같은 제목으로 나눔, 없으면 전체를 방법 후보로 */
    var parts = t.split(/\b(BACKGROUND|OBJECTIVES?|PURPOSE|METHODS?|DESIGN|PARTICIPANTS|INTERVENTIONS?|RESULTS?|CONCLUSIONS?|연구 ?배경|목적|연구 ?방법|방법|결과|결론)\s*[:：]/i);
    if (parts.length < 3) return [{ label: '', sents: splitS(t), kind: 'method' }];
    var out = []; for (var i = 1; i < parts.length; i += 2) out.push({ label: parts[i], sents: splitS(parts[i + 1]), kind: /RESULT|결과/i.test(parts[i]) ? 'result' : /BACKGROUND|OBJECTIVE|PURPOSE|CONCLUSION|배경|목적|결론/i.test(parts[i]) ? 'other' : 'method' });
    return out;
  }
  function procEvidence() {
    if (typeof window.ptIxState !== 'function') return;
    var S = window.ptIxState(), cards = [].slice.call(document.querySelectorAll('#ixEvidence .ix-ev'));
    cards.forEach(function (card, i) {
      var x = (S.ev || [])[i]; if (!x) return;
      var key = (x.id || i) + '';
      var old = card.querySelector(':scope > .wa-meth');
      if (old && old.getAttribute('data-k') === key) return;
      if (old) old.remove();
      var secs = evSections(x); if (!secs.length) return;
      var w = document.createElement('div'); w.innerHTML = methHtml(classify(secs), i); var el = w.firstChild; el.setAttribute('data-k', key);
      var grid = card.querySelector('.ix-ev-grid'); card.insertBefore(el, grid || null);
    });
  }
  function fillEvidence(i) {
    var S = window.ptIxState(), x = S.ev[i]; if (!x) return;
    var res = classify(evSections(x)), card = document.querySelectorAll('#ixEvidence .ix-ev')[i]; if (!card) return;
    /* 연구대상: 대상 단서어가 가장 많은 문장(예: 'aged 18 to 65', 'patients with …', 'inclusion') 을 고름 */
    var popScore = function (s) { return (s.match(/aged|age\b|years|men|women|participants? (included|were)|patients with|inclusion|exclusion|eligible|n\s*=|대상|명|세/gi) || []).length - (/trial|design|conducted|organi[sz]ed|hospital/i.test(s) ? 1 : 0); };
    var bestPop = res.pop.slice().sort(function (a, b) { return popScore(b) - popScore(a); })[0] || '';
    var map = { pop: (chipsOf('pop', res.pop).join(', ') ? chipsOf('pop', res.pop).join(', ') + ' — ' : '') + bestPop, fu: chipsOf('per', res.per).join(', ') || res.per[0] || '', ig: res.int.filter(function (s) { return /group|intervention|received|randomi|실험군|중재/i.test(s); }).slice(0, 2).join(' ') || res.int[0] || '' };
    var n = 0;
    Object.keys(map).forEach(function (f) {
      var ta = card.querySelector('[data-f="' + f + '"]'); if (!ta || !map[f] || String(ta.value || '').trim()) return;
      ta.value = '[초록에서 자동 정리 · 원문 확인 필요] ' + map[f]; ta.dispatchEvent(new Event('input', { bubbles: true })); n++;
    });
    toast(n ? n + '칸을 채웠습니다(빈 칸만). 원문과 맞는지 꼭 확인하세요.' : '채울 빈 칸이 없거나 초록에서 찾지 못했습니다.');
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-mfill]'); if (b) fillEvidence(+b.getAttribute('data-mfill')); });
  var methT = null;
  function methSoon() { clearTimeout(methT); methT = setTimeout(function () { try { [].forEach.call(document.querySelectorAll('#ptIx .ix-abs'), procAbs); procEvidence(); } catch (e) { console.warn('[addons] meth', e); } }, 250); }
  (function watch() { var ix = document.getElementById('ptIx'); if (!ix) { setTimeout(watch, 800); return; } new MutationObserver(function (ms) { if (ms.some(function (m) { return !(m.target.closest && m.target.closest('.wa-meth')); })) methSoon(); }).observe(ix, { childList: true, subtree: true }); methSoon(); })();

  /* ================= 4) 가상 경과 시나리오 (연습용) =================
     ⑤ 회기 기록 8회(4·8회기 재평가) + ④ 교육 확인 + ⑥ 결정 + 7 결과 중간·종료값을 '그럴듯하게' 채움.
     모든 값에 '가상 경과(연습용) — 실제 측정값 아님' 표시. 직접 기록한 회기가 있으면 만들지 않음(덮어쓰지 않음). [가상 경과 지우기]로 원래대로. */
  var SIMTYPES = [['good', '순조로운 호전'], ['slow', '느린 호전(정체)'], ['flare', '중간에 악화 후 회복']];
  var SIM_NOTE = '⚠ 가상 경과(연습용) — 실제 측정값이 아닙니다';
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function readIndicators() {
    return $$('#ptOx [data-b^="out.mid."]').map(function (inp) {
      var key = inp.getAttribute('data-b').slice(8), grid = inp.closest('.ox-grid'), box = grid ? grid.parentElement : null, txt = box ? box.innerText : '';
      var v = function (sel) { var e = grid && grid.querySelector(sel); var n = e ? parseFloat(e.value != null ? e.value : e.textContent) : NaN; return isNaN(n) ? null : n; };
      return { key: key, name: (txt.split('\n')[0] || key).trim(), low: /낮을수록/.test(txt), init: v('.ox-v'), stg: v('[data-b="out.tgt.' + key + '.s"]'), ltg: v('[data-b="out.tgt.' + key + '.l"]'), unit: (txt.match(/좋음\s*·\s*([^\n]+)/) || [0, ''])[1] };
    }).filter(function (x) { return x.init !== null; });
  }
  function bounds(ind) {
    var k = ind.key, u = ind.unit || '';
    if (/^nrs/.test(k) || /\/10/.test(u)) return [0, 10, 0];
    if (k === 'ndi' || /\/50/.test(u)) return [0, 50, 0];
    if (/^psfs/.test(k)) return [0, 10, 0];
    if (/^mmt/.test(k)) return [0, 5, 0];
    if (/^rom/.test(k) || /°/.test(u)) return [0, 180, 0];
    if (k === 'speed') return [0.2, 1.8, 2];
    if (k === 'cva' || k === 'dnf' || k === 'tug') return [0, 200, 1];
    return [0, 1000, 0];
  }
  function stepVal(ind, frac) {
    var b = bounds(ind), init = ind.init;
    /* 목표가 없으면 작게(15%)만 변하게 — 이미 정상인 값(TUG·보행속도 등)이 비현실적으로 좋아지지 않도록 */
    var ltg = ind.ltg !== null ? ind.ltg : ind.stg !== null ? (ind.low ? Math.min(ind.stg, init - (init - ind.stg) * 1.3) : Math.max(ind.stg, init + (ind.stg - init) * 1.3)) : (ind.low ? init * 0.85 : init * 1.15);
    if (ind.low && ind.ltg === null && ind.stg !== null) ltg = Math.max(ltg, ind.stg * 0.5);
    var v = init + (ltg - init) * frac;
    v = Math.max(b[0], Math.min(b[1], v));
    var p = Math.pow(10, b[2]); return Math.round(v * p) / p;
  }
  function setSel(sel, txt) { var s = typeof sel === 'string' ? $(sel) : sel; if (!s) return; s.value = txt; s.dispatchEvent(new Event('change', { bubbles: true })); }
  async function makeSim(type) {
    if (typeof window.ptIxState !== 'function') { toast('중재 화면이 아직 준비되지 않았습니다.'); return; }
    var S = window.ptIxState(); S.ses = S.ses || [];
    if (S.ses.some(function (s) { return !s.sim; })) { alert('직접 기록한 회기가 있어서 가상 경과를 만들지 않았습니다(덮어쓰지 않음).\n연습하려면 새 가상 환자를 만들어서 해 보세요.'); return; }
    if (S.sim && S.sim.on && !confirm('이미 만든 가상 경과를 지우고 새로 만들까요?')) return;
    if (S.sim && S.sim.on) removeSim(true);
    /* ③ 중재 카드가 없으면 4-3 계획에서 불러옴 */
    if (!(S.cards || []).length) { try { window.ptIxShowTab(3); await wait(300); var ib = $('#ptIx [data-a="importPlan"]'); if (ib) { var c0 = window.confirm; window.confirm = function () { return true; }; ib.click(); window.confirm = c0; } await wait(500); } catch (e) { } S = window.ptIxState(); }
    var inds = readIndicators();
    var backup = JSON.parse(JSON.stringify({ out: S.out || {}, edu: S.edu || {}, dec: S.dec || [] }));
    var start = new Date((fv('date') || new Date().toISOString().slice(0, 10)) + 'T09:00:00');
    var nrsInd = inds.filter(function (i) { return i.key === 'nrs'; })[0] || { key: 'nrs', init: 5, stg: null, ltg: null, low: true, unit: '/10' };
    var curve = { good: [0.15, 0.3, 0.45, 0.62, 0.72, 0.82, 0.9, 1.0], slow: [0.05, 0.12, 0.18, 0.3, 0.36, 0.42, 0.5, 0.62], flare: [0.15, 0.3, 0.05, 0.4, 0.55, 0.7, 0.82, 0.92] }[type];
    var cards = (S.cards || []).filter(function (c) { return !/확정 후 중재 선택|중재 미정|평가 지표 확정/.test(c.name || ''); });
    var bp = fv('bp') || '120/78', hr = parseInt(fv('hr'), 10) || 72;
    S.ses = [];
    for (var i = 0; i < 8; i++) {
      var d = new Date(start.getTime() + (i * 7 + 2) * 864e5), f = curve[i], fPrev = i ? curve[i - 1] : 0;
      var pre = stepVal(nrsInd, fPrev), post = Math.max(0, pre - (type === 'slow' ? 0 : 1));
      var flare = type === 'flare' && i === 2;
      if (flare) { pre = stepVal(nrsInd, 0.2); post = Math.min(10, pre + 2); }
      var reeval = i === 3 || i === 7, meas = {};
      if (reeval) inds.forEach(function (ind) { meas[ind.key] = String(stepVal(ind, curve[i] * rnd(0.95, 1.03))); });
      meas.nrs = String(pre);
      S.ses.push({
        id: 'sim' + i + Date.now().toString(36), sim: true, no: i + 1, date: d.toISOString().slice(0, 10), team: '가상 경과(연습용)', rec: '가상', _open: i === 7,
        home: type === 'good' ? '주 5일 중 ' + (i < 2 ? 3 : 5) + '일 수행' : type === 'slow' ? '주 5일 중 2~3일 수행(시간 부족)' : (i === 2 ? '통증 걱정으로 2일만 수행' : '주 5일 중 4일 수행'),
        prePain: String(pre), postPain: String(post), preFunc: i === 0 ? '초기 평가와 비슷' : (f > fPrev ? '지난 회기보다 일상 동작이 조금 편해짐' : '지난 회기와 비슷'),
        bp: bp, hr: String(hr + Math.round(rnd(-4, 4))), redflag: '없음', reeval: reeval,
        items: cards.map(function (c) { var dose = Object.keys(c.dose || {}).map(function (k) { var o = c.dose[k]; return o && (o.stu || o.lit) ? (o.stu || o.lit) : ''; }).filter(Boolean).join(', '); return { cardId: c.id, name: c.name, cls: c.cls, plan: dose, done: !(flare && /운동/.test(c.cls || '')), dose: flare && /운동/.test(c.cls || '') ? '' : (dose || '계획대로'), assist: i < 3 ? '구두·촉각 피드백' : '구두 피드백', min: String(Math.round(rnd(8, 15))), dev: flare && /운동/.test(c.cls || '') ? '통증 증가로 이번 회기는 운동 강도를 낮춤' : '' }; }),
        immed: flare ? '운동 중 통증 증가, 휴식 후 일부 감소' : '중재 직후 통증 감소, 움직임이 편해짐',
        adverse: flare ? '운동 뒤 통증 NRS 2점 증가(다음날까지 지속)' : '', adResp: flare ? '운동 강도·반복 감량, 냉찜질, 다음 회기 재확인' : '',
        next: flare ? '다음날까지 통증 지속, 이틀 뒤 원래대로' : (type === 'slow' ? '큰 변화 없음' : '다음날 근육통 경미, 하루 만에 회복'),
        assess: reeval ? (i === 3 ? '4주 재평가 — ' : '8주 재평가 — ') + inds.slice(0, 4).map(function (ind) { return ind.name.split(' (')[0] + ' ' + ind.init + '→' + meas[ind.key]; }).join(', ') : (flare ? '운동 후 통증 증가 — 감량 필요' : '통증 ' + pre + '→' + post + ', 이상반응 없음'),
        plan: flare ? '감량' : reeval && i === 3 ? (type === 'slow' ? '변경' : '진행') : reeval ? '유지' : '유지',
        planWhy: flare ? '통증 2점 증가 — ③ 감량 기준 적용' : reeval && i === 3 ? (type === 'slow' ? '4주 변화가 작아 중재 방법·용량 조정' : '목표에 가까워져 강도를 한 단계 올림') : '현재 용량 유지',
        add: SIM_NOTE, meas: meas
      });
    }
    S.edu = S.edu || {};
    S.edu.understand = type === 'slow' ? '부분적으로 이해함' : '이해함';
    S.edu.redemo = type === 'good' ? '정확하게 수행' : '부분적으로 수행';
    S.edu.adherence = type === 'good' ? '계획대로 수행(80% 이상)' : '일부 수행(50~80%)';
    S.edu.barriers = (type === 'slow' ? '시간 부족, 방법을 자주 잊음' : type === 'flare' ? '통증이 심해질까 걱정' : '특별한 어려움 없음') + ' [가상 경과(연습용)]';
    S.dec = (S.dec || []).filter(function (x) { return !x.sim; });
    var now = new Date().toLocaleString('ko-KR');
    if (type === 'flare') S.dec.push({ sim: true, when: now, ses: '3회기', choice: '감량', reason: '[가상 경과] 운동 후 통증 2점 증가 — 재검진 필요성 확인, 위험신호 없음, 강도 감량' });
    S.dec.push({ sim: true, when: now, ses: '4회기', choice: type === 'slow' ? '변경' : '진행', reason: type === 'slow' ? '[가상 경과] 4주 변화가 MCID 에 못 미쳐 중재 방법·용량 변경' : '[가상 경과] 4주 단기목표에 가까워 강도 한 단계 진행' });
    S.dec.push({ sim: true, when: now, ses: '8회기', choice: type === 'slow' ? '의뢰 검토' : '유지', reason: type === 'slow' ? '[가상 경과] 8주에도 호전이 작아 재평가·의뢰 검토' : '[가상 경과] 장기목표에 근접 — 가정운동 중심으로 유지' });
    S.sim = { on: true, type: type, when: now, backup: backup };
    try { window.ptIxSave(); window.ptIxReload(); } catch (e) { console.warn(e); }
    await wait(600);
    /* 7 결과: 기록지의 '회기 기록에서 가져오기'로 중간=4회기, 종료=8회기 */
    try {
      var c1 = window.alert; window.alert = function () { };
      setSel('#oxMidSes', '4'); var pm = $('#ptOx [data-a="pullMid"]'); if (pm) pm.click(); await wait(300);
      setSel('#oxEndSes', '8'); var pe = $('#ptOx [data-a="pullEnd"]'); if (pe) pe.click(); await wait(300);
      window.alert = c1;
      var S2 = window.ptIxState(); S2.out = S2.out || {}; S2.out.summary = '[가상 경과(연습용) — 실제 측정값 아님] ' + String(S2.out.summary || '').replace(/^\[가상 경과[^\]]*\]\s*/, ''); window.ptIxSave(); window.ptIxReload();
    } catch (e) { console.warn('[addons] pull', e); }
    toast('가상 경과(' + (SIMTYPES.filter(function (x) { return x[0] === type; })[0] || [0, ''])[1] + ')를 만들었습니다 — 연습용, 실제 측정값 아님');
  }
  function removeSim(silent) {
    var S = window.ptIxState(); if (!S.sim || !S.sim.on) { if (!silent) toast('지울 가상 경과가 없습니다.'); return; }
    if (!silent && !confirm('가상 경과(회기 기록·교육 확인·결정·결과 중간/종료값)를 지우고 만들기 전으로 되돌릴까요?')) return;
    var b = S.sim.backup || {};
    S.ses = (S.ses || []).filter(function (s) { return !s.sim; });
    S.out = b.out || {}; S.edu = b.edu || {}; S.dec = (b.dec || []).filter(function (x) { return !x.sim; });
    delete S.sim;
    try { window.ptIxSave(); window.ptIxReload(); } catch (e) { }
    if (!silent) toast('가상 경과를 지웠습니다.');
  }
  function simBar() {
    var S = typeof window.ptIxState === 'function' ? window.ptIxState() : null, on = S && S.sim && S.sim.on;
    var t = on ? (SIMTYPES.filter(function (x) { return x[0] === S.sim.type; })[0] || [0, ''])[1] : '';
    return '<div class="wa-sim' + (on ? ' on' : '') + '" data-ix-own>' + (on ? '<b>' + SIM_NOTE + '</b><span>경과 유형: ' + esc(t) + ' · 만든 때 ' + esc(S.sim.when) + '</span><button type="button" class="ix-btn ghost sm" data-simdel>가상 경과 지우기</button>'
      : '<b>🧪 가상 경과 시나리오 만들기</b><span>연습용: ⑤ 회기 기록 8회(4·8회기 재평가) · 교육 확인 · ⑥ 결정 · 7 결과 중간/종료값을 그럴듯하게 채웁니다(실제 측정값 아님 표시).</span><select data-simtype>' + SIMTYPES.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select><button type="button" class="ix-btn sm" data-simmake>만들기</button>') + '</div>';
  }
  function ensureSimBars() {
    var targets = [$('#ptIx .ix-pane[data-pane="5"]'), $('#ptIx .ix-pane[data-pane="6"]'), $('#ptOx')];
    var S = typeof window.ptIxState === 'function' ? window.ptIxState() : null, sig = S && S.sim && S.sim.on ? 'on' + S.sim.when : 'off';
    targets.forEach(function (t) {
      if (!t) return; var bar = t.querySelector(':scope > .wa-sim');
      if (bar && bar.getAttribute('data-sig') === sig) return;
      if (bar) bar.remove();
      var w = document.createElement('div'); w.innerHTML = simBar(); var el = w.firstChild; el.setAttribute('data-sig', sig); t.insertBefore(el, t.firstChild);
    });
  }
  document.addEventListener('click', function (e) {
    var mk = e.target.closest && e.target.closest('[data-simmake]');
    if (mk) { var sel = mk.parentElement.querySelector('[data-simtype]'); makeSim(sel ? sel.value : 'good'); return; }
    if (e.target.closest && e.target.closest('[data-simdel]')) removeSim(false);
  });

  /* ================= 5) ③ 중재 카드: FITT-VP 한눈에 보기 =================
     카드의 '용량' 표(학생 제안 → 없으면 논문 용량)와 '진행·감량 기준'을 FITT-VP 6칸으로 다시 보여 줌.
     새 입력칸은 만들지 않음(읽기 전용) — 고칠 때는 위 용량 표에서 고침. */
  var FITT_MAP = {
    '운동치료': { F: ['freq'], I: ['inten'], T: ['time', 'hold', 'rest'], Ty: ['type'] },
    '기능·과제 훈련': { F: ['freq'], I: ['level', 'assist'], T: ['time'], Ty: ['task'] },
    '수기치료': { F: ['freq'], I: ['grade'], T: ['dose'], Ty: ['tech', 'site'] },
    '신경가동술': { F: ['freq'], I: [], T: [], Ty: ['tech', 'pos'] },
    '물리적 인자': { F: ['freq'], I: ['param'], T: ['time'], Ty: ['kind', 'site'] },
    '환자 교육': { F: ['count'], I: [], T: ['time'], Ty: ['topic', 'how'] },
    '환경·인체공학적 조정': { F: [], I: [], T: [], Ty: ['what', 'env'] }
  };
  var FLAB = { freq: '빈도', inten: '강도', time: '시간', hold: '유지', rest: '휴식', type: '유형', level: '난이도', assist: '보조', grade: '등급', dose: '횟수·시간', tech: '기법', site: '부위', pos: '자세', param: '매개변수', kind: '종류', count: '횟수', topic: '주제', how: '방법', what: '내용', env: '환경', task: '과제' };
  function dv(c, k) { var d = (c.dose || {})[k] || {}; var s = String(d.stu || '').trim(), l = String(d.lit || '').trim(); return s ? { v: s, src: '' } : l ? { v: l, src: '논문' } : null; }
  function numOf(t) { var m = String(t || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)(?:\s*[~–-]\s*(\d+(?:\.\d+)?))?/); if (!m) return null; return m[2] ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : parseFloat(m[1]); }
  function perWeek(t) { t = String(t || ''); if (/매일|daily|every ?day/i.test(t)) return 7; var m = t.match(/주\s*(\d+(?:\s*[~–-]\s*\d+)?)\s*(회|번|일)/) || t.match(/(\d+(?:\s*[~–-]\s*\d+)?)\s*(times|x|회)\s*(\/|per|a)\s*week/i); if (m) return numOf(m[1]); var d = t.match(/하루\s*(\d+)\s*(회|번)/); if (d) return 7 * numOf(d[1]); return null; }
  function minutesOf(t) { t = String(t || ''); var n = numOf(t); if (n == null) return null; if (/시간|hour|hr/i.test(t) && !/분|min/i.test(t)) return n * 60; if (/분|min/i.test(t)) return n; return null; }
  function fittRows(c) {
    var m = FITT_MAP[c.cls] || FITT_MAP['운동치료'];
    var pick = function (keys) { return keys.map(function (k) { var x = dv(c, k); return x ? { k: k, v: x.v, src: x.src } : null; }).filter(Boolean); };
    var F = pick(m.F), I = pick(m.I), T = pick(m.T), Ty = pick(m.Ty);
    if (!Ty.length && c.name) Ty = [{ k: '', v: c.name, src: '카드 이름' }];
    /* V(총량): 반복×세트, 회당 시간×빈도로 주당 양을 계산(숫자를 읽을 수 있을 때만) */
    var V = [], reps = dv(c, 'reps') || dv(c, 'trials'), sets = dv(c, 'sets'), fq = dv(c, 'freq') || dv(c, 'count'), tm = dv(c, 'time'), per = dv(c, 'period');
    var pw = fq ? perWeek(fq.v) : null, rn = reps ? numOf(reps.v) : null, sn = sets ? numOf(sets.v) : null, mn = tm ? minutesOf(tm.v) : null;
    if (reps) V.push({ k: '', v: reps.v + (sets ? ' × ' + sets.v : ''), src: reps.src || (sets && sets.src) || '' });
    if (rn != null && pw != null) V.push({ k: '', v: '주당 약 ' + Math.round(rn * (sn || 1) * pw) + '회 반복', src: '자동 계산' });
    if (mn != null && pw != null) V.push({ k: '', v: '주당 약 ' + Math.round(mn * pw) + '분', src: '자동 계산' });
    if (per) V.push({ k: 'period', v: '기간 ' + per.v, src: per.src });
    var P = String(c.prog || '').trim() ? [{ k: '', v: String(c.prog).trim(), src: '⑤ 진행·감량 기준' }] : [];
    return [['F', 'Frequency', '빈도 · 얼마나 자주', F], ['I', 'Intensity', '강도 · 얼마나 세게', I], ['T', 'Time', '시간 · 한 번에 얼마나 오래', T], ['T', 'Type', '종류 · 어떤 운동·기법', Ty], ['V', 'Volume', '총량 · 위를 곱한 전체 양', V], ['P', 'Progression', '진행 · 언제·어떻게 늘리고 줄이나', P]];
  }
  function fittHtml(c) {
    var rows = fittRows(c), filled = rows.filter(function (r) { return r[3].length; }).length;
    return '<div class="wa-fitt" data-ix-own><div class="wa-fitt-h"><b>FITT-VP 한눈에 보기</b><span class="ix-tag">' + filled + '/6 채움</span><span class="wa-muted">위 용량 표·⑤ 진행 기준에서 자동으로 모음 · 고칠 때는 위 표에서</span></div>' +
      '<div class="wa-fitt-g">' + rows.map(function (r) {
        return '<div class="wa-fc' + (r[3].length ? '' : ' empty') + '"><div class="wa-fl"><i>' + r[0] + '</i><span><b>' + r[1] + '</b><small>' + r[2] + '</small></span></div><div class="wa-fvals">' +
          (r[3].length ? r[3].map(function (x) { return '<div>' + (x.k && FLAB[x.k] && r[3].length > 1 ? '<em>' + FLAB[x.k] + '</em> ' : '') + esc(x.v) + (x.src ? ' <small class="wa-fsrc">' + esc(x.src) + '</small>' : '') + '</div>'; }).join('') : '<span class="wa-muted">미입력</span>') + '</div></div>';
      }).join('') + '</div></div>';
  }
  function ensureFitt() {
    if (typeof window.ptIxState !== 'function') return;
    var S = window.ptIxState(); if (!S || !S.cards) return;
    $$('#ptIx .ix-pane[data-pane="3"] details.ix-card[data-ci]').forEach(function (card) {
      var c = S.cards[+card.getAttribute('data-ci')]; if (!c) return;
      var tw = card.querySelector('.ix-dose2'); tw = tw && tw.closest('.ix-tw'); if (!tw) return;
      var html = fittHtml(c), old = card.querySelector('.wa-fitt');
      if (old && old.getAttribute('data-h') === html.length + ':' + html.slice(-300)) return;
      var w = document.createElement('div'); w.innerHTML = html; var el = w.firstChild; el.setAttribute('data-h', html.length + ':' + html.slice(-300));
      if (old) old.replaceWith(el); else { var note = tw.nextElementSibling; (note && note.classList.contains('ix-mini') ? note : tw).insertAdjacentElement('afterend', el); }
    });
  }
  var fittT = null;
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('#ptIx details.ix-card')) { clearTimeout(fittT); fittT = setTimeout(function () { try { ensureFitt(); } catch (x) { } }, 400); } });

  /* 환자가 바뀌거나 화면이 다시 그려져도 계속 붙어 있게 */
  var lastCur = null, lastSig = '';
  setInterval(function () {
    ensurePanel(); ensureNeuro(); try { ensureSimBars(); } catch (e) { } try { ensureFitt(); } catch (e) { console.warn('[addons] fitt', e); }
    var c = null; try { c = sessionStorage.getItem('ggobugi_web_cur'); } catch (e) { }
    /* 환자가 바뀌었거나 기록지 값(감각·반사·근력)이 늦게 채워지면 표를 다시 그림 — 입력 중일 때는 건드리지 않음 */
    var sig = ''; try { sig = JSON.stringify(initNeuro().map(function (r) { return r.init + '|' + r.note; })); } catch (e) { }
    var typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#waNeuro');
    if ((c !== lastCur || sig !== lastSig) && !typing) { lastCur = c; lastSig = sig; refreshNeuro(); }
  }, 1200);
  ensurePanel(); ensureNeuro();
})();
