/* ============================================================
   Login Overlay Logic
============================================================ */
document.addEventListener('DOMContentLoaded', function(){
    var overlay = document.getElementById('loginOverlay');
    if(!overlay) return;
    // 항상 페이지 로드 시 로그인 오버레이를 표시합니다.

    var skipBtn = document.getElementById('skipLoginBtn');
    if(skipBtn) skipBtn.addEventListener('click', function(){
        // 현재 페이지에서만 오버레이를 숨깁니다 (저장하지 않음).
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden','true');
    });

    var cancelBtn = document.getElementById('btnCancelLogin');
    if(cancelBtn) cancelBtn.addEventListener('click', function(){
        // 취소는 현재 보기에서만 닫습니다.
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden','true');
    });

    var form = document.getElementById('loginForm');
    if(form) form.addEventListener('submit', function(e){
        e.preventDefault();
        var email = (this.email && this.email.value || '').trim();
        var pw = (this.password && this.password.value || '').trim();
        if(!email || !pw){
            alert('이메일과 비밀번호를 입력하세요');
            return;
        }
        // 실제 인증은 서버 연동 필요 — 현재는 클라이언트 시뮬레이션
        // 로그인 성공 후에도 상태를 저장하지 않아, 새 페이지 열 때마다 오버레이가 다시 표시됩니다.
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden','true');
    });
});

/* ============================================================
   Main App Logic
============================================================ */
/* ============================================================
   CODEV ARCHIVE - 수정 버전 V2
   수정 사항:
   1. [FIX] 연도 삭제 기능 추가 (year-item hover/active 시 × 버튼)
   2. [FIX] 연도 추가 후 새 연도 자동 선택
   3. [FIX] renderYears() 현재 선택 연도 유지
   4. [FIX] 브랜드 삭제 후 right-panel-title 초기화
   5. [FIX] 하위폴더 삭제 후 panel 정리 및 currentBrand active 초기화
   6. [FIX] 브랜드에 하위폴더가 있어도 클릭 시 직접(direct) 프로젝트 표시
   7. [FIX] btn-add 정렬 개선 (margin-bottom 제거, flex 헤더)
   8. [FIX] 하위폴더 active 상태에서 아이콘 버튼 정상 표시
   9. [FIX] 브랜드 추가 버튼(+) 클릭 시 연도 미선택 안내 개선
  10. [FIX] addSub에서 하위폴더 추가 후 트리 재렌더링 시 해당 브랜드 확장 유지
============================================================ */

const SK = { DATA: 'codev_pd2', HIST: 'codev_hr2', REL: 'codev_rf2' };
const defaultData = {
    '2022': { projects: [{ name: 'ACTIVIA', subProjects: [], products: { '_direct': [] } }] },
    '2023': { projects: [{ name: 'A', subProjects: ['1','2','3'], products: { '_direct': [], '1': [], '2': [], '3': [] } }] },
    '2024': { projects: [{ name: 'B', subProjects: ['1','2','3'], products: { '_direct': [], '1': [], '2': [], '3': [] } }] },
    '2025': { projects: [{ name: 'C', subProjects: ['1','2','3'], products: { '_direct': [], '1': [], '2': [], '3': [] } }] }
};

let projectData = JSON.parse(JSON.stringify(defaultData));
let releasedFiles = {};
let historyRecords = [];
let currentYear = null, currentBrand = null, currentSub = null, editingId = null;

