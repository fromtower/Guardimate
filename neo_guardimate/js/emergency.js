/* GUARDIMATE · js/emergency.js — Emergency SOS + 안전 타이머(체크인) + 텔레그램 전송 (로드 순서 7/9) */

/* ================================================================
   13. Emergency SOS
   - 오작동 방지를 위해 5초 카운트다운 후 전송 (취소 가능)
================================================================ */
let sosTimer = null, sosCount = 5;
const sosBtn = $('sosBtn'), sosStatus = $('sosStatus'), sosCancel = $('sosCancel');

/* 카운트다운 완료 시 실제 위치로 텔레그램 SOS 전송
   (가능하면 최신 GPS를 새로 찍고, 실패하면 마지막으로 알던 위치를 사용) */
function fireSOS(){
  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      pos => sendTelegramSOS(pos.coords.latitude, pos.coords.longitude),
      () => sendTelegramSOS(...(state.userPos || FALLBACK)),
      { timeout: 3000 }
    );
  } else {
    sendTelegramSOS(...(state.userPos || FALLBACK));
  }
}
sosBtn.addEventListener('click', ()=>{
  if (sosTimer) return;                  // 중복 실행 방지
  sosCount = 5;
  sosBtn.classList.add('counting');
  sosCancel.style.display = 'block';
  sosStatus.className = 'sos-status armed';
  const tick = ()=>{
    if (sosCount <= 0){
      clearInterval(sosTimer); sosTimer = null;
      sosBtn.classList.remove('counting');
      sosCancel.style.display = 'none';
      sosStatus.className = 'sos-status sent';
      sosStatus.innerHTML = '✅ SOS 전송 완료!<br>보호자 및 지정 연락처에 위치·긴급 알림이 전달되었습니다';
      fireSOS();
      return;
    }
    sosStatus.textContent = `🚨 ${sosCount}초 후 긴급 알림이 전송됩니다...`;
    sosCount--;
  };
  tick();
  sosTimer = setInterval(tick, 1000);
});
sosCancel.addEventListener('click', ()=>{
  clearInterval(sosTimer); sosTimer = null;
  sosBtn.classList.remove('counting');
  sosCancel.style.display = 'none';
  sosStatus.className = 'sos-status';
  sosStatus.textContent = '전송이 취소되었습니다';
});
document.querySelectorAll('.call-chip').forEach(c=>{
  c.addEventListener('click', ()=>{
    toast('📞 ' + c.dataset.name + ' ' + (window.gmPick ? window.gmPick({ko:'발신 (시뮬레이션)', en:'call (simulation)', ja:'発信(シミュレーション)', zh:'拨打(模拟)', es:'llamada (simulación)', de:'Anruf (Simulation)', fr:'appel (simulation)'}) : '발신 (시뮬레이션)'));
    sendTelegramCallAlert(c.dataset.name, c.dataset.number);
  });
});

/* ================================================================
   13-1. 안전 타이머 (도착 체크인)
   - "30분 안에 도착할게" -> 시간 내 '무사 도착'을 누르지 않으면 보호자에게
     마지막 위치와 함께 미응답 알림을 자동 전송 (SOS의 사전 예방형 버전)
   - '무사 도착'을 누르면 보호자에게 도착 확인 알림을 보낸다
================================================================ */
let checkinInterval = null, checkinEndTs = 0, checkinMin = 0;

/* 🧪 타이머 테스트 모드 (Settings) : 어떤 프리셋을 눌러도 15초로 실행
   -> 텔레그램 미응답 알림이 실제로 전송되는지 기다리지 않고 확인할 수 있다 */
state.timerTest = false;
$('timerTestToggle').addEventListener('change', e=>{
  state.timerTest = e.target.checked;
  toast(state.timerTest ? '🧪 테스트 모드 ON · 안전 타이머가 15초로 실행됩니다' : '테스트 모드 해제 · 원래 시간으로 실행');
});

