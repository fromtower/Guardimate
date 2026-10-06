/* GUARDIMATE · js/routing.js — OSRM 도보 라우팅 + ★ 안전 경로 탐색 알고리즘(그래프 다익스트라) (로드 순서 4/9) */

/* ================================================================
   6. OSRM 도보 라우팅 API 호출 (예비 서버 및 에러 처리 강화)
   ================================================================ */

// [추가] 서버가 느릴 때 무한 로딩을 막기 위한 강제 타임아웃 함수
async function fetchWithTimeout(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
async function osrmRoute(points){
  const coordStr = points.map(p=>`${p[1]},${p[0]}`).join(';');
  const drive = (state.travelMode === 'drive');   // 이동 수단에 따라 프로필 선택
  const prof1 = drive ? 'driving' : 'foot';               // project-osrm.org 프로필
  const prof2 = drive ? 'routed-car' : 'routed-foot';     // openstreetmap.de 프로필
  // 1순위: OSRM 공식 서버 (기존 독일 서버보다 훨씬 빠르고 안정적임)
  const url1 = `https://router.project-osrm.org/route/v1/${prof1}/${coordStr}?overview=full&geometries=geojson&steps=false`;
  // 2순위: 기존 OpenStreetMap 독일 서버
  const url2 = `https://routing.openstreetmap.de/${prof2}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`;

  let res;
  try {
    // 1순위 서버에 요청 (4초 안에 답 없으면 바로 에러 처리하고 넘어감)
    res = await fetchWithTimeout(url1, 4000);
    if (!res.ok) throw new Error('1순위 서버 응답 에러');
  } catch (err) {
    console.warn('1순위 서버 지연/에러 발생, 2순위 서버로 재시도합니다.');
    // 2순위 서버로 재시도 (마찬가지로 4초 타임아웃)
    res = await fetchWithTimeout(url2, 4000);
    if (!res.ok) throw new Error('2순위 서버도 응답 없음');
  }

  const data = await res.json();
  if(!data.routes || !data.routes[0]) throw new Error('경로 데이터를 찾을 수 없음');
  
  const r = data.routes[0];
  return {
    coords: r.geometry.coordinates.map(c=>[c[1],c[0]]),
    distM: r.distance,
    /* 자동차: OSRM이 준 실제 주행 소요시간(duration)을 그대로 사용.
       도보: 1순위 공개 데모 서버(router.project-osrm.org)가 foot 프로필을 무시하고
       차량 기준 duration을 반환해 "4분"처럼 터무니없이 짧게 나오는 문제가 있어,
       거리/도보 속력으로 직접 계산한다(그래프 경로·직선 폴백과 기준 통일) */
    durS: drive ? r.duration : r.distance / WALK_SPEED_MPS,
    real: true
  };
}

/* OSRM 서버 전부 응답 없을 때의 최종 폴백: 경유점을 직선으로 연결한 "가짜 경로"
   (이동 수단에 맞는 평균 속력으로 소요시간 추정) */
function straightFallback(points){
  let distM = 0;
  for (let i=1;i<points.length;i++) distM += haversineM(points[i-1], points[i]);
  const speed = (state.travelMode === 'drive') ? DRIVE_SPEED_MPS : WALK_SPEED_MPS;
  return { coords: points.slice(), distM, durS: distM/speed, real:false };
}

/* ★ 경로에 'U턴'(진행 방향이 거의 반대로 꺾이는 되돌아가기)이 있는지 검사.
   - 각 꼭짓점에서 들어온 방향 벡터와 나가는 방향 벡터의 사잇각을 본다.
     같은 방향 유지 ≈ 0°, 완전 반대(U턴) ≈ 180°. 회전각이 threshold(기본 150°)
     이상이면 U턴으로 판단한다. (90° 정도의 정상적인 길 모퉁이는 통과)
   - OSRM 점 간격이 촘촘한 곳은 방향 계산이 흔들리므로 8m 이상 떨어진 점만 사용.
   - 위도에 따라 경도 1도의 실제 거리가 다르므로 경도차에 cos(lat)를 곱해
     각도가 실제 지형과 맞게 계산되도록 보정한다. */
function hasSharpReversal(coords, thresholdDeg = 150){
  if (!coords || coords.length < 3) return false;
  const pts = [];
  for (const c of coords){
    if (!pts.length || haversineM(pts[pts.length-1], c) >= 8) pts.push(c);
  }
  if (pts.length < 3) return false;
  const cosLat = Math.cos(pts[(pts.length/2)|0][0] * Math.PI/180);
  const limit = Math.cos(thresholdDeg * Math.PI/180);   // 회전각 ≥ threshold ⇔ 정규화 내적 ≤ cos(threshold)
  for (let i=1; i<pts.length-1; i++){
    const ax = (pts[i][1]-pts[i-1][1])*cosLat, ay = pts[i][0]-pts[i-1][0];
    const bx = (pts[i+1][1]-pts[i][1])*cosLat, by = pts[i+1][0]-pts[i][0];
    const la = Math.hypot(ax,ay), lb = Math.hypot(bx,by);
    if (la === 0 || lb === 0) continue;
    if ((ax*bx + ay*by)/(la*lb) <= limit) return true;   // 방향이 거의 반대로 꺾임 → U턴
  }
  return false;
}

/* ★ 경로에 '스파이크/되돌아옴'(멀리 갔다가 원래 자리 근처로 다시 오는 잔가지)이
   있는지 검사. 완전한 180° U턴은 아니지만, 경유점이 엉뚱하게 스냅돼 갔던 곳으로
   되돌아오는 잔가지는 각도만으로는 안 걸린다. 그래서 경로를 15m 간격으로 다시
   샘플링해, '경로상으로는 50m 이상 떨어졌는데 실제 위치는 15m 이내로 다시
   가까워지는' 두 점이 있으면 되돌아온 것으로 판단한다. */
function hasBacktrack(coords){
  if (!coords || coords.length < 3) return false;
  const pts = [{ p: coords[0], s: 0 }];
  let acc = 0, lastS = 0;
  for (let i=1;i<coords.length;i++){
    acc += haversineM(coords[i-1], coords[i]);
    if (acc - lastS >= 15){ pts.push({ p: coords[i], s: acc }); lastS = acc; }
  }
  for (let i=0;i<pts.length;i++){
    for (let j=i+1;j<pts.length;j++){
      if (pts[j].s - pts[i].s < 50) continue;                 // 경로상 가까운 점은 정상
      if (haversineM(pts[i].p, pts[j].p) <= 15) return true;  // 멀리 갔다가 다시 근처로 → 되돌아옴
    }
  }
  return false;
}

/* ★ 최종 경로에서 '되돌아오는 잔가지(loop/spike)'만 안전하게 잘라낸다.
   - 어떤 지점 P를 떠난 뒤 짧은 거리(MAX_LOOP_M) 안에서 다시 P의 14m 이내로
     돌아오면, 그 사이 구간은 갔다가 되돌아온 군더더기이므로 제거한다.
   - 잘라내도 이어지는 두 점이 거의 같은 자리(≤14m)라 도로를 벗어나는 긴 직선이
     생기지 않는다 → 안전. 실제 블록을 '한 방향으로' 도는 정상 경로(제자리로
     돌아오지 않음)는 그대로 둔다. 위험구역 회피 결과도 바뀌지 않는다. */
function dedupeLoops(coords){
  if (!coords || coords.length < 4) return coords;
  /* THRESH = '다시 근처로 돌아온 것'으로 볼 거리(m). 좁으면(14) 폭이 넓은 스파이크
     (갔다가 30m쯤 옆으로 돌아오는 ⊓⊔ 잔가지)를 못 잡는다 → 30으로 넓혀 확실히 제거.
     30m 이내로 되돌아오는 건 정상 주행에선 거의 없어(블록은 보통 그보다 큼) 안전하다. */
  const THRESH = 30, MAX_LOOP_M = 260;
  const out = [];
  let i = 0;
  while (i < coords.length){
    out.push(coords[i]);
    let acc = 0, cut = -1;
    for (let j = i + 1; j < coords.length; j++){
      acc += haversineM(coords[j-1], coords[j]);
      if (acc > MAX_LOOP_M) break;
      if (j > i + 1 && haversineM(coords[i], coords[j]) <= THRESH) cut = j;  // P로 되돌아온 가장 먼 지점
    }
    i = (cut > i + 1) ? cut : i + 1;   // 되돌아옴 구간이면 건너뛰고 복귀 지점부터 계속
  }
  return out;
}

/* ================================================================
   7. ★★ 핵심 : 안전 경로 탐색 알고리즘 ★★
   [1순위] 실제 도로 그래프 + 다익스트라 (아래 7-1 computeGraphSafeRoute)
     : Overpass로 사용자~목적지 주변의 실제 보행 도로망(노드/엣지)을 가져와
       엣지 가중치 = 실거리(m) + 위험구역 통과 페널티(큰 양수, 절대 음수
       아님)로 다익스트라를 돌려 "진짜" 최적 회피 경로를 구한다. 후보를
       추측하는 게 아니라 그래프 전체를 탐색하므로, 회피 가능한 경로가
       존재하면 반드시 찾아낸다.
   [2순위 폴백] 그래프 계산이 실패하면(범위가 너무 넓음·Overpass 서버
     실패·시작/도착점이 도로망과 너무 떨어져 있음 등) 아래의 기존
     candidate 방식으로 대체한다:
     1) 직선 1개 + 구역 위치 기반 우회(최대 2개) + 고정 단일 우회 6개
        + 고정 이중(S자) 우회 4개 = 최대 13개 후보 경로를 OSRM에 병렬 요청
     2) 각 후보를 25m 간격으로 촘촘화(densify)한 뒤 모든 점을
        위험구역 폴리곤과 대조해 교차 점수(routeRiskScore) 계산
     3) 교차 0점인 후보 중 가장 짧은 것을 안전 경로로 채택
        (모두 교차하면 교차가 가장 적은 경로 + '일부 통과' 경고)

   [구역 위치 기반 우회 - 폴백용] 고정 오프셋 후보들은 위험구역이 항상
   경로 중앙 부근(t≈0.3~0.55)에 있다고 가정한다. 그런데 카테고리당 1~3개의
   구역이 t 0.15~0.85 사이 어디에나 랜덤 배치될 수 있어(buildZones 참고),
   고정 후보의 우회 지점이 실제 구역과 어긋나 그냥 관통해버리는 경우가
   있었다. 그래서 활성화된 모든 구역의 실제
   (t, side, radius)를 읽어, 그 구역의 t 위치에 정확히 그 구역을 벗어나는
   경유점을 놓는 후보를 추가한다 (margin을 다르게 준 3가지를 시도). */

/* 현재 활성화된(카테고리 토글이 켜진) 위험구역 전체를 평평한 배열로 */
function activeZoneList(){
  const list = [];
  Object.entries(state.zoneParams || {}).forEach(([key, zones]) => {
    if (state.zones[key]) list.push(...zones);
  });
  return list;
}

function safeOffsetFor(zone, marginM){
  /* zone.side ± (zone.radius + marginM) 중, 직선 경로(0)에서 더 가까운
     쪽으로 최소한만 비켜가도록 선택 -> 불필요하게 크게 돌지 않는다 */
  const optA = zone.side - (zone.radius + marginM);
  const optB = zone.side + (zone.radius + marginM);
  return Math.abs(optA) <= Math.abs(optB) ? optA : optB;
}
function buildZoneAwareWaypoints(a, b, marginM){
  const activeZones = activeZoneList();
  if (!activeZones.length) return null;
  const sorted = [...activeZones].sort((x, y) => x.t - y.t);
  return [a, ...sorted.map(z => alongOffset(a, b, z.t, safeOffsetFor(z, marginM))), b];
}

/* ================================================================
   7-1. ★ 그래프 기반 다익스트라 안전 경로
   - 엣지 가중치 = 실거리(m) + 구역 통과 페널티(m).
     페널티는 절대 음수를 쓰지 않는다: 음수 가중치는 다익스트라의 정합성을
     깨뜨리고(한 번 확정된 최단거리가 나중에 더 줄어들 수 있음), 설령 그대로
     돌아가더라도 "그 도로를 더 선호"하게 만들어 위험구역으로 더 끌리는
     정반대 결과가 된다. 대신 유한하게 "아주 큰" 양수 페널티를 더해,
     구역을 완전히 피할 수 없는 상황에서도 "그나마 가장 덜 지나는 경로"를
     계속 찾을 수 있게 한다.
   - 그래프를 못 가져오거나(범위 초과·서버 실패) 시작/도착점이 도로망에서
     너무 멀면 null을 반환해, 호출부(calcRoutes)가 기존 candidate 휴리스틱
     으로 자연스럽게 폴백한다.
================================================================ */
const GRAPH_HIGHWAY_TYPES = ['footway','path','pedestrian','living_street','residential','service','track','steps','unclassified','tertiary','tertiary_link','secondary','secondary_link','primary','primary_link','cycleway'];
const GRAPH_MAX_BEELINE_M = 6000;    // 직선거리가 이보다 멀면 그래프를 새로 가져오지 않고 폴백 (도로망이 너무 커짐)
const GRAPH_NODE_SNAP_MAX_M = 300;   // 출발/도착점이 도로 그래프에서 이보다 멀면 폴백
const ZONE_EDGE_SAMPLE_STEP_M = 20;  // 도로 구간의 위험구역 통과 비율을 재는 샘플링 간격
/* [조정] 위험구역 통과 1m당 가상 페널티(m).
   ★ 반드시 방향 전환 페널티(TURN_PENALTY_M=45)보다 훨씬 커야 한다. 안 그러면
     "구역 모서리 1m 자르기(35)가 한 번 꺾기(45)보다 싸다"가 되어 구역을 파고든다.
     그래서 구역 페널티를 전환 페널티의 약 6~7배로 둔다 → 구역 회피가 항상 우선.
   과거에 500은 "구역 1m 피하려 500m 우회"라 골목을 지그재그로 누비는 경로가
   나왔지만, 그건 방향 전환 인식이 없던 노드 기반 시절 얘기다. 지금은 엣지 기반
   turn-aware 탐색이라 우회도 매끄럽게 그려지므로 큰 값이 안전하다.
   300 = 구역 1m 회피에 최대 300m까지 우회 감수(안전 최우선). */
const ZONE_EDGE_PENALTY_PER_M = 300;

/* [조정] 패딩 0.3 -> 0.45, 최소 0.004 -> 0.008도(약 890m)
   : 위험구역이 출발-도착 회랑을 넓게 덮으면 우회로가 박스 밖에 있는 경우가
     많아, 그래프가 박스 가장자리에 붙어 지그재그하는 경로를 만들었다.
     박스를 넓혀 실제 우회 가능한 도로까지 그래프에 포함시킨다
     (쿼리는 커지지만 같은 출발/도착에서는 캐시가 재사용돼 부담이 적음) */
function computeGraphBBox(a, b, padFrac = 0.45, minPadDeg = 0.008){
  const south = Math.min(a[0], b[0]), north = Math.max(a[0], b[0]);
  const west  = Math.min(a[1], b[1]), east  = Math.max(a[1], b[1]);
  const latPad = Math.max((north - south) * padFrac, minPadDeg);
  const lonPad = Math.max((east - west) * padFrac, minPadDeg);
  return [south - latPad, west - lonPad, north + latPad, east + lonPad]; // [south, west, north, east]
}

async function fetchRoadGraph(a, b){
  const [s, w, n, e] = computeGraphBBox(a, b);
  const hwRegex = GRAPH_HIGHWAY_TYPES.join('|');
  const q = `[out:json][timeout:25];way["highway"~"^(${hwRegex})$"]["foot"!~"^(no|private)$"](${s},${w},${n},${e});(._;>;);out skel qt;`;
  const data = await overpassQuery(q);
  return parseRoadGraph(data);
}

function parseRoadGraph(data){
  const nodes = new Map();      // id -> [lat, lon]
  const adjacency = new Map();  // id -> [{to, distM}]
  const addEdge = (from, to, distM) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ to, distM });
  };
  (data.elements || []).forEach(el => {
    if (el.type === 'node') nodes.set(el.id, [el.lat, el.lon]);
  });
  (data.elements || []).forEach(el => {
    if (el.type !== 'way' || !Array.isArray(el.nodes)) return;
    for (let i = 1; i < el.nodes.length; i++){
      const idA = el.nodes[i-1], idB = el.nodes[i];
      const posA = nodes.get(idA), posB = nodes.get(idB);
      if (!posA || !posB) continue;
      const distM = haversineM(posA, posB);
      if (distM <= 0) continue;
      addEdge(idA, idB, distM);
      addEdge(idB, idA, distM); // 도보 경로이므로 양방향
    }
  });
  return { nodes, adjacency };
}