/* ─── 유틸 ─── */
function uid() { return Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10); }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function csvE(s) { return '"' + String(s || '').replace(/"/g, '""') + '"'; }
function fmtSize(b) { if (b < 1024) return b + 'B'; if (b < 1048576) return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }
function showInd() { const e = document.getElementById('save-indicator'); e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 2000); }

/* ─── 저장/로드 ─── */
function saveAll() {
    try {
        localStorage.setItem(SK.DATA, JSON.stringify(projectData));
        localStorage.setItem(SK.HIST, JSON.stringify(historyRecords));
        localStorage.setItem(SK.REL, JSON.stringify(releasedFiles));
        showInd();
    } catch (e) { alert('저장 실패: 저장 공간이 부족할 수 있습니다.'); }
}
function loadAll() {
    try {
        const d = localStorage.getItem(SK.DATA), h = localStorage.getItem(SK.HIST), r = localStorage.getItem(SK.REL);
        if (d) { Object.keys(projectData).forEach(k => delete projectData[k]); Object.assign(projectData, JSON.parse(d)); }
        if (h) { historyRecords.length = 0; JSON.parse(h).forEach(x => { if (!x.id || typeof x.id === 'number') x.id = uid(); historyRecords.push(x); }); }
        if (r) {
            Object.keys(releasedFiles).forEach(k => delete releasedFiles[k]);
            const parsed = JSON.parse(r);
            /* ── 기존 단일 projectInfo 구조 → gateEntries 마이그레이션 ── */
            Object.keys(parsed).forEach(k => {
                const item = parsed[k];
                if (item && item.projectInfo && !item.gateEntries) {
                    const pi = item.projectInfo;
                    item.gateEntries = [{
                        id: uid(),
                        gate: pi.gate || '',
                        manager: pi.manager || '',
                        date: pi.year || '',
                        tbd: pi.tbd || false,
                        memo: item.memo || '',
                        files: item.files || [],
                        reports: item.reports || [],
                        signatureDate: item.signatureDate || '',
                        decisionDocument: item.decisionDocument || '',
                        holdingActive: item.holdingActive || false,
                        holdingReason: item.holdingReason || '',
                        holdingSetAt: item.holdingSetAt || '',
                        createdAt: item.createdAt || new Date().toISOString()
                    }];
                    item.projectName = pi.project || k.split('::')[1] || '';
                    item.brand = pi.brand || '';
                    item.product = pi.product || '';
                    /* 구 필드 제거 */
                    delete item.projectInfo; delete item.memo; delete item.files;
                    delete item.reports; delete item.signatureDate; delete item.decisionDocument;
                    delete item.holdingActive; delete item.holdingReason; delete item.holdingSetAt;
                }
            });
            Object.assign(releasedFiles, parsed);
        }
    } catch (e) { console.warn('loadAll 오류:', e); }
}
function clearStorage() {
    if (!confirm('모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    Object.values(SK).forEach(k => localStorage.removeItem(k));
    location.reload();
}

/* ─── 탭 초기화 ─── */
function initTabs() {
    const tabs = document.querySelectorAll('.tab'), conts = document.querySelectorAll('.tab-content'), ti = document.getElementById('page-title');
    const t = { archive: 'I. CODEV ARCHIVE', ongoing: 'II. Ongoing Projects', history: 'III. History', holding: 'IV. Holding' };
    tabs.forEach(tab => tab.addEventListener('click', function () {
        tabs.forEach(x => x.classList.remove('active'));
        conts.forEach(x => x.classList.remove('active'));
        this.classList.add('active');
        const n = this.dataset.tab;
        document.getElementById(n + '-content')?.classList.add('active');
        if (ti) ti.textContent = t[n] || '';
        if (n === 'ongoing') updateBrandOpts();
        if (n === 'history') renderHistory();
        if (n === 'holding') renderHolding();
    }));
}
function updateBrandOpts() {
    // FIX: sel null 체크
    const sel = document.getElementById('ongoing-brand');
    if (!sel) return;
    const cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    const b = new Set();
    Object.values(projectData).forEach(y => y.projects?.forEach(p => b.add(p.name)));
    b.forEach(x => { const o = document.createElement('option'); o.value = x; o.textContent = x; sel.appendChild(o); });
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

/* ─── 연도 렌더링 ─── */
function renderYears(selectYear) {
    const l = document.getElementById('year-list');
    l.innerHTML = '';
    const years = Object.keys(projectData).sort();
    if (!years.length) {
        l.innerHTML = '<p class="empty-message" style="padding:20px 10px;font-size:12px;">연도 없음<br>+ 버튼으로<br>추가하세요</p>';
        return;
    }
    // FIX: selectYear 파라미터로 특정 연도 선택 가능, 없으면 currentYear 유지, 그것도 없으면 첫번째
    const targetYear = selectYear || (currentYear && projectData[currentYear] ? currentYear : years[0]);
    years.forEach(y => {
        const e = document.createElement('div');
        e.className = 'year-item' + (y === targetYear ? ' active' : '');
        e.innerHTML = `<span class="year-item-label">${esc(y)}</span><button class="btn-del-year" title="${y} 삭제">×</button>`;

        // FIX: label+div 이중 이벤트 통합 → div 하나로 처리 (loadYear 중복 호출 방지)
        e.addEventListener('click', function(ev) {
            if (ev.target.closest('.btn-del-year')) return;
            l.querySelectorAll('.year-item').forEach(x => x.classList.remove('active'));
            e.classList.add('active');
            loadYear(y);
        });

        // FIX: 연도 삭제 버튼
        e.querySelector('.btn-del-year').addEventListener('click', ev => {
            ev.stopPropagation();
            const hasProjects = projectData[y]?.projects?.length > 0;
            const confirmMsg = hasProjects
                ? `"${y}" 연도를 삭제하면\n하위 브랜드와 프로젝트가 모두 삭제됩니다.\n\n정말 삭제하시겠습니까?`
                : `"${y}" 연도를 삭제하시겠습니까?`;
            if (!confirm(confirmMsg)) return;
            delete projectData[y];
            // 삭제된 연도가 현재 선택된 연도라면 초기화
            if (currentYear === y) {
                currentYear = null; currentBrand = null; currentSub = null;
                document.getElementById('right-panel-title').textContent = '제품 목록';
                document.getElementById('product-detail').innerHTML = '<p class="empty-message">좌측에서 연도를 선택하세요</p>';
            }
            const remainYears = Object.keys(projectData).sort();
            renderYears(remainYears.length ? remainYears[remainYears.length - 1] : null);
            // FIX: currentYear가 유효한 경우에만 renderTree 호출
            if (currentYear && projectData[currentYear]) renderTree();
            saveAll();
        });

        l.appendChild(e);
    });

    // 최초 진입 또는 선택 연도 로드
    if (!currentYear || currentYear === targetYear || selectYear) {
        loadYear(targetYear);
    }
}

function loadYear(y) {
    if (!y || !projectData[y]) return;
    currentYear = y;
    currentBrand = null;
    currentSub = null;
    renderTree();
    document.getElementById('right-panel-title').textContent = '제품 목록';
    document.getElementById('product-detail').innerHTML = '<p class="empty-message">좌측에서 브랜드 또는 제품 폴더를 선택하세요</p>';
}

/* ─── 트리 렌더링 ─── */
function renderTree() {
    const t = document.getElementById('project-tree');
    t.innerHTML = '';
    const d = projectData[currentYear];
    if (!d?.projects?.length) {
        t.innerHTML = '<p class="empty-message">등록된 브랜드가 없습니다<br>+ 버튼으로 추가</p>';
        return;
    }
    d.projects.forEach(p => t.appendChild(buildBrand(p)));
}

/* ─── 브랜드 빌드 ─── */
function buildBrand(brand) {
    const w = document.createElement('div');
    w.className = 'brand-item';
    const h = document.createElement('div');
    h.className = 'brand-header';
    const hs = brand.subProjects?.length > 0;

    h.innerHTML = `
        ${hs ? '<span class="toggle-icon">▶</span>' : '<span class="toggle-icon" style="visibility:hidden">▶</span>'}
        <span class="brand-name">${esc(brand.name)}</span>
        <button class="btn-icon btn-edit-brand" title="브랜드 수정/삭제">✏</button>
        <button class="btn-icon btn-add-sub" title="하위폴더 추가">+</button>`;

    h.querySelector('.btn-edit-brand').addEventListener('click', e => { e.stopPropagation(); editBrand(brand.name); });
    h.querySelector('.btn-add-sub').addEventListener('click', e => { e.stopPropagation(); addSub(brand); });

    const ch = document.createElement('div');
    ch.className = 'brand-children';

    // FIX: 현재 선택 브랜드면 펼쳐진 상태로 복원
    const isCurrentBrand = (currentBrand === brand.name);

    if (hs) {
        brand.subProjects.forEach(sub => {
            const si = document.createElement('div');
            si.className = 'sub-item' + (isCurrentBrand && currentSub === sub ? ' active' : '');
            si.innerHTML = `
                <span class="sub-name">${esc(sub)}</span>
                <button class="btn-sub-icon btn-edit-sub" title="폴더 수정/삭제">✏</button>
                <button class="btn-sub-icon btn-add-product" title="프로젝트 추가">+</button>`;

            si.addEventListener('click', e => {
                if (e.target.closest('.btn-sub-icon')) return;
                selectSub(sub, si, brand.name);
            });
            si.querySelector('.btn-edit-sub').addEventListener('click', e => { e.stopPropagation(); editSub(brand.name, sub); });
            si.querySelector('.btn-add-product').addEventListener('click', e => { e.stopPropagation(); showAddProjectModal(brand.name, sub); });
            ch.appendChild(si);
        });
    }

    // FIX: 브랜드 헤더 클릭 로직 개선
    // - 하위폴더가 있는 브랜드: 클릭 시 토글 + _direct 프로젝트 로드
    // - 하위폴더가 없는 브랜드: 클릭 시 _direct 프로젝트 로드
    h.addEventListener('click', function (e) {
        if (e.target.closest('.btn-icon')) return;
        // 모든 brand-header active 제거
        document.querySelectorAll('.brand-header').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.sub-item').forEach(x => x.classList.remove('active'));

        if (hs) {
            const ic = h.querySelector('.toggle-icon');
            const isExpanded = ch.classList.contains('expanded');
            // 토글
            // FIX: isCurrentBrand와 currentBrand=== brand.name 중복 조건 정리
            if (isExpanded && currentBrand === brand.name) {
                ch.classList.remove('expanded');
                ic.textContent = '▶';
                // 현재 선택 해제
                currentBrand = null; currentSub = null;
                document.getElementById('right-panel-title').textContent = '제품 목록';
                document.getElementById('product-detail').innerHTML = '<p class="empty-message">좌측에서 브랜드 또는 제품 폴더를 선택하세요</p>';
            } else {
                // 다른 브랜드들 접기
                document.querySelectorAll('.brand-children.expanded').forEach(bc => {
                    bc.classList.remove('expanded');
                    bc.previousElementSibling?.querySelector('.toggle-icon') && (bc.previousElementSibling.querySelector('.toggle-icon').textContent = '▶');
                });
                ch.classList.add('expanded');
                ic.textContent = '▼';
                h.classList.add('active');
                currentBrand = brand.name;
                // FIX: 하위폴더가 있어도 브랜드 클릭 시 _direct 프로젝트 표시
                currentSub = '_direct';
                loadProducts(brand.name, '_direct');
            }
        } else {
            h.classList.add('active');
            currentBrand = brand.name;
            currentSub = '_direct';
            loadProducts(brand.name, '_direct');
        }
    });

    // FIX: 현재 선택 브랜드라면 펼쳐진 상태 복원
    if (isCurrentBrand && hs) {
        ch.classList.add('expanded');
        h.querySelector('.toggle-icon').textContent = '▼';
        h.classList.add('active');
    } else if (isCurrentBrand && !hs) {
        h.classList.add('active');
    }

    w.appendChild(h);
    w.appendChild(ch);
    return w;
}

function selectSub(sub, el, bn) {
    document.querySelectorAll('.brand-header,.sub-item').forEach(x => x.classList.remove('active'));
    // 해당 브랜드 헤더도 active 유지
    document.querySelectorAll('.brand-header').forEach(bh => {
        if (bh.querySelector('.brand-name')?.textContent === bn) bh.classList.add('active');
    });
    el.classList.add('active');
    currentBrand = bn;
    currentSub = sub;
    loadProducts(bn, sub);
}

/* ─── 제품 목록 로드 ─── */
function loadProducts(bn, sk) {
    const det = document.getElementById('product-detail');
    det.innerHTML = '';
    document.getElementById('right-panel-title').textContent = sk === '_direct' ? `${bn} - 프로젝트` : `${bn} > ${sk} - 프로젝트`;
    const brand = projectData[currentYear]?.projects.find(p => p.name === bn);
    const products = brand?.products?.[sk];
    if (products?.length) {
        products.forEach((pj, idx) => {
            const key = sk + '::' + pj;
            const rd = releasedFiles[key];
            const isR = !!rd;
            /* Gate 카운트 표시 */
            const gateCount = rd?.gateEntries?.length || 0;
            /* 파일 수: 모든 gateEntries 합산 */
            const fc = rd?.gateEntries?.reduce((s, e) => s + (e.files?.length || 0), 0) || 0;
            /* 가장 최근 Gate */
            const latestGate = rd?.gateEntries?.length ? rd.gateEntries[rd.gateEntries.length - 1].gate : '';
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <span class="p-icon">${isR ? '📋' : '📝'}</span>
                <span class="p-name">${esc(pj)}</span>
                ${gateCount > 0 ? `<span class="p-files" style="background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7;">🔖${gateCount}개 Gate</span>` : ''}
                ${fc ? `<span class="p-files">📎${fc}개 파일</span>` : ''}
                ${latestGate ? `<span class="p-badge manual" style="background:#E3F2FD;color:#1565C0;border:1px solid #90CAF9;">${esc(latestGate)}</span>` : `<span class="p-badge ${isR && !rd.manualEntry ? 'released' : 'manual'}">${isR && !rd.manualEntry ? 'Released' : '수동등록'}</span>`}
                <button class="btn-del-product" title="프로젝트 삭제">×</button>`;
            card.addEventListener('click', e => { if (!e.target.closest('.btn-del-product')) showProjectModal(pj, sk, bn); });
            card.querySelector('.btn-del-product').addEventListener('click', e => {
                e.stopPropagation();
                if (confirm(`"${pj}" 프로젝트를 삭제하시겠습니까?`)) {
                    // FIX: splice(idx) 클로저 인덱스 불일치 방지 → filter로 교체
                    brand.products[sk] = brand.products[sk].filter(name => name !== pj);
                    delete releasedFiles[key];
                    loadProducts(bn, sk);
                    saveAll();
                }
            });
            det.appendChild(card);
        });
    }
    const addBtn = document.createElement('div');
    addBtn.className = 'btn-add-project-panel';
    addBtn.innerHTML = '+ 새 프로젝트 추가';
    addBtn.addEventListener('click', () => showAddProjectModal(bn, sk));
    det.appendChild(addBtn);
}

/* ─── 새 프로젝트 추가 모달 ─── */
function showAddProjectModal(brandName, subKey) {
    document.getElementById('add-project-modal')?.remove();

    const basicInfoList = [{ name: '', manager: '', gate: '', date: '' }];
    const tempFiles = [];

    const ov = document.createElement('div');
    ov.id = 'add-project-modal';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
        <div class="modal-box" style="width:750px;max-height:90vh;overflow-y:auto;">
            <div class="modal-hdr blue">
                <h3>새 프로젝트 등록 — ${esc(brandName)}${subKey !== '_direct' ? ' > ' + esc(subKey) : ''}</h3>
                <button class="btn-close">×</button>
            </div>
            <div class="modal-body-edit">
                <!-- 등록된 프로젝트 목록 (수정/삭제) -->
                <div id="registered-section" style="display:none;background:#E8F5E9;padding:14px;border-radius:8px;margin-bottom:16px;border:1.5px solid #A5D6A7;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <label style="font-weight:700;font-size:14px;color:#2E7D32;">✅ 등록된 프로젝트 <span id="registered-count" style="background:#43A047;color:white;border-radius:10px;padding:1px 8px;font-size:12px;margin-left:4px;">0</span></label>
                    </div>
                    <div id="registered-list-container"></div>
                </div>
                <div class="basic-info-section" style="background:#E3F2FD;padding:16px;border-radius:8px;margin-bottom:20px;">
                    <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <label style="font-weight:700;font-size:15px;color:#1565C0;margin-bottom:0;">📋 프로젝트 기본 정보</label>
                        <button id="btn-add-basic-info" style="background:#1976D2;color:white;border:none;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.2);" title="프로젝트 기본 정보 추가">+</button>
                    </div>
                    <div id="basic-info-container"></div>
                </div>
                <div class="file-upload-section">
                    <div class="section-header">
                        <label>📎 첨부파일</label>
                        <button class="btn-add-file-row" id="btn-add-file-row" title="파일 업로드 칸 추가">+</button>
                    </div>
                    <div class="file-rows-container" id="file-rows-container"></div>
                    <div class="file-count-info" id="file-count-info">파일 0개</div>
                </div>
                <div style="margin-bottom:0">
                    <label>메모</label>
                    <textarea id="new-proj-memo" placeholder="프로젝트 관련 메모..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <div></div>
                <div class="btn-group">
                    <button class="btn-cancel">닫기</button>
                    <button class="btn-save-modal">등록</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(ov);

    const basicInfoContainer = ov.querySelector('#basic-info-container');
    const fileContainer = ov.querySelector('#file-rows-container');
    const fileCountInfo = ov.querySelector('#file-count-info');

    /* 등록 완료된 프로젝트 목록 (수정/삭제용) */
    const registeredList = []; // { key, name, subKey, brandName }

    /* 헤더 레이블: Gate가 있으면 Gate명, 없으면 프로젝트명/하위폴더명 표기 */
    function getRowLabel(info, idx) {
        if (info.gate && info.gate !== '') return info.gate;
        const projectName = (info.name || '').trim();
        if (projectName) return projectName;
        if (subKey && subKey !== '_direct') return subKey;
        return brandName || '프로젝트';
    }

    function renderBasicInfoRows() {
        basicInfoContainer.innerHTML = '';
        basicInfoList.forEach((info, idx) => {
            const row = document.createElement('div');
            row.setAttribute('data-row-idx', idx);
            row.style.cssText = 'background:white;padding:16px;border-radius:8px;margin-bottom:12px;border:2px solid #90CAF9;position:relative;box-shadow:0 2px 4px rgba(0,0,0,0.1);';
            const labelText = getRowLabel(info, idx);
            row.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span class="row-header-label" style="font-weight:700;color:#1565C0;font-size:14px;">${esc(labelText)}</span>
                    <button class="btn-remove-basic-info" data-idx="${idx}"
                        style="background:#E53935;color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1;font-weight:700;${basicInfoList.length <= 1 ? 'opacity:0.3;cursor:not-allowed;' : ''}"
                        ${basicInfoList.length <= 1 ? 'disabled' : ''}>×</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;">
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">프로젝트명 *</label>
                        <input type="text" class="input-proj-name" data-idx="${idx}" value="${esc(info.name)}" placeholder="프로젝트명 입력" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">담당자</label>
                        <input type="text" class="input-manager" data-idx="${idx}" value="${esc(info.manager)}" placeholder="담당자 입력" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">Gate</label>
                        <select class="input-gate" data-idx="${idx}" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                            <option value="">선택</option>
                            <option ${info.gate === 'Go Define' ? 'selected' : ''}>Go Define</option>
                            <option ${info.gate === 'Go Develop' ? 'selected' : ''}>Go Develop</option>
                            <option ${info.gate === 'Go Implement' ? 'selected' : ''}>Go Implement</option>
                            <option ${info.gate === 'Go Launch' ? 'selected' : ''}>Go Launch</option>
                            <option ${info.gate === 'Closure' ? 'selected' : ''}>Closure</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">보고 날짜</label>
                        <input type="date" class="input-date" data-idx="${idx}" value="${info.date}" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                    </div>
                </div>`;

            row.querySelector('.input-proj-name').addEventListener('input', e => { basicInfoList[idx].name = e.target.value; });
            row.querySelector('.input-manager').addEventListener('input', e => { basicInfoList[idx].manager = e.target.value.trim(); });
            row.querySelector('.input-gate').addEventListener('change', e => {
                basicInfoList[idx].gate = e.target.value;
                /* Gate 선택 시 헤더 레이블 즉시 업데이트 */
                const label = row.querySelector('.row-header-label');
                if (label) label.textContent = getRowLabel(basicInfoList[idx], idx);
            });
            row.querySelector('.input-date').addEventListener('change', e => { basicInfoList[idx].date = e.target.value; });

            const removeBtn = row.querySelector('.btn-remove-basic-info');
            if (basicInfoList.length > 1) {
                removeBtn.addEventListener('click', () => {
                    if (confirm(`"${getRowLabel(info, idx)}" 항목을 삭제하시겠습니까?`)) {
                        // FIX: splice(idx) 클로저 불일치 방지 → 객체 참조로 위치 재탐색
                        const curIdx = basicInfoList.indexOf(info);
                        if (curIdx !== -1) basicInfoList.splice(curIdx, 1);
                        renderBasicInfoRows();
                    }
                });
            }
            basicInfoContainer.appendChild(row);
        });
    }

    /* ─── 등록된 프로젝트 목록 렌더링 (수정/삭제) ─── */
    function renderRegisteredList() {
        const regContainer = ov.querySelector('#registered-list-container');
        if (!regContainer) return;
        if (registeredList.length === 0) {
            regContainer.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center;padding:10px 0;">등록된 프로젝트가 없습니다.</p>';
            return;
        }
        regContainer.innerHTML = '';
        registeredList.forEach((item, i) => {
            const rf = releasedFiles[item.key];
            /* 새 gateEntries 구조에서 프로젝트 정보 추출 */
            const projNameDisp = rf?.projectName || item.name;
            const firstEntry = rf?.gateEntries?.[0] || {};
            const gateCount = rf?.gateEntries?.length || 0;
            const div = document.createElement('div');
            div.style.cssText = 'display:flex;align-items:center;gap:10px;background:white;border:1.5px solid #A5D6A7;border-radius:8px;padding:12px 14px;margin-bottom:8px;';
            div.innerHTML = `
                <div style="flex:1;min-width:0;">
                    <span style="font-weight:700;color:#2E7D32;font-size:14px;">${esc(projNameDisp)}</span>
                    <span style="margin-left:8px;font-size:12px;color:#666;">${gateCount > 0 ? '<span style="background:#E8F5E9;color:#388E3C;padding:2px 8px;border-radius:10px;font-weight:600;">🔖'+gateCount+'개 Gate</span>' : ''}</span>
                    <span style="margin-left:6px;font-size:12px;color:#999;">${firstEntry.manager ? '담당: '+esc(firstEntry.manager) : ''}</span>
                </div>
                <button class="btn-reg-edit" data-idx="${i}" style="background:#1976D2;color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;">수정</button>
                <button class="btn-reg-del" data-idx="${i}" style="background:#E53935;color:white;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;">삭제</button>`;

            div.querySelector('.btn-reg-edit').addEventListener('click', () => {
                openEditRegistered(i);
            });
            div.querySelector('.btn-reg-del').addEventListener('click', () => {
                const nm = projNameDisp;
                if (!confirm(`"${nm}" 프로젝트를 삭제하시겠습니까?`)) return;
                /* projectData에서 삭제 */
                const brand = projectData[currentYear]?.projects.find(p => p.name === item.brandName);
                if (brand && brand.products[item.subKey]) {
                    // FIX: splice 대신 filter로 안전 삭제
                    brand.products[item.subKey] = brand.products[item.subKey].filter(n => n !== nm);
                }
                delete releasedFiles[item.key];
                // FIX: splice(i) 클로저 불일치 방지 → item 참조로 위치 재탐색
                const curIdx = registeredList.indexOf(item);
                if (curIdx !== -1) registeredList.splice(curIdx, 1);
                /* 카운트 업데이트 */
                const rc = ov.querySelector('#registered-count');
                if (rc) rc.textContent = registeredList.length;
                if (registeredList.length === 0) {
                    const regSection = ov.querySelector('#registered-section');
                    if (regSection) regSection.style.display = 'none';
                }
                loadProducts(item.brandName, item.subKey);
                saveAll();
                renderRegisteredList();
            });
            regContainer.appendChild(div);
        });
    }

    /* ─── 등록된 항목 수정 모달 ─── */
    function openEditRegistered(idx) {
        const item = registeredList[idx];
        const rf = releasedFiles[item.key];
        if (!rf) return;
        /* 새 gateEntries 구조 */
        const projN = rf.projectName || item.name;
        const firstE = rf.gateEntries?.[0] || {};

        document.getElementById('edit-registered-modal')?.remove();
        const eov = document.createElement('div');
        eov.id = 'edit-registered-modal';
        eov.className = 'modal-overlay';
        eov.style.zIndex = '3000';
        eov.innerHTML = `
            <div class="modal-box" style="width:560px;max-height:85vh;overflow-y:auto;">
                <div class="modal-hdr blue">
                    <h3>프로젝트 수정 — ${esc(projN)}</h3>
                    <button class="btn-close-edit">×</button>
                </div>
                <div class="modal-body-edit" style="padding:20px;">
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;">
                        <div>
                            <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">프로젝트명 *</label>
                            <input id="edit-proj-name" type="text" value="${esc(projN)}" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                        </div>
                        <div>
                            <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">담당자 (첫 Gate)</label>
                            <input id="edit-manager" type="text" value="${esc(firstE.manager || '')}" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px;">
                        <div>
                            <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">Gate (첫 항목)</label>
                            <select id="edit-gate" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                                <option value="">선택</option>
                                <option ${firstE.gate === 'Go Define' ? 'selected' : ''}>Go Define</option>
                                <option ${firstE.gate === 'Go Develop' ? 'selected' : ''}>Go Develop</option>
                                <option ${firstE.gate === 'Go Implement' ? 'selected' : ''}>Go Implement</option>
                                <option ${firstE.gate === 'Go Launch' ? 'selected' : ''}>Go Launch</option>
                                <option ${firstE.gate === 'Closure' ? 'selected' : ''}>Closure</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">보고 날짜 (첫 항목)</label>
                            <input id="edit-date" type="date" value="${firstE.date || ''}" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:6px;font-weight:600;color:#424242;">메모 (첫 항목)</label>
                        <textarea id="edit-memo" style="width:100%;padding:8px 9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;min-height:80px;resize:vertical;">${esc(firstE.memo || '')}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <div></div>
                    <div class="btn-group">
                        <button class="btn-cancel-edit" style="background:#9E9E9E;color:white;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-weight:600;">취소</button>
                        <button class="btn-save-edit" style="background:#1976D2;color:white;border:none;border-radius:6px;padding:8px 20px;cursor:pointer;font-weight:600;">저장</button>
                    </div>
                </div>
            </div>`;

        const closeEdit = () => eov.remove();
        eov.querySelector('.btn-close-edit').addEventListener('click', closeEdit);
        eov.querySelector('.btn-cancel-edit').addEventListener('click', closeEdit);
        eov.addEventListener('click', e => { if (e.target === eov) closeEdit(); });

        eov.querySelector('.btn-save-edit').addEventListener('click', () => {
            const newName = eov.querySelector('#edit-proj-name').value.trim();
            const newManager = eov.querySelector('#edit-manager').value.trim();
            const newGate = eov.querySelector('#edit-gate').value;
            const newDate = eov.querySelector('#edit-date').value;
            const newMemo = eov.querySelector('#edit-memo').value.trim();

            if (!newName) { alert('프로젝트명을 입력하세요.'); return; }

            const oldName = projN;
            const oldKey = item.key;
            const newKey = item.subKey + '::' + newName;

            /* projectData 이름 변경 */
            const brand = projectData[currentYear]?.projects.find(p => p.name === item.brandName);
            if (brand && brand.products[item.subKey]) {
                const arr = brand.products[item.subKey];
                const pos = arr.indexOf(oldName);
                if (pos !== -1) arr[pos] = newName;
            }

            /* releasedFiles 키 변경 */
            if (oldKey !== newKey && releasedFiles[oldKey]) {
                releasedFiles[newKey] = releasedFiles[oldKey];
                delete releasedFiles[oldKey];
            }
            if (releasedFiles[newKey]) {
                releasedFiles[newKey].projectName = newName;
                /* gateEntries 첫 항목도 함께 업데이트 */
                if (releasedFiles[newKey].gateEntries?.length) {
                    releasedFiles[newKey].gateEntries[0].manager = newManager;
                    releasedFiles[newKey].gateEntries[0].gate = newGate;
                    releasedFiles[newKey].gateEntries[0].date = newDate;
                    releasedFiles[newKey].gateEntries[0].memo = newMemo;
                }
            }

            /* registeredList 항목 업데이트 */
            registeredList[idx].key = newKey;
            registeredList[idx].name = newName;

            loadProducts(item.brandName, item.subKey);
            saveAll();
            renderRegisteredList();
            closeEdit();
        });

        document.body.appendChild(eov);
        setTimeout(() => eov.querySelector('#edit-proj-name')?.focus(), 100);
    }

    function updateFileCount() {
        const count = tempFiles.filter(f => f.name).length;
        fileCountInfo.textContent = `파일 ${count}개${count ? ` (${tempFiles.filter(f => f.name).map(f => fmtSize(f.size)).join(', ')})` : ''}`;
    }

    function renderFileRows() {
        fileContainer.innerHTML = '';
        tempFiles.forEach((fileData, idx) => {
            const row = document.createElement('div');
            row.className = 'file-row';
            row.innerHTML = `
                <span class="file-num">${idx + 1}</span>
                <span class="file-name-display ${fileData.name ? '' : 'empty'}">${fileData.name ? esc(fileData.name) : '파일을 선택하세요'}</span>
                ${fileData.size ? `<span class="file-size">${fmtSize(fileData.size)}</span>` : ''}
                <button class="btn-choose-file ${fileData.name ? 'has-file' : ''}">${fileData.name ? '변경' : '선택'}</button>
                <button class="btn-remove-file" ${tempFiles.length <= 1 && !fileData.name ? 'disabled' : ''}>×</button>`;

            row.querySelector('.btn-choose-file').addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.hwp,.txt,.zip,.rar,.7z,.png,.jpg,.jpeg,.gif';
                input.addEventListener('change', e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    tempFiles[idx] = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified };
                    renderFileRows();
                    updateFileCount();
                });
                input.click();
            });

            row.querySelector('.btn-remove-file').addEventListener('click', () => {
                if (tempFiles.length <= 1 && !fileData.name) return;
                if (tempFiles.length <= 1) { tempFiles[0] = { name: '', size: 0, type: '' }; }
                else {
                    // FIX: splice(idx) 클로저 불일치 방지 → 객체 참조로 위치 재탐색
                    const curIdx = tempFiles.indexOf(fileData);
                    if (curIdx !== -1) tempFiles.splice(curIdx, 1);
                }
                renderFileRows();
                updateFileCount();
            });

            fileContainer.appendChild(row);
        });
    }

    renderBasicInfoRows();
    tempFiles.push({ name: '', size: 0, type: '' });
    renderFileRows();

    /* 모달 열릴 때 기존 등록된 프로젝트를 목록에 채우기 */
    (function loadExistingProducts() {
        const brand = projectData[currentYear]?.projects.find(p => p.name === brandName);
        if (!brand || !brand.products[subKey]) return;
        brand.products[subKey].forEach(pName => {
            const key = subKey + '::' + pName;
            registeredList.push({ key, name: pName, subKey, brandName });
        });
        if (registeredList.length > 0) {
            const regSection = ov.querySelector('#registered-section');
            if (regSection) {
                regSection.style.display = 'block';
                ov.querySelector('#registered-count').textContent = registeredList.length;
            }
            renderRegisteredList();
        }
    })();

    ov.querySelector('#btn-add-basic-info').addEventListener('click', () => {
        basicInfoList.push({ name: '', manager: '', gate: '', date: '' });
        renderBasicInfoRows();
        setTimeout(() => basicInfoContainer.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    });

    ov.querySelector('#btn-add-file-row').addEventListener('click', () => {
        tempFiles.push({ name: '', size: 0, type: '' });
        renderFileRows();
        updateFileCount();
        fileContainer.scrollTop = fileContainer.scrollHeight;
    });

    const close = () => ov.remove();
    ov.querySelector('.btn-close').addEventListener('click', close);
    ov.querySelector('.btn-cancel').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });

    ov.querySelector('.btn-save-modal').addEventListener('click', () => {
        const validInfoList = basicInfoList.filter(info => info.name.trim() !== '');
        if (validInfoList.length === 0) { alert('최소 1개 이상의 프로젝트명을 입력하세요.'); return; }

        const brand = projectData[currentYear]?.projects.find(p => p.name === brandName);
        if (!brand) { alert('브랜드를 찾을 수 없습니다.'); return; }
        if (!brand.products[subKey]) brand.products[subKey] = [];

        let successCount = 0, duplicateCount = 0;
        const newlyRegistered = [];

        validInfoList.forEach(info => {
            const projectName = info.name.trim();
            const key = subKey + '::' + projectName;
            const validFiles = tempFiles.filter(f => f.name);
            const memoVal = document.getElementById('new-proj-memo').value.trim();
            const newEntry = {
                id: uid(),
                gate: info.gate,
                manager: info.manager,
                date: info.date,
                tbd: false,
                memo: memoVal,
                files: validFiles,
                reports: [],
                signatureDate: '',
                decisionDocument: '',
                holdingActive: false,
                holdingReason: '',
                holdingSetAt: '',
                createdAt: new Date().toISOString()
            };

            if (brand.products[subKey].includes(projectName)) {
                /* 이미 존재 → gateEntries에 추가 */
                if (!releasedFiles[key]) {
                    releasedFiles[key] = { projectName, brand: brandName, product: subKey === '_direct' ? brandName : subKey, manualEntry: true, gateEntries: [] };
                }
                releasedFiles[key].gateEntries.push(newEntry);
                duplicateCount++;
                registeredList.push({ key, name: projectName, subKey, brandName });
                // FIX: 중복 프로젝트는 successCount를 올리지 않음 (Gate 추가만 처리)
                newlyRegistered.push(projectName + ' (Gate 추가)');
                return;
            }
            brand.products[subKey].push(projectName);
            releasedFiles[key] = {
                projectName,
                brand: brandName,
                product: subKey === '_direct' ? brandName : subKey,
                manualEntry: true,
                gateEntries: [newEntry]
            };
            registeredList.push({ key, name: projectName, subKey, brandName });
            successCount++;
            newlyRegistered.push(projectName);
        });

        if (successCount === 0 && duplicateCount === 0) {
            alert('⚠️ 등록할 프로젝트가 없습니다.');
            return;
        }

        // FIX: Gate만 추가된 경우(successCount=0, duplicateCount>0)도 저장 및 알림 처리
        if (duplicateCount > 0 && successCount === 0) {
            const regSection = ov.querySelector('#registered-section');
            if (regSection) { regSection.style.display = 'block'; ov.querySelector('#registered-count').textContent = registeredList.length; }
            renderRegisteredList();
            loadProducts(brandName, subKey);
            saveAll();
            alert(`✅ ${duplicateCount}개 프로젝트에 Gate가 추가되었습니다.
추가: ${newlyRegistered.join(', ')}`);
            return;
        }

        if (successCount > 0) {
            /* 입력 폼 초기화 */
            basicInfoList.splice(0, basicInfoList.length, { name: '', manager: '', gate: '', date: '' });
            renderBasicInfoRows();
            tempFiles.splice(0, tempFiles.length, { name: '', size: 0, type: '' });
            renderFileRows();
            updateFileCount();
            ov.querySelector('#new-proj-memo').value = '';

            /* 등록된 목록 섹션 표시 */
            const regSection = ov.querySelector('#registered-section');
            if (regSection) {
                regSection.style.display = 'block';
                ov.querySelector('#registered-count').textContent = registeredList.length;
            }
            renderRegisteredList();

            loadProducts(brandName, subKey);
            saveAll();

            let msg = `✅ ${successCount}개 프로젝트가 등록되었습니다.\n등록: ${newlyRegistered.join(', ')}`;
            if (duplicateCount > 0) msg += `\n\n⚠️ ${duplicateCount}개는 이미 존재하여 건너뛰었습니다.`;
            alert(msg);

            /* 등록된 목록으로 스크롤 */
            setTimeout(() => regSection?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    });
}

/* ─── 프로젝트 상세 모달 (멀티 Gate) ─── */
function showProjectModal(projName, subKey, brandName) {
    document.getElementById('project-detail-modal')?.remove();
    // FIX: 파라미터 직접 재할당 방지 - 내부 변수로 분리
    let currentProjName = projName;
    const key = subKey + '::' + currentProjName;
    if (!releasedFiles[key]) {
        releasedFiles[key] = { projectName: currentProjName, brand: brandName, product: subKey === '_direct' ? brandName : subKey, manualEntry: true, gateEntries: [] };
    }
    /* 구 구조 마이그레이션 (projectInfo 남아있는 경우) */
    if (releasedFiles[key].projectInfo && !releasedFiles[key].gateEntries) {
        const item = releasedFiles[key];
        const pi = item.projectInfo;
        item.gateEntries = [{ id: uid(), gate: pi.gate||'', manager: pi.manager||'', date: pi.year||'', tbd: pi.tbd||false, memo: item.memo||'', files: item.files||[], reports: item.reports||[], signatureDate: item.signatureDate||'', decisionDocument: item.decisionDocument||'', holdingActive: item.holdingActive||false, holdingReason: item.holdingReason||'', createdAt: item.createdAt||new Date().toISOString() }];
        item.projectName = pi.project || currentProjName;
        item.brand = pi.brand || brandName;
        item.product = pi.product || '';
        delete item.projectInfo; delete item.memo; delete item.files; delete item.reports; delete item.signatureDate; delete item.decisionDocument; delete item.holdingActive; delete item.holdingReason;
    }

    const ov = document.createElement('div');
    ov.id = 'project-detail-modal';
    ov.className = 'modal-overlay';
    const modalBox = document.createElement('div');
    modalBox.className = 'product-modal-content';
    modalBox.style.cssText = 'width:95%;max-width:860px;';
    modalBox.innerHTML = `
        <div class="modal-hdr green" style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <h3 id="pmod-title" style="margin:0;">${esc(currentProjName)}</h3>
                <span style="font-size:12px;color:rgba(255,255,255,0.75);">${esc(brandName)}${subKey !== '_direct' ? ' > '+esc(subKey) : ''}</span>
            </div>
            <button class="btn-close" style="background:transparent;border:none;color:white;font-size:22px;cursor:pointer;line-height:1;">×</button>
        </div>
        <div class="product-modal-body" id="pmod-body" style="padding:20px 24px;"></div>`;
    ov.appendChild(modalBox);
    ov.querySelector('.btn-close').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);

    /* Gate 색상 맵 */
    const GATE_COLOR = {
        'Go Define':    { bg:'#E3F2FD', color:'#1565C0', border:'#90CAF9' },
        'Go Develop':   { bg:'#E8F5E9', color:'#2E7D32', border:'#A5D6A7' },
        'Go Implement': { bg:'#FFF8E1', color:'#F57F17', border:'#FFD54F' },
        'Go Launch':    { bg:'#FCE4EC', color:'#880E4F', border:'#F48FB1' },
        'Closure':      { bg:'#F3E5F5', color:'#6A1B9A', border:'#CE93D8' },
        '':             { bg:'#F5F5F5', color:'#555',    border:'#DDD' }
    };
    function gateStyle(g) { return GATE_COLOR[g] || GATE_COLOR['']; }

    function render() {
        const data = releasedFiles[key];
        const body = ov.querySelector('#pmod-body');
        body.innerHTML = '';

        /* ── 상단: 프로젝트명 수정 + 전체 삭제 ── */
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #E8F5E9;';
        topBar.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;flex:1 1 280px;">
                <span style="font-size:13px;font-weight:600;color:#555;">프로젝트명</span>
                <input id="pmod-proj-name-input" value="${esc(data.projectName||currentProjName)}"
                    style="font-size:14px;font-weight:700;color:#1B5E20;border:1.5px solid #C8E6C9;border-radius:6px;padding:5px 9px;outline:none;width:200px;max-width:100%;" placeholder="프로젝트명">
                <button id="btn-pmod-rename" style="padding:5px 14px;background:#43A047;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">이름 저장</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                <span style="font-size:12px;color:#aaa;">${(data.gateEntries||[]).length}개 Gate 기록</span>
                <button id="btn-pmod-del-project" style="padding:5px 12px;background:white;color:#E53935;border:1.5px solid #E53935;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🗑 프로젝트 삭제</button>
            </div>`;
        body.appendChild(topBar);

        topBar.querySelector('#btn-pmod-rename').addEventListener('click', () => {
            const newName = topBar.querySelector('#pmod-proj-name-input').value.trim();
            if (!newName) { alert('프로젝트명을 입력하세요.'); return; }
            const oldName = data.projectName || currentProjName;
            if (oldName === newName) return;
            const newKey = subKey + '::' + newName;
            if (releasedFiles[newKey] && newKey !== key) { alert('이미 같은 이름의 프로젝트가 존재합니다.'); return; }
            const brd = projectData[currentYear]?.projects.find(p => p.name === brandName);
            if (brd?.products[subKey]) { const arr = brd.products[subKey]; const pos = arr.indexOf(oldName); if (pos !== -1) arr[pos] = newName; }
            releasedFiles[newKey] = releasedFiles[key];
            delete releasedFiles[key];
            releasedFiles[newKey].projectName = newName;
            // FIX: 파라미터 재할당 대신 currentProjName 업데이트
            currentProjName = newName;
            ov.querySelector('#pmod-title').textContent = newName;
            loadProducts(brandName, subKey);
            saveAll();
            ov.remove();
            showProjectModal(newName, subKey, brandName);
        });

        topBar.querySelector('#btn-pmod-del-project').addEventListener('click', () => {
            const nm = data.projectName || currentProjName;
            if (!confirm(`"${nm}" 프로젝트 전체를 삭제하시겠습니까?\n(모든 Gate 기록 포함, 되돌릴 수 없습니다.)`)) return;
            const brd = projectData[currentYear]?.projects.find(p => p.name === brandName);
            if (brd?.products[subKey]) { const arr = brd.products[subKey]; const pos = arr.indexOf(nm); if (pos !== -1) arr.splice(pos, 1); }
            delete releasedFiles[key];
            loadProducts(brandName, subKey);
            saveAll();
            ov.remove();
        });

        /* ── Gate 추가 버튼 ── */
        const addGateBar = document.createElement('div');
        addGateBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;';
        addGateBar.innerHTML = `
            <span style="font-size:14px;font-weight:700;color:#333;">📋 Gate 기록</span>
            <button id="btn-add-gate-entry" style="display:flex;align-items:center;gap:5px;padding:7px 16px;background:#1976D2;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 2px 6px rgba(25,118,210,.3);">
                <span style="font-size:18px;line-height:1;">+</span> Gate 추가
            </button>`;
        body.appendChild(addGateBar);
        addGateBar.querySelector('#btn-add-gate-entry').addEventListener('click', () => openGateForm(null));

        const gateEntries = data.gateEntries || [];
        if (gateEntries.length === 0) {
            const empty = document.createElement('div');
            empty.innerHTML = '<div style="text-align:center;padding:32px;color:#aaa;font-size:13px;background:#FAFAFA;border-radius:8px;border:1.5px dashed #DDD;">등록된 Gate 기록이 없습니다.<br>+ Gate 추가 버튼으로 첫 기록을 남겨보세요.</div>';
            body.appendChild(empty);
            return;
        }

        /* Gate 카드 목록 */
        const gateList = document.createElement('div');
        gateList.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        body.appendChild(gateList);

        gateEntries.forEach((entry) => {
            const gs = gateStyle(entry.gate);
            const card = document.createElement('div');
            card.style.cssText = `border:2px solid ${gs.border};border-radius:10px;overflow:hidden;`;

            const cardHdr = document.createElement('div');
            cardHdr.style.cssText = `display:flex;align-items:center;gap:12px;padding:12px 16px;background:${gs.bg};cursor:pointer;user-select:none;`;
            cardHdr.innerHTML = `
                <span style="font-weight:700;font-size:14px;color:${gs.color};padding:3px 14px;background:white;border-radius:20px;border:1.5px solid ${gs.border};">
                    ${entry.gate || '(Gate 미지정)'}
                </span>
                <span style="font-size:12px;color:#555;flex:1;">
                    ${entry.manager ? '👤 '+esc(entry.manager) : ''}
                    ${entry.date ? ' &nbsp;📅 '+esc(entry.date) : (entry.tbd ? ' &nbsp;<span style="color:#FF9800;font-weight:700">TBD</span>' : '')}
                </span>
                ${entry.files?.length ? `<span style="font-size:11px;color:#888;background:white;padding:2px 8px;border-radius:10px;">📎${entry.files.length}</span>` : ''}
                ${entry.holdingActive ? '<span style="font-size:11px;background:#FFF3E0;color:#E65100;padding:2px 8px;border-radius:10px;font-weight:600;">🔒 Holding</span>' : ''}
                <span class="g-toggle" style="font-size:11px;color:${gs.color};">▼</span>`;

            const cardBody = document.createElement('div');
            cardBody.style.cssText = 'display:none;padding:14px 16px;background:white;border-top:1.5px solid '+gs.border+';';
            cardBody.innerHTML = buildGateBody(entry);

            cardHdr.addEventListener('click', () => {
                const open = cardBody.style.display !== 'none';
                cardBody.style.display = open ? 'none' : 'block';
                cardHdr.querySelector('.g-toggle').style.transform = open ? '' : 'rotate(180deg)';
            });

            card.appendChild(cardHdr);
            card.appendChild(cardBody);
            gateList.appendChild(card);

            cardBody.querySelector('.btn-gate-edit').addEventListener('click', () => openGateForm(entry.id));
            cardBody.querySelector('.btn-gate-del').addEventListener('click', () => {
                if (!confirm(`"${entry.gate||'Gate'}" 기록을 삭제하시겠습니까?`)) return;
                const d2 = releasedFiles[key];
                const pos = d2.gateEntries.findIndex(e => e.id === entry.id);
                if (pos !== -1) d2.gateEntries.splice(pos, 1);
                loadProducts(brandName, subKey);
                saveAll();
                render();
            });
        });
    }

    function buildGateBody(entry) {
        let h = '<div>';
        h += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
            <div style="background:#F9F9F9;border-radius:6px;padding:8px 12px;"><div style="font-size:11px;color:#999;margin-bottom:2px;">담당자</div><div style="font-size:13px;font-weight:600;color:#333;">${esc(entry.manager||'-')}</div></div>
            <div style="background:#F9F9F9;border-radius:6px;padding:8px 12px;"><div style="font-size:11px;color:#999;margin-bottom:2px;">보고 날짜</div><div style="font-size:13px;font-weight:600;">${entry.tbd?'<span style="color:#FF9800;font-weight:700">TBD</span>':esc(entry.date||'-')}</div></div>
            <div style="background:#F9F9F9;border-radius:6px;padding:8px 12px;"><div style="font-size:11px;color:#999;margin-bottom:2px;">등록일</div><div style="font-size:12px;color:#555;">${entry.createdAt?entry.createdAt.slice(0,10):'-'}</div></div>
        </div>`;
        if (entry.memo) h += `<div style="background:#FFFDE7;border-left:3px solid #FDD835;padding:8px 12px;border-radius:0 6px 6px 0;font-size:13px;margin-bottom:10px;white-space:pre-wrap;">${esc(entry.memo)}</div>`;
        if (entry.files?.length) {
            h += `<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:600;color:#555;margin-bottom:5px;">📎 첨부파일 (${entry.files.length}개)</div><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
            entry.files.forEach(f => { h += `<span style="background:#E3F2FD;color:#1565C0;padding:3px 10px;border-radius:12px;font-size:12px;">📄 ${esc(f.name)}</span>`; });
            h += `</div></div>`;
        }
        if (entry.reports?.length) {
            h += `<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:600;color:#555;margin-bottom:5px;">보고 기록 (${entry.reports.length}건)</div><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#F5F5F5;"><th style="padding:5px 8px;border:1px solid #EEE;text-align:left;">보고 날짜</th><th style="padding:5px 8px;border:1px solid #EEE;">문서</th><th style="padding:5px 8px;border:1px solid #EEE;">유형</th><th style="padding:5px 8px;border:1px solid #EEE;">비고</th></tr></thead><tbody>`;
            entry.reports.forEach(r => {
                const badge = r.docType ? `<span class="doc-type-badge ${r.docType.toLowerCase()}">${esc(r.docType)}</span>` : '—';
                h += `<tr><td style="padding:5px 8px;border:1px solid #EEE;">${esc(r.reportDate||'-')}</td><td style="padding:5px 8px;border:1px solid #EEE;">${r.document?esc(r.document):'—'}</td><td style="padding:5px 8px;border:1px solid #EEE;text-align:center;">${badge}</td><td style="padding:5px 8px;border:1px solid #EEE;">${esc(r.meetingNote||'-')}</td></tr>`;
            });
            h += `</tbody></table></div>`;
        }
        if (entry.signatureDate || entry.decisionDocument) h += `<div style="margin-bottom:10px;background:#F3E5F5;padding:8px 12px;border-radius:6px;font-size:12px;"><span style="color:#6A1B9A;font-weight:600;">결재일: </span>${esc(entry.signatureDate||'-')} &nbsp;<span style="color:#6A1B9A;font-weight:600;">문서: </span>${entry.decisionDocument?esc(entry.decisionDocument):'—'}</div>`;
        if (entry.holdingActive) h += `<div style="margin-bottom:10px;background:#FFF3E0;border-left:3px solid #FF9800;padding:8px 12px;border-radius:0 6px 6px 0;font-size:13px;"><span style="font-weight:700;color:#E65100;">🔒 Holding 중</span> &nbsp;사유: ${esc(entry.holdingReason||'미입력')}</div>`;
        h += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #EEE;">
            <button class="btn-gate-edit" style="padding:5px 14px;background:white;color:#1976D2;border:1.5px solid #1976D2;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">✏️ 수정</button>
            <button class="btn-gate-del" style="padding:5px 14px;background:white;color:#E53935;border:1.5px solid #E53935;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">🗑 삭제</button>
        </div></div>`;
        return h;
    }

    function openGateForm(entryId) {
        document.getElementById('gate-form-overlay')?.remove();
        const data = releasedFiles[key];
        const existing = entryId ? data.gateEntries.find(e => e.id === entryId) : null;
        const isEdit = !!existing;
        const entry = existing
            ? JSON.parse(JSON.stringify(existing))
            : { id: uid(), gate:'', manager:'', date:'', tbd:false, memo:'', files:[], reports:[], signatureDate:'', decisionDocument:'', holdingActive:false, holdingReason:'', createdAt: new Date().toISOString() };

        /* 파일 목록 작업용 배열 (기존 파일 복사 + 새 파일 추가) */
        const fileList = (entry.files || []).map(f => ({ ...f, _isExisting: true }));
        if (fileList.length === 0) fileList.push({ name:'', size:0, type:'', _isExisting:false });

        const fo = document.createElement('div');
        fo.id = 'gate-form-overlay';
        fo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:4000;display:flex;align-items:center;justify-content:center;';
        fo.innerHTML = `
            <div id="gf-inner" style="background:white;border-radius:12px;width:min(580px,92vw);max-height:90vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.25);animation:slideUp .25s;display:flex;flex-direction:column;">
                <!-- 헤더 -->
                <div style="background:#1565C0;color:white;padding:14px 20px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                    <h4 style="margin:0;font-size:15px;">${isEdit ? '✏️ Gate 기록 수정' : '+ 새 Gate 기록 추가'} — ${esc(data.projectName || currentProjName)}</h4>
                    <button id="btn-gf-close" style="background:transparent;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;">×</button>
                </div>
                <!-- 바디 -->
                <div style="padding:20px;flex:1;overflow-y:auto;">
                    <!-- Gate / 담당자 -->
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px;">
                        <div>
                            <label style="display:block;font-size:12px;font-weight:600;color:#424242;margin-bottom:5px;">Gate *</label>
                            <select id="gf-gate" style="width:100%;padding:9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                                <option value="">선택</option>
                                <option ${entry.gate==='Go Define'?'selected':''}>Go Define</option>
                                <option ${entry.gate==='Go Develop'?'selected':''}>Go Develop</option>
                                <option ${entry.gate==='Go Implement'?'selected':''}>Go Implement</option>
                                <option ${entry.gate==='Go Launch'?'selected':''}>Go Launch</option>
                                <option ${entry.gate==='Closure'?'selected':''}>Closure</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block;font-size:12px;font-weight:600;color:#424242;margin-bottom:5px;">담당자</label>
                            <input id="gf-manager" type="text" value="${esc(entry.manager)}" placeholder="담당자 입력"
                                style="width:100%;padding:9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                        </div>
                    </div>
                    <!-- 보고 날짜 / TBD -->
                    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px;">
                        <div>
                            <label style="display:block;font-size:12px;font-weight:600;color:#424242;margin-bottom:5px;">보고 날짜</label>
                            <input id="gf-date" type="date" value="${entry.date||''}" ${entry.tbd?'disabled':''}
                                style="width:100%;padding:9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;">
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;padding-top:22px;">
                            <input type="checkbox" id="gf-tbd" ${entry.tbd?'checked':''} style="width:16px;height:16px;cursor:pointer;">
                            <label for="gf-tbd" style="font-size:13px;font-weight:600;color:#FF9800;cursor:pointer;">TBD (보고 날짜 미정)</label>
                        </div>
                    </div>
                    <!-- 메모 -->
                    <div style="margin-bottom:16px;">
                        <label style="display:block;font-size:12px;font-weight:600;color:#424242;margin-bottom:5px;">메모</label>
                        <textarea id="gf-memo" placeholder="이 Gate에 대한 메모..."
                            style="width:100%;padding:9px;border:1.5px solid #BDBDBD;border-radius:6px;font-size:13px;outline:none;min-height:65px;resize:vertical;">${esc(entry.memo||'')}</textarea>
                    </div>
                    <!-- 첨부파일 섹션 -->
                    <div style="background:#F1F8E9;border:1.5px solid #C5E1A5;border-radius:8px;padding:14px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                            <span style="font-size:13px;font-weight:700;color:#33691E;">📎 첨부파일</span>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span id="gf-file-count" style="font-size:11px;color:#558B2F;background:#DCEDC8;padding:2px 8px;border-radius:10px;"></span>
                                <button id="btn-gf-add-file"
                                    style="width:28px;height:28px;border:2px solid #558B2F;background:white;color:#558B2F;border-radius:6px;cursor:pointer;font-size:18px;font-weight:bold;display:flex;align-items:center;justify-content:center;transition:all .2s;"
                                    title="파일 항목 추가"
                                    onmouseover="this.style.background='#558B2F';this.style.color='white';"
                                    onmouseout="this.style.background='white';this.style.color='#558B2F';">+</button>
                            </div>
                        </div>
                        <div id="gf-file-rows" style="display:flex;flex-direction:column;gap:7px;"></div>
                    </div>
                </div>
                <!-- 푸터 -->
                <div style="padding:14px 20px;border-top:1px solid #EEE;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;">
                    <button id="btn-gf-cancel" style="padding:8px 20px;background:white;color:#555;border:1.5px solid #9E9E9E;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">취소</button>
                    <button id="btn-gf-save" style="padding:8px 24px;background:#1976D2;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">저장</button>
                </div>
            </div>`;

        document.body.appendChild(fo);

        /* ── 파일 행 렌더링 ── */
        function renderGfFiles() {
            const container = fo.querySelector('#gf-file-rows');
            container.innerHTML = '';

            fileList.forEach((fd, idx) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:8px;background:white;border:1.5px solid #C8E6C9;border-radius:7px;padding:7px 10px;';

                const hasFile = !!fd.name;
                row.innerHTML = `
                    <span style="min-width:20px;font-size:12px;color:#888;font-weight:600;text-align:right;">${idx+1}</span>
                    <span class="gf-fname" style="flex:1;font-size:13px;color:${hasFile?'#1B5E20':'#bbb'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${hasFile ? esc(fd.name) : '파일을 선택하세요'}
                    </span>
                    ${hasFile && fd.size ? `<span style="font-size:11px;color:#888;white-space:nowrap;flex-shrink:0;">${fmtSize(fd.size)}</span>` : ''}
                    <button class="gf-btn-choose" style="flex-shrink:0;padding:4px 11px;background:${hasFile?'#E8F5E9':'#1976D2'};color:${hasFile?'#2E7D32':'white'};border:1.5px solid ${hasFile?'#A5D6A7':'#1976D2'};border-radius:5px;cursor:pointer;font-size:11px;font-weight:600;white-space:nowrap;">
                        ${hasFile ? '변경' : '선택'}
                    </button>
                    <button class="gf-btn-remove" title="제거"
                        style="flex-shrink:0;width:24px;height:24px;border:1.5px solid #EF9A9A;background:white;color:#E53935;border-radius:5px;cursor:${fileList.length <= 1 && !hasFile ? 'not-allowed' : 'pointer'};font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;${fileList.length <= 1 && !hasFile ? 'opacity:0.35;' : ''}"
                        ${fileList.length <= 1 && !hasFile ? 'disabled' : ''}>×</button>`;

                /* 선택 버튼 */
                row.querySelector('.gf-btn-choose').addEventListener('click', () => {
                    const inp = document.createElement('input');
                    inp.type = 'file';
                    inp.accept = '.pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.hwp,.txt,.zip,.rar,.7z,.png,.jpg,.jpeg,.gif,.mp4,.mov';
                    inp.addEventListener('change', e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        fileList[idx] = { name: f.name, size: f.size, type: f.type, lastModified: f.lastModified, _isExisting: false };
                        renderGfFiles();
                        updateGfFileCount();
                    });
                    inp.click();
                });

                /* 제거 버튼 */
                row.querySelector('.gf-btn-remove').addEventListener('click', () => {
                    if (fileList.length <= 1 && !hasFile) return;
                    if (fileList.length <= 1) {
                        fileList[0] = { name:'', size:0, type:'', _isExisting:false };
                    } else {
                        // FIX: splice(idx) 클로저 불일치 방지 → 객체 참조로 위치 재탐색
                        const curIdx = fileList.indexOf(fd);
                        if (curIdx !== -1) fileList.splice(curIdx, 1);
                    }
                    renderGfFiles();
                    updateGfFileCount();
                });

                container.appendChild(row);
            });

            updateGfFileCount();
        }

        function updateGfFileCount() {
            const count = fileList.filter(f => f.name).length;
            const el = fo.querySelector('#gf-file-count');
            if (el) el.textContent = count > 0 ? `${count}개 선택됨` : '없음';
        }

        /* + 파일 항목 추가 버튼 */
        fo.querySelector('#btn-gf-add-file').addEventListener('click', () => {
            fileList.push({ name:'', size:0, type:'', _isExisting:false });
            renderGfFiles();
            /* 새 항목으로 스크롤 */
            setTimeout(() => {
                const rows = fo.querySelector('#gf-file-rows');
                rows?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'nearest' });
            }, 80);
        });

        /* TBD 토글 */
        fo.querySelector('#gf-tbd').addEventListener('change', e => {
            fo.querySelector('#gf-date').disabled = e.target.checked;
            if (e.target.checked) fo.querySelector('#gf-date').value = '';
        });

        const closeForm = () => fo.remove();
        fo.querySelector('#btn-gf-close').addEventListener('click', closeForm);
        fo.querySelector('#btn-gf-cancel').addEventListener('click', closeForm);
        fo.addEventListener('click', e => { if (e.target === fo) closeForm(); });

        /* 저장 */
        fo.querySelector('#btn-gf-save').addEventListener('click', () => {
            const gateVal = fo.querySelector('#gf-gate').value;
            if (!gateVal) { alert('Gate를 선택하세요.'); return; }
            entry.gate    = gateVal;
            entry.manager = fo.querySelector('#gf-manager').value.trim();
            entry.tbd     = fo.querySelector('#gf-tbd').checked;
            entry.date    = entry.tbd ? '' : fo.querySelector('#gf-date').value;
            entry.memo    = fo.querySelector('#gf-memo').value.trim();
            /* 비어있지 않은 파일만 저장 */
            entry.files   = fileList.filter(f => f.name).map(({ _isExisting, ...rest }) => rest);

            const d2 = releasedFiles[key];
            if (!d2.gateEntries) d2.gateEntries = [];
            if (isEdit) {
                const pos = d2.gateEntries.findIndex(e => e.id === entry.id);
                if (pos !== -1) d2.gateEntries[pos] = entry;
            } else {
                d2.gateEntries.push(entry);
            }
            loadProducts(brandName, subKey);
            saveAll();
            closeForm();
            render();
        });

        /* 초기 렌더 */
        renderGfFiles();
        setTimeout(() => fo.querySelector('#gf-gate')?.focus(), 80);
    }

    render();
}

function buildDetail(data) {
    /* 하위 호환: gateEntries 구조 첫 항목 단순 표시 */
    const entry = data.gateEntries?.[0];
    if (!entry) return '<p class="empty-message">기록 없음</p>';
    return `<div class="modal-section"><div class="modal-section-title">프로젝트 정보</div><div class="info-grid">
        <div class="info-item"><span class="info-label">브랜드</span><span class="info-value">${esc(data.brand||'-')}</span></div>
        <div class="info-item"><span class="info-label">제품명</span><span class="info-value">${esc(data.product||'-')}</span></div>
        <div class="info-item"><span class="info-label">프로젝트</span><span class="info-value">${esc(data.projectName||'-')}</span></div>
        <div class="info-item"><span class="info-label">담당자</span><span class="info-value">${esc(entry.manager||'-')}</span></div>
        <div class="info-item"><span class="info-label">Gate</span><span class="info-value">${esc(entry.gate||'-')}</span></div>
        <div class="info-item"><span class="info-label">일자</span><span class="info-value">${entry.tbd?'<span style="color:#FF9800;font-weight:700">TBD</span>':esc(entry.date||'-')}</span></div>
    </div></div>`;
}

/* ─── ARCHIVE 버튼 초기화 ─── */
function initArchiveBtns() {
    // FIX: 연도 추가 버튼
    document.getElementById('btn-add-year').addEventListener('click', function () {
        const yr = prompt('추가할 연도를 입력하세요 (예: 2026):');
        if (!yr) return;
        const t = yr.trim();
        if (!/^\d{4}$/.test(t)) { alert('4자리 숫자만 입력 가능합니다!\n예: 2026'); return; }
        if (projectData[t]) { alert(`"${t}"은(는) 이미 등록된 연도입니다!`); return; }
        projectData[t] = { projects: [] };
        // FIX: 새로 추가한 연도를 자동 선택
        renderYears(t);
        saveAll();
    });

    // FIX: 브랜드(상위폴더) 추가 버튼
    document.getElementById('btn-add-brand').addEventListener('click', function () {
        if (!currentYear) { alert('먼저 좌측에서 연도를 선택하세요!'); return; }
        const name = prompt(`[${currentYear}] 추가할 브랜드(상위폴더)명:`);
        if (!name || !name.trim()) return;
        const trimName = name.trim();

        if (!projectData[currentYear]) projectData[currentYear] = { projects: [] };
        if (projectData[currentYear].projects.some(p => p.name === trimName)) {
            alert(`"${trimName}"은(는) 이미 존재하는 브랜드명입니다!`);
            return;
        }
        projectData[currentYear].projects.push({
            name: trimName,
            subProjects: [],
            products: { '_direct': [] }
        });
        // FIX: 트리 재렌더링 후 추가된 브랜드 유지
        currentBrand = trimName;
        currentSub = '_direct';
        renderTree();
        updateBrandOpts();
        saveAll();
        // 자동으로 해당 브랜드의 _direct 로드
        loadProducts(trimName, '_direct');
    });
}

/* ─── 하위폴더 추가 ─── */
function addSub(brand) {
    if (!currentYear) return;
    const name = prompt(`"${brand.name}" 에 추가할 하위폴더명:`);
    if (!name?.trim()) return;
    const trimName = name.trim();
    const p = projectData[currentYear]?.projects.find(pr => pr.name === brand.name);
    if (!p) return;
    if (!p.subProjects) p.subProjects = [];
    if (p.subProjects.includes(trimName)) { alert(`"${trimName}"은(는) 이미 존재하는 폴더명입니다!`); return; }
    p.subProjects.push(trimName);
    if (!p.products) p.products = { '_direct': [] };
    p.products[trimName] = [];
    // FIX: 트리 재렌더링 후 현재 브랜드 상태 유지 및 새 하위폴더 자동 선택
    currentBrand = brand.name;
    currentSub = trimName;
    renderTree();
    saveAll();
    loadProducts(brand.name, trimName);
}

/* ─── 수정 모달 (브랜드/하위폴더) ─── */
function showEditModal(opts) {
    document.getElementById('edit-modal')?.remove();
    const ov = document.createElement('div');
    ov.id = 'edit-modal';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
        <div class="modal-box" style="width:420px">
            <div class="modal-hdr orange"><h3>${esc(opts.title)}</h3><button class="btn-close">×</button></div>
            <div class="modal-body-edit">
                <label>현재 이름</label>
                <div class="current-val">${esc(opts.currentName)}</div>
                <label>새 이름</label>
                <input type="text" id="edit-input" value="${esc(opts.currentName)}">
            </div>
            <div class="modal-footer">
                <button class="btn-del">삭제</button>
                <div class="btn-group">
                    <button class="btn-cancel">취소</button>
                    <button class="btn-save-modal">저장</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(ov);
    const input = document.getElementById('edit-input');
    setTimeout(() => { input.focus(); input.select(); }, 100);
    const close = () => ov.remove();
    ov.querySelector('.btn-close').addEventListener('click', close);
    ov.querySelector('.btn-cancel').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') ov.querySelector('.btn-save-modal').click();
        if (e.key === 'Escape') close();
    });
    ov.querySelector('.btn-save-modal').addEventListener('click', () => {
        const n = input.value.trim();
        if (!n) { alert('이름을 입력하세요.'); return; }
        if (n === opts.currentName) { close(); return; }
        if (opts.onSave(n) !== false) close();
    });
    ov.querySelector('.btn-del').addEventListener('click', () => {
        if (opts.onDelete?.() !== false) close();
    });
}

/* ─── 브랜드 편집/삭제 ─── */
function editBrand(bn) {
    if (!currentYear || !projectData[currentYear]) return;
    const idx = projectData[currentYear].projects.findIndex(p => p.name === bn);
    if (idx === -1) return;
    showEditModal({
        title: '브랜드 수정',
        currentName: bn,
        onSave(n) {
            if (projectData[currentYear].projects.some((p, i) => i !== idx && p.name === n)) { alert('이미 존재하는 이름입니다.'); return false; }
            const old = projectData[currentYear].projects[idx].name;
            projectData[currentYear].projects[idx].name = n;
            historyRecords.forEach(r => { if (r.brand === old) r.brand = n; });
            Object.keys(releasedFiles).forEach(k => {
                if (releasedFiles[k].brand === old) releasedFiles[k].brand = n;
            });
            if (currentBrand === old) currentBrand = n;
            renderTree();
            updateBrandOpts();
            renderHistory();
            saveAll();
        },
        onDelete() {
            if (!confirm(`"${bn}" 브랜드를 삭제하시겠습니까?\n하위 프로젝트도 모두 삭제됩니다.`)) return false;
            projectData[currentYear].projects.splice(idx, 1);
            // FIX: 브랜드 삭제 시 releasedFiles에서 해당 브랜드 관련 키 정리 (데이터 누수 방지)
            Object.keys(releasedFiles).forEach(k => {
                if (releasedFiles[k].brand === bn) delete releasedFiles[k];
            });
            // FIX: 삭제 후 패널 초기화
            if (currentBrand === bn) {
                currentBrand = null; currentSub = null;
                document.getElementById('right-panel-title').textContent = '제품 목록';
                document.getElementById('product-detail').innerHTML = '<p class="empty-message">브랜드를 선택하세요</p>';
            }
            renderTree();
            updateBrandOpts();
            saveAll();
        }
    });
}

/* ─── 하위폴더 편집/삭제 ─── */
function editSub(bn, sn) {
    if (!currentYear) return;
    const brand = projectData[currentYear].projects.find(p => p.name === bn);
    if (!brand) return;
    const si = brand.subProjects.indexOf(sn);
    if (si === -1) return;
    showEditModal({
        title: '하위폴더 수정',
        currentName: sn,
        onSave(n) {
            if (brand.subProjects.some((s, i) => i !== si && s === n)) { alert('이미 존재하는 폴더명입니다.'); return false; }
            brand.subProjects[si] = n;
            // products 키 이름 변경
            if (brand.products?.[sn] !== undefined) {
                brand.products[n] = brand.products[sn];
                delete brand.products[sn];
            }
            // FIX: 이터레이션 중 키 삭제 불안정 → 사전에 키 목록 추출 후 처리
            const keysToRename = Object.keys(releasedFiles).filter(k => k.startsWith(sn + '::'));
            keysToRename.forEach(k => {
                const pName = k.split('::').slice(1).join('::');
                releasedFiles[n + '::' + pName] = releasedFiles[k];
                delete releasedFiles[k];
            });
            if (currentSub === sn) currentSub = n;
            renderTree();
            saveAll();
            // FIX: 이름 변경 후 해당 폴더 유지
            if (currentBrand === bn) loadProducts(bn, n);
        },
        onDelete() {
            if (!confirm(`"${sn}" 폴더를 삭제하시겠습니까?\n폴더 내 프로젝트도 모두 삭제됩니다.`)) return false;
            brand.subProjects.splice(si, 1);
            // FIX: products 키 삭제
            if (brand.products) delete brand.products[sn];
            // FIX: 이터레이션 중 키 삭제 불안정 → 사전에 키 목록 추출 후 처리
            const keysToDelete = Object.keys(releasedFiles).filter(k => k.startsWith(sn + '::'));
            keysToDelete.forEach(k => { delete releasedFiles[k]; });
            // FIX: 삭제 후 패널 초기화
            if (currentSub === sn) {
                currentSub = null;
                document.getElementById('right-panel-title').textContent = `${bn} - 프로젝트`;
                document.getElementById('product-detail').innerHTML = '<p class="empty-message">폴더가 삭제되었습니다</p>';
            }
            renderTree();
            saveAll();
        }
    });
}

/* ─── TBD / Decision / Holding ─── */
function initTBD() {
    document.getElementById('ongoing-tbd').addEventListener('change', function () { toggleTBD(this.checked); });
}
function toggleTBD(on) {
    const i = document.getElementById('ongoing-year'), g = document.getElementById('year-group'), c = document.getElementById('tbd-container');
    if (on) { i.disabled = true; i.value = ''; g.classList.add('disabled'); c.classList.add('active'); }
    else { i.disabled = false; g.classList.remove('disabled'); c.classList.remove('active'); }
}
function checkDecision() {
    let g = false;
    document.querySelectorAll('#report-tbody .doc-type-select').forEach(s => { if (s.value === 'Go') g = true; });
    const sec = document.getElementById('decision-section'), di = document.getElementById('decision-date'), ub = document.getElementById('decision-upload-btn');
    if (g) { sec.classList.remove('disabled'); di.disabled = false; ub.disabled = false; }
    else { sec.classList.add('disabled'); di.disabled = true; ub.disabled = true; }
}
function initDocTypeWatch() {
    document.addEventListener('change', e => { if (e.target.classList.contains('doc-type-select')) { styleDocType(e.target); checkDecision(); } });
}
function styleDocType(s) {
    s.classList.remove('type-status', 'type-go');
    if (s.value === 'Status') s.classList.add('type-status');
    else if (s.value === 'Go') s.classList.add('type-go');
}
function initHolding() {
    const cb = document.getElementById('holding-toggle'), co = document.getElementById('holding-cb-container');
    cb.addEventListener('change', () => toggleHolding(cb.checked));
    // FIX: htmlFor는 label 외 요소에서 undefined → tagName 비교로 수정
    co.addEventListener('click', e => { if (e.target !== cb && e.target.tagName !== 'LABEL') { cb.checked = !cb.checked; toggleHolding(cb.checked); } });
}
function toggleHolding(on) {
    const co = document.getElementById('holding-cb-container'), se = document.getElementById('holding-section'), de = document.getElementById('holding-detail'), st = document.getElementById('holding-status'), ms = document.getElementById('holding-disabled-msg'), ip = document.getElementById('holding-reason');
    if (on) { co.classList.add('active'); se.classList.remove('disabled-holding'); de.classList.add('expanded'); st.textContent = '프로젝트 홀딩 중'; st.classList.add('on'); ms.style.display = 'none'; ip.disabled = false; setTimeout(() => ip.focus(), 300); }
    else { co.classList.remove('active'); se.classList.add('disabled-holding'); de.classList.remove('expanded'); st.textContent = '체크하면 홀딩 사유를 입력합니다'; st.classList.remove('on'); ms.style.display = 'block'; ip.disabled = true; ip.value = ''; }
}

/* ─── 보고 테이블 ─── */
function createReportRow(d) {
    const r = document.createElement('tr');
    r.innerHTML = `<td><input type="date" class="table-input rpt-date" value="${d?.reportDate || ''}"></td><td><div class="doc-upload-cell" ${d?.document ? `data-file-name="${esc(d.document)}"` : ''}><button class="btn-upload ${d?.document ? 'uploaded' : ''}">${d?.document ? '변경' : '선택'}</button><span class="doc-file-name">${esc(d?.document || '')}</span><button class="btn-del-doc" style="display:${d?.document ? 'flex' : 'none'}">×</button></div></td><td><select class="doc-type-select"><option value="">선택</option><option value="Status" ${d?.docType === 'Status' ? 'selected' : ''}>Status</option><option value="Go" ${d?.docType === 'Go' ? 'selected' : ''}>Go</option></select></td><td><input type="text" class="table-input rpt-note" placeholder="비고" value="${esc(d?.meetingNote || '')}"></td><td><button class="btn-del-row">×</button></td>`;
    const s = r.querySelector('.doc-type-select');
    if (s) styleDocType(s);
    r.querySelector('.btn-del-row').addEventListener('click', () => {
        if (document.getElementById('report-tbody').rows.length <= 1) { alert('최소 1행은 유지해야 합니다.'); return; }
        if (confirm('이 행을 삭제하시겠습니까?')) { r.style.opacity = '0'; r.style.transition = 'opacity .3s'; setTimeout(() => { r.remove(); checkDecision(); }, 300); }
    });
    return r;
}
function addReportRow(d) {
    const tb = document.getElementById('report-tbody'), r = createReportRow(d);
    tb.appendChild(r);
    if (!d) { r.style.backgroundColor = '#e8f5e9'; setTimeout(() => { r.style.transition = 'background-color .5s'; r.style.backgroundColor = ''; }, 100); }
}
function initReportTable() {
    addReportRow();
    document.getElementById('btn-add-report-row').addEventListener('click', () => addReportRow());
}
function initDocUpload() {
    document.getElementById('ongoing-content').addEventListener('click', e => {
        if (e.target.classList.contains('btn-upload') && !e.target.disabled) {
            const c = e.target.closest('.doc-upload-cell');
            if (!c) return;
            const i = document.createElement('input');
            i.type = 'file'; i.accept = '.pdf,.doc,.docx,.xlsx,.ppt,.pptx';
            i.addEventListener('change', ev => {
                const f = ev.target.files[0]; if (!f) return;
                c.dataset.fileName = f.name; c.querySelector('.doc-file-name').textContent = f.name;
                const b = c.querySelector('.btn-upload'); b.textContent = '변경'; b.classList.add('uploaded');
                c.querySelector('.btn-del-doc').style.display = 'flex';
            });
            i.click();
        }
        if (e.target.classList.contains('btn-del-doc')) {
            const c = e.target.closest('.doc-upload-cell');
            if (!c || !confirm('첨부 파일을 삭제하시겠습니까?')) return;
            delete c.dataset.fileName; c.querySelector('.doc-file-name').textContent = '';
            const b = c.querySelector('.btn-upload'); b.textContent = '선택'; b.classList.remove('uploaded');
            c.querySelector('.btn-del-doc').style.display = 'none';
        }
    });
}
function collectReports() {
    const rp = [];
    document.querySelectorAll('#report-tbody tr').forEach(r => {
        const d = r.querySelector('.rpt-date')?.value || '', dc = r.querySelector('.doc-upload-cell')?.dataset.fileName || '', ty = r.querySelector('.doc-type-select')?.value || '', no = r.querySelector('.rpt-note')?.value || '';
        if (d || dc || ty || no) rp.push({ reportDate: d, document: dc, docType: ty, meetingNote: no });
    });
    return rp;
}

/* ─── 저장 버튼 ─── */
function initSaveBtn() { document.getElementById('btn-save').addEventListener('click', saveOngoing); }
function saveOngoing() {
    const br = document.getElementById('ongoing-brand').value, pr = document.getElementById('ongoing-product').value.trim(), pj = document.getElementById('ongoing-project').value.trim(), gt = document.getElementById('ongoing-gate').value, yr = document.getElementById('ongoing-year').value, td = document.getElementById('ongoing-tbd').checked, mg = document.getElementById('ongoing-manager').value.trim();
    const m = [];
    if (!br) m.push('브랜드'); if (!pr) m.push('제품명'); if (!pj) m.push('프로젝트명'); if (!gt) m.push('Gate'); if (!yr && !td) m.push('일자/TBD');
    if (m.length) { alert('필수 항목을 입력하세요:\n- ' + m.join('\n- ')); return; }
    const rp = collectReports(), ho = document.getElementById('holding-toggle').checked;
    const holdingReason = ho ? (document.getElementById('holding-reason').value || '') : '';
    historyRecords.push({ id: uid(), brand: br, product: pr, project: pj, gate: gt, year: yr, tbd: td, manager: mg, reports: rp, signatureDate: document.getElementById('decision-date').value || '', decisionDocument: document.getElementById('decision-upload-cell')?.dataset.fileName || '', holdingActive: ho, holdingReason: holdingReason, holdingResolved: false, holdingResolveNote: '', holdingSetAt: ho ? new Date().toISOString() : '', released: false, createdAt: new Date().toISOString() });
    renderHistory(); saveAll(); alert('저장되었습니다!');
    if (confirm('입력 폼을 초기화하시겠습니까?')) clearForm();
}
function initEditBtns() {
    document.getElementById('btn-update').addEventListener('click', updateRecord);
    document.getElementById('btn-cancel-edit').addEventListener('click', () => { if (confirm('수정을 취소하시겠습니까?')) { setEditMode(false); clearForm(); } });
}
function editRecord(id) {
    const rec = historyRecords.find(r => r.id === id); if (!rec) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="ongoing"]').classList.add('active');
    document.getElementById('ongoing-content').classList.add('active');
    document.getElementById('page-title').textContent = 'II. Ongoing Projects';
    updateBrandOpts();
    document.getElementById('ongoing-brand').value = rec.brand;
    document.getElementById('ongoing-product').value = rec.product;
    document.getElementById('ongoing-project').value = rec.project;
    document.getElementById('ongoing-gate').value = rec.gate;
    document.getElementById('ongoing-year').value = rec.year;
    document.getElementById('ongoing-manager').value = rec.manager || '';
    document.getElementById('ongoing-tbd').checked = rec.tbd;
    toggleTBD(rec.tbd);
    const tb = document.getElementById('report-tbody');
    tb.innerHTML = '';
    if (rec.reports?.length) rec.reports.forEach(r => addReportRow(r)); else addReportRow();
    checkDecision();
    document.getElementById('decision-date').value = rec.signatureDate || '';
    const dc = document.getElementById('decision-upload-cell');
    if (rec.decisionDocument) { dc.dataset.fileName = rec.decisionDocument; dc.querySelector('.doc-file-name').textContent = rec.decisionDocument; dc.querySelector('.btn-upload').textContent = '변경'; dc.querySelector('.btn-upload').classList.add('uploaded'); dc.querySelector('.btn-del-doc').style.display = 'flex'; }
    document.getElementById('holding-toggle').checked = rec.holdingActive || false;
    toggleHolding(rec.holdingActive || false);
    setTimeout(() => { document.getElementById('holding-reason').value = rec.holdingReason || ''; }, 50);
    editingId = id; setEditMode(true);
    document.getElementById('edit-indicator')?.remove();
    const ind = document.createElement('div'); ind.className = 'edit-indicator'; ind.id = 'edit-indicator'; ind.textContent = `수정 중: [${rec.brand}] ${rec.project}`;
    document.querySelector('.ongoing-container .panel-title').insertAdjacentElement('afterend', ind);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function updateRecord() {
    if (!editingId) return;
    const idx = historyRecords.findIndex(r => r.id === editingId); if (idx === -1) return;
    const br = document.getElementById('ongoing-brand').value, pr = document.getElementById('ongoing-product').value.trim(), pj = document.getElementById('ongoing-project').value.trim(), gt = document.getElementById('ongoing-gate').value, yr = document.getElementById('ongoing-year').value, td = document.getElementById('ongoing-tbd').checked;
    const m = [];
    if (!br) m.push('브랜드'); if (!pr) m.push('제품명'); if (!pj) m.push('프로젝트명'); if (!gt) m.push('Gate'); if (!yr && !td) m.push('일자/TBD');
    if (m.length) { alert('필수 항목을 입력하세요:\n- ' + m.join('\n- ')); return; }
    const ho = document.getElementById('holding-toggle').checked;
    const prevRec = historyRecords[idx];
    const newHoldingReason = ho ? (document.getElementById('holding-reason').value || '') : '';
    // 홀딩이 새로 켜진 경우 holdingSetAt 갱신, 꺼진 경우 holdingResolved 처리
    const wasHolding = prevRec.holdingActive;
    const holdingSetAt = ho ? (wasHolding ? prevRec.holdingSetAt : new Date().toISOString()) : prevRec.holdingSetAt || '';
    const holdingResolved = !ho && wasHolding ? true : (ho ? false : prevRec.holdingResolved);
    historyRecords[idx] = { ...prevRec, brand: br, product: pr, project: pj, gate: gt, year: yr, tbd: td, manager: document.getElementById('ongoing-manager').value.trim(), reports: collectReports(), signatureDate: document.getElementById('decision-date').value || '', decisionDocument: document.getElementById('decision-upload-cell')?.dataset.fileName || '', holdingActive: ho, holdingReason: newHoldingReason, holdingResolved: holdingResolved, holdingSetAt: holdingSetAt, updatedAt: new Date().toISOString() };
    renderHistory(); saveAll(); setEditMode(false); alert('수정되었습니다!');
    if (confirm('입력 폼을 초기화하시겠습니까?')) clearForm();
}
function setEditMode(on) {
    document.getElementById('btn-save').style.display = on ? 'none' : 'inline-block';
    document.getElementById('btn-update').style.display = on ? 'inline-block' : 'none';
    document.getElementById('btn-cancel-edit').style.display = on ? 'inline-block' : 'none';
    if (!on) { editingId = null; document.getElementById('edit-indicator')?.remove(); }
}
function clearForm() {
    ['ongoing-brand', 'ongoing-gate'].forEach(id => document.getElementById(id).value = '');
    ['ongoing-product', 'ongoing-project', 'ongoing-year', 'ongoing-manager'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ongoing-tbd').checked = false; toggleTBD(false);
    document.getElementById('report-tbody').innerHTML = ''; addReportRow();
    document.getElementById('decision-date').value = '';
    // FIX: decision-upload-cell null 체크
    const dc = document.getElementById('decision-upload-cell');
    if (dc) {
        delete dc.dataset.fileName; dc.querySelector('.doc-file-name').textContent = '';
        dc.querySelector('.btn-upload').textContent = '선택'; dc.querySelector('.btn-upload').classList.remove('uploaded');
        dc.querySelector('.btn-del-doc').style.display = 'none';
    }
    document.getElementById('holding-toggle').checked = false; toggleHolding(false); checkDecision();
}

/* ─── Release ─── */
function releaseProject(id) {
    const rec = historyRecords.find(r => r.id === id); if (!rec) { alert('기록을 찾을 수 없습니다.'); return; }
    if (rec.gate !== 'Closure') { alert('Closure 단계에서만 Release 가능합니다.'); return; }
    if (rec.tbd || !rec.year) { alert('TBD 상태에서는 Release할 수 없습니다.'); return; }
    let ty;
    try { const d = new Date(rec.year); if (isNaN(d.getTime())) throw 0; ty = d.getFullYear().toString(); } catch { alert('일자 형식 오류'); return; }
    if (!confirm(`Release 하시겠습니까?\n[${ty}] > [${rec.brand}] > [${rec.product}] > [${rec.project}]`)) return;
    if (!projectData[ty]) projectData[ty] = { projects: [] };
    let brand = projectData[ty].projects.find(p => p.name === rec.brand);
    if (!brand) { brand = { name: rec.brand, subProjects: [], products: { '_direct': [] } }; projectData[ty].projects.push(brand); }
    if (!brand.subProjects) brand.subProjects = [];
    if (!brand.products) brand.products = { '_direct': [] };
    // FIX: rec.product 빈값이면 _direct에 등록 (빈 키 방지)
    const productKey = rec.product || '_direct';
    if (rec.product && !brand.subProjects.includes(rec.product)) brand.subProjects.push(rec.product);
    if (!brand.products[productKey]) brand.products[productKey] = [];
    if (!brand.products[productKey].includes(rec.project)) brand.products[productKey].push(rec.project);
    const key = productKey + '::' + rec.project;
    releasedFiles[key] = {
        projectName: rec.project,
        brand: rec.brand,
        product: rec.product,
        manualEntry: false,
        gateEntries: [{
            id: uid(),
            gate: rec.gate,
            manager: rec.manager || '',
            date: rec.year || '',
            tbd: rec.tbd || false,
            memo: '',
            files: [],
            reports: rec.reports || [],
            signatureDate: rec.signatureDate || '',
            decisionDocument: rec.decisionDocument || '',
            holdingActive: rec.holdingActive || false,
            holdingReason: rec.holdingReason || '',
            holdingSetAt: rec.holdingSetAt || '',
            createdAt: new Date().toISOString()
        }],
        releasedAt: new Date().toISOString()
    };
    rec.released = true;
    renderYears();
    renderHistory();
    updateBrandOpts();
    saveAll();
    alert(`Release 완료!\n[${ty}] > [${rec.brand}] > [${rec.product}] > [${rec.project}]`);
}

/* ─── History 렌더링 ─── */
function renderHistory() {
    const tb = document.getElementById('history-tbody');
    tb.innerHTML = '';
    if (!historyRecords.length) {
        tb.innerHTML = '<tr class="empty-row"><td colspan="15" style="text-align:center;padding:40px;color:#999">저장된 기록이 없습니다</td></tr>';
        return;
    }
    historyRecords.forEach((rec, di) => {
        const no = di + 1, yd = rec.tbd ? '<span style="background:#FF9800;color:white;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">TBD</span>' : esc(rec.year || '-');
        let rb = '-';
        if (rec.gate === 'Closure') rb = rec.released ? '<button class="btn-release released" disabled>완료</button>' : `<button class="btn-release" data-release="${rec.id}">Release</button>`;
        const rc = Math.max(rec.reports?.length || 0, 1);
        if (rec.reports?.length) {
            rec.reports.forEach((rpt, i) => {
                const badge = rpt.docType ? `<span class="doc-type-badge ${rpt.docType.toLowerCase()}">${esc(rpt.docType)}</span>` : '-';
                const dc = rpt.docType ? `dtype-cell type-${rpt.docType.toLowerCase()}` : '';
                const row = document.createElement('tr');
                if (i === 0) row.innerHTML = `<td rowspan="${rc}">${no}</td><td rowspan="${rc}">${esc(rec.brand)}</td><td rowspan="${rc}">${esc(rec.product)}</td><td rowspan="${rc}">${esc(rec.project)}</td><td rowspan="${rc}" class="mgr-cell">${esc(rec.manager || '-')}</td><td rowspan="${rc}">${esc(rec.gate)}</td><td rowspan="${rc}">${yd}</td><td>${esc(rpt.reportDate || '-')}</td><td>${rpt.document ? `<span class="doc-link">${esc(rpt.document)}</span>` : '-'}</td><td class="${dc}">${badge}</td><td>${esc(rpt.meetingNote || '-')}</td><td rowspan="${rc}">${esc(rec.signatureDate || '-')}</td><td rowspan="${rc}">${rb}</td><td rowspan="${rc}"><button class="btn-edit-hist" data-edit="${rec.id}">수정</button></td><td rowspan="${rc}"><button class="btn-del-hist" data-del="${rec.id}">삭제</button></td>`;
                else row.innerHTML = `<td>${esc(rpt.reportDate || '-')}</td><td>${rpt.document ? `<span class="doc-link">${esc(rpt.document)}</span>` : '-'}</td><td class="${dc}">${badge}</td><td>${esc(rpt.meetingNote || '-')}</td>`;
                tb.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${no}</td><td>${esc(rec.brand)}</td><td>${esc(rec.product)}</td><td>${esc(rec.project)}</td><td class="mgr-cell">${esc(rec.manager || '-')}</td><td>${esc(rec.gate)}</td><td>${yd}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>${esc(rec.signatureDate || '-')}</td><td>${rb}</td><td><button class="btn-edit-hist" data-edit="${rec.id}">수정</button></td><td><button class="btn-del-hist" data-del="${rec.id}">삭제</button></td>`;
            tb.appendChild(row);
        }
    });
}

