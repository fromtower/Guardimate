/* GUARDIMATE · js/zones.js — 위험 구역 생성 + 주변 시설(POI)/날씨/뉴스 조회 (로드 순서 3/9) */

/* ================================================================
   5. 위험 구역 생성
   - 실서비스에선 공공데이터/크라우드소싱으로 채워질 부분
   - 데모에선 사용자->목적지 직선 경로 주변에 자동 배치해
     "최단 경로는 위험을 지나고, 안전 경로는 우회해야 하는" 상황을 만든다
   - 카테고리별로 1~3개의 구역을 랜덤 배치한다. 단, 세 카테고리 중 두
     곳이 모두 1개로 나오면(구역이 전부 밋밋해지는 것을 막기 위해)
     나머지 한 카테고리는 2~3개 중에서 다시 뽑는다
================================================================ */
const ZONE_BASE = { // 카테고리별 기준 위치(t=경로상 비율, side=수직 오프셋m)/반경/스타일
  crime:    { t:0.55, side:-170, radius:190, seed:2.1,
              color:'#ef4444', dashArray:'6 5', fillOpacity:0.22,
              tip:'⚠ 치안 위험 구역<br><span style="font-weight:500;color:#aab6d4">심야 우범 · 가로등 결함</span>' },
  disaster: { t:0.30, side: 190, radius:160, seed:4.7,
              color:'#f59e0b', dashArray:'6 5', fillOpacity:0.20,
              tip:'⚠ 재난·침수 구역<br><span style="font-weight:500;color:#aab6d4">폭우 · 침수 상습 지역</span>' },
  infra:    { t:0.48, side:   0, radius: 90, seed:8.3,
              color:'#608cff', dashArray:'4 5', fillOpacity:0.20,
              tip:'🚧 긴급 공사 구간<br><span style="font-weight:500;color:#aab6d4">도보 통행 불가</span>' }
};
function randInt(min, max){ return min + Math.floor(Math.random() * (max - min + 1)); }

/* 위험구역 개수(1~3)를 균등(1/3씩)이 아니라 가중치를 둬서 뽑는다:
   1개 50% · 2개 35% · 3개 15% -> "3개"는 자주 나오지 않는 예외적인 경우가 되게 한다.
   min=2로 호출되면(아래 rollZoneCounts의 강제 재추첨용) 2:3의 상대 비율(35:15)을
   그대로 유지해 70%:30%로 정규화한다 */
function weightedZoneCount(min = 1){
  const r = Math.random() * 100;
  if (min <= 1){
    if (r < 50) return 1;
    if (r < 85) return 2;
    return 3;
  }
  return r < 70 ? 2 : 3;
}

/* 카테고리별 위험구역 개수를 한 번에 굴린다.
   [규칙] 세 카테고리 중 두 곳이 모두 1개로 나오면, 나머지 한 카테고리는
   2~3개 중에서 다시 뽑는다 (모든 카테고리가 1개짜리로만 밋밋해지는 것을 방지) */
function rollZoneCounts(){
  const keys = Object.keys(ZONE_BASE);
  const counts = {};
  keys.forEach(k => { counts[k] = weightedZoneCount(1); });
  const onesKeys = keys.filter(k => counts[k] === 1);
  if (onesKeys.length >= 2){
    const remaining = keys.find(k => counts[k] !== 1) || keys[randInt(0, keys.length - 1)];
    counts[remaining] = weightedZoneCount(2);
  }
  return counts;
}

/* 위험구역 툴팁(제목/부제) 다국어 : 지도 위 Leaflet 툴팁은 applyLang이 훑지 않으므로
   생성 시점에 현재 언어로 만든다 (언어 변경 시 buildZones(false)로 다시 그림) */
