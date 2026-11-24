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

  /* 환자가 바뀌거나 화면이 다시 그려져도 계속 붙어 있게 */
  var lastCur = null, lastSig = '';
  setInterval(function () {
    ensurePanel(); ensureNeuro();
    var c = null; try { c = sessionStorage.getItem('ggobugi_web_cur'); } catch (e) { }
    /* 환자가 바뀌었거나 기록지 값(감각·반사·근력)이 늦게 채워지면 표를 다시 그림 — 입력 중일 때는 건드리지 않음 */
    var sig = ''; try { sig = JSON.stringify(initNeuro().map(function (r) { return r.init + '|' + r.note; })); } catch (e) { }
    var typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#waNeuro');
    if ((c !== lastCur || sig !== lastSig) && !typing) { lastCur = c; lastSig = sig; refreshNeuro(); }
  }, 1200);
  ensurePanel(); ensureNeuro();
})();
