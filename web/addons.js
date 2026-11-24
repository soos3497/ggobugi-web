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

  /* 4) 가상 경과 시나리오: 사용자 요청으로 롤백(2026-11-24). 예전에 만들어 둔 연습용 값이 남아 있으면 만들기 전 상태로 한 번 되돌림 */
  function cleanOldSim() {
    if (typeof window.ptIxState !== 'function') return;
    var S = window.ptIxState(); if (!S || !S.sim || !S.sim.on) return;
    var b = S.sim.backup || {};
    S.ses = (S.ses || []).filter(function (s) { return !s.sim; });
    S.out = b.out || {}; S.edu = b.edu || {}; S.dec = (b.dec || []).filter(function (x) { return !x.sim; });
    delete S.sim;
    try { window.ptIxSave(); window.ptIxReload(); } catch (e) { }
  }

  /* ================= 5) ③ 중재 카드: FITT-VP 용량 =================
     (2026-11-24 사용자 요청) 원래 '용량' 표(논문 용량·출처·학생 제안)는 숨기고, 이 FITT-VP 상자에서 바로 적음.
     입력칸은 기록지와 같은 data-b="cards.N.dose.KEY.stu" 를 써서 기록지의 저장 방식 그대로 저장됨(새 저장 방식 없음).
     원래 표의 칸(분류별 DOSE 항목)은 빠짐없이 6칸 중 하나에 배치. 논문 용량이 적혀 있으면 칸 아래에 작게 보여 줌.
     P(진행)는 ⑤ 진행·감량 기준 칸을 그대로 보여 줌(두 곳에서 고치면 엉킬 수 있어 읽기 전용). */
  var FITT_MAP = {
    '운동치료': { F: ['freq'], I: ['inten'], T: ['time', 'hold', 'rest'], Ty: ['type'], V: ['reps', 'sets', 'period'] },
    '기능·과제 훈련': { F: ['freq'], I: ['level', 'assist'], T: ['time'], Ty: ['task'], V: ['trials', 'period'] },
    '수기치료': { F: ['freq'], I: ['grade'], T: ['dose'], Ty: ['tech', 'site'], V: ['period'] },
    '신경가동술': { F: ['freq'], I: [], T: [], Ty: ['tech', 'pos'], V: ['reps', 'sets', 'period'] },
    '물리적 인자': { F: ['freq'], I: ['param'], T: ['time'], Ty: ['kind', 'site'], V: ['period'] },
    '환자 교육': { F: ['count'], I: [], T: ['time'], Ty: ['topic', 'how', 'mat'], V: [] },
    '환경·인체공학적 조정': { F: [], I: [], T: ['check'], Ty: ['what', 'env'], V: ['period'] }
  };
  var FLAB = { freq: '빈도', inten: '강도', time: '시간', hold: '유지', rest: '휴식', type: '유형', reps: '반복', sets: '세트', period: '기간', level: '난이도·환경', assist: '보조 수준', trials: '반복·시도 횟수', grade: '등급', dose: '진동 횟수·시간·세트', tech: '기법', site: '부위', pos: '자세', param: '강도·매개변수', kind: '종류', count: '횟수', topic: '주제', how: '방법', mat: '자료', what: '조정 내용', env: '대상 환경', check: '확인 시점', task: '과제' };
  var FPH = { freq: '예: 주 3회', inten: '예: RPE 5–6, 통증 NRS 3 이하', time: '예: 15분', hold: '예: 10초', rest: '예: 세트 간 60초', type: '예: 머리목굽힘 운동', reps: '예: 10회', sets: '예: 3세트', period: '예: 8주', trials: '예: 5회', count: '예: 주 1회', grade: '예: Maitland III', dose: '예: 30초 × 3세트' };
  function dget(c, k) { return ((c.dose || {})[k] || {}); }
  function numOf(t) { var m = String(t || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)(?:\s*[~–-]\s*(\d+(?:\.\d+)?))?/); if (!m) return null; return m[2] ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : parseFloat(m[1]); }
  function perWeek(t) { t = String(t || ''); if (/매일|daily|every ?day/i.test(t)) return 7; var m = t.match(/주\s*(\d+(?:\s*[~–-]\s*\d+)?)\s*(회|번|일)/) || t.match(/(\d+(?:\s*[~–-]\s*\d+)?)\s*(times|x|회)\s*(\/|per|a)\s*week/i); if (m) return numOf(m[1]); var d = t.match(/하루\s*(\d+)\s*(회|번)/); if (d) return 7 * numOf(d[1]); return null; }
  function minutesOf(t) { t = String(t || ''); var n = numOf(t); if (n == null) return null; if (/시간|hour|hr/i.test(t) && !/분|min/i.test(t)) return n * 60; if (/분|min/i.test(t)) return n; return null; }
  function sv(c, k) { var d = dget(c, k); return String(d.stu || '').trim() || String(d.lit || '').trim(); }
  function calcText(c) {
    var fq = sv(c, 'freq') || sv(c, 'count'), pw = perWeek(fq), rn = numOf(sv(c, 'reps') || sv(c, 'trials')), sn = numOf(sv(c, 'sets')), mn = minutesOf(sv(c, 'time')), out = [];
    if (rn != null && pw != null) out.push('주당 약 ' + Math.round(rn * (sn || 1) * pw) + '회 반복');
    if (mn != null && pw != null) out.push('주당 약 ' + Math.round(mn * pw) + '분');
    return out.join(' · ');
  }
  function filledCount(c) {
    var m = FITT_MAP[c.cls] || FITT_MAP['운동치료'], n = 0;
    ['F', 'I', 'T', 'Ty', 'V'].forEach(function (g) { if (m[g].some(function (k) { return sv(c, k); })) n++; });
    if (String(c.prog || '').trim()) n++;
    return n;
  }
  function fittHtml(c, i) {
    var m = FITT_MAP[c.cls] || FITT_MAP['운동치료'];
    var field = function (k, many) {
      var d = dget(c, k), lit = String(d.lit || '').trim();
      return '<label class="wa-ff">' + (many ? '<em>' + esc(FLAB[k] || k) + '</em>' : '') +
        '<input type="text" data-b="cards.' + i + '.dose.' + k + '.stu" value="' + esc(d.stu || '') + '" placeholder="' + esc(FPH[k] || '보고되지 않음/확인 필요') + '">' +
        (d.stuDraft ? '<small class="wa-fsrc">논문 용량 복사 초안 · 조정 필요</small>' : '') +
        (lit ? '<small class="wa-flit">논문: ' + esc(lit) + '</small>' : '') + '</label>';
    };
    var cell = function (letter, en, ko, keys, extra) {
      return '<div class="wa-fc"><div class="wa-fl"><i>' + letter + '</i><span><b>' + en + '</b><small>' + ko + '</small></span></div><div class="wa-fvals">' +
        (keys.length ? keys.map(function (k) { return field(k, keys.length > 1); }).join('') : '<span class="wa-muted">이 분류는 해당 없음</span>') + (extra || '') + '</div></div>';
    };
    var prog = String(c.prog || '').trim();
    return '<div class="wa-fitt" data-ix-own data-fi="' + i + '"><div class="wa-fitt-h"><b>용량 — FITT-VP</b><span class="ix-tag" data-fcount>' + filledCount(c) + '/6 채움</span><span class="wa-muted">' + esc(c.cls || '') + ' · 학생이 제안한 용량을 여기에 바로 적어요</span></div>' +
      '<div class="wa-fitt-g">' +
      cell('F', 'Frequency', '빈도 · 얼마나 자주', m.F) +
      cell('I', 'Intensity', '강도 · 얼마나 세게', m.I) +
      cell('T', 'Time', '시간 · 한 번에 얼마나 오래', m.T) +
      cell('T', 'Type', '종류 · 어떤 운동·기법', m.Ty) +
      cell('V', 'Volume', '총량 · 위를 곱한 전체 양', m.V, '<div class="wa-fcalc" data-fcalc>' + esc(calcText(c)) + '</div>') +
      '<div class="wa-fc"><div class="wa-fl"><i>P</i><span><b>Progression</b><small>진행 · 언제·어떻게 늘리고 줄이나</small></span></div><div class="wa-fvals">' +
      (prog ? '<div class="wa-fprog">' + esc(prog) + '</div>' : '<span class="wa-muted">미입력</span>') + '<small class="wa-fsrc">아래 ⑤ 진행·감량 기준에서 고쳐요</small></div></div>' +
      '</div></div>';
  }
  function ensureFitt() {
    if (typeof window.ptIxState !== 'function') return;
    var S = window.ptIxState(); if (!S || !S.cards) return;
    $$('#ptIx .ix-pane[data-pane="3"] details.ix-card[data-ci]').forEach(function (card) {
      var i = +card.getAttribute('data-ci'), c = S.cards[i]; if (!c) return;
      var tw = card.querySelector('.ix-dose2'); tw = tw && tw.closest('.ix-tw'); if (!tw) return;
      /* 원래 용량 표(제목·표·아래 안내)는 숨김 — 지우지 않음 */
      var head = tw.previousElementSibling, note = tw.nextElementSibling;
      [tw, head && head.classList.contains('ix-sec') ? head : null, note && note.classList.contains('ix-mini') ? note : null].forEach(function (e) { if (e) e.classList.add('wa-dose-hide'); });
      var old = card.querySelector('.wa-fitt');
      if (old && old.contains(document.activeElement)) return; /* 적는 중에는 다시 그리지 않음 */
      var html = fittHtml(c, i), sig = html.length + ':' + html.slice(-400) + html.slice(0, 400);
      if (old && old.getAttribute('data-h') === sig) return;
      var w = document.createElement('div'); w.innerHTML = html; var el = w.firstChild; el.setAttribute('data-h', sig);
      if (old) old.replaceWith(el); else (note && note.classList.contains('ix-mini') ? note : tw).insertAdjacentElement('afterend', el);
    });
  }
  /* 적는 동안: 칸은 그대로 두고 '채움 수'와 '주당 양'만 바로 바꿈 */
  document.addEventListener('input', function (e) {
    var box = e.target.closest && e.target.closest('.wa-fitt'); if (!box) return;
    setTimeout(function () {
      try {
        var c = window.ptIxState().cards[+box.getAttribute('data-fi')]; if (!c) return;
        var t = box.querySelector('[data-fcount]'); if (t) t.textContent = filledCount(c) + '/6 채움';
        var v = box.querySelector('[data-fcalc]'); if (v) v.textContent = calcText(c);
      } catch (x) { }
    }, 0);
  });

  /* 환자가 바뀌거나 화면이 다시 그려져도 계속 붙어 있게 */
  var lastCur = null, lastSig = '';
  setInterval(function () {
    ensurePanel(); ensureNeuro(); try { cleanOldSim(); } catch (e) { } try { ensureFitt(); } catch (e) { console.warn('[addons] fitt', e); }
    var c = null; try { c = sessionStorage.getItem('ggobugi_web_cur'); } catch (e) { }
    /* 환자가 바뀌었거나 기록지 값(감각·반사·근력)이 늦게 채워지면 표를 다시 그림 — 입력 중일 때는 건드리지 않음 */
    var sig = ''; try { sig = JSON.stringify(initNeuro().map(function (r) { return r.init + '|' + r.note; })); } catch (e) { }
    var typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#waNeuro');
    if ((c !== lastCur || sig !== lastSig) && !typing) { lastCur = c; lastSig = sig; refreshNeuro(); }
  }, 1200);
  ensurePanel(); ensureNeuro();
})();