function nearestGraphNode(nodes, pos){
  let bestId = null, bestD = Infinity;
  for (const [id, p] of nodes){
    const d = haversineM(pos, p);
    if (d < bestD){ bestD = d; bestId = id; }
  }
  return { id: bestId, distM: bestD };
}

/* 도로 구간(posA -> posB)이 활성 위험구역을 지나는 비율만큼 페널티(가상 거리 m) 부여 */
function edgeZonePenalty(posA, posB, activeZones){
  if (!activeZones.length) return 0;
  const distM = haversineM(posA, posB);
  if (distM <= 0) return 0;
  const mid = [(posA[0]+posB[0])/2, (posA[1]+posB[1])/2];
  /* 명백히 먼 구역은 정밀 샘플링 전에 걸러내 성능을 확보 (반경*1.25는
     makePolygon이 정점을 반경의 최대 1.2배까지 들쭉날쭉하게 뽑는 것에 대한 여유) */
  const nearby = activeZones.filter(z => haversineM(mid, z.center) <= (z.radius * 1.25) + distM/2 + 40);
  if (!nearby.length) return 0;
  const steps = Math.max(1, Math.ceil(distM / ZONE_EDGE_SAMPLE_STEP_M));
  let insideCount = 0;
  for (let i = 0; i <= steps; i++){
    const t = i / steps;
    const pt = [ posA[0] + (posB[0]-posA[0])*t, posA[1] + (posB[1]-posA[1])*t ];
    for (const z of nearby){
      /* [매끄러운 회피] 표시용 구역 폴리곤은 도로를 따라 들쭉날쭉(street-snap)한데,
         경로가 그 톱니를 하나하나 피하려다 보면 노치/계단이 생긴다. 그렇다고 '원(반경)'으로
         피하면 원이 실제 구역보다 커서 옆 틈을 막아버려(과회피) 오히려 후보 경로로 밀려나
         구역을 스치게 된다. 그래서 그 중간인 '볼록 껍질(hull)'로 판정한다:
         폴리곤보다 매끈(노치 없음) + 원보다 작아 틈을 안 막음 + 폴리곤을 완전히 포함(안 파고듦). */
      if (pointInPolygon(pt, z.hull || z.poly)){ insideCount++; break; }
    }
  }
  return (insideCount / (steps + 1)) * distM * ZONE_EDGE_PENALTY_PER_M;
}