const ZONE_TIP_I18N = {
  crime: {
    title: {ko:'⚠ 치안 위험 구역', en:'⚠ Public-safety risk zone', ja:'⚠ 治安リスク区域', zh:'⚠ 治安风险区', es:'⚠ Zona de riesgo de seguridad', de:'⚠ Sicherheitsrisikozone', fr:'⚠ Zone à risque de sécurité'},
    sub:   {ko:'심야 우범 · 가로등 결함', en:'Late-night crime · broken streetlights', ja:'深夜犯罪 · 街灯不良', zh:'深夜犯罪 · 路灯故障', es:'Delito nocturno · farolas averiadas', de:'Nächtliche Kriminalität · defekte Laternen', fr:'Délinquance nocturne · lampadaires en panne'}
  },
  disaster: {
    title: {ko:'⚠ 재난·침수 구역', en:'⚠ Disaster/flood zone', ja:'⚠ 災害・浸水区域', zh:'⚠ 灾害·内涝区', es:'⚠ Zona de desastre/inundación', de:'⚠ Katastrophen-/Überschwemmungszone', fr:'⚠ Zone de catastrophe/inondation'},
    sub:   {ko:'폭우 · 침수 상습 지역', en:'Heavy rain · flood-prone area', ja:'豪雨 · 浸水常襲地域', zh:'暴雨 · 易涝地区', es:'Lluvia intensa · área inundable', de:'Starkregen · überschwemmungsgefährdet', fr:'Fortes pluies · zone inondable'}
  },
  infra: {
    title: {ko:'🚧 긴급 공사 구간', en:'🚧 Emergency construction', ja:'🚧 緊急工事区間', zh:'🚧 紧急施工路段', es:'🚧 Obras de emergencia', de:'🚧 Notbaustelle', fr:"🚧 Travaux d'urgence"},
    sub:   {ko:'도보 통행 불가', en:'No pedestrian access', ja:'歩行者通行不可', zh:'禁止步行通过', es:'Sin acceso peatonal', de:'Kein Fußgängerzugang', fr:'Accès piéton interdit'}
  }
};
function zoneTip(key, base, showNight){
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  const info = ZONE_TIP_I18N[key];
  const body = info ? `${P(info.title)}<br><span style="font-weight:500;color:#aab6d4">${P(info.sub)}</span>` : base.tip;
  const night = showNight ? P({ko:'<br>🌙 심야 가중: 반경 확대 적용', en:'<br>🌙 Night boost: expanded radius', ja:'<br>🌙 深夜加重: 半径拡大', zh:'<br>🌙 深夜加权: 半径扩大', es:'<br>🌙 Refuerzo nocturno: radio ampliado', de:'<br>🌙 Nachtverstärkung: erweiterter Radius', fr:'<br>🌙 Renforcement nocturne : rayon élargi'}) : '';
  return body + night;
}
function buildZones(reroll = true){
  Object.values(zoneLayers).forEach(z=>{ if(map.hasLayer(z)) map.removeLayer(z); });
  const a = state.userPos, b = state.destPos;
  /* [심야 가중 토글 등] 배치를 유지한 채 다시 그릴 때는 기존 개수를 재사용
     (매번 새로 굴리면 토글 하나 바꿔도 구역 배치가 통째로 바뀌어 버린다) */
  if (reroll || !state.zoneCounts) state.zoneCounts = rollZoneCounts();
  const zoneCounts = state.zoneCounts;
  /* 🌙 심야 위험 가중 : 야간(21~06시)에는 치안 위험 구역 반경을 1.35배로 확대
     -> 같은 우범 구역이라도 밤에는 더 넓게 우회하는 경로가 선택된다 */
  const nightOn = state.nightBoost && isNight();

  /* [반경 스케일] 경로가 짧으면 위험구역을 작게, 멀면 크게 (2km를 기준 1배로,
     거리의 제곱근에 비례해 완만하게 · 과하지 않도록 0.65~1.4배로 제한) */
  const routeDistM = (a && b) ? haversineM(a, b) : 2000;
  const sizeScale = Math.max(0.65, Math.min(1.4, Math.sqrt(routeDistM / 2000)));

  /* 폴리곤 좌표를 먼저 만들어 state에 저장 (경로 교차 검사에 사용) - 카테고리당 폴리곤 배열
     state.zoneParams에는 각 구역을 만들 때 쓴 (t, side, radius, center, poly)를
     그대로 보존해 둔다 -> calcRoutes()의 candidate 우회 계산과 그래프 다익스트라의
     구역 페널티 계산이 "이 구역이 정확히 어디 있는지" 역산하지 않고 바로 쓸 수 있게 */
  state.zonePolys = {};
  state.zoneParams = {};
  zoneLayers = {};
  const placed = [];   // 이미 배치된 구역(겹침 방지용) : {center, radius}
  Object.entries(ZONE_BASE).forEach(([key, base]) => {
    const count = zoneCounts[key];
    const polys = [];
    const params = [];
    const layers = [];
    for (let i = 0; i < count; i++){
      /* 여러 개일 때는 경로를 따라 서로 다른 지점/측면에 흩어 배치 */
      const spread = count > 1 ? (i - (count - 1) / 2) : 0;
      const baseT = Math.min(0.85, Math.max(0.15, base.t + spread * 0.18));
      const side = base.side + spread * 90;
      const seed = base.seed + i * 2.7;
      const radius = base.radius * sizeScale * (key === 'crime' && nightOn ? 1.35 : 1);  // 거리 스케일 + 🌙 심야 가중
      /* [겹침 방지] 이미 배치된 구역과 크게 겹치면 t를 조금씩 밀어 빈 자리를 찾고,
         끝내 못 찾으면 이 구역은 생략한다 → 구역들이 뭉쳐 지저분해 보이는 것을 막는다 */
      let center = null, t = baseT;
      for (const dt of [0, 0.09, -0.09, 0.18, -0.18, 0.27, -0.27]){
        const tt = Math.min(0.9, Math.max(0.1, baseT + dt));
        const c = alongOffset(a, b, tt, side);
        if (!placed.some(p => haversineM(c, p.center) < (radius + p.radius) * 1.1)){ center = c; t = tt; break; }
      }
      if (!center) continue;   // 빈 자리를 못 찾으면 생략
      placed.push({ center, radius });
      const poly = makeStreetPolygon(center, radius) || makePolygon(center, radius, 6, seed);
      const hull = convexHull(poly);   // 경로 회피용 매끈한 볼록 경계(표시는 poly)
      polys.push(poly);
      params.push({ t, side, radius, center, poly, hull });
      layers.push(
        /* [수정] 상시 라벨(permanent) 제거 : 구역 종류는 좌하단 범례 색상으로 안내되므로
           경로선을 가리지 않게 hover/터치 시에만 툴팁을 띄운다 */
        L.polygon(poly, {color:base.color, weight:2, dashArray:base.dashArray, fillColor:base.color, fillOpacity:base.fillOpacity})
          .bindTooltip(zoneTip(key, base, key === 'crime' && nightOn), {sticky:true, direction:'top', className:'zone-tip'})
      );
    }
    state.zonePolys[key] = polys;
    state.zoneParams[key] = params;
    const group = L.layerGroup(layers);
    zoneLayers[key] = group;
    if (state.zones[key]) group.addTo(map);
  });
  applyReportZones();   // 커뮤니티 제보 구역도 zonePolys/zoneParams에 합류 (경로 회피 대상)
}

