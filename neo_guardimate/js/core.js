/* GUARDIMATE · js/core.js — 전역 상태(state) + 공용 유틸($/toast) + 좌표 기하 유틸리티 (로드 순서 1/9) */

/* ================================================================
   1. 앱 전역 상태 (state)
   - 모든 화면이 이 객체를 공유하며, 값이 바뀌면 UI를 다시 그린다
================================================================ */
const state = {
  safePath: true,                              // Safe Path 토글 상태
  zones: { crime:true, disaster:true, infra:true, report:true }, // 위험 카테고리 on/off (report=커뮤니티 제보)
  nightBoost: true,                            // 🌙 심야 위험 가중 (야간에 치안 구역 반경 확대)
  reports: [],                                 // 커뮤니티 위험 제보 목록 (localStorage 연동)
  zoneCounts: null,                            // 카테고리별 위험구역 개수 (토글 재빌드 때 배치 유지용)
  mapStyle: 'dark',
  chatHistory: [],                             // AI 챗 대화 기록 (API에 전달)
  userPos: null,                               // [위도, 경도] 실제 GPS
  destPos: null,
  destName: '목적지',
  usingRealGPS: false,
  zonePolys: {},                               // 위험구역 폴리곤 좌표 (경로 교차 검사용)
  zoneParams: {},                              // 위험구역 생성 파라미터 {t,side,radius} (경로 회피 후보 생성용)
  routes: { safe:null, short:null },           // {coords, distM, durS, real, blocked}
  guardianNumber: '',                          // 지정 보호자 번호 (Settings에서 등록)
  consulateEnabled: true,                       // 영사콜센터 연동 on/off
  travelMode: 'walk'                           // 이동 수단: 'walk'(도보) | 'drive'(자동차)
};

const FALLBACK = [40.7648, -73.9808];          // 위치 권한 거부 시 데모 좌표(뉴욕)
const WALK_SPEED_MPS = 1.25;                   // 도보 평균 속력 (≈4.5km/h) - 모든 ETA 계산의 공통 기준
const DRIVE_SPEED_MPS = 11;                    // 시내 자동차 평균 속력 (≈40km/h) - OSRM 실패 시 근사용
const $ = id => document.getElementById(id);

/* 하단 토스트 알림 */
const toastEl = $('toast');
let toastTimer;
function toast(msg){
  toastEl.textContent = (window.gmTr ? window.gmTr(msg) : msg);   // 표시 언어로 번역(neo i18n)
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toastEl.classList.remove('show'), 2600);
}

