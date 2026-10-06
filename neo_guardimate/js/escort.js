/* GUARDIMATE · js/escort.js — 보호자 실시간 동행(Guardian Escort)
   (추가 모듈 · emergency.js 다음, chat.js 이전에 로드)

   ================================================================
   ★ 개념 : 기존 SOS/안전 타이머가 "사건이 터진 뒤" 알리는 것이라면,
     Guardian Escort는 이동하는 "내내" 보호자가 지켜보게 하는 기능이다.
     - 시작하면 보호자(텔레그램)에게 목적지·출발 위치를 알리고,
       이후 일정 간격으로 현재 위치를 공유해 준(準)실시간 추적을 제공한다.
     - GUARDIMATE만의 차별점: 이미 계산해 둔 "안전 경로"를 기준으로
       ① 경로 이탈  ② 장시간 정지  ③ 목적지 도착 을 자동 감지해,
       거리 dot만 보내는 여느 위치공유 앱과 달리 "안전 경로에서 벗어났다"
       처럼 의미 있는 경고를 보호자에게 즉시 보낸다.
   ★ 재사용 : sendTelegramMessage(emergency.js) · state/haversineM(core.js)
     · userMarker/map(map.js) · state.routes.safe(routing.js) · toast(core.js)
   ★ 백엔드 불필요 : 별도 서버 없이 기존 텔레그램 봇 채널로 이벤트/핑을 보낸다.
   ================================================================ */

/* --- 감지 임계값 (일반 모드) --- */
const ESCORT_OFF_ROUTE_M   = 50;      // 안전 경로에서 이만큼(m) 벗어나면 '이탈 후보'
const ESCORT_OFF_ROUTE_SEC = 60;      // 이탈이 이 시간 이상 지속되면 보호자에게 알림
const ESCORT_STALL_SEC     = 180;     // 이동 없이 이 시간 이상이면 '정지' 알림
const ESCORT_MOVE_MIN_M    = 15;      // 이 거리 이상 움직여야 '이동 중'으로 인정
const ESCORT_ARRIVE_M      = 40;      // 목적지 이 반경(m) 내 도달 시 '무사 도착' 처리
const ESCORT_PING_MS       = 60000;   // 1분마다 보호자에게 현재 위치 공유(준실시간)

/* --- 런타임 상태 --- */
let escortActive = false;
let escortWatchId = null;
let escortPingTimer = null;
let escortRouteCoords = null;          // 시작 시점의 안전 경로 좌표(이 '트립'의 기준선)
let escortOffRouteSince = 0;
let escortOffRouteAlerted = false;
let escortLastMovePos = null;
let escortLastMoveTs = 0;
let escortStallAlerted = false;
let escortStartTs = 0;
/* 테스트 모드(Settings의 🧪)에서는 짧은 임계값을 써서 동작을 빠르게 확인 */
let effOffSec = ESCORT_OFF_ROUTE_SEC, effStallSec = ESCORT_STALL_SEC, effPingMs = ESCORT_PING_MS;

/* ================================================================
   기하 : 한 점에서 "안전 경로 폴리라인"까지의 최단 거리(m)
   - 점 주변을 국소 평면(등거리 근사)으로 투영해 각 선분까지의
     수직 거리를 구하고 최솟값을 취한다 (도보권 짧은 거리라 오차 무시 가능)
================================================================ */
function escortPointToSegmentM(p, a, b){
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos(p[0] * Math.PI / 180);
  const ax = (a[1]-p[1])*mPerLon, ay = (a[0]-p[0])*mPerLat;   // p를 원점으로
  const bx = (b[1]-p[1])*mPerLon, by = (b[0]-p[0])*mPerLat;
  const dx = bx-ax, dy = by-ay;
  const len2 = dx*dx + dy*dy;
  let t = len2 > 0 ? -(ax*dx + ay*dy) / len2 : 0;   // 원점(p)의 선분 투영 비율
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t*dx, cy = ay + t*dy;
  return Math.hypot(cx, cy);
}
function escortDistanceToRoute(pos, coords){
  let min = Infinity;
  for (let i = 1; i < coords.length; i++){
    const d = escortPointToSegmentM(pos, coords[i-1], coords[i]);
    if (d < min) min = d;
  }
  return min;
}

/* ================================================================
   텔레그램 메시지 빌더 (SOS와 동일한 봇 채널 사용)
================================================================ */
function escortMapLink(pos){ return `https://www.google.com/maps?q=${pos[0]},${pos[1]}`; }
function escortClock(){ return new Date().toLocaleTimeString('ko-KR'); }