/* ================================================================
   5-1. 주변 경찰서 · 소방서 · 병원 (OpenStreetMap Overpass API, 무료/키 불필요)
   - 반경(POI_RADIUS_M)만 조회하면 내 위치/목적지 근처만 커버되고 그 사이
     구간은 빈틈이 생기므로, 두 지점 사이를 POI_SAMPLE_STEP_M(2~3km) 간격의
     "보이지 않는" 샘플 지점으로 나눠 각 지점마다 같은 반경을 적용한다.
     (샘플 지점 자체는 지도에 표시되지 않고, 조회된 실제 시설만 마커로 표시)
================================================================ */
const POI_RADIUS_M = 2000;       // 2km
const POI_SAMPLE_STEP_M = 2500;  // 경로를 2~3km 간격으로 샘플링
const POI_MAX_SAMPLES = 8;       // 쿼리 크기를 더 줄여 응답 성공률↑ (긴 경로도 충분히 커버)

/* 사용자 -> 목적지 직선을 균등 간격으로 나눈 샘플 지점 (양 끝점 포함, 지도에는 표시 안 함) */
function sampleRoutePoints(a, b, stepM, maxPoints = POI_MAX_SAMPLES){
  const totalM = haversineM(a, b);
  let segments = Math.max(1, Math.round(totalM / stepM));
  if (segments + 1 > maxPoints) segments = maxPoints - 1;
  const points = [];
  for (let i = 0; i <= segments; i++){
    const t = i / segments;
    points.push([ a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t ]);
  }
  return points;
}