function initHistoryEvents() {
    document.getElementById('history-tbody').addEventListener('click', e => {
        const eb = e.target.closest('[data-edit]'); if (eb) { editRecord(eb.dataset.edit); return; }
        const db = e.target.closest('[data-del]');
        if (db) { if (confirm('이 기록을 삭제하시겠습니까?')) { const i = historyRecords.findIndex(r => r.id === db.dataset.del); if (i !== -1) { historyRecords.splice(i, 1); renderHistory(); saveAll(); } } return; }
        const rb = e.target.closest('[data-release]'); if (rb) { releaseProject(rb.dataset.release); return; }
    });
    document.getElementById('btn-del-all').addEventListener('click', () => {
        if (!historyRecords.length) { alert('삭제할 기록이 없습니다.'); return; }
        if (confirm('모든 기록을 삭제하시겠습니까?')) { historyRecords.length = 0; renderHistory(); saveAll(); }
    });
    document.getElementById('btn-clear-storage').addEventListener('click', clearStorage);
}

function initExport() {
    document.getElementById('btn-export').addEventListener('click', () => {
        if (!historyRecords.length) { alert('내보낼 데이터가 없습니다.'); return; }
        // FIX: 헤더 컬럼(12개) ↔ 데이터 값(14개) 불일치 수정 → 홀딩/홀딩사유 컬럼 추가
        const hd = ['No', '브랜드', '제품', '프로젝트', '담당자', 'Gate', '일자', '보고 날짜', '문서', '유형', '비고', '결재일', '홀딩', '홀딩사유'];
        let csv = '\uFEFF' + hd.map(csvE).join(',') + '\n';
        historyRecords.forEach((r, i) => {
            const yr = r.tbd ? 'TBD' : (r.year || '-'), ha = r.holdingActive ? 'Y' : 'N';
            if (r.reports?.length) {
                r.reports.forEach((rp, j) => {
                    if (j === 0) csv += [i + 1, csvE(r.brand), csvE(r.product), csvE(r.project), csvE(r.manager), csvE(r.gate), csvE(yr), csvE(rp.reportDate || '-'), csvE(rp.document || '-'), csvE(rp.docType || '-'), csvE(rp.meetingNote || '-'), csvE(r.signatureDate || '-'), ha, csvE(r.holdingReason || '-')].join(',') + '\n';
                    else csv += ['', '', '', '', '', '', '', csvE(rp.reportDate || '-'), csvE(rp.document || '-'), csvE(rp.docType || '-'), csvE(rp.meetingNote || '-'), '', '', ''].join(',') + '\n';
                });
            } else csv += [i + 1, csvE(r.brand), csvE(r.product), csvE(r.project), csvE(r.manager), csvE(r.gate), csvE(yr), '-', '-', '-', '-', csvE(r.signatureDate || '-'), ha, csvE(r.holdingReason || '-')].join(',') + '\n';
        });
        const lk = document.createElement('a');
        lk.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        lk.download = `CODEV_History_${new Date().toISOString().slice(0, 10)}.csv`;
        lk.click();
        URL.revokeObjectURL(lk.href);
    });
}

