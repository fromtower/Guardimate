/* GUARDIMATE · js/settings.js — Settings 화면 동작 + 커뮤니티 위험 제보 (로드 순서 6/9) */

/* ================================================================
   12. Settings 동작
================================================================ */
/* 위험 알림 카테고리 on/off
   -> 지도 표시 갱신 + 회피 대상이 바뀌므로 경로도 다시 계산! */
document.querySelectorAll('.zoneToggle').forEach(t=>{
  t.addEventListener('change', e=>{
    const z = e.target.dataset.zone;
    state.zones[z] = e.target.checked;
    if (zoneLayers[z]){
      if (e.target.checked) zoneLayers[z].addTo(map);
      else map.removeLayer(zoneLayers[z]);
    }
    calcRoutes();  // ★ 회피 조건이 달라졌으니 안전 경로 재탐색
    toast(e.target.checked ? '카테고리 켜짐 · 경로 재계산' : '카테고리 꺼짐 · 경로 재계산');
  });
});
/* 지도 타일(테마) 전환 */
$('mapStyleSeg').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#mapStyleSeg button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  Object.values(tileLayers).forEach(l=>map.removeLayer(l));
  tileLayers[b.dataset.style].addTo(map);
  state.mapStyle = b.dataset.style;
  toast((window.gmPick ? window.gmPick({ko:'지도 스타일: ', en:'Map style: ', ja:'地図スタイル:', zh:'地图样式:', es:'Estilo de mapa: ', de:'Kartenstil: ', fr:'Style de carte : '}) : '지도 스타일: ') + b.textContent);
});

/* 🌙 심야 위험 가중 on/off
   -> 구역 배치(개수/위치)는 유지한 채 반경만 다시 그리고(buildZones(false)) 경로 재계산 */
try{
  const v = localStorage.getItem('gm_night_boost');
  if (v !== null) state.nightBoost = v === '1';
}catch(e){}
$('nightToggle').checked = state.nightBoost;
$('nightToggle').addEventListener('change', e=>{
  state.nightBoost = e.target.checked;
  try{ localStorage.setItem('gm_night_boost', state.nightBoost ? '1' : '0'); }catch(e2){}
  if (state.userPos && state.destPos){ buildZones(false); calcRoutes(); }
  toast(state.nightBoost
    ? (isNight() ? '🌙 심야 가중 켜짐 · 치안 구역 확대 적용' : '🌙 심야 가중 켜짐 · 야간(21~06시)에 자동 적용')
    : '심야 위험 가중이 꺼졌습니다');
});

/* ================================================================
   12-1. 커뮤니티 위험 제보
   - 지도를 길게 누르면(우클릭/롱탭 = Leaflet contextmenu) 제보 패널이 열린다
   - 제보는 보라색 폴리곤 구역으로 표시되고, 만료 시각과 함께 localStorage에
     저장되어 다른 위험구역과 똑같이 경로 회피(zonePolys/zoneParams)에 반영된다
   - 실서비스라면 서버에 모여 다른 사용자에게 공유될 부분 (데모는 기기 로컬)
================================================================ */
const REPORT_RADIUS_M = 120;   // 제보 구역 기본 반경
let reportLayerGroup = null;   // 지도 위 제보 폴리곤 레이어
let pendingReportPos = null;   // 길게 누른 좌표 (패널에서 '제보 등록'을 누르면 사용)

try{ state.reports = JSON.parse(localStorage.getItem('gm_reports') || '[]'); }catch(e){ state.reports = []; }
function saveReports(){ try{ localStorage.setItem('gm_reports', JSON.stringify(state.reports)); }catch(e){} }

/* 제보 목록 -> 지도 폴리곤 + zonePolys/zoneParams의 'report' 카테고리로 반영
   (buildZones 끝에서 호출되고, 제보 추가/삭제 시에도 단독 호출된다) */