function fmtCountdown(ms){
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function setTimerUI(active){
  $('timerIdle').style.display = active ? 'none' : 'flex';
  $('timerActive').style.display = active ? 'block' : 'none';
}
function stopCheckin(){
  clearInterval(checkinInterval); checkinInterval = null;
  setTimerUI(false);
}
function checkinTick(){
  const left = checkinEndTs - Date.now();
  const el = $('timerCount');
  el.textContent = fmtCountdown(left);
  el.classList.toggle('warn', left <= 5 * 60 * 1000);   // 남은 시간 5분 미만이면 주황색 경고
  if (left <= 0){
    stopCheckin();
    const st = $('timerStatus');
    st.style.display = 'block';
    st.style.color = 'var(--orange)';
    st.textContent = `⚠ ${state.timerTest ? '15초(테스트)' : checkinMin + '분'} 체크인 미응답 · 보호자에게 위치와 함께 알림을 전송했습니다`;
    sendTelegramCheckinAlert();
    toast('⚠ 도착 확인이 없어 보호자에게 알림을 전송했습니다');
  }
}
$('timerIdle').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  checkinMin = parseInt(b.dataset.min, 10);
  const durMs = state.timerTest ? 15 * 1000 : checkinMin * 60 * 1000;   // 🧪 테스트 모드: 15초
  checkinEndTs = Date.now() + durMs;
  $('timerStatus').style.display = 'none';
  setTimerUI(true);
  checkinTick();
  checkinInterval = setInterval(checkinTick, 1000);
  toast(state.timerTest
    ? '🧪 테스트 · 15초 후 미응답 알림이 전송됩니다'
    : (window.gmPick ? window.gmPick({
        ko:`⏱ ${checkinMin}분 안전 타이머 시작 · 도착하면 '무사 도착'을 눌러주세요`,
        en:`⏱ ${checkinMin}-min safety timer started · tap 'Arrived safely' when you get there`,
        ja:`⏱ ${checkinMin}分の安全タイマー開始 · 到着したら「無事到着」を押してください`,
        zh:`⏱ 已启动${checkinMin}分钟安全计时器 · 到达后点'平安到达'`,
        es:`⏱ Temporizador de seguridad de ${checkinMin} min iniciado · pulsa 'Llegué bien' al llegar`,
        de:`⏱ ${checkinMin}-Min-Sicherheits-Timer gestartet · tippe bei Ankunft auf 'Sicher angekommen'`,
        fr:`⏱ Minuteur de sécurité de ${checkinMin} min démarré · appuie sur « Bien arrivé(e) » en arrivant`
      }) : `⏱ ${checkinMin}분 안전 타이머 시작 · 도착하면 '무사 도착'을 눌러주세요`));
});
$('timerArrived').addEventListener('click', ()=>{
  stopCheckin();
  const st = $('timerStatus');
  st.style.display = 'block';
  st.style.color = 'var(--green)';
  st.textContent = '✅ 무사 도착 확인 · 보호자에게 도착 알림을 전송했습니다';
  sendTelegramArrival();
  toast('✅ 무사 도착이 보호자에게 공유되었습니다');
});
$('timerStop').addEventListener('click', ()=>{
  stopCheckin();
  $('timerStatus').style.display = 'none';
  toast('안전 타이머가 취소되었습니다');
});

/* ================================================================
   텔레그램 봇을 이용한 긴급 알림 전송 (SOS/체크인/발신 알림 공용)
================================================================ */
const TG_BOT_TOKEN = '8628454041:AAHs9Bd_mdz8ti3bswliKteHr1luXnVtG9g';
const TG_CHAT_ID = '7168975347';

/* 텔레그램 전송 공용 함수 */
async function sendTelegramMessage(text){
  const telegramUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text })
    });
    if (!response.ok) console.error('API 응답 에러 (너무 자주 보냈을 수 있습니다)');
    return response.ok;
  } catch (error) {
    console.error('❌ 텔레그램 전송 실패:', error);
    return false;
  }
}

async function sendTelegramSOS(lat, lng) {
  const timeString = new Date().toLocaleTimeString('ko-KR');
  const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
  const message = `🚨 [긴급 SOS 알림] 🚨\n\n지정된 보호대상자가 SOS 버튼을 눌렀습니다!\n즉시 확인 및 신고를 진행해 주세요.\n\n⏰ 발생 시간: ${timeString}\n📍 현재 위치:\n${mapLink}`;
  if (await sendTelegramMessage(message)){
    console.log(`✅ 텔레그램 SOS 전송 성공! (${timeString})`);
    toast('🚨 보호자에게 긴급 메시지와 위치를 전송했습니다!');
  }
}

/* 안전 타이머 : 체크인 미응답 -> 보호자에게 마지막 위치와 함께 자동 알림 */
async function sendTelegramCheckinAlert(){
  const timeString = new Date().toLocaleTimeString('ko-KR');
  const pos = state.userPos || FALLBACK;
  const mapLink = `https://www.google.com/maps?q=${pos[0]},${pos[1]}`;
  const durLabel = state.timerTest ? '15초 · 테스트 모드' : `${checkinMin}분`;
  const message = `⏱ [체크인 미응답 알림]\n\n사용자가 안전 타이머(${durLabel}) 내에 도착 확인을 하지 않았습니다.\n연락하여 상황을 확인해 주세요.\n\n⏰ 시간: ${timeString}\n🏁 목적지: ${state.destName}\n📍 마지막 위치:\n${mapLink}`;
  if (await sendTelegramMessage(message)) console.log('✅ 체크인 미응답 알림 전송 성공');
}

/* 안전 타이머 : 무사 도착 확인 알림 */
async function sendTelegramArrival(){
  const timeString = new Date().toLocaleTimeString('ko-KR');
  const message = `✅ [도착 확인]\n\n사용자가 안전 타이머 내에 무사 도착을 확인했습니다.\n\n⏰ 시간: ${timeString}\n🏁 목적지: ${state.destName}`;
  if (await sendTelegramMessage(message)) console.log('✅ 도착 확인 알림 전송 성공');
}

/* 응급 연락처 발신 버튼을 누르면 보호자에게도 알림 전송 */
async function sendTelegramCallAlert(contactName, number){
  const timeString = new Date().toLocaleTimeString('ko-KR');
  const pos = state.userPos || FALLBACK;
  const mapLink = `https://www.google.com/maps?q=${pos[0]},${pos[1]}`;
  const numLine = number ? `\n☎ 번호: ${number}` : '';
  const message = `📞 [발신 알림]\n\n사용자가 '${contactName}'로 발신을 시도했습니다.${numLine}\n\n⏰ 시간: ${timeString}\n📍 위치:\n${mapLink}`;
  if (await sendTelegramMessage(message)){
    console.log(`✅ 발신 알림 전송 성공 (${contactName}, ${timeString})`);
  }
}