/* [예비 서버 구성] 1순위 overpass-api.de가 과부하/차단(406 등)으로 자주 실패하므로,
   OSRM 라우팅과 동일하게 2순위 미러 서버로 자동 재시도한다. */
/* [실측 반영·2026-07] 브라우저에서 실제로 되는(CORS * + 데이터 정상) 서버를 우선.
   - overpass-api.de : 요청을 자주 406(차단)해서 뒤로 밀었다
   - overpass.osm.ch : 유럽 한정 데이터(호주 결과 0)라 제외
   - maps.mail.ru    : CORS * + 전 세계 데이터 정상 확인 → 1순위 */
const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];
/* 직렬화(한 번에 하나씩) + 순차 폴백(1순위부터 차례로). 동시 병렬 요청은
   rate-limit을 유발하므로 쓰지 않는다. 타임아웃 12초 */
let overpassChain = Promise.resolve();
function overpassQuery(q){
  const run = async () => {
    const qs = '?data=' + encodeURIComponent(q);
    for (const endpoint of OVERPASS_ENDPOINTS){
      try {
        const res = await fetchWithTimeout(endpoint + qs, 12000);
        if (res.ok) return await res.json();
        console.warn('Overpass 응답 에러:', endpoint, res.status);
      } catch (e){
        console.warn('Overpass 요청 실패:', endpoint, e);
      }
    }
    throw new Error('모든 Overpass 서버에 연결할 수 없음');
  };
  const result = overpassChain.then(run, run);   // 직렬화: 이전 요청이 끝난 뒤 실행
  overpassChain = result.catch(() => {});
  return result;
}

/* 주변 시설 마커 라벨 다국어 + 언어 변경 시 재라벨(재조회 없이 툴팁만 갱신) */
let facilityMarkers = [];   // {marker, amenity, name}
function facilityLabel(amenity){
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  if (amenity === 'police') return P({ko:'👮 경찰서', en:'👮 Police', ja:'👮 警察署', zh:'👮 警察局', es:'👮 Policía', de:'👮 Polizei', fr:'👮 Police'});
  if (amenity === 'fire_station') return P({ko:'🚒 소방서', en:'🚒 Fire station', ja:'🚒 消防署', zh:'🚒 消防局', es:'🚒 Bomberos', de:'🚒 Feuerwehr', fr:'🚒 Pompiers'});
  return P({ko:'🏥 병원/의원', en:'🏥 Hospital/clinic', ja:'🏥 病院/医院', zh:'🏥 医院/诊所', es:'🏥 Hospital/clínica', de:'🏥 Krankenhaus/Klinik', fr:'🏥 Hôpital/clinique'});
}
function relabelFacilities(){
  facilityMarkers.forEach(f => { if (f.marker.getTooltip()) f.marker.setTooltipContent(facilityLabel(f.amenity) + f.name); });
}
async function loadNearbyFacilities(userPos, destPos){
  poiLayer.clearLayers();
  facilityMarkers = [];
  /* [경량화] 지점마다 around()를 거는 무거운 쿼리(수십 개 절)는 Overpass 부담이 커
     실패가 잦았다 → 경로를 감싸는 '단일 박스' 한 번의 조회로 바꿔 성공률을 높인다 */
  const pts = destPos ? [userPos, destPos] : [userPos];
  const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
  const padLat = 0.02, padLon = 0.02 / Math.max(0.2, Math.cos(userPos[0] * Math.PI / 180));   // ≈2km 여유
  const s = Math.min(...lats) - padLat, n = Math.max(...lats) + padLat;
  const w = Math.min(...lons) - padLon, e = Math.max(...lons) + padLon;
  const q = `[out:json][timeout:25];node["amenity"~"^(police|fire_station|hospital|clinic)$"](${s},${w},${n},${e});out body 120;`;

  const seen = new Set();
  let found = 0;
  try{
    const data = await overpassQuery(q);
    (data.elements || []).forEach(el => {
      if (seen.has(el.id) || el.lat == null || el.lon == null || !el.tags) return;
      seen.add(el.id);
      found++;
      const amenity = el.tags.amenity;
      const icon  = amenity === 'police' ? policeIcon : amenity === 'fire_station' ? fireIcon : medicalIcon;
      const name  = el.tags.name ? ` · ${el.tags.name}` : '';
      const m = L.marker([el.lat, el.lon], {icon})
        .bindTooltip(facilityLabel(amenity) + name, {direction:'top', className:'zone-tip', offset:[0,-12]})
        .addTo(poiLayer);
      facilityMarkers.push({ marker: m, amenity, name });
    });
    if (!found) toast('주변에 등록된 경찰서/소방서/병원 정보가 없습니다');
  }catch(e){
    console.warn('주변 시설(경찰/소방/병원) 조회 실패:', e);
    toast('⚠ 주변 시설 정보를 불러오지 못했습니다 (서버 응답 지연 · 잠시 후 다시 시도하세요)');
  }
}