/* [개선] 이진 최소 힙 : 기존 "미방문 노드 전체를 선형 탐색"하는 O(n^2) 방식은
   그래프가 수천 노드만 돼도 계산이 눈에 띄게 느려졌다. 힙으로 다음 노드를
   O(log n)에 꺼내 전체를 O(E log V)로 줄인다 */
class MinHeap {
  constructor(){ this.a = []; }
  get size(){ return this.a.length; }
  push(item){                     // item = [우선순위, 노드id]
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0){
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(){
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length){
      a[0] = last;
      let i = 0;
      for (;;){
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l;
        if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        [a[i], a[s]] = [a[s], a[i]];
        i = s;
      }
    }
    return top;
  }
}

/* [지그재그 완화 - 방향 전환 비용] 격자 도로에서 대각선으로 가려면 두 직교
   도로를 번갈아 타야 해서, '계단식 지그재그'와 '한 번 크게 꺾는 L자'의 길이가
   같다. 길이가 같으면 알고리즘이 굳이 깔끔한 쪽을 고르지 않아 계단이 나온다.
   전환 1회(직각)마다 작은 가상 페널티를 더해 '길게 쭉 뻗는' 경로를 선호하게 한다.
   구역 페널티(1m당 35)에 비하면 훨씬 작아 '위험구역 회피'는 최우선으로 유지된다. */
