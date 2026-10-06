/* GUARDIMATE · js/scenario.js — 역지오코딩 + 시나리오 재구성 + GPS + Safe Map UI 갱신 (로드 순서 5/9) */

/* ================================================================
   8. 역지오코딩 (좌표 -> 장소/도로명, Nominatim)
================================================================ */
async function reverseName(pos){
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos[0]}&lon=${pos[1]}&zoom=17&accept-language=ko`);
    const d = await res.json();
    const ad = d.address || {};
    return ad.amenity || ad.leisure || ad.building || ad.road || ad.suburb || d.name || '선택한 목적지';
  }catch(e){ return '선택한 목적지'; }
}

/* ================================================================
   9. 시나리오 전체 재구성
   - 위치 파악/목적지 변경 시마다 마커, 위험구역, 경로를 다시 만든다
================================================================ */
async function rebuildScenario(userPos, destPos){
  state.userPos = userPos;
  state.destPos = destPos || offsetM(userPos, 850, 950);  // 기본 목적지: 북동쪽 약 1.3km

  if (userMarker) map.removeLayer(userMarker);
  if (destMarker) map.removeLayer(destMarker);
  userMarker = L.marker(state.userPos, {icon:userIcon}).addTo(map)
    .bindTooltip('내 위치', {direction:'top', className:'zone-tip', offset:[0,-10]});
  destMarker = L.marker(state.destPos, {icon:destIcon}).addTo(map);

  buildZones();
  map.fitBounds(L.latLngBounds([state.userPos, state.destPos]).pad(0.25));
  calcRoutes();   // 비동기: 완료되면 refreshMapUI()가 ETA 갱신
  loadNearbyFacilities(state.userPos, state.destPos);  // 비동기: 완료되면 지도에 마커 추가
  loadDangerNews(state.userPos, state.destPos);        // 비동기: 완료되면 지도에 위험 뉴스 마커 추가
  checkWeatherAlert(state.userPos);                    // 비동기: 완료되면 배너 아래 알림 갱신

  /* 목적지/현위치 이름은 백그라운드에서 채움 */
  reverseName(state.destPos).then(n=>{
    state.destName = n;
    $('destName').textContent = n;
    destMarker.bindTooltip(destTipText(), {direction:'top', className:'zone-tip', offset:[0,-12]});
  });
  reverseName(state.userPos).then(n=>{
    userRegionName = n;
    updateProfileLoc();
    /* [수정] Emergency 화면의 '현재 위치' 카드는 제거됨(사용자는 자기 위치를 이미 앎).
       위치는 여전히 SOS/동행으로 보호자에게 전송된다. 요소가 없을 때만 안전하게 건너뜀 */
    const lb = $('locBox');
    if (lb) lb.innerHTML =
      `<b>${state.usingRealGPS ? '실제 기기 위치' : '데모 위치(권한 거부됨)'}</b> · ${n} 인근<br>`+
      `좌표: ${state.userPos[0].toFixed(5)}, ${state.userPos[1].toFixed(5)}<br>`+
      `<span style="color:var(--dim)">SOS 전송 시 이 위치가 함께 공유됩니다</span>`;
  });
}

/* ================================================================
   10. GPS 위치 확인 (HTML5 Geolocation API)
================================================================ */
function locateAndBuild(){
  $('destName').textContent = '내 위치 확인 중...';
  if (!navigator.geolocation){
    rebuildScenario(FALLBACK);
    toast('이 브라우저는 위치를 지원하지 않아 데모 위치를 사용합니다');
    return;
  }
  navigator.geolocation.getCurrentPosition(position => {
    state.usingRealGPS = true;
    rebuildScenario([position.coords.latitude, position.coords.longitude]);
  }, err => {
    console.warn('위치 정보를 가져올 수 없습니다.');
    state.usingRealGPS = false;
    rebuildScenario(FALLBACK);
    toast('위치 권한이 거부되어 데모 위치를 사용합니다');
  });
}
$('locateBtn').addEventListener('click', locateAndBuild);

/* 지도를 탭하면 그 지점을 새 목적지로 설정
   (단, 🚩 제보 모드가 켜져 있으면 목적지 변경 대신 제보 패널을 연다) */
map.on('click', e=>{
  if (!state.userPos) return;
  if (reportArmed){
    disarmReportMode();
    pendingReportPos = [e.latlng.lat, e.latlng.lng];
    $('reportOverlay').style.display = 'flex';
    return;
  }
  rebuildScenario(state.userPos, [e.latlng.lat, e.latlng.lng]);
  toast('🏁 목적지가 변경되었습니다');
});

/* ================================================================
   11. Safe Map UI 갱신 (배너/ETA/경로 스타일)
================================================================ */
/* 목적지 마커 툴팁 다국어 + 언어 변경 시 재라벨 */
function destTipText(){
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  const prefix = P({ko:'목적지 · ', en:'Destination · ', ja:'目的地 · ', zh:'目的地 · ', es:'Destino · ', de:'Ziel · ', fr:'Destination · '});
  return prefix + (state.destName || '');
}
function relabelDestMarker(){
  if (typeof destMarker !== 'undefined' && destMarker && destMarker.getTooltip()) destMarker.setTooltipContent(destTipText());
}
function activeZoneCount(){ return Object.values(state.zones).filter(Boolean).length; }
/* 프로필 위치 라벨(해외 체류 중 · OO 인근) — 표시 언어로 렌더 (언어 전환 시 재호출됨) */
let userRegionName = null;
function updateProfileLoc(){
  const el = $('profileLoc'); if (!el) return;
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  const abroad = P({ko:'해외 체류 중', en:'Abroad', ja:'海外滞在中', zh:'海外停留中', es:'En el extranjero', de:'Im Ausland', fr:'À l\'étranger'});
  if (!userRegionName){
    el.textContent = abroad + ' · ' + P({ko:'위치 확인 중', en:'locating…', ja:'位置確認中', zh:'定位中', es:'localizando…', de:'wird geortet…', fr:'localisation…'});
  } else {
    el.textContent = abroad + ' · ' + P({ko:userRegionName+' 인근', en:'near '+userRegionName, ja:userRegionName+' 付近', zh:userRegionName+' 附近', es:'cerca de '+userRegionName, de:'nahe '+userRegionName, fr:'près de '+userRegionName});
  }
}
function fmtRoute(r){
  if(!r) return {km:'—', min:'—'};
  const lang = window.gmLang ? window.gmLang() : 'ko';
  const unit = {ko:'분', en:' min', ja:'分', zh:'分钟', es:' min', de:' Min.', fr:' min'}[lang] || '분';
  return { km:(r.distM/1000).toFixed(1)+' km', min:Math.max(1,Math.round(r.durS/60))+unit };
}
function refreshMapUI(){
  const on = state.safePath;
  const n = activeZoneCount();
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);   // 현재 언어 문구 선택
  /* Safe Path ON: 파란 안전경로 강조 / OFF: 최단경로를 붉게 강조 */
  if (routeSafeLine)  routeSafeLine.setStyle({opacity: on ? 1 : 0.15});
  if (routeShortLine) routeShortLine.setStyle({opacity: on ? 0.5 : 1, color: on ? '#8b98b8' : '#f87171'});
  const curRoute = on ? state.routes.safe : state.routes.short;
  const cur = fmtRoute(curRoute);
  const approx = curRoute?.real === false ? P({ko:' · 직선 근사', en:' · straight-line approx.', ja:' · 直線近似', zh:' · 直线近似', es:' · aprox. en línea recta', de:' · Luftlinien-Näherung', fr:' · approx. à vol d\'oiseau'}) : '';
  $('mapBanner').className = 'map-banner' + (on ? '' : ' risk');
  $('mapBanner').childNodes[0].textContent = on
    ? 'SAFE PATH ACTIVE'
    : P({ko:'SHORTEST PATH (주의)', en:'SHORTEST PATH (caution)', ja:'SHORTEST PATH(注意)', zh:'SHORTEST PATH(注意)', es:'SHORTEST PATH (precaución)', de:'SHORTEST PATH (Achtung)', fr:'SHORTEST PATH (attention)'});
  $('bannerSub').textContent = on
    ? (curRoute?.blocked
        ? P({ko:'⚠ 완전 회피 경로가 없어 위험 최소 경로로 안내합니다', en:'⚠ No fully clear route — guiding the least-hazardous path', ja:'⚠ 完全回避経路がないため、危険最小の経路を案内します', zh:'⚠ 无完全规避路线,按危险最小的路线指引', es:'⚠ Sin ruta totalmente libre — guiando por la de menor peligro', de:'⚠ Keine völlig freie Route — Führung über den risikoärmsten Weg', fr:'⚠ Aucun itinéraire totalement dégagé — guidage par le chemin le moins dangereux'})
        : P({ko:`위험 구역 ${n}곳을 회피 검증한 경로가 활성화되었습니다`, en:`Route verified to avoid ${n} hazard zone(s) is active`, ja:`危険区域${n}か所を回避検証した経路が有効です`, zh:`已启用绕开${n}处危险区域并经校验的路线`, es:`Ruta verificada para evitar ${n} zona(s) de peligro activa`, de:`Route zum Umgehen von ${n} Gefahrenzone(n) ist aktiv`, fr:`Itinéraire vérifié évitant ${n} zone(s) de danger actif`}))
    : P({ko:'최단 경로는 위험 구역을 통과할 수 있습니다', en:'The shortest route may pass through hazard zones', ja:'最短経路は危険区域を通過する可能性があります', zh:'最短路线可能穿过危险区域', es:'La ruta más corta puede atravesar zonas de peligro', de:'Die kürzeste Route kann durch Gefahrenzonen führen', fr:'L\'itinéraire le plus court peut traverser des zones de danger'});
  if (on && state.nightBoost && isNight()) $('bannerSub').textContent += P({ko:' · 🌙 심야 가중 적용 중', en:' · 🌙 night boost applied', ja:' · 🌙 深夜加重を適用中', zh:' · 🌙 已应用深夜加权', es:' · 🌙 refuerzo nocturno aplicado', de:' · 🌙 Nachtverstärkung aktiv', fr:' · 🌙 renforcement nocturne actif'});
  $('etaVal').textContent = cur.min;
  $('routeMeta').textContent = on
    ? P({ko:'안전 경로', en:'Safe route', ja:'安全経路', zh:'安全路线', es:'Ruta segura', de:'Sichere Route', fr:'Itinéraire sûr'}) + ` · ${cur.km} · `
      + (curRoute?.blocked ? P({ko:'위험 일부 통과', en:'partial hazard pass-through', ja:'危険を一部通過', zh:'部分穿越危险', es:'paso parcial por peligro', de:'teilw. durch Gefahr', fr:'traversée partielle de danger'}) : P({ko:'위험구역 교차 0건', en:'0 hazard-zone crossings', ja:'危険区域の交差0件', zh:'危险区交叉0处', es:'0 cruces de zona de peligro', de:'0 Gefahrenzonen-Kreuzungen', fr:'0 croisement de zone de danger'})) + approx
    : P({ko:'최단 경로', en:'Shortest route', ja:'最短経路', zh:'最短路线', es:'Ruta más corta', de:'Kürzeste Route', fr:'Itinéraire le plus court'}) + ` · ${cur.km} · ` + P({ko:'⚠ 회피 검증 안 함', en:'⚠ not hazard-checked', ja:'⚠ 回避未検証', zh:'⚠ 未做规避校验', es:'⚠ sin verificación de peligros', de:'⚠ nicht gefahrengeprüft', fr:'⚠ non vérifié'}) + approx;
  $('headerPill').textContent = on ? 'SAFE PATH ON' : 'SAFE PATH OFF';
  $('headerPill').className = 'status-pill' + (on ? '' : ' off');
  $('aiNote').textContent = on
    ? (curRoute?.blocked
        ? P({ko:'⚠ 이 구간은 모든 도로가 위험 구역과 겹쳐 완전 회피가 불가능해요. 교차가 가장 적은 경로로 안내하니 해당 구간에서는 주의하세요.', en:'⚠ Every road here overlaps a hazard zone, so full avoidance isn\'t possible. I\'m guiding the least-crossing route — please stay alert along it.', ja:'⚠ この区間はすべての道路が危険区域と重なり完全回避が不可能です。交差が最も少ない経路を案内しますので、その区間では注意してください。', zh:'⚠ 此路段所有道路都与危险区重叠,无法完全规避。将按交叉最少的路线指引,请在该路段保持警惕。', es:'⚠ Aquí todas las vías se solapan con una zona de peligro, así que no es posible evitarlas del todo. Guío por la ruta con menos cruces; mantente alerta en ese tramo.', de:'⚠ Hier überlappen alle Straßen mit einer Gefahrenzone, eine vollständige Umgehung ist nicht möglich. Ich führe über die Route mit den wenigsten Kreuzungen — bleib dort wachsam.', fr:'⚠ Ici, toutes les routes chevauchent une zone de danger, l\'évitement total est donc impossible. Je guide par l\'itinéraire avec le moins de croisements — reste vigilant(e) sur ce tronçon.'})
        : P({ko:'후보 경로들을 위험 구역과 대조 검사한 결과, 교차 없이 통과하는 최단 안전 경로를 선택했어요. 파란 선을 따라 이동하세요.', en:'After checking candidate routes against hazard zones, I picked the shortest safe route that crosses none. Follow the blue line.', ja:'候補経路を危険区域と照合した結果、交差なしで通れる最短の安全経路を選びました。青い線に沿って移動してください。', zh:'将候选路线与危险区域比对后,选出了零交叉的最短安全路线。请沿蓝线前进。', es:'Tras comparar las rutas candidatas con las zonas de peligro, elegí la ruta segura más corta que no cruza ninguna. Sigue la línea azul.', de:'Nach dem Abgleich der Kandidatenrouten mit den Gefahrenzonen habe ich die kürzeste sichere Route ohne Kreuzung gewählt. Folge der blauen Linie.', fr:'Après comparaison des itinéraires candidats avec les zones de danger, j\'ai choisi le plus court itinéraire sûr qui n\'en croise aucune. Suis la ligne bleue.'}))
    : P({ko:'⚠ 안전 경로가 꺼져 있습니다. 최단 경로는 위험 구역 회피 검증을 하지 않으므로 심야 시간에는 권장하지 않아요.', en:'⚠ Safe Path is off. The shortest route isn\'t hazard-checked, so it\'s not recommended late at night.', ja:'⚠ 安全経路がオフです。最短経路は危険回避の検証をしないため、深夜帯にはおすすめしません。', zh:'⚠ 安全路线已关闭。最短路线不做危险规避校验,深夜时段不建议使用。', es:'⚠ La ruta segura está desactivada. La ruta más corta no verifica peligros, así que no se recomienda de noche.', de:'⚠ Sichere Route ist aus. Die kürzeste Route ist nicht gefahrengeprüft und wird nachts nicht empfohlen.', fr:'⚠ Safe Path est désactivé. L\'itinéraire le plus court n\'est pas vérifié pour les dangers ; déconseillé la nuit.'});

  /* --- 경로 안전 점수(0~100) 비교 칩 갱신 --- */
  const sSafe = routeSafetyScore(state.routes.safe);
  const sShort = routeSafetyScore(state.routes.short);
  const scoreRow = $('scoreRow');
  if (sSafe == null && sShort == null){
    scoreRow.style.display = 'none';
  } else {
    scoreRow.style.display = 'flex';
    const cls = v => v == null ? '' : v >= 80 ? 'score-good' : v >= 50 ? 'score-mid' : 'score-bad';
    const pt = P({ko:'점', en:'', ja:'点', zh:'分', es:'', de:'', fr:''});
    const safeLbl = P({ko:'안전', en:'Safe', ja:'安全', zh:'安全', es:'Segura', de:'Sicher', fr:'Sûr'});
    const shortLbl = P({ko:'최단', en:'Short', ja:'最短', zh:'最短', es:'Corta', de:'Kurz', fr:'Court'});
    $('scoreSafe').innerHTML  = `🛡 ${safeLbl} <b class="${cls(sSafe)}">${sSafe ?? '—'}</b>${pt} · ${fmtRoute(state.routes.safe).min}`;
    $('scoreShort').innerHTML = `⚡ ${shortLbl} <b class="${cls(sShort)}">${sShort ?? '—'}</b>${pt} · ${fmtRoute(state.routes.short).min}`;
    $('scoreSafe').classList.toggle('current', on);    // 파란 테두리 = 현재 안내 중인 경로
    $('scoreShort').classList.toggle('current', !on);
  }
}
/* Safe Path 전환 공용 함수 (토글 스위치 · 점수 칩 · 지도의 경로선 어디서든 호출) */
function setSafePath(on){
  if (state.safePath === on) return;
  state.safePath = on;
  $('safeToggle').checked = on;
  refreshMapUI();
  toast(on ? '✅ AI가 안전 경로로 최적화했습니다' : '⚠ 최단 경로로 전환됨');
}
$('safeToggle').addEventListener('change', e=> setSafePath(e.target.checked));
/* 점수 칩을 탭해도 해당 경로로 바로 전환 */
$('scoreSafe').addEventListener('click', ()=> setSafePath(true));
$('scoreShort').addEventListener('click', ()=> setSafePath(false));

/* 🚶/🚗 이동 수단 전환 : 도보/자동차 → 경로/ETA 재계산 (마지막 선택을 저장/복원) */
(function(){
  const seg = $('travelModeSeg');
  if (!seg) return;
  try { const saved = localStorage.getItem('gm_travel_mode'); if (saved === 'walk' || saved === 'drive') state.travelMode = saved; } catch(e){}
  seg.querySelectorAll('button').forEach(x=> x.classList.toggle('active', x.dataset.mode === state.travelMode));
  seg.addEventListener('click', e=>{
    const b = e.target.closest('button'); if (!b) return;
    const mode = b.dataset.mode;
    if (mode === state.travelMode) return;
    state.travelMode = mode;
    try { localStorage.setItem('gm_travel_mode', mode); } catch(e){}
    seg.querySelectorAll('button').forEach(x=> x.classList.toggle('active', x.dataset.mode === mode));
    toast(mode === 'drive' ? '🚗 자동차 경로로 전환' : '🚶 도보 경로로 전환');
    if (state.userPos && state.destPos) calcRoutes();
  });
})();

/* ================================================================
   12. 목적지 검색 (Photon 우선 · 내 위치 근접 가중 → Nominatim 폴백)
   - Photon(Komoot): 내 위치(lat/lon)를 넘기면 '근접 가중(location_bias)'으로
     검색해 가까운 관련 결과를 잘 돌려준다 → 여기에 거리순 정렬을 더해 표시.
   - Photon 실패/무결과 시 Nominatim(로컬 박스 한정)으로 폴백.
================================================================ */
(function(){
  const input = $('destSearch'), btn = $('destSearchBtn'), results = $('destResults');
  if (!input || !btn || !results) return;
  let searchSeq = 0;
  const PHOTON_LANGS = { en:'en', de:'de', fr:'fr' };   // Photon 지원 언어만 전달(그 외 기본값)

  function labelFromPhoton(p){
    const primary = p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || p.city || p.state || p.country || '';
    const ctx = [];
    if (p.name && p.street) ctx.push(p.street);
    if (p.city) ctx.push(p.city); else if (p.county) ctx.push(p.county);
    if (p.state) ctx.push(p.state);
    if (p.country) ctx.push(p.country);
    const seen = new Set(), out = [];
    ctx.forEach(x => { if (x && x !== primary && !seen.has(x)){ seen.add(x); out.push(x); } });
    return out.length ? primary + ', ' + out.join(', ') : primary;
  }
  async function searchPhoton(q, lat, lon){
    const lang = window.gmLang ? window.gmLang() : 'ko';
    const langParam = PHOTON_LANGS[lang] ? '&lang=' + PHOTON_LANGS[lang] : '';
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}`
      + `&limit=25&location_bias_scale=0.6${langParam}`;
    const res = await fetchWithTimeout(url, 6000);   // fetchWithTimeout: routing.js
    const data = await res.json();
    return (data.features || [])
      .filter(f => f.geometry && Array.isArray(f.geometry.coordinates))
      .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], display_name: labelFromPhoton(f.properties || {}) }))
      .filter(r => r.lat != null && r.lon != null && r.display_name);
  }
  async function searchNominatim(q, lat, lon){
    const lang = window.gmLang ? window.gmLang() : 'ko';
    const d = 0.3, viewbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=40&accept-language=${lang}`
      + `&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(q)}`;
    const res = await fetchWithTimeout(url, 6000);
    const data = await res.json();
    return (data || []).map(r => ({ lat: parseFloat(r.lat), lon: parseFloat(r.lon), display_name: r.display_name }));
  }
  function render(list){
    results.innerHTML = '';
    list.forEach(r => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'dest-result-item';
      const badge = document.createElement('span');
      badge.className = 'dest-dist';
      badge.textContent = r._distM < 1000 ? Math.round(r._distM) + ' m' : (r._distM / 1000).toFixed(1) + ' km';
      item.appendChild(badge);
      item.appendChild(document.createTextNode(r.display_name));
      item.addEventListener('click', () => {
        results.innerHTML = '';
        input.value = r.display_name.split(',')[0];
        rebuildScenario(state.userPos, [r.lat, r.lon]);
        toast('🏁 목적지가 변경되었습니다');
      });
      results.appendChild(item);
    });
  }
  async function runSearch(){
    const q = input.value.trim();
    if (!q) return;
    if (!state.userPos){ toast('현재 위치를 먼저 확인해 주세요'); return; }
    const mySeq = ++searchSeq;
    try{
      let list = [];
      try { list = await searchPhoton(q, state.userPos[0], state.userPos[1]); }
      catch(e){ console.warn('Photon 검색 실패, Nominatim로 대체:', e); }
      if (mySeq !== searchSeq) return;
      if (!list.length){                               // Photon 무결과/실패 → Nominatim 폴백
        list = await searchNominatim(q, state.userPos[0], state.userPos[1]);
        if (mySeq !== searchSeq) return;
      }
      if (!list.length){ results.innerHTML = ''; toast('검색 결과가 없습니다'); return; }
      const seen = new Set();                          // 좌표 근접 중복 제거
      list = list.filter(r => { const k = r.lat.toFixed(4) + ',' + r.lon.toFixed(4); if (seen.has(k)) return false; seen.add(k); return true; });
      list.forEach(r => { r._distM = haversineM(state.userPos, [r.lat, r.lon]); });
      list.sort((a, b) => a._distM - b._distM);        // 가까운 순
      render(list.slice(0, 12));                       // 가까운 12개만 표시
    }catch(e){
      if (mySeq !== searchSeq) return;
      console.warn('목적지 검색 실패:', e);
      toast('검색에 실패했습니다 (서버 지연 · 잠시 후 다시 시도)');
    }
  }
  btn.addEventListener('click', runSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); runSearch(); } });
  input.addEventListener('input', () => { if (!input.value.trim()) results.innerHTML = ''; });
})();