/* ================================================================
   2. 좌표 기하 유틸리티
================================================================ */
/* 미터 단위 오프셋 -> 위경도 변환 (위도 1도 ≈ 111,320m) */
function offsetM(pos, northM, eastM){
  return [ pos[0] + northM/111320,
           pos[1] + eastM/(111320*Math.cos(pos[0]*Math.PI/180)) ];
}
/* 하버사인 공식 : 두 좌표 사이 실제 거리(m) */
function haversineM(a, b){
  const R=6371000, toR=x=>x*Math.PI/180;
  const dLat=toR(b[0]-a[0]), dLng=toR(b[1]-a[1]);
  const h=Math.sin(dLat/2)**2 + Math.cos(toR(a[0]))*Math.cos(toR(b[0]))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
/* 출발->도착 방향 단위벡터(u)와 그 수직벡터(p) 계산 (미터 좌표계 기준) */
function pathVectors(a, b){
  const north = (b[0]-a[0])*111320;
  const east  = (b[1]-a[1])*111320*Math.cos(a[0]*Math.PI/180);
  const len = Math.hypot(north, east) || 1;
  return { u:[north/len, east/len], p:[-east/len, north/len], len };
}
/* 경로상 t(0~1) 비율 지점에서 수직으로 side(m)만큼 벗어난 좌표 */
function alongOffset(a, b, t, side){
  const {u, p, len} = pathVectors(a, b);
  return offsetM(a, u[0]*len*t + p[0]*side, u[1]*len*t + p[1]*side);
}
/* 🌙 심야 판정 (21시~06시) - '심야 위험 가중'(state.nightBoost)과 함께 사용 */
function isNight(){
  const h = new Date().getHours();
  return h >= 21 || h < 6;
}
/* 임의 좌표를 현재 경로(a->b) 기준의 (t: 진행 비율, side: 수직 오프셋 m)로 사영
   -> 커뮤니티 제보 구역도 폴백 candidate 우회(buildZoneAwareWaypoints)가 피해갈 수 있게 */
function projectToRoute(a, b, pt){
  const { u, p, len } = pathVectors(a, b);
  const north = (pt[0]-a[0])*111320;
  const east  = (pt[1]-a[1])*111320*Math.cos(a[0]*Math.PI/180);
  return {
    t: Math.min(0.95, Math.max(0.05, (north*u[0] + east*u[1]) / len)),
    side: north*p[0] + east*p[1]
  };
}
/* 중심점 주변에 불규칙한 다각형 좌표 생성 (위험구역 모양용) */
function makePolygon(center, radiusM, n=6, seed=1){
  const pts=[];
  for(let i=0;i<n;i++){
    const ang = (i/n)*Math.PI*2 + seed;
    const r = radiusM * (0.75 + 0.45*Math.abs(Math.sin(seed*7+i*2.3)));
    pts.push(offsetM(center, Math.cos(ang)*r, Math.sin(ang)*r));
  }
  return pts;
}

/* ★ 위험구역을 '도로를 따라가는' 모양으로 만들기 (street-snap)
   - 라우팅용으로 이미 받아둔 도로 그래프(roadGraphCache)를 재사용(추가 네트워크 없음).
   - 중심 주변을 N개 방위 섹터로 나누고, 각 섹터에서 반경 안의 '가장 바깥 도로 노드'까지를
     경계로 삼아, 실제 길이 뻗은 만큼 구역이 퍼지는 울퍼불토한 폴리곤을 만든다.
   - 도로 커버리지가 부족하면 null 반환 → 기존 원형 블롭(makePolygon)으로 폴백.
   - 반환은 '단일 폴리곤'이라 경로 교차/페널티 등 하위 로직은 그대로 동작한다. */
function makeStreetPolygon(center, radiusM){
  const g = (typeof roadGraphCache !== 'undefined' && roadGraphCache) ? roadGraphCache.graph : null;
  if (!g || !g.nodes || g.nodes.size < 40) return null;
  const N = 20;
  const cosLat = Math.cos(center[0]*Math.PI/180);
  const maxR = new Array(N).fill(0);
  let filled = 0;
  for (const p of g.nodes.values()){
    const dN = (p[0]-center[0])*111320;
    const dE = (p[1]-center[1])*111320*cosLat;
    const d = Math.hypot(dN, dE);
    if (d > radiusM || d < radiusM*0.1) continue;
    let s = Math.floor((Math.atan2(dE, dN) + Math.PI) / (2*Math.PI) * N);
    s = ((s % N) + N) % N;
    if (d > maxR[s]){ if (maxR[s] === 0) filled++; maxR[s] = d; }
  }
  if (filled < N*0.6) return null;                 // 도로 커버리지 부족 → 폴백
  const r = new Array(N);
  for (let s=0; s<N; s++){
    if (maxR[s] > 0){ r[s] = maxR[s]; continue; }  // 빈 섹터는 이웃으로 보간
    const prev = maxR[(s-1+N)%N], next = maxR[(s+1)%N];
    r[s] = (prev && next) ? (prev+next)/2 : (prev || next || radiusM*0.72);
  }
  for (let s=0; s<N; s++){                          // 스파이크 완화(이웃 평균의 1.35배 상한)
    const nb = (r[(s-1+N)%N] + r[(s+1)%N]) / 2;
    if (r[s] > nb*1.35) r[s] = nb*1.35;
  }
  const poly = [];
  for (let s=0; s<N; s++){
    const ang = (s/N)*2*Math.PI - Math.PI;
    poly.push([ center[0] + (Math.cos(ang)*r[s])/111320,
                center[1] + (Math.sin(ang)*r[s])/(111320*cosLat) ]);
  }
  return poly;
}

/* ★ 볼록 껍질(convex hull) : 들쭉날쭉한 구역 폴리곤을 감싸는 '매끈하고 볼록한' 경계.
   경로 회피에 쓰면 — 원(반경)보다 작아 틈을 막지 않고, 폴리곤보다 매끈해 노치가 없으며,
   폴리곤을 완전히 포함해 표시 구역을 파고들지 않는다. Andrew's monotone chain. */
function convexHull(pts){
  if (!pts || pts.length < 4) return (pts || []).slice();
  const p = pts.slice().sort((a,b)=> (a[1]-b[1]) || (a[0]-b[0]));   // 경도(x=[1]) 우선 정렬
  const cross = (o,a,b)=> (a[1]-o[1])*(b[0]-o[0]) - (a[0]-o[0])*(b[1]-o[1]);
  const lo = [];
  for (const q of p){ while (lo.length>=2 && cross(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (let i=p.length-1;i>=0;i--){ const q=p[i]; while (up.length>=2 && cross(up[up.length-2], up[up.length-1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  const hull = lo.concat(up);
  return hull.length >= 3 ? hull : pts.slice();
}
/* ★ 점-다각형 내부 판정 (Ray Casting 알고리즘)
   : 점에서 수평 반직선을 쏘아 다각형 변과 홀수 번 교차하면 내부 */
function pointInPolygon(pt, poly){
  let inside = false;
  for(let i=0, j=poly.length-1; i<poly.length; j=i++){
    const yi=poly[i][0], xi=poly[i][1], yj=poly[j][0], xj=poly[j][1];
    if( ((yi>pt[0]) !== (yj>pt[0])) &&
        (pt[1] < (xj-xi)*(pt[0]-yi)/(yj-yi)+xi) ) inside = !inside;
  }
  return inside;
}
/* ★ 경로 촘촘화(densify)
   : OSRM 좌표는 직선 도로에서 점이 듬성듬성해서, 점과 점 "사이"로
     위험구역을 통과하면 검사에 안 걸리는 허점이 있다.
     -> 모든 구간을 stepM(기본 25m) 간격으로 잘게 쪼개 보간점을 추가 */
function densify(coords, stepM=25){
  const out = [coords[0]];
  for(let i=1;i<coords.length;i++){
    const a=coords[i-1], b=coords[i];
    const d = haversineM(a,b);
    const n = Math.max(1, Math.ceil(d/stepM));
    for(let k=1;k<=n;k++){
      out.push([ a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n ]);
    }
  }
  return out;
}
/* ★ 경로가 활성화된 위험구역과 몇 번 교차하는지 점수화
   : 촘촘화된 좌표를 하나씩 검사해 위험구역 내부 점 개수를 센다 (낮을수록 안전)
     25m 간격이므로 score ≈ 위험구역 안을 지나는 거리(m) / 25
   [주의] state.zonePolys[key]는 카테고리당 폴리곤 "배열"이다 (카테고리별로
     1~3개가 랜덤 생성됨) -> 배열의 각 폴리곤을 모두 검사한다 */
const ZONE_RISK_WEIGHT = { crime: 40, infra: 40, disaster: 34, report: 15 };  // 카테고리 심각도 가중(치안·인프라 최우선, 재난 강하게 회피, 제보는 미검증이라 중간)
function routeRiskScore(coords){
  const dense = densify(coords, 25);
  let score = 0;
  for (const [key, polys] of Object.entries(state.zonePolys)){
    if (!state.zones[key]) continue;           // 꺼진 카테고리는 검사 제외
    for (const poly of polys){
      for (const c of dense){
        if (pointInPolygon(c, poly)) score += (ZONE_RISK_WEIGHT[key] ?? 4);
      }
    }
  }
  return score;
}

/* ★ 경로 안전 점수 (0~100)
   - 위험구역 "내부" 통과 비율(강한 감점) + 구역 경계 150m 이내 "인접" 비율(약한 감점)
   - 심야 위험 가중이 켜진 야간에는 소폭 추가 감점
   - 100 = 위험 노출 없음 / 낮을수록 위험 노출이 큰 경로
   -> 안전 vs 최단을 켜고 끄는 이분법 대신, 두 경로의 트레이드오프를 정량 비교 */
function routeSafetyScore(route){
  if (!route || !route.coords || route.coords.length < 2) return null;
  const dense = densify(route.coords, 25);
  const zones = activeZoneList();               // 켜진 카테고리의 모든 구역 (커뮤니티 제보 포함)
  let inside = 0, near = 0;
  for (const c of dense){
    let isIn = false, isNear = false;
    for (const z of zones){
      const d = haversineM(c, z.center);
      if (d <= z.radius * 1.25 && pointInPolygon(c, z.poly)){ isIn = true; break; }
      if (d <= z.radius + 150) isNear = true;
    }
    if (isIn) inside++;
    else if (isNear) near++;
  }
  const n = dense.length;
  let score = 100 - Math.min(70, (inside / n) * 250) - Math.min(20, (near / n) * 60);
  if (state.nightBoost && isNight()) score -= 5; // 🌙 야간에는 같은 경로도 체감 위험이 커짐
  return Math.max(5, Math.min(100, Math.round(score)));
}