const TURN_PENALTY_M = 45;   // 직각(90°) 전환 1회당 가상 거리(m). 180°(U턴)=2배 · 값↑ = 전환을 더 강하게 회피(더 곧게)
function turnCost(pPrev, pCur, pNext){
  const cosLat = Math.cos(pCur[0] * Math.PI/180);
  const ax = (pCur[1]-pPrev[1])*cosLat, ay = pCur[0]-pPrev[0];
  const bx = (pNext[1]-pCur[1])*cosLat, by = pNext[0]-pCur[0];
  const la = Math.hypot(ax,ay), lb = Math.hypot(bx,by);
  if (la === 0 || lb === 0) return 0;
  let c = (ax*bx + ay*by)/(la*lb);
  c = c < -1 ? -1 : c > 1 ? 1 : c;
  return TURN_PENALTY_M * (Math.acos(c) / (Math.PI/2));   // 회전각 / 90° 에 비례
}

/* ★ 안전 경로 탐색 : '엣지 기반(turn-aware)' 다익스트라 + A* 휴리스틱.
   [핵심] 탐색 상태를 '노드'가 아니라 '방향이 있는 엣지'(어느 노드에서 어느
   노드로 진입했는가)로 둔다. 그래야 "지금 어느 방향으로 가고 있는지"를 알아
   방향 전환 비용(turnCost)을 정확히 매길 수 있고, 계단식 지그재그가 사라진다.
   (노드 기반으로 전환 비용을 근사하면 진입 방향을 한 번만 고정해 오히려 이상한
    우회가 생겼다 → 그래서 엣지 기반으로 올바르게 구현한다)
   - 비용 = 실거리 + 위험구역 페널티(양수) + 방향 전환 페널티(양수).
   - A* 휴리스틱은 목적지까지 직선거리(모든 비용이 음수 아님 → admissible).
   - 반환 coords/distM에는 '실거리'만 누적(가상 페널티는 표시 거리·ETA에 넣지 않음). */