/* ─── Holding 탭 렌더링 ─── */
function renderHolding() {
    // 필터값 수집
    const filterBrand  = document.getElementById('hf-brand')?.value  || '';
    const filterStatus = document.getElementById('hf-status')?.value || '';
    const filterSearch = (document.getElementById('hf-search')?.value || '').trim().toLowerCase();

    // holding 레코드 추출: historyRecords 중 holdingActive=true 또는 holdingResolved=true 포함
    const holdingRecords = historyRecords.filter(r => r.holdingActive || r.holdingResolved);

    // 브랜드 필터 옵션 갱신
    const brandSel = document.getElementById('hf-brand');
    if (brandSel) {
        const prevVal = brandSel.value;
        while (brandSel.options.length > 1) brandSel.remove(1);
        const brands = [...new Set(holdingRecords.map(r => r.brand).filter(Boolean))];
        brands.sort().forEach(b => {
            const o = document.createElement('option');
            o.value = b; o.textContent = b;
            brandSel.appendChild(o);
        });
        if ([...brandSel.options].some(o => o.value === prevVal)) brandSel.value = prevVal;
    }

    // 필터링
    let filtered = holdingRecords.filter(r => {
        if (filterBrand && r.brand !== filterBrand) return false;
        if (filterStatus === 'active'   && !r.holdingActive)   return false;
        if (filterStatus === 'resolved' && !r.holdingResolved) return false;
        if (filterSearch) {
            const haystack = `${r.brand} ${r.product} ${r.project} ${r.manager} ${r.holdingReason}`.toLowerCase();
            if (!haystack.includes(filterSearch)) return false;
        }
        return true;
    });

    // 요약 카드
    const totalAll      = holdingRecords.length;
    const totalActive   = holdingRecords.filter(r => r.holdingActive).length;
    const totalResolved = holdingRecords.filter(r => r.holdingResolved).length;
    const summaryEl = document.getElementById('holding-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="holding-summary-card total">📋 전체 홀딩 ${totalAll}건</div>
            <div class="holding-summary-card active-hold">🔴 홀딩 중 ${totalActive}건</div>
            <div class="holding-summary-card resolved">✅ 해제됨 ${totalResolved}건</div>`;
    }

    // 테이블
    const tb = document.getElementById('holding-tbody');
    if (!tb) return;
    tb.innerHTML = '';

    if (!filtered.length) {
        tb.innerHTML = `<tr class="holding-empty-row"><td colspan="11">${holdingRecords.length ? '필터 조건에 맞는 항목이 없습니다.' : '홀딩 등록된 프로젝트가 없습니다.<br><small style="color:#bbb">Ongoing Projects 탭에서 Holding을 체크하면 자동으로 여기에 기록됩니다.</small>'}</td></tr>`;
        return;
    }

    filtered.forEach((rec, idx) => {
        const isActive = !!rec.holdingActive;
        const statusBadge = isActive
            ? `<span class="hstatus-badge active">홀딩 중</span>`
            : `<span class="hstatus-badge resolved">해제됨</span>`;

        const createdDate = rec.holdingSetAt
            ? new Date(rec.holdingSetAt).toLocaleDateString('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'})
            : (rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('ko-KR') : '-');

        const resolveNote = rec.holdingResolveNote
            ? `<span style="color:#2E7D32">${esc(rec.holdingResolveNote)}</span>`
            : `<span style="color:#bbb">-</span>`;

        const row = document.createElement('tr');
        if (!isActive) row.style.opacity = '0.65';
        row.innerHTML = `
            <td class="num-cell">${idx + 1}</td>
            <td class="brand-cell">${esc(rec.brand)}</td>
            <td>${esc(rec.product)}</td>
            <td><strong>${esc(rec.project)}</strong></td>
            <td>${esc(rec.manager || '-')}</td>
            <td>${esc(rec.gate || '-')}</td>
            <td class="reason-cell">${esc(rec.holdingReason || '-')}</td>
            <td class="date-cell">${createdDate}</td>
            <td>${resolveNote}</td>
            <td class="status-cell">${statusBadge}</td>
            <td>
                <div class="holding-action-cell">
                    ${isActive ? `<button class="btn-holding-resolve" data-hresolve="${rec.id}">해제</button>` : `<button class="btn-holding-resolve" disabled>해제됨</button>`}
                    <button class="btn-holding-edit" data-hedit="${rec.id}">수정</button>
                    <button class="btn-holding-del" data-hdel="${rec.id}">삭제</button>
                </div>
            </td>`;
        tb.appendChild(row);
    });
}

function initHoldingTab() {
    // 필터 이벤트
    // FIX: select에 input+change 동시 등록 시 2회 호출 방지 → select는 change, input은 input 이벤트만
    ['hf-brand','hf-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', renderHolding);
    });
    const hfSearch = document.getElementById('hf-search');
    if (hfSearch) hfSearch.addEventListener('input', renderHolding);
    document.getElementById('btn-holding-reset')?.addEventListener('click', () => {
        document.getElementById('hf-brand').value  = '';
        document.getElementById('hf-status').value = '';
        document.getElementById('hf-search').value = '';
        renderHolding();
    });

    // 테이블 액션 이벤트 위임
    document.getElementById('holding-tbody')?.addEventListener('click', e => {
        // 해제 버튼
        const rb = e.target.closest('[data-hresolve]');
        if (rb) { holdingResolve(rb.dataset.hresolve); return; }
        // 수정 버튼 (Ongoing 탭으로 이동)
        const eb = e.target.closest('[data-hedit]');
        if (eb) { editRecord(eb.dataset.hedit); return; }
        // 삭제 버튼
        const db = e.target.closest('[data-hdel]');
        if (db) {
            if (!confirm('이 홀딩 기록을 삭제하시겠습니까?\n(History에서도 해당 기록이 삭제됩니다)')) return;
            const i = historyRecords.findIndex(r => r.id === db.dataset.hdel);
            if (i !== -1) { historyRecords.splice(i, 1); }
            renderHolding();
            renderHistory();
            saveAll();
        }
    });
}

function holdingResolve(id) {
    const rec = historyRecords.find(r => r.id === id);
    if (!rec) return;
    // 해제 메모 입력 모달
    document.getElementById('holding-resolve-modal')?.remove();
    const ov = document.createElement('div');
    ov.id = 'holding-resolve-modal';
    ov.className = 'modal-overlay holding-resolve-modal';
    ov.innerHTML = `
        <div class="modal-box" style="width:460px">
            <div class="modal-hdr" style="background:#4CAF50">
                <h3>✅ 홀딩 해제 — ${esc(rec.project)}</h3>
                <button class="btn-close">×</button>
            </div>
            <div class="modal-body-edit">
                <div class="holding-resolve-note">홀딩 사유: ${esc(rec.holdingReason || '(없음)')}</div>
                <label>해제 메모 <span style="color:#aaa;font-weight:400">(선택)</span></label>
                <textarea id="resolve-note-input" placeholder="해제 사유 또는 조치 내용을 입력하세요..." style="min-height:80px"></textarea>
            </div>
            <div class="modal-footer">
                <div></div>
                <div class="btn-group">
                    <button class="btn-cancel">취소</button>
                    <button class="btn-save-modal" style="background:linear-gradient(135deg,#4CAF50,#388E3C)">해제 확인</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('.btn-close').addEventListener('click', close);
    ov.querySelector('.btn-cancel').addEventListener('click', close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.btn-save-modal').addEventListener('click', () => {
        const note = document.getElementById('resolve-note-input').value.trim();
        rec.holdingActive   = false;
        rec.holdingResolved = true;
        rec.holdingResolveNote = note;
        rec.holdingResolvedAt  = new Date().toISOString();
        renderHolding();
        renderHistory();
        saveAll();
        close();
        showInd();
    });
    setTimeout(() => ov.querySelector('#resolve-note-input')?.focus(), 150);
}

/* ─── DOMContentLoaded ─── */
document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    initTabs();
    renderYears();
    initArchiveBtns();
    initReportTable();
    initDocUpload();
    initTBD();
    initDocTypeWatch();
    initHolding();
    initSaveBtn();
    initEditBtns();
    checkDecision();
    initHistoryEvents();
    initExport();
    updateBrandOpts();
    renderHistory();
    initHoldingTab();
});