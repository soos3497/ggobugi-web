/* 꼬북이 — 랜덤 가상환자 만들기
   - 나이·성별·직업·질환·심한 정도·발병 시기·아픈 쪽·기타사항을 고르거나(빈칸은 랜덤) 정하면
     질환별 '환자 유형 틀'로 기록지 전체를 채운다.
   - 기록지의 칸·문구는 바꾸지 않고, 기록지에 들어 있는 입력 함수(_setVal 등)로 '값만' 넣는다.
   - 뇌졸중·척수손상은 기록지의 예시 환자를 바탕으로 이름·나이·성별·직업만 바꾼다. */
(function () {
  'use strict';
  var rnd = Math.random;
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function rint(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function rf(a, b, d) { var p = Math.pow(10, d == null ? 1 : d); return Math.round((a + rnd() * (b - a)) * p) / p; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------------- 고르는 항목 ---------------- */
  var SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍'];
  var MALE = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '준서', '건우', '현우', '우진', '성민', '재훈', '동현', '상철', '영수', '정호', '태식', '병철'];
  var FEMALE = ['서연', '서윤', '지우', '하은', '민서', '지유', '윤서', '채원', '수아', '지민', '은영', '미경', '영희', '순자', '정숙', '혜진', '수정', '경희', '소영', '나연'];
  var JOBS = [
    { t: '대학생', sit: '8시간 이상', ex: '주 1–2회', ctx: '과제·노트북·스마트폰 사용', lift: false },
    { t: '사무직', sit: '8시간 이상', ex: '거의 안 함', ctx: '컴퓨터 업무', lift: false },
    { t: '프로그래머', sit: '8시간 이상', ex: '거의 안 함', ctx: '장시간 코딩', lift: false },
    { t: '간호사', sit: '2시간 미만', ex: '주 1–2회', ctx: '교대 근무와 환자 이동 보조', lift: true },
    { t: '택배 기사', sit: '4–6시간', ex: '거의 안 함', ctx: '물건 들고 나르기와 운전', lift: true },
    { t: '요리사', sit: '2시간 미만', ex: '거의 안 함', ctx: '오래 서서 일하기', lift: true },
    { t: '건설 노동자', sit: '2시간 미만', ex: '거의 안 함', ctx: '무거운 자재 운반', lift: true },
    { t: '교사', sit: '2–4시간', ex: '주 1–2회', ctx: '판서와 오래 서 있기', lift: false },
    { t: '주부', sit: '2–4시간', ex: '주 1–2회', ctx: '집안일과 아이 돌보기', lift: true },
    { t: '미용사', sit: '2시간 미만', ex: '거의 안 함', ctx: '팔을 든 채 오래 서서 일하기', lift: false },
    { t: '버스 기사', sit: '8시간 이상', ex: '거의 안 함', ctx: '장시간 운전', lift: false },
    { t: '운동선수', sit: '2–4시간', ex: '주 5회 이상', ctx: '고강도 훈련', lift: true },
    { t: '농업', sit: '2시간 미만', ex: '거의 안 함', ctx: '쪼그려 앉아 일하기와 들기', lift: true },
    { t: '은퇴(무직)', sit: '4–6시간', ex: '주 1–2회', ctx: 'TV 시청과 가벼운 집안일', lift: false }
  ];
  var EXTRAS = [['htn', '고혈압'], ['dm', '당뇨'], ['smoke', '흡연'], ['obese', '과체중'], ['sedentary', '운동 부족'], ['active', '규칙적 운동'], ['sleep', '수면 부족'], ['mood', '불안·우울감'], ['surg', '과거 수술']];
  var SEV = [['1', '경도'], ['2', '중등도'], ['3', '중증']];
  var DUR = [['acute', '급성(며칠 전)'], ['sub', '아급성(몇 주 전)'], ['chronic', '만성(몇 달 이상)']];
  var SIDE = [['R', '오른쪽'], ['L', '왼쪽']];
  var CONDS = {
    neck: { t: '목 통증·전방머리자세', age: [18, 48], dx: '목 통증 및 전방머리자세', code: 'M54.2', dept: '재활의학과' },
    lbp: { t: '허리 통증(비특이적)', age: [22, 62], dx: '비특이적 허리 통증', code: 'M54.5', dept: '재활의학과' },
    shoulder: { t: '어깨 통증(회전근개 힘줄병증)', age: [38, 68], dx: '어깨 충돌 증후군(회전근개 힘줄병증)', code: 'M75.4', dept: '정형외과' },
    knee: { t: '무릎 골관절염', age: [55, 80], dx: '무릎 골관절염', code: 'M17.1', dept: '정형외과' },
    ankle: { t: '발목 가쪽 인대 염좌', age: [16, 38], dx: '발목 가쪽 인대 염좌', code: 'S93.4', dept: '정형외과' },
    stroke: { t: '뇌졸중 후 편마비(예시 환자 기반)', age: [45, 80], scenario: 'stroke' },
    sci: { t: '불완전 척수손상(예시 환자 기반)', age: [20, 60], scenario: 'sci' }
  };

  /* 빈칸은 랜덤으로 채워 완성된 환자 정보 만들기 */
  function resolve(p) {
    p = Object.assign({}, p || {});
    if (!p.cond || !CONDS[p.cond]) p.cond = pick(Object.keys(CONDS));
    var C = CONDS[p.cond];
    if (!p.sex) p.sex = pick(['남성', '여성']);
    if (!p.age) p.age = rint(C.age[0], C.age[1]);
    p.age = clamp(parseInt(p.age, 10) || C.age[0], 10, 95);
    if (!p.job) { var pool = JOBS.filter(function (j) { if (p.sex === '남성' && j.t === '주부') return false; return p.age >= 62 ? /은퇴|주부|농업/.test(j.t) : p.age <= 24 ? /대학생|운동선수/.test(j.t) || rnd() < 0.2 : !/대학생|은퇴/.test(j.t); }); p.job = pick(pool.length ? pool : JOBS).t; }
    if (!p.sev) p.sev = pick(['1', '2', '2', '3']);
    if (!p.dur) p.dur = p.cond === 'ankle' ? pick(['acute', 'sub']) : p.cond === 'knee' ? 'chronic' : pick(['acute', 'sub', 'chronic', 'chronic']);
    if (!p.side) p.side = pick(['R', 'L']);
    if (!p.extras) p.extras = EXTRAS.filter(function () { return rnd() < 0.18; }).map(function (x) { return x[0]; });
    if (p.extras.indexOf('active') >= 0 && p.extras.indexOf('sedentary') >= 0) p.extras.splice(p.extras.indexOf('sedentary'), 1);
    if (!p.name) p.name = pick(SUR) + pick(p.sex === '여성' ? FEMALE : MALE) + '(가상)';
    else if (!/가상/.test(p.name)) p.name = p.name + '(가상)';
    p.condLabel = C.t;
    return p;
  }
  function label(p) {
    var C = CONDS[p.cond] || {}, s = (SEV.filter(function (x) { return x[0] === p.sev; })[0] || [0, ''])[1];
    return (C.t || '') + (C.scenario ? '' : ' · ' + s + ' · ' + (p.side === 'L' ? '왼쪽' : '오른쪽'));
  }

  /* ---------------- 기록지 입력 도우미 (기록지 함수 그대로 사용) ---------------- */
  function V(n, v, i) { if (v == null) return; try { _setVal(n, v, i); } catch (e) { } }
  function RA(n, v) { try { _setRadio(n, v); } catch (e) { } }
  function CH(n, a) { try { _setChecks(n, a); } catch (e) { } }
  function rows(id) { return [].slice.call(document.querySelectorAll('#' + id + ' tbody tr')); }
  function selR(tr, n, v, i) { try { _setSelectInRow(tr, n, v, i); } catch (e) { } }
  function inR(tr, n, v) { try { _setInputInRow(tr, n, v); } catch (e) { } }
  function fire(el) { if (!el) return; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }

  var ROM_N = [50, 60, 45, 80, 45, 60, 25, 25, 180, 60, 180, 30, 70, 90, 145, 0, 80, 80, 80, 70, 20, 30, 120, 20, 45, 30, 45, 45, 135, 0, 20, 50, 35, 15];
  var SPINE_BOTH = [0, 1, 5, 6]; /* 굽힘·폄은 좌우 같은 값 */

  function resetAll() {
    if (typeof setMMTRows === 'function' && typeof FHP_MMT_ROWS !== 'undefined') setMMTRows(FHP_MMT_ROWS);
    [].forEach.call(document.querySelectorAll('main input, main select, main textarea'), function (e) {
      if (e.closest('[data-ix-own]')) return;
      if (e.type === 'checkbox' || e.type === 'radio') e.checked = false; else if (!e.readOnly && e.type !== 'button') e.value = '';
    });
    /* clearSpecialSelections 는 특수검사 이름까지 비우므로 먼저 하고, 그다음 특수검사 표를 기본 목록으로 다시 만듦 */
    if (typeof clearSpecialSelections === 'function') try { clearSpecialSelections(); } catch (e) { }
    if (typeof resetSpecialTable === 'function') resetSpecialTable();
  }
  function normals(p) {
    /* 레드플래그 22문항 '아니요' */
    var rfn = {}; [].forEach.call(document.querySelectorAll('main input[type=radio][name^="rf_"]'), function (r) { if (/^rf_(ces|fx|ca|inf|cv)\d+$/.test(r.name)) rfn[r.name] = 1; });
    Object.keys(rfn).forEach(function (n) { RA(n, '아니요'); });
    CH('safety', ['해당 없음']); CH('neuro', ['해당 없음']); V('neuro_detail', '없음.');
    CH('record_check', ['의학적 정보 확인', '가상환자 식별 확인', '평가 제한 확인']);
    rows('systemsTable').forEach(function (tr) { selR(tr, 'system_status', '특이사항 없음'); inR(tr, 'system_note', '문진 및 관찰상 관련 특이 증상 없음.'); });
    var old = p.age >= 60, htn = p.extras.indexOf('htn') >= 0;
    V('bp', htn ? rint(136, 148) + '/' + rint(86, 94) : (old ? rint(122, 134) : rint(108, 124)) + '/' + rint(68, 82));
    V('hr', rint(62, 84)); V('rr', rint(12, 18)); V('spo2', rint(96, 99)); V('temp', rf(36.3, 36.9)); V('edema', '없음');
    V('vital_status', htn ? '주의/재측정' : '특이사항 없음');
    rows('posture').forEach(function (tr) { selR(tr, 'posture_grade', '0'); selR(tr, 'posture_dir', '해당없음'); inR(tr, 'posture_note', '정면·측면 관찰상 큰 편위 없음'); });
    rows('romTable').forEach(function (tr, i) {
      var n = ROM_N[i] || 0, a = n ? n - rint(0, 4) : 0, b = n ? Math.max(a, n - rint(0, 2)) + rint(1, 3) : 0;
      if (SPINE_BOTH.indexOf(i) >= 0) { inR2(tr, a, b, a, b); } else inR2(tr, a, b, n ? n - rint(0, 4) : 0, b);
      selR(tr, 'rom_pain', '없음'); inR(tr, 'rom_note', '기능적 범위, 통증 없음');
    });
    rows('mmtTable').forEach(function (tr) { selR(tr, 'mmt_grade', '5', 0); selR(tr, 'mmt_grade', '5', 1); selR(tr, 'mmt_comp', '없음'); inR(tr, 'mmt_note', '좌우 기능적 대칭, 통증 없음'); });
    rows('muscleLength').forEach(function (tr) { selR(tr, 'ml_result', '정상', 0); selR(tr, 'ml_result', '정상', 1); selR(tr, 'ml_comp', '없음'); inR(tr, 'ml_note', '좌우 정상 범위'); });
    rows('jointPlay').forEach(function (tr) { selR(tr, 'jp_result', '정상', 0); selR(tr, 'jp_result', '정상', 1); selR(tr, 'jp_symptom', '없음'); inR(tr, 'jp_note', '정상 가동성, 증상 없음'); });
    rows('sensoryTable').forEach(function (tr) { [].forEach.call(tr.querySelectorAll('select[name="sens_grade"]'), function (s) { s.value = '2'; }); inR(tr, 'sens_note', '좌우 대칭, 정상'); });
    rows('dermatomeTable').forEach(function (tr) { [].forEach.call(tr.querySelectorAll('select[name="sens_grade"]'), function (s) { s.value = '2'; }); inR(tr, 'derm_note', '좌우 대칭'); });
    rows('dtrTable').forEach(function (tr) { [].forEach.call(tr.querySelectorAll('select[name="dtr_grade"]'), function (s) { s.value = '2+'; }); selR(tr, 'dtr_sym', '대칭'); inR(tr, 'dtr_note', '2+ 대칭'); });
    rows('pathTable').forEach(function (tr) { [].forEach.call(tr.querySelectorAll('select[name="pn_result"]'), function (s) { s.value = 'Negative'; }); selR(tr, 'path_grade', 'Negative'); inR(tr, 'path_note', '병적 반응 없음'); });
    rows('specialTable').forEach(function (tr) { selR(tr, 'spec_side', '양측'); selR(tr, 'pn_result', 'NT'); selR(tr, 'spec_concord', '없음'); inR(tr, 'spec_note', '이 환자에서 적응증 낮아 미검'); });
    rows('balanceTable').forEach(function (tr, i) { selR(tr, 'bal_grade', '4'); inR(tr, 'bal_cond', ['60초 독립 안정', '전방/측방 reach 독립', '눈뜸·감음 30초 유지', '방향 전환·이중과제 독립', '30초 유지', '양측 30초 이상'][i] || ''); inR(tr, 'bal_note', '독립 수행'); });
    rows('functionTable').forEach(function (tr) { selR(tr, 'func_grade', 'I'); inR(tr, 'func_device', '없음'); inR(tr, 'func_note', '독립 수행, 신체적 도움 불필요'); });
    gait(p, { speed: old ? rf(1.05, 1.2, 2) : rf(1.2, 1.4, 2) });
    V('berg', 56); V('tug', old ? rf(8, 9.5) : rf(6.2, 7.8)); V('reach', old ? rf(26, 31) : rf(31, 37)); V('minibest', old ? 25 : 28);
  }
  function inR2(tr, la, lp, ra, rp) { inR(tr, 'rom_l_arom', la); inR(tr, 'rom_l_prom', lp); inR(tr, 'rom_r_arom', ra); inR(tr, 'rom_r_prom', rp); }
  /* ROM: 아픈 쪽(또는 양쪽)을 정상의 frac 만큼 줄임 */
  function rom(i, frac, pain, note, both) {
    var tr = rows('romTable')[i]; if (!tr) return;
    var n = ROM_N[i], sideA = P.side;
    var dA = Math.round(n * (1 - frac)) - rint(0, 3), dP = Math.min(n, dA + rint(4, 8));
    var nA = n - rint(0, 4), nP = Math.min(n + 2, nA + rint(2, 4));
    if (both || SPINE_BOTH.indexOf(i) >= 0) inR2(tr, dA, dP, dA, dP);
    else if (sideA === 'L') inR2(tr, dA, dP, nA, nP); else inR2(tr, nA, nP, dA, dP);
    selR(tr, 'rom_pain', pain === 'S' ? sideA : pain || '없음'); inR(tr, 'rom_note', note || '');
    return { a: dA, n: nA };
  }
  function mmtT(term, g, comp, note, both) {
    var tr = (typeof _findRow === 'function' && _findRow('mmtTable', term)) || rows('mmtTable').filter(function (r) { return r.innerText.indexOf(term) >= 0; })[0]; if (!tr) return;
    var L = both || P.side === 'L' ? g : '5', R = both || P.side === 'R' ? g : '5';
    selR(tr, 'mmt_grade', L, 0); selR(tr, 'mmt_grade', R, 1); selR(tr, 'mmt_comp', comp || '없음'); inR(tr, 'mmt_note', note || '');
  }
  function ml(i, note, both) { var tr = rows('muscleLength')[i]; if (!tr) return; selR(tr, 'ml_result', both || P.side === 'L' ? '단축' : '정상', 0); selR(tr, 'ml_result', both || P.side === 'R' ? '단축' : '정상', 1); selR(tr, 'ml_comp', '보상'); inR(tr, 'ml_note', note); }
  function jp(i, sym, note, both) { var tr = rows('jointPlay')[i]; if (!tr) return; selR(tr, 'jp_result', both || P.side === 'L' ? '저가동성' : '정상', 0); selR(tr, 'jp_result', both || P.side === 'R' ? '저가동성' : '정상', 1); selR(tr, 'jp_symptom', sym || '없음'); inR(tr, 'jp_note', note); }
  function post(i, g, dir, note) { var tr = rows('posture')[i]; if (!tr) return; selR(tr, 'posture_grade', String(g)); selR(tr, 'posture_dir', dir); inR(tr, 'posture_note', note); }
  function spec(name, res, con, note, nth) {
    var list = rows('specialTable').filter(function (tr) { var s = tr.querySelector('select[name="spec_name"]'); return s && s.value.indexOf(name) >= 0; });
    var tr = list[nth || 0]; if (!tr) return;
    selR(tr, 'spec_side', res === 'NT' ? '양측' : P.side); selR(tr, 'pn_result', res); selR(tr, 'spec_concord', con || '없음'); inR(tr, 'spec_note', note);
  }
  function bal(i, g, cond, note) { var tr = rows('balanceTable')[i]; if (!tr) return; selR(tr, 'bal_grade', String(g)); inR(tr, 'bal_cond', cond); inR(tr, 'bal_note', note); }
  function func(term, g, dev, note) { var tr = (typeof _findRow === 'function' && _findRow('functionTable', term)) || rows('functionTable').filter(function (r) { return r.innerText.indexOf(term) >= 0; })[0]; if (!tr) return; selR(tr, 'func_grade', g); inR(tr, 'func_device', dev || '없음'); inR(tr, 'func_note', note); }
  function gait(p, o) {
    var sp = o.speed, cad = Math.round(sp * 60 / 0.65 * (o.short ? 0.95 : 1)), step = Math.round(sp / cad * 6000);
    var sA = o.asym ? Math.round(step * 0.88) : step, sN = step;
    var L = p.side === 'L' ? sA : sN, R = p.side === 'R' ? sA : sN;
    var vals = [o.aid || '없음', o.assist || '독립', o.dist || '500 m 이상', sp + ' m/s', cad + ' steps/min', L + ' cm', R + ' cm', (L + R) + ' cm', rint(8, 11) + ' cm', o.asym ? (p.side === 'L' ? 'L 57% / R 63%' : 'L 63% / R 57%') : 'L 60% / R 60%', o.asym ? (p.side === 'L' ? 'L 43% / R 37%' : 'L 37% / R 43%') : 'L 40% / R 40%', o.asym ? '비대칭' : '대칭', 'heel strike', '정상', o.trunk || '정상', o.dev || '없음'];
    rows('gaitTable').forEach(function (tr, i) { if (i < vals.length) { inR(tr, 'gait_value', vals[i]); selR(tr, 'gait_status', o.asym && (i === 11 || i === 15) ? '비정상' : '정상'); inR(tr, 'gait_note', i === 15 && o.dev ? o.devNote || '' : '일상 보행에서 기능적 범위.'); } });
    if (typeof setAbnormalGaitAuto === 'function') { if (o.abn) setAbnormalGaitAuto(true, o.abn, o.abnStatus || '주의', o.abnNote || ''); else setAbnormalGaitAuto(false, '', '정상', ''); }
  }
  function mpi(level, mood) {
    var base = [[1, 1, 1, 1, 1, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1], [3, 3, 2, 3, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 3, 2], [4, 5, 4, 4, 4, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]][level - 1];
    var sels = [].slice.call(document.querySelectorAll('#mpiAdapted select[name="mpi_adapt_score"]'));
    sels.forEach(function (s, i) { var v = (base[i] == null ? 2 : base[i]) + (mood && i >= 9 && i <= 12 ? 2 : 0) + rint(-1, 1); s.value = String(clamp(v, 0, 6)); fire(s); });
  }
  function ndi(target) {
    var sels = [].slice.call(document.querySelectorAll('#ndi select[name="ndi_score"]')), w = [1.3, 0.8, 0.9, 1.4, 1.0, 0.9, 1.2, 0.8, 1.1, 1.0];
    var left = target; sels.forEach(function (s, i) { var v = clamp(Math.round(target / 10 * w[i] + rint(-1, 1) * 0.6), 0, 5); s.value = String(v); });
    var sum = sels.reduce(function (a, s) { return a + (+s.value || 0); }, 0), k = 0;
    while (sum !== target && k < 40) { var s2 = sels[rint(0, sels.length - 1)], v2 = +s2.value; if (sum < target && v2 < 5) { s2.value = String(v2 + 1); sum++; } else if (sum > target && v2 > 0) { s2.value = String(v2 - 1); sum--; } k++; }
    sels.forEach(fire);
  }
  function SS(t) { return t.replace(/\{S\}/g, P.side === 'L' ? '좌' : '우').replace(/\{O\}/g, P.side === 'L' ? '우' : '좌'); }

  /* ---------------- 공통 병력(나이·직업·기타사항 반영) ---------------- */
  var P = null;
  function common(p, C, o) {
    var job = JOBS.filter(function (j) { return j.t === p.job; })[0] || { t: p.job, sit: '4–6시간', ex: '주 1–2회', ctx: '일상 업무', lift: false };
    var ex = p.extras, has = function (k) { return ex.indexOf(k) >= 0; };
    var today = new Date(), ord = new Date(today.getTime() - rint(2, 7) * 864e5);
    var phys = pick(SUR) + pick(rnd() < 0.5 ? MALE : FEMALE) + '(가상)';
    V('ref_physician', phys); V('ref_department', C.dept); V('ref_order_date', ymd(ord)); V('ref_medical_dx', C.dx); V('ref_dx_code', C.code);
    V('ref_surgery', has('surg') ? o.surgery || '과거 수술 이력 있음(현재 증상과 직접 관련 낮음)' : '해당 없음');
    V('ref_wb', o.wb || '제한 없음 / WBAT'); V('ref_orthosis', o.orthosis || '현재 사용 없음');
    V('ref_precautions', (has('htn') ? '고혈압 — 운동 전후 혈압 확인. ' : '') + (has('dm') ? '당뇨 — 저혈당 증상 주의, 발 감각 확인. ' : '') + (o.precaution || '현재 의학적 금기사항 없음.'));
    V('name', p.name); V('age', p.age); V('sex', p.sex); V('job', p.job);
    V('dob', (today.getFullYear() - p.age) + '-' + pad(rint(1, 12)) + '-' + pad(rint(1, 28))); V('date', ymd(today));
    V('sign_pt', pick(SUR) + pick(rnd() < 0.5 ? MALE : FEMALE) + '(가상)'); V('sign_lic', '가상-PT-' + pad(rint(1, 99)) + rint(0, 9)); V('sign_dt', ymd(today) + ' ' + pad(rint(9, 17)) + ':' + pick(['00', '30']));
    V('sign_dr', phys); V('sign_emr', p.age + '세 ' + p.sex + ' ' + p.job + ' · ' + C.dx + ' · ' + label(p));
    var hist = ['해당 없음'], htxt = [];
    if (has('surg')) { hist = ['수술 경험']; htxt.push(o.surgery || '과거 수술 이력 있음.'); }
    if (o.histItems) { hist = hist.filter(function (x) { return x !== '해당 없음'; }).concat(o.histItems); if (o.histText) htxt.push(o.histText); }
    CH('history_item', hist.length ? hist : ['해당 없음']); V('history', htxt.length ? htxt.join(' ') : '특이 과거력 없음.');
    var meds = []; if (has('htn')) meds.push('고혈압약 복용 중'); if (has('dm')) meds.push('당뇨약(경구 혈당강하제) 복용 중'); if (o.med) meds.push(o.med);
    RA('med', meds.length ? '있음' : '없음'); RA('allergy', '없음'); V('med_detail', meds.length ? meds.join(', ') + '. 약물 알레르기 없음.' : '정기 복용약 없음. 약물 알레르기 없음.');
    V('sitting', job.sit); V('exercise', has('active') ? '주 3–4회' : has('sedentary') ? '거의 안 함' : job.ex); V('sleep', has('sleep') ? '5시간 미만' : pick(['6–7시간', '7–8시간']));
    var life = []; if (has('smoke')) life.push('흡연 하루 반 갑~한 갑'); if (has('obese')) life.push('과체중(BMI 약 ' + rf(26.5, 30.5) + ')'); if (has('sleep')) life.push('수면 시간 부족'); if (has('active')) life.push('주 3~4회 규칙적으로 운동'); if (has('sedentary')) life.push('규칙적인 운동 거의 없음');
    V('lifestyle_detail', life.length ? life.join(', ') + '.' : '특이사항 없음.');
    V('additional', job.t + ' — ' + job.ctx + '이(가) 일상의 대부분임.' + (has('mood') ? ' 통증이 오래가면서 불안하고 기분이 가라앉는 날이 늘었다고 함.' : '') + (o.additional ? ' ' + o.additional : ''));
    return job;
  }
  function durOnset(p, acuteCtx) {
    var map = { acute: ['며칠 전', '갑자기 시작'], sub: ['몇 주 전', pick(['서서히 시작', '갑자기 시작'])], chronic: [pick(['몇 달 전', '1년 이상']), pick(['서서히 시작', '반복적으로 발생'])] }[p.dur];
    RA('onset_time', map[0]); RA('onset_mode', map[1]);
    return map;
  }
  function pain(sev) { var now = [rint(2, 3), rint(4, 5), rint(6, 7)][sev - 1]; return { now: now, worst: clamp(now + rint(2, 3), 0, 10) }; }

  /* ---------------- 질환별 틀 ---------------- */
  var FILL = {};
  FILL.neck = function (p, sev) {
    var C = CONDS.neck, job = common(p, C, {}), pn = pain(sev), on = durOnset(p);
    CH('main_feature', ['통증', '뻐근함 / 결림'].concat(sev >= 2 ? ['관절 움직임 제한'] : []).concat(['일상생활 불편']));
    V('main_symptom', SS('목 뒤쪽과 {S}측 목-어깨의 뻐근한 통증이 가장 불편함. ' + job.ctx + '을(를) 오래 하면 심해지고, 평소 NRS ' + pn.now + '/10, 심할 때 ' + pn.worst + '/10.'));
    CH('onset_context', [p.dur === 'acute' ? pick(['오래 앉거나 같은 자세 후', '특별한 원인 없음']) : '오래 앉거나 같은 자세 후']);
    V('onset_detail', on[0] + ' ' + on[1].replace('시작', '시작됨') + '. ' + job.ctx + ' 시간이 길어지면서 목·어깨 불편감이 생김.');
    CH('provocation', ['오래 앉기', '목 움직이기'].concat(sev === 3 ? ['수면 / 누운 자세'] : []));
    V('provocation_detail', SS('같은 자세로 40~60분 이상 지속하면 {S}측 후목과 어깨 위쪽이 뻐근해짐. 고개를 {S}측으로 돌리거나 위를 볼 때 당김이 재현됨.'));
    CH('palliation', ['휴식', '자세 변경', '온찜질', '스트레칭']); V('palliation_detail', '자세를 바로 하고 가볍게 스트레칭하거나 온찜질하면 일시적으로 편해짐.');
    CH('quality', ['뻐근하고 묵직함', '당김 / 조임']); V('quality_detail', '저림·전기 오는 느낌은 없음.');
    CH('region', ['목', '어깨'].concat(sev >= 2 ? ['등'] : [])); RA('radiation', '아니오'); V('radiation_detail', '팔·손으로 퍼지는 증상 없음.');
    RA('nowpain', String(pn.now)); RA('worstpain', String(pn.worst));
    RA('time_pattern', ['특정 활동에서만 나타남', '간헐적으로 나타남', '계속 지속됨'][sev - 1]); CH('time_worse', ['저녁', '활동 후']);
    V('episode_duration', ['수십 분', '1~3시간', '수시간 이상'][sev - 1]); V('symptom_trend', pick(['비슷하게 유지', '좋아졌다 나빠졌다 반복']));
    V('time_detail', '오후·저녁에 심하고, 화면 사용이 적은 날은 덜함. 야간통은 ' + (sev === 3 ? '돌아누울 때 가끔 있음.' : '없음.'));
    CH('function', ['업무 / 학업'].concat(sev >= 2 ? ['수면'] : []).concat(sev === 3 ? ['운전'] : [])); V('function_detail', job.ctx + '을(를) 30~60분 이상 이어서 하기 어려움.');
    CH('goal', ['통증 감소', '자세 개선', '관절 움직임 개선', '직장/학업 복귀']); V('goal_detail', '목 통증 없이 ' + job.ctx + '을(를) 2시간 정도 이어서 하고 싶음.');
    post(0, sev, '전방', 'CVA 감소, 머리 전방 이동과 위쪽 목뼈 폄 보상.'); post(1, 1, P.side === 'L' ? '좌' : '우', SS('{S}측 어깨가 약간 높고 위등세모근 긴장.')); post(2, 2, '양측', '양측 어깨뼈 내밈.'); if (sev >= 2) post(3, 2, '후방', '앉은 자세에서 등뼈 뒤굽음 증가.'); post(9, sev >= 2 ? 2 : 1, '전방', '앉은 자세에서 골반 뒤기울임-등뼈 뒤굽음-전방머리자세 연쇄.');
    var fr = [0.12, 0.22, 0.32][sev - 1];
    rom(0, fr * 0.5, '없음', '말기 후목 당김.'); rom(1, fr, '양측', '말기 후목 국소 통증, 방사 없음.'); var r2 = rom(2, fr, 'S', SS('{S}측 가쪽굽힘에서 위등세모근 당김.')); var r3 = rom(3, fr, 'S', SS('{S}측 돌림이 반대쪽보다 감소하며 평소 목 불편감 재현.')); rom(4, fr * 0.8, 'S', '등뼈 돌림 감소, 어깨뼈 사이 뻣뻣함.');
    var g = sev === 3 ? '4' : '4';
    mmtT('목뼈 굽힘근', g, '보상', '저항 증가 시 목빗근·목갈비근 보상.', true); mmtT('목뼈 폄근', sev === 1 ? '5' : '4', '보상', '위쪽 목뼈 폄 보상.', true); mmtT('중부 등세모근', '4', '보상', SS('{S}측에서 위등세모근 보상.')); mmtT('하부 등세모근', '4', '보상', SS('{S}측 어깨뼈 내밈 보상.')); mmtT('앞톱니근', sev >= 2 ? '4' : '5', '보상', '반복 시 날개어깨뼈 경향.');
    ml(0, SS('{S}측 위등세모근 단축·압통.')); ml(1, SS('{S}측 어깨올림근 단축.')); ml(4, '작은가슴근 단축, 어깨뼈 앞기울임.', true);
    jp(0, '증상 재현', '중앙 후방-전방 활주에서 뻣뻣함과 국소 통증.', true); jp(1, '증상 재현', SS('{S}측 편측 활주에서 익숙한 통증 재현.')); jp(3, '없음', '등뼈 분절 저가동성.', true);
    spec('Spurling', 'Negative', '없음', '팔 방사통·저림 재현 없음.'); spec('Cervical distraction', 'Negative', '없음', '팔 신경 증상 변화 없음.'); spec('ULTT', 'Negative', '없음', '신경 긴장 반응 좌우 대칭.');
    spec('Flexion-Rotation', sev >= 2 ? 'Positive' : 'Negative', sev >= 2 ? '있음' : '없음', sev >= 2 ? SS('{S}측 FRT 감소, 위쪽 목뼈 뻣뻣함 재현.') : '좌우 차이 작음.'); spec('Scapular correction', 'Positive', '있음', '어깨뼈 위치를 보조하면 목 돌림 증가·통증 감소.');
    var cva = [rf(47, 49.5), rf(44, 46.5), rf(40.5, 43.5)][sev - 1];
    V('cva_trial1', rf(cva - 0.6, cva + 0.6)); V('cva_trial2', rf(cva - 0.6, cva + 0.6)); V('cva_trial3', rf(cva - 0.6, cva + 0.6)); V('cva_mean', cva);
    V('occiput_wall', [rf(2.5, 3.5), rf(3.8, 4.8), rf(5, 6.5)][sev - 1]); V('forward_head_distance', [rf(2.5, 3.5), rf(3.6, 4.6), rf(4.8, 6)][sev - 1]);
    V('ccft_activation', [28, 26, 24][sev - 1]); V('ccft_perf_level', [26, 24, 22][sev - 1]); V('ccft_reps', [10, 8, 5][sev - 1]); V('dnf_endurance', [rf(30, 36), rf(20, 26), rf(11, 17)][sev - 1]);
    var jl = rf(2.4, 3.4), jr = rf(4.2, 6); V('jpe_left', P.side === 'L' ? jr : jl); V('jpe_right', P.side === 'L' ? jl : jr);
    V('ccft_note', '20 mmHg 기준에서 시작, 상위 단계에서 목빗근 과활성과 턱 들림 보상.');
    V('psfs_study', [7, 5, 3][sev - 1]); V('psfs_phone', [7, 5, 3][sev - 1] + rint(-1, 1)); V('psfs_turn', [8, 6, 4][sev - 1]);
    V('sit_bout', rint(60, 110)); V('screen_drop', rint(12, 24)); V('view_distance', rint(40, 55)); V('phone_hours', rf(2.5, 6));
    ndi([rint(6, 10), rint(14, 20), rint(24, 30)][sev - 1]);
    if (typeof updateQuantDerived === 'function') try { updateQuantDerived(); } catch (e) { }
    V('posture_summary', '전방머리자세와 양측 어깨뼈 내밈, 앉은 자세에서 등뼈 뒤굽음 증가가 관찰됨. CVA 평균 ' + cva + '°.');
    V('rom_summary', SS('목뼈 {S}측 돌림 ' + r3.a + '°로 반대쪽(' + r3.n + '°)보다 감소하고, {S}측 가쪽굽힘에서도 익숙한 당김이 재현됨. 등뼈 돌림도 감소.'));
    V('mmt_summary', '목 굽힘·폄근 근수행력 저하와 표층 근육 보상. 중·하부 등세모근, 앞톱니근의 어깨뼈 조절 저하.');
    V('sensory_summary', '감각·피부절 좌우 대칭 정상.'); V('reflex_summary', '깊은힘줄반사 2+ 대칭.'); V('path_summary', '병적반사 모두 음성.');
    V('special_summary', '신경뿌리 검사 음성으로 신경뿌리병증 가능성 낮음. 어깨뼈 보조 시 증상 감소로 어깨뼈 조절의 영향 시사.');
    V('gait_summary', '독립 보행, 특이 소견 없음.'); V('balance_summary', '정적·동적 균형 독립.'); V('function_exam_summary', '기본 ADL 독립. 제한은 오래 앉아 일하기·화면 사용 지속 시간에서 나타남.');
    V('quant_summary', 'CVA ' + cva + '°, DNF 지구력 저하, CCFT 상위 단계에서 보상. 자세·깊은 목굽힘근 지구력 저하가 주요 문제.');
    V('muscle_length_summary', '위등세모근·어깨올림근·작은가슴근 단축.'); V('joint_play_summary', '목뼈·등뼈 분절 저가동성.');
    V('manual_abnormal', '목뼈 돌림·가쪽굽힘 제한, 전방머리자세(CVA ' + cva + '°), 깊은 목굽힘근 지구력 저하, 어깨뼈 조절 저하.');
    V('manual_meaning', '장시간 같은 자세와 자세 조절 저하가 목 통증을 유지시키는 요인으로 보임. 위험신호·신경뿌리 소견은 없음.');
    gait(p, { speed: p.age >= 60 ? rf(1.05, 1.2, 2) : rf(1.2, 1.4, 2) });
    mpi(sev, p.extras.indexOf('mood') >= 0);
  };
  FILL.lbp = function (p, sev) {
    var C = CONDS.lbp, job = common(p, C, { histItems: p.dur === 'chronic' && rnd() < 0.4 ? ['물리치료 경험'] : null, histText: '과거에도 비슷한 허리 통증이 있었고 물리치료 후 좋아진 적 있음.' }), pn = pain(sev), on = durOnset(p);
    var rad = sev === 3;
    CH('main_feature', ['통증', '뻐근함 / 결림'].concat(sev >= 2 ? ['관절 움직임 제한'] : []).concat(['일상생활 불편']));
    V('main_symptom', SS('허리 아래쪽(' + (rad ? '{S}측 엉덩이까지' : '가운데~{S}측') + ')이 뻐근하고 아픔. ' + (job.lift ? '물건을 들거나 ' : '') + '오래 앉아 있다 일어날 때 심함. NRS ' + pn.now + '/10, 심할 때 ' + pn.worst + '/10.'));
    CH('onset_context', [job.lift ? '운동 중' : '오래 앉거나 같은 자세 후']); V('onset_detail', on[0] + ' ' + (job.lift ? '무거운 물건을 들다가 ' : '오래 앉아 일한 뒤 ') + '허리 통증이 시작됨.');
    CH('provocation', ['오래 앉기', '허리 굽히기'].concat(job.lift ? ['물건 들기'] : []).concat(sev >= 2 ? ['오래 서기'] : []));
    V('provocation_detail', '앞으로 숙이거나 30분 이상 앉아 있으면 심해지고, 앉았다 일어날 때 첫 동작이 아픔.');
    CH('palliation', ['휴식', '자세 변경', '온찜질']); V('palliation_detail', '걷거나 허리를 살짝 펴면 편해짐.');
    CH('quality', ['뻐근하고 묵직함', '쑤심 / 욱신거림']); V('quality_detail', rad ? '엉덩이 쪽으로 묵직한 느낌이 퍼지나 무릎 아래로는 내려가지 않음.' : '다리로 퍼지는 증상 없음.');
    CH('region', ['허리'].concat(rad ? ['엉덩이'] : []).concat(sev >= 2 ? ['골반'] : [])); RA('radiation', rad ? '예' : '아니오'); if (rad) CH('radiation_region', ['엉덩이']); V('radiation_detail', rad ? SS('{S}측 엉덩이까지, 무릎 아래로는 내려가지 않음. 저림 없음.') : '없음.');
    RA('nowpain', String(pn.now)); RA('worstpain', String(pn.worst));
    RA('time_pattern', ['특정 활동에서만 나타남', '간헐적으로 나타남', '계속 지속됨'][sev - 1]); CH('time_worse', ['아침', '활동 후']); V('episode_duration', ['수십 분', '1~3시간', '수시간 이상'][sev - 1]); V('symptom_trend', pick(['비슷하게 유지', '호전되는 중', '좋아졌다 나빠졌다 반복']));
    V('time_detail', '아침에 일어날 때 뻣뻣함 30분 이내, 움직이면 나아짐.');
    CH('function', ['업무 / 학업', '옷 입고 벗기'].concat(sev >= 2 ? ['집안일', '수면'] : [])); V('function_detail', '양말 신기·숙여서 세수하기가 불편함.');
    CH('goal', ['통증 감소', '관절 움직임 개선', '일상생활 회복', '직장/학업 복귀']); V('goal_detail', '허리 걱정 없이 ' + job.ctx + '을(를) 하고 싶음.');
    post(4, 1, '후방', '허리뼈 앞굽음 감소(편평).'); post(5, 1, P.side === 'L' ? '좌' : '우', '골반 경도 비대칭.'); post(9, 1, '전방', '앉은 자세에서 골반 뒤기울임.');
    var fr = [0.15, 0.3, 0.45][sev - 1];
    var lf = rom(5, fr, '양측', '굽힘 말기 허리 통증 재현.'); rom(6, fr * 0.6, sev >= 2 ? '양측' : '없음', '폄은 상대적으로 편함.'); rom(7, fr * 0.6, 'S', SS('{S}측 가쪽굽힘에서 당김.')); rom(22, fr * 0.3, '없음', '엉덩관절 굽힘 경도 제한.', true); rom(26, 0.15, '없음', '안쪽돌림 경도 감소.');
    mmtT('엉덩관절 폄근', '4', '보상', SS('{S}측 볼기근 활성 지연, 뒤넙다리근 보상.')); mmtT('엉덩관절 벌림근', '4', '보상', SS('{S}측 골반 떨어짐 경향.'));
    ml(6, '엉덩허리근 단축.', true); ml(9, '뒤넙다리근 단축.', true);
    spec('Straight Leg Raise', rad ? 'Equivocal' : 'Negative', '없음', rad ? SS('{S}측 약 70°에서 뒤넙다리 당김, 방사통 재현 없음.') : '방사통 재현 없음.'); spec('Slump', 'Negative', '없음', '신경 증상 재현 없음.'); spec('FABER', 'Negative', '없음', '엉덩관절·엉치 통증 재현 없음.'); spec('Thomas', 'Positive', '없음', '엉덩관절 굽힘근 단축.'); spec('Trendelenburg', sev >= 2 ? 'Equivocal' : 'Negative', '없음', SS('{S}측 서기에서 골반 경도 떨어짐.'));
    if (sev === 3) { func('Sit ↔ Stand', 'Mod I', '없음', '손으로 짚고 천천히 일어남.'); func('하지 옷입기', 'Mod I', '없음', '양말 신기 시 통증으로 시간이 걸림.'); }
    gait(p, sev === 3 ? { speed: rf(0.95, 1.1, 2), asym: true, abn: '절뚝거림 (Antalgic gait)', abnNote: SS('{S}측 체중 지지 시간 감소.') } : { speed: rf(1.15, 1.35, 2) });
    V('posture_summary', '허리뼈 앞굽음 감소, 앉은 자세에서 골반 뒤기울임.'); V('rom_summary', '허리 굽힘 ' + lf.a + '°로 제한되며 통증 재현. 폄은 비교적 편함.');
    V('mmt_summary', SS('{S}측 엉덩관절 폄·벌림근 근수행력 저하.')); V('muscle_length_summary', '엉덩허리근·뒤넙다리근 단축.'); V('joint_play_summary', '엉덩관절 가동성 정상 범위.');
    V('sensory_summary', '감각 정상 대칭.'); V('reflex_summary', '무릎·발목 반사 2+ 대칭.'); V('path_summary', '병적반사 음성.');
    V('special_summary', 'SLR·Slump 음성으로 신경뿌리 증상 가능성 낮음. Thomas 양성(엉덩관절 굽힘근 단축).'); V('gait_summary', sev === 3 ? '통증 회피 보행 경향.' : '독립 보행, 특이 소견 없음.');
    V('balance_summary', '균형 독립.'); V('function_exam_summary', '기본 ADL 독립' + (sev === 3 ? ', 앉았다 일어서기·하지 옷 입기에서 보조 수단 필요.' : '. 오래 앉기·숙이기에서 제한.'));
    V('manual_abnormal', '허리 굽힘 제한과 통증 재현, 엉덩관절 굽힘근·뒤넙다리근 단축, 볼기근 근수행력 저하.');
    V('manual_meaning', '기계적 허리 통증 양상. 위험신호·신경뿌리 소견 없음. 굽힘 방향 부하와 오래 앉기가 증상을 유지시키는 요인.');
    mpi(sev, p.extras.indexOf('mood') >= 0);
  };
  FILL.shoulder = function (p, sev) {
    var C = CONDS.shoulder, job = common(p, C, {}), pn = pain(sev), on = durOnset(p);
    CH('main_feature', ['통증', '관절 움직임 제한'].concat(sev >= 2 ? ['근력 저하 / 힘 빠짐'] : []).concat(['일상생활 불편']));
    V('main_symptom', SS('{S}측 어깨 바깥쪽 통증. 팔을 들어 올리거나 ' + (sev >= 2 ? '그쪽으로 누우면' : '높은 곳에 손을 뻗으면') + ' 아픔. NRS ' + pn.now + '/10, 심할 때 ' + pn.worst + '/10.'));
    CH('onset_context', [job.t === '미용사' || job.lift ? '운동 중' : '특별한 원인 없음']); V('onset_detail', on[0] + ' ' + job.ctx + ' 뒤 어깨 통증이 생겨 점점 팔 올리기가 불편해짐.');
    CH('provocation', ['팔 올리기', '물건 들기'].concat(sev >= 2 ? ['수면 / 누운 자세'] : [])); V('provocation_detail', '팔을 옆으로 60~120° 들 때 통증(통증 호). 머리 위 동작과 뒤로 손 뻗기에서 심함.');
    CH('palliation', ['휴식', sev >= 2 ? '약 복용' : '자세 변경', '냉찜질']); V('palliation_detail', '팔을 내리고 쉬면 줄어듦.');
    CH('quality', ['쑤심 / 욱신거림', '날카로운 통증']); V('quality_detail', '팔을 들 때 찌르듯 아프고, 쉬면 욱신거림.');
    CH('region', ['어깨', '팔 / 팔꿈치']); RA('radiation', '아니오'); V('radiation_detail', '위팔 바깥쪽까지 묵직하나 팔꿈치 아래로 내려가지 않음.');
    RA('nowpain', String(pn.now)); RA('worstpain', String(pn.worst)); RA('time_pattern', ['특정 활동에서만 나타남', '간헐적으로 나타남', '간헐적으로 나타남'][sev - 1]);
    CH('time_worse', sev >= 2 ? ['밤 / 수면 중', '활동 후'] : ['활동 후']); V('episode_duration', ['수초~수분', '수십 분', '1~3시간'][sev - 1]); V('symptom_trend', pick(['비슷하게 유지', '점점 악화']));
    V('time_detail', sev >= 2 ? '아픈 쪽으로 누우면 잠에서 깸.' : '야간통 없음.');
    CH('function', ['옷 입고 벗기', '샤워'].concat(['업무 / 학업']).concat(sev >= 2 ? ['수면'] : [])); V('function_detail', '머리 감기, 높은 선반 물건 꺼내기, 뒤로 손 넣기 어려움.');
    CH('goal', ['통증 감소', '관절 움직임 개선', '근력 향상', '일상생활 회복']); V('goal_detail', '팔을 아프지 않게 들어 머리 감기와 ' + job.ctx + '을(를) 하고 싶음.');
    post(2, 2, P.side === 'L' ? '좌' : '우', SS('{S}측 어깨뼈 내밈·앞기울임.')); post(1, 1, P.side === 'L' ? '좌' : '우', SS('{S}측 어깨가 약간 낮음.')); post(3, 1, '후방', '등뼈 뒤굽음 경도 증가.');
    var fr = [0.1, 0.22, 0.35][sev - 1];
    var fl = rom(8, fr, 'S', '끝범위 통증, 어깨뼈 올림 보상.'); rom(10, fr * 1.1, 'S', '60~120° 통증 호.'); rom(12, fr * 1.3, 'S', '손을 등 뒤로 올리기 제한.'); rom(13, fr * 0.6, 'S', '가쪽돌림 끝범위 통증.');
    mmtT('어깨 벌림근', sev === 3 ? '3' : '4', '통증', '저항 시 어깨 바깥 통증.'); mmtT('어깨 가쪽돌림근', '4', '통증', '저항 가쪽돌림 시 통증.'); mmtT('어깨 굽힘근', '4', '통증+보상', '어깨뼈 올림 보상.'); mmtT('하부 등세모근', '4', '보상', '어깨뼈 아래돌림 조절 저하.'); mmtT('앞톱니근', '4', '보상', '날개어깨뼈 경향.');
    ml(4, SS('{S}측 작은가슴근 단축.')); ml(0, SS('{S}측 위등세모근 긴장.'));
    jp(4, '통증', SS('{S}측 오목위팔관절 뒤쪽 활주 저가동성.')); jp(6, '없음', SS('{S}측 아래 활주 감소.'));
    spec('Neer', 'Positive', '있음', '익숙한 어깨 통증 재현.'); spec('Hawkins', 'Positive', '있음', '익숙한 통증 재현.'); spec('Empty Can', sev >= 2 ? 'Positive' : 'Equivocal', sev >= 2 ? '있음' : '불명확', '통증과 함께 힘 감소.'); spec('Apprehension', 'Negative', '없음', '불안감 없음.'); spec('Spurling', 'Negative', '없음', '목 기원 가능성 낮음.');
    if (sev >= 2) { func('상지 옷입기', 'Mod I', '없음', '아픈 팔부터 끼우며 천천히.'); func('목욕/샤워', 'Mod I', '없음', '머리 감기·등 씻기 어려움.'); }
    V('posture_summary', SS('{S}측 어깨뼈 내밈·앞기울임, 등뼈 뒤굽음 경도.')); V('rom_summary', SS('{S}측 어깨 굽힘 ' + fl.a + '°, 벌림 60~120° 통증 호, 안쪽돌림 제한.'));
    V('mmt_summary', '어깨 벌림·가쪽돌림 저항 시 통증과 근수행력 저하, 어깨뼈 조절 근육 약화.'); V('muscle_length_summary', '작은가슴근 단축.'); V('joint_play_summary', '오목위팔관절 뒤·아래 활주 감소.');
    V('sensory_summary', '감각 정상.'); V('reflex_summary', '팔 반사 2+ 대칭.'); V('path_summary', '병적반사 음성.');
    V('special_summary', 'Neer·Hawkins 양성, Empty can ' + (sev >= 2 ? '양성' : '애매') + ' → 어깨밑 통증·회전근개 힘줄병증 가능성. 불안정·목 기원 소견 없음.');
    V('gait_summary', '독립 보행.'); V('balance_summary', '균형 독립.'); V('function_exam_summary', '머리 위 동작·옷 입기·씻기에서 제한.');
    V('manual_abnormal', '어깨 굽힘·벌림 통증 호, 안쪽돌림 제한, 충돌 검사 양성, 어깨뼈 조절 저하.'); V('manual_meaning', '팔 들기 반복과 어깨뼈 조절 저하가 회전근개 힘줄에 부하를 주는 양상. 위험신호 없음.');
    mpi(sev, p.extras.indexOf('mood') >= 0);
  };
  FILL.knee = function (p, sev) {
    var C = CONDS.knee, job = common(p, C, { histItems: ['관절염'], histText: '수년 전부터 무릎 관절염 진단, 간헐적으로 진통제 복용.', med: sev >= 2 ? '소염진통제 필요 시 복용' : null, orthosis: sev === 3 ? '지팡이(반대쪽 손)' : '현재 사용 없음', additional: '체중 관리가 필요하다는 설명을 들은 적 있음.' }), pn = pain(sev);
    RA('onset_time', '1년 이상'); RA('onset_mode', '서서히 시작');
    CH('main_feature', ['통증', '뻐근함 / 결림', '관절 움직임 제한', '보행 불편'].concat(sev >= 2 ? ['일상생활 불편'] : []));
    V('main_symptom', SS('{S}측 무릎 안쪽 통증과 뻣뻣함. 계단 내려갈 때와 오래 걸은 뒤 심함. NRS ' + pn.now + '/10, 심할 때 ' + pn.worst + '/10.'));
    CH('onset_context', ['특별한 원인 없음']); V('onset_detail', '수년에 걸쳐 서서히 심해짐.');
    CH('provocation', ['계단 오르내리기', '걷기', '오래 서기'].concat(sev >= 2 ? ['뛰기'] : [])); V('provocation_detail', '계단 내려가기, 쪼그려 앉기, ' + (sev === 3 ? '10~15분' : '30분 이상') + ' 걷기에서 심해짐.');
    CH('palliation', ['휴식', '온찜질', '약 복용']); V('palliation_detail', '쉬거나 온찜질하면 줄어듦.');
    CH('quality', ['쑤심 / 욱신거림', '뻐근하고 묵직함']); V('quality_detail', '움직일 때 무릎에서 사각거리는 소리(마찰음).');
    CH('region', ['무릎']); RA('radiation', '아니오'); V('radiation_detail', '없음.'); RA('nowpain', String(pn.now)); RA('worstpain', String(pn.worst));
    RA('time_pattern', '간헐적으로 나타남'); CH('time_worse', ['아침', '활동 후', '저녁']); V('episode_duration', '1~3시간'); V('symptom_trend', pick(['비슷하게 유지', '점점 악화']));
    V('time_detail', '아침에 일어나면 15~20분 뻣뻣함(30분 미만).');
    CH('function', ['걷기', '계단', '집안일'].concat(sev >= 2 ? ['운동'] : [])); V('function_detail', '시장 보기, 계단, 쪼그려 앉아 일하기가 어려움.');
    CH('goal', ['통증 감소', '보행 개선', '근력 향상', '일상생활 회복']); V('goal_detail', '무릎 통증 없이 동네 산책 30분과 계단을 오르내리고 싶음.');
    post(7, 2, P.side === 'L' ? '좌' : '우', SS('{S}측 무릎 안굽이(내반) 정렬.')); post(8, 1, P.side === 'L' ? '좌' : '우', '발 안쪽 아치 경도 낮음.'); post(6, 1, P.side === 'L' ? '좌' : '우', '엉덩관절 경도 굽힘 자세.');
    var fr = [0.1, 0.2, 0.3][sev - 1];
    var kf = rom(28, fr, 'S', '끝범위 통증·마찰음.'); var ke = rows('romTable')[29]; if (ke) { var lag = [3, 6, 10][sev - 1]; if (P.side === 'L') inR2(ke, -lag, -lag + 3, 0, 0); else inR2(ke, 0, 0, -lag, -lag + 3); selR(ke, 'rom_pain', P.side); inR(ke, 'rom_note', '완전 폄 안 됨(굽힘 구축 ' + lag + '°).'); }
    rom(26, 0.2, '없음', '엉덩관절 안쪽돌림 경도 감소.');
    mmtT('무릎 폄근', sev === 3 ? '3' : '4', '통증', '넙다리네갈래근 위축, 저항 시 통증.'); mmtT('엉덩관절 벌림근', '4', '보상', '한발 지지 시 골반 떨어짐.'); mmtT('엉덩관절 폄근', '4', '없음', '근수행력 저하.'); mmtT('무릎 굽힘근', '4', '없음', '근수행력 경도 저하.');
    ml(10, '넙다리네갈래근 단축.'); ml(9, '뒤넙다리근 단축.', true); ml(11, '장딴지근 단축.');
    jp(12, '통증', SS('{S}측 정강넙다리관절 활주 감소.')); jp(13, '없음', '무릎뼈 움직임 감소.');
    spec('McMurray', 'Negative', '없음', '걸림·딸깍 없음.'); spec('Valgus stress', 'Negative', '없음', '안정적.'); spec('Varus stress', 'Negative', '없음', '안정적, 안쪽 관절선 불편감.'); spec('Lachman', 'Negative', '없음', '단단한 끝느낌.'); spec('Anterior drawer', 'Negative', '없음', '안정적.', 0);
    var sp = [rf(1.0, 1.1, 2), rf(0.85, 0.98, 2), rf(0.65, 0.8, 2)][sev - 1];
    gait(p, { speed: sp, asym: sev >= 2, aid: sev === 3 ? '지팡이' : '없음', dist: sev === 3 ? '200 m 정도' : '400 m 이상', abn: sev >= 2 ? '절뚝거림 (Antalgic gait)' : null, abnNote: SS('{S}측 디딤기 짧음.'), dev: sev >= 2 ? 'antalgic' : null, devNote: SS('{S}측 통증 회피.') });
    bal(4, 3, '20초 유지', '흔들림 증가.'); bal(5, sev === 3 ? 2 : 3, SS('{O}측 ' + rint(15, 25) + '초 / {S}측 ' + rint(3, 9) + '초'), SS('{S}측 한발서기 짧음.'));
    V('berg', [53, 49, 44][sev - 1]); V('tug', [rf(9, 10.5), rf(11, 13), rf(14, 17)][sev - 1]); V('reach', [rf(26, 29), rf(22, 26), rf(18, 22)][sev - 1]); V('minibest', [24, 20, 16][sev - 1]);
    func('계단', sev === 1 ? 'I' : 'Mod I', '난간', '난간 잡고 한 계단씩' + (sev === 3 ? ', 내려갈 때 감독 필요' : '') + '.'); func('실외 보행', sev === 3 ? 'Mod I' : 'I', sev === 3 ? '지팡이' : '없음', sev === 3 ? '지팡이로 200m 후 휴식 필요.' : '30분 이후 통증 증가.'); func('Sit ↔ Stand', sev >= 2 ? 'Mod I' : 'I', '없음', '팔걸이를 짚고 일어남.');
    V('posture_summary', SS('{S}측 무릎 안굽이 정렬, 경도 굽힘 자세.')); V('rom_summary', SS('{S}측 무릎 굽힘 ' + kf.a + '°, 완전 폄 안 됨.'));
    V('mmt_summary', '넙다리네갈래근·엉덩관절 벌림근 근수행력 저하.'); V('muscle_length_summary', '넙다리네갈래근·뒤넙다리근·장딴지근 단축.'); V('joint_play_summary', '정강넙다리·무릎뼈넙다리관절 가동성 감소.');
    V('sensory_summary', '감각 정상.'); V('reflex_summary', '무릎·발목 반사 2+ 대칭.'); V('path_summary', '병적반사 음성.');
    V('special_summary', '인대·반달연골 검사 음성 → 퇴행성 관절염 양상.'); V('gait_summary', '보행 속도 ' + sp + ' m/s' + (sev >= 2 ? ', 통증 회피 보행.' : '.'));
    V('balance_summary', SS('{S}측 한발서기 감소, 낙상 위험 ' + (sev === 3 ? '있음' : '낮음') + '.')); V('function_exam_summary', '계단·오래 걷기·앉았다 일어서기에서 제한.');
    V('manual_abnormal', '무릎 굽힘·폄 제한, 넙다리네갈래근 약화, 보행 속도 감소' + (sev === 3 ? ', 균형 저하(TUG 지연)' : '') + '.'); V('manual_meaning', '무릎 골관절염에 의한 통증·근약화·활동 감소의 악순환. 근력·유산소 운동과 체중 관리가 핵심.');
    mpi(sev, p.extras.indexOf('mood') >= 0);
  };
  FILL.ankle = function (p, sev) {
    var C = CONDS.ankle, job = common(p, C, { wb: sev === 3 ? 'PWB' : '제한 없음 / WBAT', orthosis: sev >= 2 ? '발목 보호대' : '현재 사용 없음', precaution: sev === 3 ? '부분 체중 지지, 오타와 규칙으로 골절 배제됨.' : '오타와 규칙으로 골절 배제됨.' });
    var pn = pain(sev); RA('onset_time', p.dur === 'acute' ? '며칠 전' : '몇 주 전'); RA('onset_mode', '갑자기 시작');
    CH('main_feature', ['통증', '부종', '보행 불편'].concat(sev >= 2 ? ['관절 움직임 제한'] : []));
    V('main_symptom', SS('{S}측 발목 바깥 복사뼈 아래 통증과 부기. 걸을 때 아픔. NRS ' + pn.now + '/10, 심할 때 ' + pn.worst + '/10.'));
    CH('onset_context', ['운동 중']); V('onset_detail', SS('운동 중 착지하다가 {S}측 발목이 안쪽으로 접질림.'));
    CH('provocation', ['걷기', '뛰기', '계단 오르내리기']); V('provocation_detail', '체중을 실을 때, 울퉁불퉁한 길, 방향 바꾸기에서 심함.');
    CH('palliation', ['휴식', '냉찜질'].concat(sev >= 2 ? ['약 복용'] : [])); V('palliation_detail', '다리를 올리고 냉찜질하면 줄어듦.');
    CH('quality', ['쑤심 / 욱신거림', '날카로운 통증']); V('quality_detail', '발목을 안쪽으로 돌릴 때 찌르듯 아픔.');
    CH('region', ['발목', '발']); RA('radiation', '아니오'); V('radiation_detail', '없음.'); RA('nowpain', String(pn.now)); RA('worstpain', String(pn.worst));
    RA('time_pattern', '특정 활동에서만 나타남'); CH('time_worse', ['활동 후', '저녁']); V('episode_duration', '수십 분'); V('symptom_trend', '호전되는 중');
    V('time_detail', '저녁에 부기 증가.'); V('edema', '있음');
    CH('function', ['걷기', '계단', '운동']); V('function_detail', '빨리 걷기, 계단 내려가기, 운동이 어려움.');
    CH('goal', ['통증 감소', '보행 개선', '스포츠 복귀']); V('goal_detail', '다시 운동하고 발목이 또 접질리지 않게 하고 싶음.');
    post(8, sev, P.side === 'L' ? '좌' : '우', SS('{S}측 바깥 복사뼈 주변 부종.'));
    var fr = [0.15, 0.3, 0.45][sev - 1];
    var df = rom(30, fr, 'S', '발등굽힘 끝범위 앞쪽 끼임 통증.'); rom(31, fr * 0.6, 'S', '발바닥굽힘 끝 통증.'); rom(32, fr * 1.2, 'S', '안쪽번짐에서 바깥 인대 통증 재현.'); rom(33, fr * 0.5, '없음', '경도 제한.');
    mmtT('발목 가쪽번짐근', sev === 3 ? '3' : '4', '통증', '저항 시 바깥 통증.'); mmtT('발목 발바닥굽힘근', '4', '통증', '한 발 뒤꿈치 들기 ' + [12, 6, 0][sev - 1] + '회.'); mmtT('발목 발등굽힘근', '4', '없음', '경도 저하.');
    ml(11, SS('{S}측 장딴지근 단축.')); ml(12, SS('{S}측 가자미근 단축.'));
    jp(14, '통증', SS('{S}측 목말 뒤쪽 활주 감소.'));
    spec('Anterior drawer', sev >= 2 ? 'Positive' : 'Equivocal', sev >= 2 ? '있음' : '불명확', '앞목말종아리인대 손상 시사.', 1); spec('Talar tilt', sev === 3 ? 'Positive' : 'Negative', sev === 3 ? '있음' : '없음', sev === 3 ? '발꿈치종아리인대 동반 손상 시사.' : '안정적.'); spec('Thompson', 'Negative', '없음', '아킬레스힘줄 정상.');
    var sp = [rf(1.1, 1.25, 2), rf(0.9, 1.05, 2), rf(0.6, 0.8, 2)][sev - 1];
    gait(p, { speed: sp, asym: true, aid: sev === 3 ? '목발(부분 체중 지지)' : '없음', abn: '절뚝거림 (Antalgic gait)', abnNote: SS('{S}측 디딤기 짧고 발끝 밀기 감소.'), dev: 'antalgic', devNote: SS('{S}측 통증 회피.') });
    bal(5, sev === 3 ? 1 : 2, SS('{O}측 30초 / {S}측 ' + [rint(8, 14), rint(3, 7), 0][sev - 1] + '초'), SS('{S}측 한발서기 불안정.')); bal(4, 3, '20초 유지', '흔들림 증가.');
    V('berg', [55, 53, 48][sev - 1]); V('tug', [rf(7, 8), rf(8.5, 10), rf(12, 15)][sev - 1]);
    func('계단', sev === 1 ? 'I' : 'Mod I', '난간', '한 계단씩.'); func('실외 보행', sev === 3 ? 'Mod I' : 'I', sev === 3 ? '목발' : '없음', '울퉁불퉁한 길에서 불안정.');
    V('posture_summary', SS('{S}측 발목 바깥 부종.')); V('rom_summary', SS('{S}측 발목 발등굽힘 ' + df.a + '°, 안쪽번짐 통증 재현.'));
    V('mmt_summary', '가쪽번짐근·발바닥굽힘근 근수행력 저하(통증 동반).'); V('muscle_length_summary', '장딴지·가자미근 단축.'); V('joint_play_summary', '목말 뒤쪽 활주 감소.');
    V('sensory_summary', '감각 정상.'); V('reflex_summary', '발목 반사 2+ 대칭.'); V('path_summary', '병적반사 음성.');
    V('special_summary', '앞당김 검사 ' + (sev >= 2 ? '양성' : '애매') + (sev === 3 ? ', 목말 기울임 양성' : '') + ' → 가쪽 인대 손상. 아킬레스 정상.'); V('gait_summary', '통증 회피 보행, 속도 ' + sp + ' m/s.');
    V('balance_summary', SS('{S}측 한발서기 감소(고유수용감각 저하).')); V('function_exam_summary', '계단·빠른 걷기·운동에서 제한.');
    V('manual_abnormal', '발목 부종, 발등굽힘·안쪽번짐 제한, 앞당김 검사 ' + (sev >= 2 ? '양성' : '애매') + ', 한발서기 감소.'); V('manual_meaning', '급성 가쪽 인대 염좌 후 통증·부종·고유수용감각 저하. 재손상 예방을 위한 균형 훈련이 핵심.');
    mpi(sev, p.extras.indexOf('mood') >= 0);
  };

  /* 예시 환자 기반(뇌졸중·척수손상): 이름·나이·성별·직업만 바꿈 */
  function scenarioOverride(p) {
    var oldName = (document.querySelector('main [name="name"]') || {}).value || '';
    var oldAge = (document.querySelector('main [name="age"]') || {}).value || '';
    var oldSex = (document.querySelector('main [name="sex"]') || {}).value || '';
    var oldJob = (document.querySelector('main [name="job"]') || {}).value || '';
    [].forEach.call(document.querySelectorAll('main input[type=text], main input:not([type]), main textarea'), function (e) {
      if (e.closest('[data-ix-own]') || !e.value) return;
      var v = e.value;
      if (oldName) v = v.split(oldName).join(p.name);
      if (oldAge) v = v.replace(new RegExp(oldAge + '세', 'g'), p.age + '세');
      if (oldSex && oldSex !== p.sex) v = v.replace(new RegExp(oldAge + '세 ' + oldSex, 'g'), p.age + '세 ' + p.sex);
      if (oldJob && p.job && oldJob !== p.job) v = v.split(oldJob).join(p.job);
      if (v !== e.value) e.value = v;
    });
    V('name', p.name); V('age', p.age); V('sex', p.sex); V('job', p.job);
    V('dob', (new Date().getFullYear() - p.age) + '-' + pad(rint(1, 12)) + '-' + pad(rint(1, 28)));
  }

  /* ---------------- 실행 ---------------- */
  async function fill(prof) {
    var p = resolve(prof); P = p;
    var C = CONDS[p.cond];
    if (C.scenario) {
      if (typeof applyScenario === 'function') applyScenario(C.scenario);
      await wait(1400);
      scenarioOverride(p);
    } else {
      try { resetAll(); } catch (e) { console.error('[gen] reset', e); }
      try { normals(p); } catch (e) { console.error('[gen] normals', e); }
      try { FILL[p.cond](p, +p.sev); } catch (e) { console.error('[gen] fill', e); }
      [].forEach.call(document.querySelectorAll('main select[name="ndi_score"], main #mpiAdapted select'), fire);
      if (typeof syncRegionSelection === 'function') try { syncRegionSelection(); } catch (e) { }
      if (typeof setSharedMode === 'function') try { setSharedMode('region'); } catch (e) { }
      try { var lab = document.getElementById('scenarioCurrentLabel'); if (lab) lab.textContent = '랜덤 가상환자 · ' + label(p); } catch (e) { }
      await wait(200);
    }
    [].forEach.call(document.querySelectorAll('main [name="name"], main [name="age"], main [name="sex"], main [name="job"]'), fire);
    if (typeof analyzeUnified === 'function') { window._ptQuietAnalyze = true; try { analyzeUnified(); } catch (e) { console.warn(e); } window._ptQuietAnalyze = false; }
    await wait(300);
    var st = document.querySelector('main [name="pt_diagnosis_status"]'); if (st) st.value = '수정 필요';
    return p;
  }

  window.GGGEN = { CONDS: CONDS, JOBS: JOBS, EXTRAS: EXTRAS, SEV: SEV, DUR: DUR, SIDE: SIDE, resolve: resolve, fill: fill, label: label };
})();