function dijkstraSafeRoute(graph, startId, endId, activeZones){
  if (startId === endId) return null;
  const endPos = graph.nodes.get(endId);
  const key = (from, to) => from + '_' + to;      // 방향 엣지 상태 키
  const best = new Map();      // stateKey -> 최소 비용
  const info = new Map();      // stateKey -> {to, realM, penaltyM, prevKey}
  const visited = new Set();   // 확정된 상태 키
  const penaltyCache = new Map();
  const heap = new MinHeap();
  const zonePen = (idA, posA, idB, posB) => {
    const ek = idA < idB ? idA + '_' + idB : idB + '_' + idA;
    let p = penaltyCache.get(ek);
    if (p === undefined){ p = edgeZonePenalty(posA, posB, activeZones); penaltyCache.set(ek, p); }
    return p;
  };

  /* 시작 노드의 각 이웃으로 가는 초기 상태 (진입 방향이 없으므로 회전 비용 0) */
  const startPos = graph.nodes.get(startId);
  for (const { to, distM } of (graph.adjacency.get(startId) || [])){
    const posB = graph.nodes.get(to);
    const pen = zonePen(startId, startPos, to, posB);
    const cost = distM + pen;
    const k = key(startId, to);
    if (cost < (best.has(k) ? best.get(k) : Infinity)){
      best.set(k, cost);
      info.set(k, { to, realM: distM, penaltyM: pen, prevKey: null });
      heap.push([cost + haversineM(posB, endPos), startId, to]);
    }
  }

  let goalKey = null;
  while (heap.size){
    const [, fromId, curId] = heap.pop();
    const curKey = key(fromId, curId);
    if (visited.has(curKey)) continue;   // 힙에 남아 있던 옛(더 비싼) 항목은 무시
    visited.add(curKey);
    if (curId === endId){ goalKey = curKey; break; }   // 목적지 도착 → 확정 종료

    const curCost = best.get(curKey);
    const posPrev = graph.nodes.get(fromId);
    const posCur = graph.nodes.get(curId);
    for (const { to, distM } of (graph.adjacency.get(curId) || [])){
      const nk = key(curId, to);
      if (visited.has(nk)) continue;
      const posB = graph.nodes.get(to);
      const pen = zonePen(curId, posCur, to, posB);
      const turn = turnCost(posPrev, posCur, posB);   // 진입 방향(from→cur) 대비 (cur→to) 회전
      const alt = curCost + distM + pen + turn;
      if (alt < (best.has(nk) ? best.get(nk) : Infinity)){
        best.set(nk, alt);
        info.set(nk, { to, realM: distM, penaltyM: pen, prevKey: curKey });
        heap.push([alt + haversineM(posB, endPos), curId, to]);
      }
    }
  }

  if (!goalKey) return null; // 도달 불가

  const coords = [];
  let realDistM = 0, penaltyDistM = 0;
  let k = goalKey;
  while (k){
    const st = info.get(k);
    coords.push(graph.nodes.get(st.to));
    realDistM += st.realM;
    penaltyDistM += st.penaltyM;
    k = st.prevKey;
  }
  coords.push(graph.nodes.get(startId));
  coords.reverse();

  return { coords, distM: realDistM, penaltyM: penaltyDistM };
}