/* ================================================================
   5-2. 실시간 날씨 알림 (OpenWeatherMap, 별도 API 키 필요)
   - 안전 경로 계산에는 절대 반영하지 않는 "정보 제공용" 알림
     : 항상 현재 날씨를 안전/위험으로 표시하고, 안전하더라도 5시간 이내
       위험 기상 예보가 있으면 함께 안내한다 (비/눈이 경로를 바꾸지는 않음)
================================================================ */
const OWM_API_KEY = '3e1ce733aeed5349e7c9ee2e8f43f657';
const DANGEROUS_MAINS = new Set(['Thunderstorm','Drizzle','Rain','Snow','Tornado','Squall','Ash']);
const WEATHER_EMOJI = {
  Thunderstorm:'⛈', Drizzle:'🌦', Rain:'🌧', Snow:'❄️', Tornado:'🌪', Squall:'💨', Ash:'🌋',
  Clear:'☀️', Clouds:'☁️', Mist:'🌫', Fog:'🌫', Haze:'🌫', Smoke:'💨', Dust:'🌪', Sand:'🌪'
};
/* OWM 언어코드 · 시간 로케일 매핑 (표시 언어에 맞춰 날씨 설명/시각도 현지화) */
const OWM_LANG = { ko:'kr', en:'en', ja:'ja', zh:'zh_cn', es:'es', de:'de', fr:'fr' };
const WX_TIME_LOCALE = { ko:'ko-KR', en:'en-US', ja:'ja-JP', zh:'zh-CN', es:'es-ES', de:'de-DE', fr:'fr-FR' };
async function checkWeatherAlert(pos){
  const el = $('weatherNotice');
  if (!pos || !el) return;
  const [lat, lon] = pos;
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  const uiLang = window.gmLang ? window.gmLang() : 'ko';
  const owmLang = OWM_LANG[uiLang] || 'en';
  const tLocale = WX_TIME_LOCALE[uiLang] || 'en-US';
  el.style.display = 'flex';
  el.className = 'weather-notice';
  el.innerHTML = '<span class="wx-emoji">🌡</span><span>' + P({ko:'날씨 확인 중...', en:'Checking weather...', ja:'天気を確認中...', zh:'正在检查天气...', es:'Comprobando el clima...', de:'Wetter wird geprüft...', fr:'Vérification de la météo...'}) + '</span>';
  try{
    const curRes = await fetchWithTimeout(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=${owmLang}`, 4000);
    if (!curRes.ok) throw new Error('현재 날씨 조회 실패 (' + curRes.status + ')');
    const cur = await curRes.json();
    const curMain = cur.weather?.[0]?.main;
    const curDesc = cur.weather?.[0]?.description || P({ko:'알 수 없음', en:'unknown', ja:'不明', zh:'未知', es:'desconocido', de:'unbekannt', fr:'inconnu'});
    const curTemp = cur.main?.temp != null ? Math.round(cur.main.temp) : null;
    const curDangerous = DANGEROUS_MAINS.has(curMain);

    /* 지금 당장 위험 기상이 아니면 5시간 이내 예보도 확인 */
    let forecastLine = '';
    if (!curDangerous){
      const fcRes = await fetchWithTimeout(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=${owmLang}`, 4000);
      if (fcRes.ok){
        const fc = await fcRes.json();
        const nowS = Date.now() / 1000;
        const soon = (fc.list || []).find(item => {
          const dh = (item.dt - nowS) / 3600;
          return dh >= 0 && dh <= 5 && DANGEROUS_MAINS.has(item.weather?.[0]?.main);
        });
        if (soon){
          const when = new Date(soon.dt * 1000).toLocaleTimeString(tLocale, {hour:'2-digit', minute:'2-digit'});
          const d = soon.weather[0].description;
          forecastLine = ' · ⚠ ' + P({ko:`${when} 경 ${d} 예보`, en:`${d} forecast around ${when}`, ja:`${when}頃 ${d} の予報`, zh:`${when}前后 ${d} 预报`, es:`pronóstico de ${d} hacia las ${when}`, de:`Vorhersage: ${d} gegen ${when}`, fr:`prévision : ${d} vers ${when}`});
        }
      }
    }

    const dangerNow = curDangerous || !!forecastLine;
    el.classList.toggle('danger', dangerNow);
    const status = curDangerous
      ? P({ko:'⚠ 위험 날씨', en:'⚠ Dangerous weather', ja:'⚠ 危険な天気', zh:'⚠ 危险天气', es:'⚠ Clima peligroso', de:'⚠ Gefährliches Wetter', fr:'⚠ Météo dangereuse'})
      : (forecastLine
          ? P({ko:'⚠ 주의', en:'⚠ Caution', ja:'⚠ 注意', zh:'⚠ 注意', es:'⚠ Precaución', de:'⚠ Achtung', fr:'⚠ Attention'})
          : P({ko:'✅ 안전한 날씨', en:'✅ Safe weather', ja:'✅ 安全な天気', zh:'✅ 天气安全', es:'✅ Clima seguro', de:'✅ Sicheres Wetter', fr:'✅ Météo sûre'}));
    const nowLabel = P({ko:'현재', en:'Now', ja:'現在', zh:'当前', es:'Ahora', de:'Jetzt', fr:'Actuel'});
    const srcNote = P({ko:'출처: OpenWeatherMap · 경로 계산에는 반영되지 않음', en:'Source: OpenWeatherMap · not used in route calculation', ja:'出典: OpenWeatherMap · 経路計算には未反映', zh:'来源: OpenWeatherMap · 不计入路线计算', es:'Fuente: OpenWeatherMap · no se usa en el cálculo de rutas', de:'Quelle: OpenWeatherMap · fließt nicht in die Routenberechnung ein', fr:"Source : OpenWeatherMap · non pris en compte dans le calcul d'itinéraire"});
    el.innerHTML = `<span class="wx-emoji">${WEATHER_EMOJI[curMain] || '🌡'}</span>`
      + `<span><b>${status}</b>`
      + ` · ${nowLabel} ${curDesc}${curTemp != null ? ', ' + curTemp + '°C' : ''}${forecastLine}`
      + `<small>${srcNote}</small></span>`;
  }catch(e){
    console.warn('날씨 정보를 가져올 수 없습니다:', e);
    el.className = 'weather-notice danger';
    const failMsg = P({ko:'날씨 정보를 가져올 수 없습니다', en:"Couldn't get weather info", ja:'天気情報を取得できません', zh:'无法获取天气信息', es:'No se pudo obtener el clima', de:'Wetterdaten nicht verfügbar', fr:"Impossible d'obtenir la météo"});
    const src = P({ko:'출처: OpenWeatherMap', en:'Source: OpenWeatherMap', ja:'出典: OpenWeatherMap', zh:'来源: OpenWeatherMap', es:'Fuente: OpenWeatherMap', de:'Quelle: OpenWeatherMap', fr:'Source : OpenWeatherMap'});
    el.innerHTML = '<span class="wx-emoji">⚠️</span><span>' + failMsg + '<small>' + src + '</small></span>';
  }
}