function escortMsgStart(pos){
  const km = state.routes.safe ? (state.routes.safe.distM/1000).toFixed(1) + 'km' : '—';
  return `🛡 [동행 시작] GUARDIMATE\n\n보호대상자가 안전 경로 동행을 시작했습니다.\n`
       + `이동 중 경로 이탈·장시간 정지가 감지되면 즉시 알려드립니다.\n\n`
       + `🏁 목적지: ${state.destName}\n📏 예상 거리: ${km}\n⏰ 시작: ${escortClock()}\n📍 출발 위치:\n${escortMapLink(pos)}`;
}
function escortMsgPing(pos){
  return `📍 [동행 위치 공유]\n\n현재 이동 중입니다.\n⏰ ${escortClock()}\n${escortMapLink(pos)}`;
}
function escortMsgOffRoute(pos, dM){
  return `⚠ [경로 이탈 감지]\n\n보호대상자가 안전 경로에서 약 ${Math.round(dM)}m 벗어난 상태가 지속되고 있습니다.\n연락하여 상황을 확인해 주세요.\n\n🏁 목적지: ${state.destName}\n⏰ ${escortClock()}\n📍 현재 위치:\n${escortMapLink(pos)}`;
}
function escortMsgStall(pos){
  const mins = Math.round(effStallSec/60) || 1;
  return `⚠ [장시간 정지 감지]\n\n보호대상자가 약 ${state.timerTest ? effStallSec+'초' : mins+'분'} 동안 이동이 없습니다.\n연락하여 상황을 확인해 주세요.\n\n⏰ ${escortClock()}\n📍 현재 위치:\n${escortMapLink(pos)}`;
}
function escortMsgArrived(pos){
  return `✅ [무사 도착]\n\n보호대상자가 목적지(${state.destName})에 안전하게 도착했습니다. 동행을 종료합니다.\n⏰ ${escortClock()}`;
}
function escortMsgEnded(pos){
  return `🔚 [동행 종료]\n\n보호대상자가 동행을 직접 종료했습니다.\n⏰ ${escortClock()}\n📍 종료 위치:\n${escortMapLink(pos)}`;
}

/* ================================================================
   UI 갱신
================================================================ */
function escortUpdateUI(){
  const btn = $('escortBtn');
  if (!btn) return;
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);   // 현재 언어 문구 선택
  btn.classList.toggle('active', escortActive);
  $('escortTitle').textContent = escortActive
    ? P({ko:'보호자 동행 중 · 탭하여 종료', en:'Escort active · tap to end', ja:'保護者同行中 · タップで終了', zh:'监护人同行中 · 点击结束', es:'Acompañamiento activo · toca para terminar', de:'Begleitung aktiv · zum Beenden tippen', fr:'Accompagnement actif · toucher pour terminer'})
    : P({ko:'보호자 동행 시작', en:'Start guardian escort', ja:'保護者同行を開始', zh:'开启监护人同行', es:'Iniciar acompañamiento', de:'Begleitung starten', fr:'Démarrer l\'accompagnement'});
  $('escortSub').textContent   = escortActive
    ? P({ko:'실시간 위치를 보호자와 공유하고 있습니다', en:'Sharing your live location with your guardian', ja:'リアルタイム位置を保護者と共有中', zh:'正在向监护人共享实时位置', es:'Compartiendo tu ubicación en vivo con tu tutor', de:'Teilt deinen Live-Standort mit deinem Betreuer', fr:'Partage de ta position en direct avec ton tuteur'})
    : P({ko:'실시간 위치·경로 이탈을 보호자에게 공유', en:'Shares live location & route deviations with your guardian', ja:'リアルタイム位置・経路逸脱を保護者に共有', zh:'向监护人共享实时位置与偏离路线', es:'Comparte tu ubicación en vivo y desvíos de ruta con tu tutor', de:'Teilt Live-Standort & Routenabweichungen mit deinem Betreuer', fr:'Partage la position en direct et les écarts d\'itinéraire avec ton tuteur'});
  $('escortState').textContent = escortActive ? 'LIVE' : 'OFF';
}