/* ★ 그래프 기반 안전 경로 계산의 진입점. 실패 조건을 만나면 예외 없이
   null을 반환해서, 호출부가 항상 기존 candidate 휴리스틱으로 이어갈 수 있게 한다 */
let roadGraphCache = { key: null, graph: null };   // 같은 출발/도착의 도로 그래프 재사용

async function computeGraphSafeRoute(a, b){
  try{
    if (haversineM(a, b) > GRAPH_MAX_BEELINE_M) return null;

    /* [캐시] 출발/도착이 같으면 Overpass에서 도로 그래프를 다시 받지 않는다.
       제보 추가/삭제나 카테고리 토글은 "구역"만 바뀔 뿐 도로망은 그대로이므로,
       재계산이 네트워크 왕복 없이 로컬 다익스트라만으로 즉시 끝난다 */
    const key = a.join(',') + '|' + b.join(',');
    let graph;
    if (roadGraphCache.key === key && roadGraphCache.graph){
      graph = roadGraphCache.graph;
    } else {
      graph = await fetchRoadGraph(a, b);
      if (graph.nodes.size) roadGraphCache = { key, graph };
    }
    if (!graph.nodes.size) return null;

    const startNode = nearestGraphNode(graph.nodes, a);
    const endNode = nearestGraphNode(graph.nodes, b);
    if (!startNode.id || !endNode.id) return null;
    if (startNode.distM > GRAPH_NODE_SNAP_MAX_M || endNode.distM > GRAPH_NODE_SNAP_MAX_M) return null;

    const result = dijkstraSafeRoute(graph, startNode.id, endNode.id, activeZoneList());
    if (!result || result.coords.length < 2) return null;

    return {
      coords: result.coords,
      distM: result.distM,
      durS: result.distM / WALK_SPEED_MPS,   // 모든 경로와 동일한 도보 속력 기준
      real: true,
      blocked: result.penaltyM > 0  // 구역을 조금이라도 지나야 했다면 '일부 통과'로 표시
    };
  }catch(e){
    console.warn('그래프 기반 안전 경로 계산 실패, 기존 후보 방식으로 대체:', e);
    return null;
  }
}

let calcSeq = 0;   /* 경로 계산 세대 번호 : 계산 도중 목적지를 바꾸면
                      늦게 도착한 이전 계산 결과가 새 경로를 덮어쓰던 버그 방지 */