/* ================================================================
   5-3. 위험/통제 뉴스 스캔 (GNews API, 별도 API 키 필요)
   [한계] GNews는 위경도 반경(radius) 검색을 지원하지 않는 키워드 기반
     뉴스 검색 API다. "30km 반경"을 흉내내기 위해, 내 위치·목적지 좌표를
     Nominatim으로 "시/구" 단위까지만 역지오코딩(zoom=10)한 지역명 +
     위험 키워드로 검색한다 → 지역명 기준 근사치이며 실제 30km 원과는
     다를 수 있다. 또한 무료 플랜은 뉴스 반영이 최대 12시간 지연되고
     요청 빈도 제한이 빡빡하므로, 지역별로 결과를 캐싱해 재요청을 줄인다.
   이 뉴스 마커는 정확한 좌표/폴리곤이 없으므로 안전 경로 계산(zonePolys)에는
   전혀 반영하지 않고, 지도 위 경고 마커 + 헤드라인 목록으로만 안내한다.
================================================================ */
const GNEWS_API_KEY = '3be0723a2eb83e78cd207c49f5705ec0';
const GNEWS_RADIUS_HINT_KM = 30; // 실제 반경 필터링이 아닌, 검색 지역 단위를 정하기 위한 참고값
const newsCache = {};           // { [지역명]: {ts, articles} } - 15분 캐시로 재요청/429 최소화
const NEWS_CACHE_TTL_MS = 15 * 60 * 1000;