function applyReportZones(){
  const now = Date.now();
  const before = state.reports.length;
  state.reports = state.reports.filter(r => r.expiresTs > now);   // 만료된 제보 자동 정리
  if (state.reports.length !== before) saveReports();

  if (reportLayerGroup && map.hasLayer(reportLayerGroup)) map.removeLayer(reportLayerGroup);
  const a = state.userPos, b = state.destPos;
  const polys = [], params = [], layers = [];
  state.reports.forEach(r => {
    const center = [r.lat, r.lng];
    const poly = makePolygon(center, r.radius, 6, (r.id % 9) + 1.7);
    polys.push(poly);
    /* 제보는 절대 좌표이므로, 현재 경로 기준 (t, side)로 사영해 폴백 우회 계산에도 쓰이게 */
    const proj = (a && b) ? projectToRoute(a, b, center) : { t: 0.5, side: 0 };
    params.push({ t: proj.t, side: proj.side, radius: r.radius, center, poly });
    const P = window.gmPick || (o => o.ko != null ? o.ko : o);
    const tLocale = { ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN', es:'es-ES', de:'de-DE', fr:'fr-FR' }[window.gmLang ? window.gmLang() : 'ko'] || 'ko-KR';
    const exp = new Date(r.expiresTs).toLocaleTimeString(tLocale, {hour:'2-digit', minute:'2-digit'});
    const untilTxt = P({ko:`${exp}까지 · 탭하여 관리`, en:`Until ${exp} · tap to manage`, ja:`${exp}まで · タップで管理`, zh:`至${exp} · 点击管理`, es:`Hasta ${exp} · toca para gestionar`, de:`Bis ${exp} · zum Verwalten tippen`, fr:`Jusqu'à ${exp} · toucher pour gérer`});
    const delTxt = P({ko:'제보 삭제', en:'Delete report', ja:'提報を削除', zh:'删除上报', es:'Eliminar reporte', de:'Meldung löschen', fr:'Supprimer le signalement'});
    layers.push(
      /* [수정] bubblingMouseEvents:false - 제보 구역 클릭이 지도 클릭(목적지 변경)으로
         번지면 팝업이 열리자마자 전체 재구성으로 닫혀버려 삭제가 불가능했다 */
      L.polygon(poly, {color:'#a855f7', weight:2, dashArray:'3 5', fillColor:'#a855f7', fillOpacity:0.18, bubblingMouseEvents:false})
        /* [수정] 상시 라벨 제거(범례 색상으로 대체) - hover/터치 시에만 표시 */
        .bindTooltip(`🚩 ${r.label}<br><span style="font-weight:500;color:#aab6d4">${untilTxt}</span>`,
                     {sticky:true, direction:'top', className:'zone-tip'})
        .bindPopup(`<div style="font-size:11.5px;font-weight:700">🚩 ${r.label}</div>`
          + `<button onclick="removeReport(${r.id})" style="margin-top:7px;background:#ef4444;border:none;color:#fff;font-family:inherit;font-weight:700;font-size:10.5px;padding:5px 12px;border-radius:8px;cursor:pointer">${delTxt}</button>`)
    );
  });
  state.zonePolys.report = polys;
  state.zoneParams.report = params;
  reportLayerGroup = L.layerGroup(layers);
  zoneLayers.report = reportLayerGroup;   // Settings의 zoneToggle 공용 핸들러가 켜고 끌 수 있게
  if (state.zones.report && layers.length) reportLayerGroup.addTo(map);
}

/* 제보 폴리곤 팝업의 '제보 삭제' 버튼 (inline onclick에서 호출되므로 전역 등록) */
window.removeReport = function(id){
  state.reports = state.reports.filter(r => r.id !== id);
  saveReports();
  map.closePopup();
  applyReportZones();
  calcRoutes();
  toast('🗑 제보가 삭제되어 경로를 재계산합니다');
};

/* 🚩 제보 모드 버튼 : 켜면 다음 지도 탭이 목적지 변경 대신 "제보 위치 선택"이 된다
   (길게 누르기는 트랙패드·모바일에서 안 먹는 경우가 많아, 확실한 진입 경로를 제공) */
let reportArmed = false;
const DEFAULT_HINT = $('mapHint').textContent;
function disarmReportMode(){
  reportArmed = false;
  $('reportBtn').classList.remove('armed');
  $('mapHint').textContent = DEFAULT_HINT;
}
$('reportBtn').addEventListener('click', ()=>{
  reportArmed = !reportArmed;
  $('reportBtn').classList.toggle('armed', reportArmed);
  $('mapHint').textContent = reportArmed ? '🚩 제보할 위치를 지도에서 탭하세요' : DEFAULT_HINT;
  toast(reportArmed ? '🚩 제보 모드 ON · 지도를 탭해 위치를 선택하세요' : '제보 모드가 해제되었습니다');
});

/* 지도 길게 누르기(우클릭/롱탭) -> 제보 패널 바로 열기 (제보 모드의 단축 경로) */
map.on('contextmenu', e => {
  if (!state.userPos) return;
  disarmReportMode();
  pendingReportPos = [e.latlng.lat, e.latlng.lng];
  $('reportOverlay').style.display = 'flex';
});
$('repCats').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#repCats button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
});
$('repDurs').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#repDurs button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
});
$('repCancel').addEventListener('click', ()=>{ $('reportOverlay').style.display = 'none'; });
$('repSubmit').addEventListener('click', ()=>{
  if (!pendingReportPos) return;
  const cat = document.querySelector('#repCats button.active');
  const dur = document.querySelector('#repDurs button.active');
  const hours = dur ? parseFloat(dur.dataset.h) : 6;
  state.reports.push({
    id: Date.now(),
    label: cat ? cat.textContent.trim() : '위험 제보',
    lat: pendingReportPos[0],
    lng: pendingReportPos[1],
    radius: REPORT_RADIUS_M,
    ts: Date.now(),
    expiresTs: Date.now() + hours * 3600 * 1000
  });
  saveReports();
  $('reportOverlay').style.display = 'none';
  applyReportZones();
  calcRoutes();   // ★ 제보 구역이 회피 대상에 추가됐으니 경로 재탐색
  toast('🚩 제보가 등록되어 회피 경로를 재계산합니다');
});