let osrmCandCache = { key: null, list: [] };   // 같은 출발/도착의 고정 오프셋 후보 재사용
async function calcRoutes(){
  const mySeq = ++calcSeq;
  $('routeMeta').textContent = '안전 경로 분석 중...';
  $('etaVal').textContent = '—';
  const a = state.userPos, b = state.destPos;

  /* [안전 경로 품질 우선] 위험구역을 '진짜로' 피하려면 실제 도로망 위에서
     구역 통과에 페널티를 주는 그래프 탐색(다익스트라)이 필요하다. 경유점
     오프셋(candidate) 방식은 폴리곤 구역을 확실히 우회하지 못해 구역을 파고드는
     경우가 있어서, 그래프 경로를 1순위로 되살린다.
     - Overpass(도로망) 호출이 필요해 '새 목적지'는 처음 한 번 다소 느릴 수 있으나,
       같은 출발/도착은 캐시되어 이후 즉시 나온다(roadGraphCache).
     - GRAPH_MAX_WAIT_MS를 넘으면 OSRM 후보 경로로 자동 폴백해 무한 대기를 막는다.
     - 자동차 모드는 보행 도로망 그래프가 부적합하므로 건너뛴다.
     OSRM 후보 계산과 '동시에' 시작해 전체 대기시간을 늘리지 않는다 */
  const graphSafePromise = (state.travelMode === 'drive') ? Promise.resolve(null) : computeGraphSafeRoute(a, b);
  const GRAPH_MAX_WAIT_MS = 8000;   // 회피 품질을 살리되 무한 대기는 방지
  const graphSafeCapped = Promise.race([
    graphSafePromise,
    new Promise(res => setTimeout(() => res(null), GRAPH_MAX_WAIT_MS))
  ]);

  /* --- 1단계: 후보 경유지 목록 (경로 수직 방향 오프셋, 단위 m) --- */
  /* 두 종류의 후보를 만든다:
       A) 단일 우회 : 중간(t=0.5)에서 좌/우로 비켜가기
       B) 이중 우회 : t=0.3과 t=0.7 두 곳에 경유지를 두어
          경로 전체를 한쪽으로 밀어내기 (한쪽 위험을 통째로 회피)
     [불필요한 우회 개선] 그래프 다익스트라를 걷어낸 뒤로는 이 후보들이
     '안전 경로'를 직접 결정한다. 안전 경로 = 위험구역을 지나지 않는(risk 0)
     후보 중 '가장 짧은' 것이라, 최소한만 비켜가는 후보가 실제로 존재해야
     쓸데없이 크게 도는 경로를 피할 수 있다. 그래서
       ① 작은 오프셋(±90)을 촘촘히 추가해 '살짝만' 비켜가는 후보를 확보하고
       ② 위험구역 바로 바깥(margin 40m)을 스치는 zone-aware 후보를 추가한다.
     zone-aware 후보는 단일 오프셋의 V자 우회와 달리 실제 구역 위치에 딱
     맞춰 경유점을 놓으므로, 회피에 필요한 '최소' 우회에 가장 가깝다 */
  const singleOffsets = [90, -90, 180, -180, 340, -340, 560, -560];
  const doubleOffsets = [280, -280, 520, -520];
  const zoneAwarePts = [40, 110, 220]
    .map(margin => buildZoneAwareWaypoints(a, b, margin))
    .filter(Boolean);
  /* 고정 오프셋 후보 : 직선 1개 + 단일 우회 6개 + 이중 우회 4개 = 11개
     (위험구역과 무관하게 출발/도착만으로 결정되므로 캐시 가능) */
  const fixedPts = [
    [a, b],                                                        // 직선(최단) 후보
    ...singleOffsets.map(off => [a, alongOffset(a,b,0.5,off), b]), // A) 단일 우회 6개
    ...doubleOffsets.map(off =>                                    // B) 이중 우회 4개
      [a, alongOffset(a,b,0.3,off), alongOffset(a,b,0.7,off), b])
  ];

  /* --- 후보 경로 요청: 8개씩 병렬 배치 ---
     [개선] 기존 순차 요청은 전체 계산에 수십 초가 걸려, 그 사이 목적지를
     바꾸면 옛 경로가 뒤늦게 그려지는 문제가 있었다. 병렬 배치로 수 초 안에
     끝내되, 공용 OSRM 서버 부하를 고려해 동시 요청은 8개로 제한한다(배치 수↓ → 더 빠름)
     [캐시] 고정 오프셋 후보 11개는 출발/도착이 같으면 결과가 항상 같으므로
     재사용하고, 구역 위치에 따라 달라지는 후보(최대 2개)만 새로 요청한다
     -> 제보 추가/카테고리 토글 시 OSRM 요청이 13회에서 최대 2회로 줄어
        경로 재계산이 즉시 끝난다 */
  async function fetchBatch(ptsList){
    const out = [];
    for (let i = 0; i < ptsList.length; i += 8){
      if (mySeq !== calcSeq) return null;   // 그 사이 새 계산이 시작됨 -> 이 결과는 폐기
      const results = await Promise.allSettled(
        ptsList.slice(i, i+8).map(pts => osrmRoute(pts)));
      results.forEach(r => {
        if (r.status === 'fulfilled') out.push(r.value);
        else console.warn('개별 경로 탐색 실패 (스킵):', r.reason);
      });
    }
    return out;
  }
  const candKey = a.join(',') + '|' + b.join(',') + '|' + (state.travelMode || 'walk');   // 이동 수단별 캐시 분리
  let fixedCands;
  if (osrmCandCache.key === candKey && osrmCandCache.list.length){
    fixedCands = osrmCandCache.list.slice();
  } else {
    fixedCands = await fetchBatch(fixedPts);
    if (fixedCands === null) return;
    if (fixedCands.length) osrmCandCache = { key: candKey, list: fixedCands.slice() };
  }
  const zoneCands = await fetchBatch(zoneAwarePts);
  if (zoneCands === null) return;
  let candidates = [...fixedCands, ...zoneCands];
  if (mySeq !== calcSeq) return;     // 결과 적용 직전 최종 확인

  if (!candidates.length){
    candidates = fixedPts.slice(0, 3).map(pts => straightFallback(pts));
    toast('⚠ 라우팅 서버 연결 불가 · 직선 근사로 표시');
  }

  /* --- 비정상 후보 걸러내기 ---
     [개선] 경유지가 강 건너편·진입 불가 도로 등 엉뚱한 곳에 스냅되면
     왕복 지그재그의 터무니없는 경로가 나온다. 직선거리 대비 지나치게
     긴 후보는 제외한다 (전부 걸러지면 원본 유지) */
  const beeline = haversineM(a, b);
  const sane = candidates.filter(c => c.distM <= Math.max(beeline*3, beeline + 1200));
  if (sane.length) candidates = sane;

  /* --- 2단계: 각 후보의 위험구역 교차 점수 + '어색함'(U턴/스파이크) 계산 --- */
  candidates.forEach(c => {
    c.risk   = routeRiskScore(c.coords);
    /* U턴(≥150° 되돌아가기)이나 스파이크/되돌아옴(잔가지)이 있으면 '어색한' 경로로 표시.
       이 값은 안전(risk)이 같은 후보들 사이에서만 2차 기준으로 쓴다 → 매끄러운 경로를
       고르되, 안전(위험구역 회피)은 절대 희생하지 않는다 */
    c.wiggle = hasSharpReversal(c.coords) || hasBacktrack(c.coords);
  });

  /* 같은 안전 등급 안에서 더 나은 경로 고르기: 매끄러운 쪽 > 짧은 쪽 */
  const betterRoute = (m, c) => {
    if (!!m.wiggle !== !!c.wiggle) return m.wiggle ? c : m;   // 어색하지 않은 쪽 우선
    return c.distM < m.distM ? c : m;                          // 그다음 더 짧은 쪽
  };

  /* --- 3단계: 경로 선택 --- */
  /* 최단 경로 = 후보 중 가장 짧은 것 (위험 무시) */
  const shortR = candidates.reduce((m,c)=> c.distM < m.distM ? c : m);

  /* 안전 경로 1순위: 그래프 기반 다익스트라 결과 (대기 상한 초과 시 null → 후보로 폴백) */
  let safeR = await graphSafeCapped;
  if (mySeq !== calcSeq) return;

  /* [블록 모양 구역] 도로 그래프가 준비되면 위험구역을 '도로를 따라가는' 모양으로
     다시 그린다(최초 계산 때는 그래프가 없어 원형 블롭으로 그려졌을 수 있음).
     roadGraphCache.key가 바뀌면(=새 목적지) 자동으로 다시 스냅한다.
     경로선은 이 아래에서 그려지므로 z-순서(구역 위에 경로)도 유지된다. */
  if (typeof roadGraphCache !== 'undefined' && roadGraphCache.graph &&
      state._zoneShapeKey !== roadGraphCache.key){
    state._zoneShapeKey = roadGraphCache.key;
    buildZones(false);
    if (mySeq !== calcSeq) return;
  }

  /* [핵심] 그래프 경로가 '모든 구역을 완전히 회피(blocked=false)'했다면 그걸 우선한다.
     그래프 경로는 turn-aware + 원형(매끄러운) 회피라 후보(OSRM 오프셋)보다 훨씬
     깔끔하다. 예전엔 그래프가 골목을 과하게 돌아서 "더 짧은 교차0 후보"를 택했지만,
     지금은 그래프가 매끄러워서 '조금 길다는 이유로' 후보의 노치/계단 경로를 택하면
     오히려 지저분해진다. 그래서 다음 경우에만 후보(bestClean)로 대체한다:
       ① 그래프 경로가 구역을 일부 통과(blocked)했거나
       ② 그래프 경로가 최선 후보보다 지나치게 김(1.4배 초과 = 원형 회피가 과한 우회일 때) */
  const clean = candidates.filter(c => c.risk === 0);
  const bestClean = clean.length ? clean.reduce(betterRoute) : null;
  if (safeR && bestClean && (safeR.blocked || safeR.distM > bestClean.distM * 1.4)){
    safeR = bestClean;
    safeR.blocked = false;
  }

  if (!safeR){
    /* 그래프 계산 실패 시 기존 candidate 휴리스틱으로 대체
       안전 경로 = 교차 0점 후보 중 최단 / 없으면 교차 최소 후보 */
    if (bestClean){
      safeR = bestClean;
      safeR.blocked = false;
    } else {
      /* 완전 회피 불가: 위험(risk)이 가장 낮은 후보 우선, 같은 위험이면 매끄러운/짧은 쪽 */
      safeR = candidates.reduce((m,c)=> c.risk !== m.risk ? (c.risk < m.risk ? c : m) : betterRoute(m,c));
      safeR.blocked = true;   // 완전 회피 실패 표시
    }
  }
  /* 최종 마무리: 갔다가 제자리로 돌아오는 짧은 잔가지(spike/loop)만 제거해 깔끔하게.
     실제 블록을 한 방향으로 도는 정상 경로는 유지된다 */
  safeR.coords  = dedupeLoops(safeR.coords);
  shortR.coords = dedupeLoops(shortR.coords);
  state.routes.short = shortR;
  state.routes.safe  = safeR;

  /* --- 지도에 경로 그리기 --- */
  if (routeShortLine) map.removeLayer(routeShortLine);
  if (routeSafeLine)  map.removeLayer(routeSafeLine);
  /* [수정] 경로선을 탭하면 그 경로로 전환할 수 있게 클릭 핸들러 추가
     (bubblingMouseEvents:false - 경로선 클릭이 지도 클릭(목적지 변경)으로 번지는 것 차단) */
  routeShortLine = L.polyline(shortR.coords, {color:'#8b98b8', weight:4, dashArray:'8 8', opacity:.5, bubblingMouseEvents:false})
    .bindTooltip('⚡ 최단 경로 · 탭하여 전환', {sticky:true, className:'zone-tip'})
    .on('click', ()=> setSafePath(false))
    .addTo(map);
  routeSafeLine  = L.polyline(safeR.coords,  {color:'#3b82f6', weight:5, opacity:1, lineJoin:'round', bubblingMouseEvents:false})
    .bindTooltip('🛡 안전 경로 · 탭하여 전환', {sticky:true, className:'zone-tip'})
    .on('click', ()=> setSafePath(true))
    .addTo(map);
  refreshMapUI();
}