/* ================================================================
   위치 업데이트 처리 : 이동/정지 · 경로 이탈 · 도착 감지
================================================================ */
function escortOnFix(pos){
  if (!escortActive) return;
  state.userPos = pos;                                   // SOS 등이 최신 위치를 쓰도록 갱신
  if (typeof userMarker !== 'undefined' && userMarker) userMarker.setLatLng(pos);

  /* ① 이동/정지 감지 */
  if (!escortLastMovePos || haversineM(pos, escortLastMovePos) >= ESCORT_MOVE_MIN_M){
    escortLastMovePos = pos;
    escortLastMoveTs = Date.now();
    escortStallAlerted = false;
  } else if (!escortStallAlerted && Date.now() - escortLastMoveTs >= effStallSec*1000){
    escortStallAlerted = true;
    sendTelegramMessage(escortMsgStall(pos));
    toast('⚠ 장시간 정지 감지 · 보호자에게 알림');
  }

  /* ② 안전 경로 이탈 감지 (기준선이 있을 때만) */
  if (escortRouteCoords && escortRouteCoords.length >= 2){
    const dRoute = escortDistanceToRoute(pos, escortRouteCoords);
    if (dRoute > ESCORT_OFF_ROUTE_M){
      if (!escortOffRouteSince) escortOffRouteSince = Date.now();
      if (!escortOffRouteAlerted && Date.now() - escortOffRouteSince >= effOffSec*1000){
        escortOffRouteAlerted = true;
        sendTelegramMessage(escortMsgOffRoute(pos, dRoute));
        toast('⚠ 안전 경로 이탈 감지 · 보호자에게 알림');
      }
    } else {
      if (escortOffRouteAlerted) toast('✅ 안전 경로로 복귀했습니다');
      escortOffRouteSince = 0;
      escortOffRouteAlerted = false;
    }
  }

  /* ③ 목적지 도착 감지 */
  if (state.destPos && haversineM(pos, state.destPos) <= ESCORT_ARRIVE_M){
    stopEscort('arrived');
  }
}

function escortSendPing(){
  if (escortActive && state.userPos) sendTelegramMessage(escortMsgPing(state.userPos));
}

/* ================================================================
   시작 / 종료
================================================================ */
function startEscort(){
  if (escortActive) return;
  if (!state.userPos){ toast('현재 위치를 먼저 확인해 주세요'); return; }
  if (!state.routes.safe || !state.routes.safe.coords || state.routes.safe.coords.length < 2){
    toast('목적지와 안전 경로를 먼저 설정해 주세요'); return;
  }

  escortActive = true;
  escortStartTs = Date.now();
  escortRouteCoords = state.routes.safe.coords.slice();   // 이 트립의 기준 경로 고정
  escortLastMovePos = state.userPos;
  escortLastMoveTs = Date.now();
  escortOffRouteSince = 0;
  escortOffRouteAlerted = false;
  escortStallAlerted = false;
  /* 🧪 테스트 모드면 빠른 임계값으로 동작 확인 */
  if (state.timerTest){ effOffSec = 8; effStallSec = 15; effPingMs = 15000; }
  else { effOffSec = ESCORT_OFF_ROUTE_SEC; effStallSec = ESCORT_STALL_SEC; effPingMs = ESCORT_PING_MS; }

  escortUpdateUI();
  sendTelegramMessage(escortMsgStart(state.userPos));
  toast(state.timerTest ? '🧪 테스트 동행 시작 · 임계값 단축' : '🛡 보호자 동행을 시작합니다');

  if (navigator.geolocation){
    escortWatchId = navigator.geolocation.watchPosition(
      p => escortOnFix([p.coords.latitude, p.coords.longitude]),
      e => { console.warn('동행 위치 추적 실패:', e); toast('위치 추적을 시작할 수 없어 마지막 위치로 공유합니다'); },
      { enableHighAccuracy:true, maximumAge:5000, timeout:10000 }
    );
  }
  escortPingTimer = setInterval(escortSendPing, effPingMs);
}

function stopEscort(reason){
  if (!escortActive) return;
  escortActive = false;
  if (escortWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(escortWatchId);
  escortWatchId = null;
  clearInterval(escortPingTimer); escortPingTimer = null;

  const pos = state.userPos || FALLBACK;
  if (reason === 'arrived'){
    sendTelegramMessage(escortMsgArrived(pos));
    toast('✅ 목적지 도착 · 보호자에게 무사 도착을 알렸습니다');
  } else {
    sendTelegramMessage(escortMsgEnded(pos));
    toast('보호자 동행을 종료했습니다');
  }
  escortUpdateUI();
}

/* 버튼 토글 (Safe Map 화면) */
(function wireEscortButton(){
  const btn = $('escortBtn');
  if (!btn) return;
  btn.addEventListener('click', ()=> escortActive ? stopEscort('user') : startEscort());
  escortUpdateUI();
})();