/* 지정 보호자 번호 / 영사콜센터 연동 -> 로컬 저장 + Emergency 탭 반영 */
try{ state.guardianNumber = localStorage.getItem('gm_guardian_number') || ''; }catch(e){}
try{
  const v = localStorage.getItem('gm_consulate_enabled');
  if (v !== null) state.consulateEnabled = v === '1';
}catch(e){}

function refreshContactsUI(){
  const sub = $('guardianSub');
  if (sub) sub.textContent = state.guardianNumber
    ? `${state.guardianNumber} · SOS 자동 전송 대상`
    : '번호 미등록 · SOS 자동 전송 대상';
  const guardianBtn = $('guardianCallBtn');
  if (guardianBtn) guardianBtn.dataset.number = state.guardianNumber;

  const row = $('consulateRow');
  if (row) row.style.display = state.consulateEnabled ? '' : 'none';
}

function guardianStatusText(){
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  return state.guardianNumber
    ? P({ko:'등록된 번호: ', en:'Registered: ', ja:'登録番号:', zh:'已登记号码:', es:'Registrado: ', de:'Registriert: ', fr:'Enregistré : '}) + state.guardianNumber
    : P({ko:'번호가 등록되지 않았습니다', en:'No number registered', ja:'番号が未登録です', zh:'尚未登记号码', es:'No hay número registrado', de:'Keine Nummer registriert', fr:'Aucun numéro enregistré'});
}
if ($('guardianInput')) $('guardianInput').value = state.guardianNumber;
$('guardianStatus').textContent = guardianStatusText();
$('guardianSave').addEventListener('click', ()=>{
  state.guardianNumber = $('guardianInput').value.trim();
  try{ localStorage.setItem('gm_guardian_number', state.guardianNumber); }catch(e){}
  $('guardianStatus').textContent = guardianStatusText();
  refreshContactsUI();
  toast(state.guardianNumber ? '📱 보호자 번호가 저장되었습니다' : '보호자 번호가 삭제되었습니다');
});

$('consulateToggle').checked = state.consulateEnabled;
$('consulateToggle').addEventListener('change', e=>{
  state.consulateEnabled = e.target.checked;
  try{ localStorage.setItem('gm_consulate_enabled', state.consulateEnabled ? '1' : '0'); }catch(e){}
  refreshContactsUI();
  toast(state.consulateEnabled ? '☎ 영사콜센터 연동이 켜졌습니다' : '☎ 영사콜센터 연동이 꺼졌습니다');
});
refreshContactsUI();