/* 뉴스 검색용 대략적 지역명 (도로명 등 너무 좁은 단위 대신 시/구 단위) */
async function reverseRegionName(pos){
  try{
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos[0]}&lon=${pos[1]}&zoom=10&accept-language=ko`, 4000);
    const d = await res.json();
    const ad = d.address || {};
    return ad.city || ad.town || ad.county || ad.state_district || ad.state || d.name || null;
  }catch(e){ return null; }
}

async function searchDangerNews(region){
  if (!region) return [];
  const cached = newsCache[region];
  if (cached && Date.now() - cached.ts < NEWS_CACHE_TTL_MS) return cached.articles;
  const q = `${region} (도로 통제 OR 통행 제한 OR 침수 OR 산불 OR 화재 OR 사고 OR 폐쇄 OR 위험)`;
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=ko&max=5&apikey=${GNEWS_API_KEY}`;
  try{
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok){ console.warn('GNews 응답 에러:', res.status); return []; }
    const data = await res.json();
    const articles = data.articles || [];
    newsCache[region] = { ts: Date.now(), articles };
    return articles;
  }catch(e){ console.warn('GNews 조회 실패:', e); return []; }
}

/* 위험 뉴스 마커 다국어 : 헤드라인(data)은 그대로, 감싸는 문구만 현지화하고
   언어 변경 시 재라벨할 수 있게 마커+데이터를 보관한다 */
let newsMarkers = [];   // {marker, region, list}
function newsTipHTML(region, list){
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  const km = GNEWS_RADIUS_HINT_KM;
  const head = P({
    ko:`🚨 '${region}' 인근(약 ${km}km) 위험 뉴스`,
    en:`🚨 Hazard news near '${region}' (~${km} km)`,
    ja:`🚨 '${region}' 周辺(約${km}km)の危険ニュース`,
    zh:`🚨 '${region}' 附近(约${km}km)危险新闻`,
    es:`🚨 Noticias de peligro cerca de '${region}' (~${km} km)`,
    de:`🚨 Gefahrennews nahe '${region}' (~${km} km)`,
    fr:`🚨 Actus danger près de '${region}' (~${km} km)`
  });
  return `${head}<br><span style="font-weight:500;color:#aab6d4">${list}</span>`;
}
function relabelNews(){
  newsMarkers.forEach(nm => { if (nm.marker.getTooltip()) nm.marker.setTooltipContent(newsTipHTML(nm.region, nm.list)); });
}
async function loadDangerNews(userPos, destPos){
  newsLayer.clearLayers();
  newsMarkers = [];
  const points = destPos ? [userPos, destPos] : [userPos];
  for (const pos of points){
    const region = await reverseRegionName(pos);
    if (!region) continue;
    const articles = await searchDangerNews(region);
    if (!articles.length) continue;
    const list = articles.slice(0, 5)
      .map(a => `• ${a.title}${a.source?.name ? ' (' + a.source.name + ')' : ''}`)
      .join('<br>');
    const m = L.marker(pos, {icon: newsIcon})
      .bindTooltip(newsTipHTML(region, list), {direction:'top', className:'zone-tip', offset:[0,-14]})
      .addTo(newsLayer);
    newsMarkers.push({ marker: m, region, list });
  }
}
