/* GUARDIMATE · js/chat.js — AI Core Chat - Gemini API 연동 + 내장 오프라인 어시스턴트 (로드 순서 8/9) */

/* ================================================================
   14. AI Core Chat - 2단계 연결 체계
   ① API 키 직접 연결  : Settings에 입력한 Google Gemini API 키로
      브라우저에서 직접 호출 (Gemini API는 CORS 직접 호출 지원)
   ② 내장 오프라인 어시스턴트 : ①이 실패하면 앱 상태(state)를
      직접 읽어 규칙 기반으로 답변 -> 시연이 절대 중단되지 않음
================================================================ */
const chatLog = $('chatLog'), chatInput = $('chatInput'), chatSend = $('chatSend');
const DEFAULT_GEMINI_KEY = 'AIzaSyDTWWEv-aMDuvftsOnbbPWXeM9WQSdqqX0';  // 기본 내장 키 (Settings에서 다른 키로 교체 가능)
state.apiKey = DEFAULT_GEMINI_KEY;
state.aiMode = null;   // 'key' | 'offline' (첫 응답 때 확정)

/* API 키 저장 (브라우저 로컬 저장 시도, 안 되는 환경이면 메모리에만)
   저장된 키가 없거나 비워져 있으면 기본 내장 키 사용 */
try{ state.apiKey = localStorage.getItem('gm_gemini_key') || DEFAULT_GEMINI_KEY; }catch(e){}
if ($('apiKeyInput')) $('apiKeyInput').value = state.apiKey;
$('apiKeySave').addEventListener('click', ()=>{
  const entered = $('apiKeyInput').value.trim();
  state.apiKey = entered || DEFAULT_GEMINI_KEY;  // 비우면 기본 내장 키로 복귀
  try{ localStorage.setItem('gm_gemini_key', entered); }catch(e){}
  state.aiMode = null;  // 다음 메시지에서 다시 판별
  const CP = window.gmPick || (o => o.ko != null ? o.ko : o);
  const prefix = CP({ko:'연결 상태: ', en:'Status: ', ja:'接続状態:', zh:'连接状态:', es:'Estado: ', de:'Status: ', fr:'État : '});
  $('aiConnStatus').textContent = prefix + (entered
    ? CP({ko:'새 API 키 저장됨 · 다음 메시지부터 적용', en:'New API key saved · applies from next message', ja:'新しいAPIキーを保存 · 次のメッセージから適用', zh:'已保存新API密钥 · 下条消息起生效', es:'Nueva clave guardada · se aplica desde el próximo mensaje', de:'Neuer API-Schlüssel gespeichert · ab nächster Nachricht aktiv', fr:'Nouvelle clé API enregistrée · appliquée dès le prochain message'})
    : CP({ko:'기본 내장 키 사용', en:'Using built-in key', ja:'内蔵キーを使用', zh:'使用内置密钥', es:'Usando la clave integrada', de:'Integrierter Schlüssel wird verwendet', fr:'Utilisation de la clé intégrée'}));
  toast(entered ? '🔑 API 키가 저장되었습니다' : '기본 내장 키로 복귀했습니다');
});
function setConnStatus(mode){
  state.aiMode = mode;
  const CP = window.gmPick || (o => o.ko != null ? o.ko : o);
  const label = {
    key:     CP({ko:'✅ Gemini API 연결 (실제 AI)', en:'✅ Gemini API connected (real AI)', ja:'✅ Gemini API接続(実AI)', zh:'✅ 已连接Gemini API(真实AI)', es:'✅ Gemini API conectada (IA real)', de:'✅ Gemini-API verbunden (echte KI)', fr:'✅ API Gemini connectée (vraie IA)'}),
    offline: CP({ko:'🔌 오프라인 어시스턴트 (내장 응답)', en:'🔌 Offline assistant (built-in)', ja:'🔌 オフラインアシスタント(内蔵応答)', zh:'🔌 离线助手(内置回复)', es:'🔌 Asistente sin conexión (integrado)', de:'🔌 Offline-Assistent (integriert)', fr:'🔌 Assistant hors ligne (intégré)'})
  }[mode];
  $('aiConnStatus').textContent = CP({ko:'연결 상태: ', en:'Status: ', ja:'接続状態:', zh:'连接状态:', es:'Estado: ', de:'Status: ', fr:'État : '}) + label;
}

function addMsg(text, who){
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  chatLog.appendChild(d);
  chatLog.scrollTop = chatLog.scrollHeight;
  return d;
}

/* 현재 앱 상태를 AI 시스템 프롬프트로 직렬화 */
function buildContext(){
  const zoneNames = [];
  if (state.zones.crime) zoneNames.push('치안 위험 구역(심야 우범, 가로등 결함)');
  if (state.zones.disaster) zoneNames.push('재난·침수 구역(폭우로 인한 침수 상습 지역)');
  if (state.zones.infra) zoneNames.push('긴급 공사 구간(도보 통행 불가)');
  if (state.zones.report && state.reports.length) zoneNames.push(`커뮤니티 제보 구역 ${state.reports.length}건(사용자 직접 제보)`);
  const safe = fmtRoute(state.routes.safe), short = fmtRoute(state.routes.short);
  return `너는 GUARDIMATE 앱의 'AI Core Chat' 안전 비서다. GUARDIMATE는 해외 체류 유학생을 위한 AI 기반 개인 안전 동반자 앱이다.

[현재 Safe Map 상태 - 실시간 연동 데이터]
- 사용자 위치: ${state.userPos ? `좌표 ${state.userPos[0].toFixed(4)}, ${state.userPos[1].toFixed(4)}${state.usingRealGPS?' (실제 GPS)':' (데모 위치)'}` : '확인 중'}
- 목적지: ${state.destName}
- Safe Path: ${state.safePath ? 'ON' : 'OFF'}
- 안전 경로: ${safe.km}, 도보 약 ${safe.min} — 후보 경로들을 위험구역 폴리곤과 교차 검사하여 ${state.routes.safe?.blocked ? '완전 회피는 불가, 교차 최소 경로 선택됨' : '교차 0건인 경로가 선택됨'}
- 최단 경로: ${short.km}, 도보 약 ${short.min} (회피 검증 없음)
- 경로 안전 점수(100점 만점): 안전 경로 ${routeSafetyScore(state.routes.safe) ?? '계산 중'}점 / 최단 경로 ${routeSafetyScore(state.routes.short) ?? '계산 중'}점
- 심야 위험 가중: ${state.nightBoost ? (isNight() ? 'ON · 현재 야간이라 치안 구역 반경 1.35배 확대 적용 중' : 'ON · 현재는 주간이라 미적용 (야간 21~06시 자동 적용)') : 'OFF'}
- 커뮤니티 위험 제보: ${state.reports.length ? state.reports.length + '건 활성 (지도를 길게 눌러 제보, 경로 회피에 즉시 반영됨)' : '없음 (지도를 길게 눌러 제보 가능)'}
- 안전 타이머: Emergency 탭에서 15/30/60분 설정 가능. 시간 내 '무사 도착' 미확인 시 보호자에게 위치와 함께 자동 알림 전송
- 현재 활성화된 위험 구역: ${zoneNames.length ? zoneNames.join(' / ') : '없음(모든 알림 꺼짐)'}
- 참고: 위험 구역 데이터는 시연용 시뮬레이션이며, 실서비스에서는 공공데이터/범죄통계/크라우드소싱으로 채워짐

[응답 규칙]
- ${({ko:'반드시 한국어로', en:'You MUST reply in English', ja:'必ず日本語で', zh:'必须用简体中文', es:'DEBES responder en español', de:'Du MUSST auf Deutsch antworten', fr:'Tu DOIS répondre en français'})[(window.gmLang?window.gmLang():'ko')] || '반드시 한국어로'} 답한다. 사용자의 표시 언어 설정이 최우선이며, 사용자가 다른 언어로 물어도 이 언어로 답한다
- 친근하고 간결하게 답한다 (모바일 채팅이므로 보통 1~4문장, 필요할 때만 길게)
- 안전 관련 질문이 아니어도 괜찮다: 인사, 잡담, 일상 대화, 일반 상식 질문에도 다정한 친구처럼 자연스럽게 응한다
- 경로 질문에는 위 Safe Map 상태(거리, 시간, 회피 검증 결과)를 근거로 구체적으로 답한다
- 위급 상황 질문에는 앱의 Emergency SOS 탭(원터치 SOS, 현지 긴급번호, 대한민국 영사콜센터 +82-2-3210-0404) 사용을 안내한다
- 대화 흐름을 기억하고 이어서 답한다. 단, 답변 언어는 위에서 지정한 표시 언어를 항상 따른다
- 마크다운 문법 없이 일반 텍스트로 답한다`;
}

/* --- ③ 내장 오프라인 어시스턴트 ---
   AI 서버 없이도 앱 상태(경로/위험구역/ETA)를 읽어 규칙 기반으로 답변.
   실서비스라면 서버가 처리할 부분이지만, 데모의 안정성을 위해 내장 */
function localAssistant(q){
  const P = window.gmPick || (o => o.ko != null ? o.ko : o);
  const safe = fmtRoute(state.routes.safe), short = fmtRoute(state.routes.short);
  const ZN = {
    crime:    { ko:'치안 위험 구역(심야 우범·가로등 결함)', en:'public-safety risk zones (late-night crime · broken streetlights)', ja:'治安リスク区域(深夜犯罪・街灯不良)', zh:'治安风险区(深夜犯罪·路灯故障)', es:'zonas de riesgo de seguridad (delito nocturno · farolas averiadas)', de:'Sicherheitsrisikozonen (nächtliche Kriminalität · defekte Laternen)', fr:'zones à risque de sécurité (délinquance nocturne · lampadaires en panne)' },
    disaster: { ko:'재난·침수 구역(폭우 침수 상습 지역)', en:'disaster/flood zones (areas prone to heavy-rain flooding)', ja:'災害・浸水区域(豪雨浸水の常襲地域)', zh:'灾害·内涝区(暴雨易涝地区)', es:'zonas de desastre/inundación (áreas propensas a inundaciones por lluvia)', de:'Katastrophen-/Überschwemmungszonen (bei Starkregen häufig überflutet)', fr:'zones de catastrophe/inondation (souvent inondées lors de fortes pluies)' },
    infra:    { ko:'긴급 공사 구간(도보 통행 불가)', en:'emergency construction (no pedestrian access)', ja:'緊急工事区間(歩行者通行不可)', zh:'紧急施工路段(禁止步行通过)', es:'obras de emergencia (sin acceso peatonal)', de:'Notbaustelle (kein Fußgängerzugang)', fr:'travaux d\'urgence (accès piéton interdit)' }
  };
  const zones = [];
  if (state.zones.crime) zones.push(P(ZN.crime));
  if (state.zones.disaster) zones.push(P(ZN.disaster));
  if (state.zones.infra) zones.push(P(ZN.infra));
  const zoneTxt = zones.length ? zones.join(', ') : P({ ko:'현재 켜져 있는 위험 알림이 없어요', en:'no hazard alerts are currently on', ja:'現在オンになっている危険アラートはありません', zh:'当前没有开启的危险提醒', es:'no hay alertas de peligro activas', de:'derzeit sind keine Gefahrenwarnungen aktiv', fr:'aucune alerte de danger active pour le moment' });

  /* 인사·잡담 */
  if (/안녕|하이|헬로|반가|hello|hi\b|こんにち|やあ|你好|哈囉|嗨/i.test(q)){
    return P({ ko:`안녕하세요! 😊 GUARDIMATE AI 비서예요. 오늘도 안전한 하루 보내고 계신가요? 경로 안내, 주변 위험 확인, 가벼운 수다도 좋아요.`,
      en:`Hi! 😊 I'm the GUARDIMATE AI assistant. Staying safe today? I can help with routes, nearby risks, or just chat.`,
      ja:`こんにちは!😊 GUARDIMATE AIアシスタントです。今日も安全にお過ごしですか?経路案内や周辺の危険確認、雑談もどうぞ。`,
      zh:`您好!😊 我是GUARDIMATE AI助手。今天也平安吗?路线指引、周边危险确认,或随便聊聊都可以。`,
      es:`¡Hola! 😊 Soy el asistente de IA de GUARDIMATE. ¿Todo seguro hoy? Puedo ayudarte con rutas, riesgos cercanos o simplemente charlar.`,
      de:`Hallo! 😊 Ich bin der GUARDIMATE-KI-Assistent. Heute alles sicher? Ich helfe bei Routen, Gefahren in der Nähe oder plaudere einfach.`,
      fr:`Bonjour ! 😊 Je suis l'assistant IA de GUARDIMATE. Tout va bien aujourd'hui ? Je peux aider avec les itinéraires, les risques à proximité, ou simplement discuter.` });
  }
  if (/고마|감사|thank|ありがと|谢谢|感謝/i.test(q)){
    return P({ ko:`천만에요! 도움이 됐다니 기뻐요. 이동 중 궁금한 게 생기면 언제든 다시 불러주세요. 🙌`,
      en:`You're welcome! Glad I could help. Call me anytime while you're on the move. 🙌`,
      ja:`どういたしまして!お役に立てて嬉しいです。移動中に気になることがあればいつでも呼んでください。🙌`,
      zh:`不客气!很高兴能帮到您。出行途中有任何问题随时叫我。🙌`,
      es:`¡De nada! Me alegra haber ayudado. Llámame cuando quieras mientras te desplazas. 🙌`,
      de:`Gern geschehen! Freut mich, dass ich helfen konnte. Ruf mich unterwegs jederzeit. 🙌`,
      fr:`De rien ! Ravi d'avoir aidé. Appelle-moi à tout moment pendant tes déplacements. 🙌` });
  }
  if (/누구|이름|뭐야|정체|who are you|your name|誰|名前|你是谁|你叫/i.test(q)){
    return P({ ko:`저는 GUARDIMATE의 AI Core Chat이에요. 해외 체류 사용자님의 안전을 돕는 개인 비서로, 안전 경로 안내·위험 정보 확인·응급 대처를 담당해요.`,
      en:`I'm GUARDIMATE's AI Core Chat — your personal safety assistant abroad, handling safe-route guidance, hazard info, and emergency help.`,
      ja:`私はGUARDIMATEのAI Core Chatです。海外滞在中のあなたの安全を支える個人アシスタントで、安全経路案内・危険情報・緊急対応を担当します。`,
      zh:`我是GUARDIMATE的AI Core Chat——为您在海外提供安全的私人助手,负责安全路线指引、危险信息与应急处理。`,
      es:`Soy el AI Core Chat de GUARDIMATE, tu asistente personal de seguridad en el extranjero: rutas seguras, información de peligros y ayuda de emergencia.`,
      de:`Ich bin GUARDIMATEs AI Core Chat — dein persönlicher Sicherheitsassistent im Ausland für sichere Routen, Gefahreninfos und Notfallhilfe.`,
      fr:`Je suis l'AI Core Chat de GUARDIMATE, ton assistant de sécurité personnel à l'étranger : itinéraires sûrs, infos sur les dangers et aide d'urgence.` });
  }
  if (/심심|뭐해|기분|잘 지내|피곤|bored|how are you|暇|退屈|无聊|你好吗/i.test(q)){
    return P({ ko:`저는 항상 사용자님 곁에서 대기 중이에요! 😄 심심할 때 말 걸어주셔도 좋고, 이동하실 일이 있으면 안전 경로도 바로 확인해 드릴게요.`,
      en:`I'm always on standby by your side! 😄 Chat with me anytime, and whenever you head out I'll check the safe route for you.`,
      ja:`いつもあなたのそばで待機しています!😄 退屈なときは話しかけてください。お出かけの際は安全経路もすぐ確認します。`,
      zh:`我一直在您身边待命!😄 无聊时可以找我聊,要出行时我马上帮您确认安全路线。`,
      es:`¡Siempre estoy a tu lado, listo! 😄 Háblame cuando te aburras, y cuando salgas te reviso la ruta segura al instante.`,
      de:`Ich bin immer an deiner Seite in Bereitschaft! 😄 Sprich mich bei Langeweile an, und wenn du losgehst, prüfe ich sofort die sichere Route.`,
      fr:`Je suis toujours à tes côtés, prêt ! 😄 Parle-moi quand tu t'ennuies, et dès que tu sors je vérifie l'itinéraire sûr pour toi.` });
  }

  if (/경로|길|가는|route|어떻게 가|どう行|経路|路线|怎么走|怎麼走/i.test(q)){
    return state.safePath
      ? P({ ko:`현재 ${state.destName}까지 안전 경로가 활성화되어 있어요. 거리 ${safe.km}, 도보 약 ${safe.min} 예상입니다. ${state.routes.safe?.blocked ? '이 구간은 완전 회피가 불가능해 위험 교차가 가장 적은 경로로 안내 중이에요.' : '후보 경로들을 위험 구역과 대조해 교차 없이 통과하는 최단 경로를 선택했어요.'} 지도의 파란 선을 따라가세요.`,
          en:`A safe route to ${state.destName} is active. Distance ${safe.km}, about ${safe.min} on foot. ${state.routes.safe?.blocked ? 'Full avoidance isn\'t possible here, so I\'m guiding the route with the least hazard overlap.' : 'I checked candidate routes against hazard zones and picked the shortest one that passes through none.'} Follow the blue line on the map.`,
          ja:`${state.destName}までの安全経路が有効です。距離${safe.km}、徒歩約${safe.min}。${state.routes.safe?.blocked ? 'この区間は完全回避が不可能なため、危険との交差が最も少ない経路を案内中です。' : '候補経路を危険区域と照合し、交差ゼロで通れる最短経路を選びました。'} 地図の青い線に沿って進んでください。`,
          zh:`前往${state.destName}的安全路线已启用。距离${safe.km},步行约${safe.min}。${state.routes.safe?.blocked ? '此路段无法完全规避,正为您指引与危险重叠最少的路线。' : '我已将候选路线与危险区域比对,选出零交叉的最短路线。'} 请沿地图上的蓝线前进。`,
          es:`Hay una ruta segura a ${state.destName} activa. Distancia ${safe.km}, unos ${safe.min} a pie. ${state.routes.safe?.blocked ? 'Aquí no es posible evitarlo del todo, así que guío por la ruta con menor solape de peligro.' : 'Comparé las rutas candidatas con las zonas de peligro y elegí la más corta que no cruza ninguna.'} Sigue la línea azul del mapa.`,
          de:`Eine sichere Route nach ${state.destName} ist aktiv. Entfernung ${safe.km}, ca. ${safe.min} zu Fuß. ${state.routes.safe?.blocked ? 'Hier ist keine vollständige Umgehung möglich, daher führe ich über die Route mit der geringsten Gefahrenüberlappung.' : 'Ich habe die Kandidatenrouten mit den Gefahrenzonen abgeglichen und die kürzeste ohne Kreuzung gewählt.'} Folge der blauen Linie auf der Karte.`,
          fr:`Un itinéraire sûr vers ${state.destName} est actif. Distance ${safe.km}, environ ${safe.min} à pied. ${state.routes.safe?.blocked ? 'Ici, un évitement total est impossible, je guide donc par l\'itinéraire au plus faible chevauchement de danger.' : 'J\'ai comparé les itinéraires candidats aux zones de danger et choisi le plus court qui n\'en traverse aucune.'} Suis la ligne bleue sur la carte.` })
      : P({ ko:`지금은 Safe Path가 꺼져 있어 최단 경로(${short.km}, 약 ${short.min}) 기준이에요. 이 경로는 위험 회피 검증을 하지 않으니, Safe Map 탭에서 토글을 켜 안전 경로(${safe.km}, 약 ${safe.min})로 전환을 추천해요.`,
          en:`Safe Path is off, so this is the shortest route (${short.km}, ~${short.min}). It isn't hazard-checked — I recommend turning on the toggle in the Safe Map tab to switch to the safe route (${safe.km}, ~${safe.min}).`,
          ja:`今はSafe Pathがオフで、最短経路(${short.km}、約${short.min})基準です。危険回避の検証をしないため、Safe Mapタブでトグルをオンにして安全経路(${safe.km}、約${safe.min})への切替をおすすめします。`,
          zh:`当前Safe Path已关闭,按最短路线(${short.km},约${short.min})显示。该路线未做危险规避校验,建议在Safe Map页开启开关切换到安全路线(${safe.km},约${safe.min})。`,
          es:`Safe Path está desactivado, así que esta es la ruta más corta (${short.km}, ~${short.min}). No verifica peligros; te recomiendo activar el interruptor en la pestaña Safe Map para cambiar a la ruta segura (${safe.km}, ~${safe.min}).`,
          de:`Safe Path ist aus, daher ist dies die kürzeste Route (${short.km}, ~${short.min}). Sie ist nicht gefahrengeprüft — ich empfehle, den Schalter im Tab Safe Map zu aktivieren und zur sicheren Route (${safe.km}, ~${safe.min}) zu wechseln.`,
          fr:`Safe Path est désactivé, voici donc l'itinéraire le plus court (${short.km}, ~${short.min}). Il n'est pas vérifié pour les dangers ; je te conseille d'activer l'interrupteur dans l'onglet Safe Map pour passer à l'itinéraire sûr (${safe.km}, ~${safe.min}).` });
  }
  if (/위험|주변|근처|조심|hazard|danger|around|nearby|危険|周辺|周边|附近/i.test(q)){
    return P({ ko:`현재 지도에 표시된 위험 요소예요: ${zoneTxt}. ${state.safePath ? '안전 경로가 이 구역들을 우회하도록 설정돼 있으니 파란 선을 벗어나지 않는 게 좋아요.' : 'Safe Path를 켜면 이 구역들을 우회하는 경로를 안내해 드려요.'}`,
      en:`Here are the hazards shown on the map: ${zoneTxt}. ${state.safePath ? 'The safe route is set to avoid these zones, so try to stay on the blue line.' : 'Turn on Safe Path and I\'ll route you around these zones.'}`,
      ja:`地図に表示中の危険要素です:${zoneTxt}。${state.safePath ? '安全経路がこれらの区域を迂回するよう設定されているので、青い線から外れないのがおすすめです。' : 'Safe Pathをオンにすると、これらの区域を迂回する経路を案内します。'}`,
      zh:`地图上显示的危险要素:${zoneTxt}。${state.safePath ? '安全路线已设置为绕开这些区域,建议不要偏离蓝线。' : '开启Safe Path后,我会为您规划绕开这些区域的路线。'}`,
      es:`Estos son los peligros que muestra el mapa: ${zoneTxt}. ${state.safePath ? 'La ruta segura está configurada para evitar estas zonas, así que intenta no salir de la línea azul.' : 'Activa Safe Path y te llevaré rodeando estas zonas.'}`,
      de:`Das sind die auf der Karte angezeigten Gefahren: ${zoneTxt}. ${state.safePath ? 'Die sichere Route umgeht diese Zonen, bleib also möglichst auf der blauen Linie.' : 'Aktiviere Safe Path, dann leite ich dich um diese Zonen herum.'}`,
      fr:`Voici les dangers affichés sur la carte : ${zoneTxt}. ${state.safePath ? 'L\'itinéraire sûr est réglé pour éviter ces zones, essaie donc de rester sur la ligne bleue.' : 'Active Safe Path et je te ferai contourner ces zones.'}` });
  }
  if (/밤|심야|늦게|귀가|혼자|night|alone|夜|帰宅|深夜|回家|独自/i.test(q)){
    return P({ ko:`심야 귀가 수칙이에요. 1) Safe Path를 켜 우범·침수 구역을 우회하세요. 2) 밝고 사람 많은 큰길로 이동하세요. 3) 이어폰은 한쪽만 사용하세요. 4) 보호자에게 출발·도착을 공유하세요. 5) 위급 시 Emergency 탭의 SOS를 누르면 5초 후 위치와 함께 알림이 전송돼요.`,
      en:`Late-night tips: 1) Turn on Safe Path to avoid crime/flood zones. 2) Stick to bright, busy main streets. 3) Use only one earbud. 4) Share your departure/arrival with a guardian. 5) In an emergency, tap SOS in the Emergency tab — after 5s it sends an alert with your location.`,
      ja:`深夜帰宅の心得です。1) Safe Pathをオンにして犯罪・浸水区域を迂回。2) 明るく人通りの多い大通りを移動。3) イヤホンは片耳だけ。4) 保護者に出発・到着を共有。5) 危険時はEmergencyタブのSOSを押すと5秒後に位置とともに通知が送信されます。`,
      zh:`深夜回家须知:1) 开启Safe Path绕开犯罪/内涝区。2) 走明亮、人多的大路。3) 只戴一只耳机。4) 向监护人共享出发/到达。5) 遇险时点Emergency页的SOS,5秒后连同位置发送警报。`,
      es:`Consejos para volver de noche: 1) Activa Safe Path para evitar zonas de delito/inundación. 2) Ve por calles principales, iluminadas y concurridas. 3) Usa solo un auricular. 4) Comparte tu salida/llegada con un tutor. 5) En una emergencia, pulsa SOS en la pestaña Emergency: tras 5 s envía una alerta con tu ubicación.`,
      de:`Tipps für nachts: 1) Aktiviere Safe Path, um Kriminalitäts-/Überschwemmungszonen zu meiden. 2) Bleib auf hellen, belebten Hauptstraßen. 3) Nutze nur einen Ohrhörer. 4) Teile Abfahrt/Ankunft mit einem Betreuer. 5) Tippe im Notfall auf SOS im Emergency-Tab — nach 5 s wird eine Warnung mit deinem Standort gesendet.`,
      fr:`Conseils pour rentrer la nuit : 1) Active Safe Path pour éviter les zones de délinquance/inondation. 2) Reste sur les grandes rues éclairées et fréquentées. 3) N'utilise qu'un seul écouteur. 4) Partage ton départ/arrivée avec un tuteur. 5) En cas d'urgence, appuie sur SOS dans l'onglet Emergency — après 5 s, une alerte avec ta position est envoyée.` });
  }
  if (/타이머|체크인|늦으면|timer|check-?in|タイマー|チェックイン|计时|签到/i.test(q)){
    return P({ ko:`안전 타이머는 Emergency 탭에서 15/30/60분으로 설정할 수 있어요. 시간 내 '무사 도착'을 누르지 않으면 보호자에게 마지막 위치와 함께 미응답 알림이 자동 전송돼요. 출발 전 켜두는 걸 추천해요!`,
      en:`You can set the safety timer to 15/30/60 min in the Emergency tab. If you don't tap 'Arrived safely' in time, a no-response alert with your last location goes to your guardian automatically. Turn it on before you leave!`,
      ja:`安全タイマーはEmergencyタブで15/30/60分に設定できます。時間内に「無事到着」を押さないと、最後の位置とともに未応答通知が保護者へ自動送信されます。出発前にオンにするのがおすすめです!`,
      zh:`可在Emergency页把安全计时器设为15/30/60分钟。若未在时间内点'平安到达',系统会自动向监护人发送含最后位置的未响应提醒。建议出发前开启!`,
      es:`Puedes fijar el temporizador de seguridad a 15/30/60 min en la pestaña Emergency. Si no pulsas 'Llegué bien' a tiempo, se envía automáticamente a tu tutor una alerta de no respuesta con tu última ubicación. ¡Actívalo antes de salir!`,
      de:`Du kannst den Sicherheits-Timer im Emergency-Tab auf 15/30/60 Min. stellen. Wenn du nicht rechtzeitig 'Sicher angekommen' tippst, geht automatisch eine Nichtantwort-Warnung mit deinem letzten Standort an deinen Betreuer. Aktiviere ihn vor dem Losgehen!`,
      fr:`Tu peux régler le minuteur de sécurité sur 15/30/60 min dans l'onglet Emergency. Si tu n'appuies pas sur « Bien arrivé(e) » à temps, une alerte de non-réponse avec ta dernière position est envoyée automatiquement à ton tuteur. Active-le avant de partir !` });
  }
  if (/제보|커뮤니티|report|community|提報|上报|社区/i.test(q)){
    return P({ ko:`지도를 길게 누르면 그 위치의 위험(가로등 고장, 공사·통제, 침수, 치안 불안)을 제보할 수 있어요. 제보 구역은 보라색으로 표시되고 즉시 안전 경로 회피에 반영돼요. 현재 활성 제보는 ${state.reports.length}건이에요.`,
      en:`Long-press the map to report a hazard there (broken streetlight, construction, flooding, safety concern). Reported zones show in purple and instantly factor into safe-route avoidance. Active reports right now: ${state.reports.length}.`,
      ja:`地図を長押しすると、その場所の危険(街灯故障・工事規制・浸水・治安不安)を提報できます。提報区域は紫で表示され、即座に安全経路の回避に反映されます。現在の有効な提報は${state.reports.length}件です。`,
      zh:`长按地图即可上报该位置的危险(路灯故障、施工管制、内涝、治安不安)。上报区域以紫色显示,并立即计入安全路线规避。当前有效上报${state.reports.length}条。`,
      es:`Mantén pulsado el mapa para reportar un peligro ahí (farola averiada, obras, inundación, inseguridad). Las zonas reportadas aparecen en morado y se incorporan al instante a la evitación de rutas. Reportes activos ahora: ${state.reports.length}.`,
      de:`Drücke lang auf die Karte, um dort eine Gefahr zu melden (defekte Laterne, Baustelle, Überschwemmung, Unsicherheit). Gemeldete Zonen erscheinen violett und fließen sofort in die Routenvermeidung ein. Aktive Meldungen: ${state.reports.length}.`,
      fr:`Appui long sur la carte pour y signaler un danger (lampadaire en panne, travaux, inondation, insécurité). Les zones signalées apparaissent en violet et sont aussitôt prises en compte dans l'évitement d'itinéraire. Signalements actifs : ${state.reports.length}.` });
  }
  if (/응급|SOS|사고|신고|경찰|다쳤|emergency|police|accident|緊急|事故|警察|紧急|报警/i.test(q)){
    return P({ ko:`위급 상황에서는 Emergency 탭의 SOS 버튼을 눌러주세요. 5초 후 지정 보호자에게 현재 위치와 긴급 알림이 자동 전송돼요. 즉시 신고가 필요하면 현지 긴급번호(호주 000·미국 911), 대한민국 영사콜센터 +82-2-3210-0404로 연락하세요.`,
      en:`In an emergency, tap the SOS button in the Emergency tab. After 5s it auto-sends your location and an alert to your guardian. If you need to report immediately, call the local emergency number (Australia 000 · US 911) or the Korea Consular Call Center +82-2-3210-0404.`,
      ja:`緊急時はEmergencyタブのSOSボタンを押してください。5秒後に指定保護者へ現在地と緊急通知が自動送信されます。すぐ通報が必要なら現地緊急番号(豪州000・米国911)、韓国領事コールセンター+82-2-3210-0404へ。`,
      zh:`遇险时请点Emergency页的SOS按钮。5秒后会自动向指定监护人发送当前位置与紧急警报。如需立即报警,可拨打当地紧急号码(澳大利亚000·美国911)或韩国领事呼叫中心+82-2-3210-0404。`,
      es:`En una emergencia, pulsa el botón SOS en la pestaña Emergency. Tras 5 s envía automáticamente tu ubicación y una alerta a tu tutor. Si necesitas avisar de inmediato, llama al número de emergencias local (Australia 000 · EE. UU. 911) o al Centro consular de Corea +82-2-3210-0404.`,
      de:`Tippe im Notfall auf die SOS-Taste im Emergency-Tab. Nach 5 s werden automatisch dein Standort und eine Warnung an deinen Betreuer gesendet. Wenn du sofort melden musst, ruf die lokale Notrufnummer (Australien 000 · USA 911) oder das koreanische Konsular-Callcenter +82-2-3210-0404 an.`,
      fr:`En cas d'urgence, appuie sur le bouton SOS dans l'onglet Emergency. Après 5 s, ta position et une alerte sont envoyées automatiquement à ton tuteur. Si tu dois alerter immédiatement, appelle le numéro d'urgence local (Australie 000 · É.-U. 911) ou le Centre consulaire de Corée +82-2-3210-0404.` });
  }
  if (/병원|약국|의료|아프|hospital|pharmacy|medical|sick|病院|薬局|医療|医院|药店|生病/i.test(q)){
    return P({ ko:`현재 위치 기준 24시간 약국·응급실 정보는 생활 정보 기능에서 제공될 예정이에요. 응급 진료가 필요하면 Emergency 탭에서 현지 긴급번호로 바로 연결하는 걸 권장해요.`,
      en:`24-hour pharmacy and ER info near you is coming in the living-info feature. If you need emergency care, I recommend calling the local emergency number from the Emergency tab.`,
      ja:`現在地の24時間薬局・救急情報は生活情報機能で提供予定です。救急受診が必要な場合はEmergencyタブから現地の緊急番号に直接つなぐことをおすすめします。`,
      zh:`基于当前位置的24小时药店与急诊信息将在生活信息功能中提供。如需急诊,建议在Emergency页直接拨打当地紧急号码。`,
      es:`La información de farmacias 24 h y urgencias cerca de ti llegará en la función de información práctica. Si necesitas atención de urgencia, te recomiendo llamar al número de emergencias local desde la pestaña Emergency.`,
      de:`Infos zu 24-Stunden-Apotheken und Notaufnahmen in deiner Nähe kommen in der Alltagsinfo-Funktion. Bei akutem Behandlungsbedarf empfehle ich, die lokale Notrufnummer im Emergency-Tab anzurufen.`,
      fr:`Les infos sur les pharmacies 24 h et les urgences près de toi arriveront dans la fonction d'infos pratiques. En cas de besoin urgent de soins, je te conseille d'appeler le numéro d'urgence local depuis l'onglet Emergency.` });
  }
  return P({ ko:`무엇을 도와드릴까요? 참고 정보예요 — 목적지: ${state.destName}, 안전 경로 ${safe.km}(약 ${safe.min}), 활성 위험: ${zoneTxt}. "가장 안전한 경로", "주변 위험", "심야 귀가 수칙", "응급 대처" 등을 물어보세요.`,
    en:`How can I help? For reference — destination: ${state.destName}, safe route ${safe.km} (~${safe.min}), active hazards: ${zoneTxt}. Try "safest route", "nearby risks", "late-night tips", or "emergency steps".`,
    ja:`何をお手伝いしましょう?参考情報 — 目的地:${state.destName}、安全経路 ${safe.km}(約${safe.min})、有効な危険:${zoneTxt}。「最も安全な経路」「周辺の危険」「深夜帰宅の心得」「緊急対応」などを聞いてください。`,
    zh:`需要什么帮助?参考信息 — 目的地:${state.destName},安全路线 ${safe.km}(约${safe.min}),当前危险:${zoneTxt}。可以问"最安全的路线""周边危险""深夜回家须知""应急处理"等。`,
    es:`¿En qué te ayudo? Para referencia — destino: ${state.destName}, ruta segura ${safe.km} (~${safe.min}), peligros activos: ${zoneTxt}. Prueba "ruta más segura", "riesgos cercanos", "consejos nocturnos" o "pasos de emergencia".`,
    de:`Wie kann ich helfen? Zur Info — Ziel: ${state.destName}, sichere Route ${safe.km} (~${safe.min}), aktive Gefahren: ${zoneTxt}. Frag z. B. „sicherste Route", „Gefahren in der Nähe", „Tipps für nachts" oder „Notfall-Schritte".`,
    fr:`Comment puis-je aider ? Pour info — destination : ${state.destName}, itinéraire sûr ${safe.km} (~${safe.min}), dangers actifs : ${zoneTxt}. Essaie « itinéraire le plus sûr », « risques à proximité », « conseils nocturnes » ou « gestes d'urgence ».` });
}

/* --- ① 실제 Gemini API 호출 --- */
async function callGemini(){
  if (!state.apiKey) throw new Error('no api key');
  /* Gemini 형식으로 변환: role은 'user'/'model', 본문은 parts 배열 */
  const contents = state.chatHistory.slice(-12).map(m=>({  // 최근 12개 대화만 전달(컨텍스트 절약)
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const body = JSON.stringify({
    systemInstruction: { parts:[{ text: buildContext() }] },  // 실시간 앱 상태 주입
    contents,
    generationConfig: {
      maxOutputTokens: 1000,
      thinkingConfig: { thinkingBudget: 0 }  // 사고 과정 생략 -> 응답 속도 대폭 향상
    }
  });
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-goog-api-key': state.apiKey
    }, body
  });
  if (res.ok){
    const data = await res.json();
    const txt = (data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
    if (txt){ setConnStatus('key'); return txt; }
  }
  throw new Error('gemini unavailable');
}

async function sendChat(text){
  if (!text.trim()) return;
  addMsg(text, 'user');
  state.chatHistory.push({role:'user', content:text});
  chatInput.value = '';
  chatSend.disabled = true;
  const typing = addMsg('', 'ai');   // '입력 중' 말풍선
  typing.classList.add('typing');
  let reply;
  try{
    reply = await callGemini();      // ① 실제 AI
  }catch(err){
    /* ② 오프라인 어시스턴트로 자동 전환 */
    reply = localAssistant(text);
    if (state.aiMode !== 'offline'){
      setConnStatus('offline');
      toast('🔌 AI 서버 연결 불가 · 내장 어시스턴트로 전환됨');
    }
  }
  typing.classList.remove('typing');
  typing.textContent = reply;
  state.chatHistory.push({role:'assistant', content:reply});
  chatSend.disabled = false;
  chatLog.scrollTop = chatLog.scrollHeight;
}
chatSend.addEventListener('click', ()=>sendChat(chatInput.value));
chatInput.addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(chatInput.value); });

/* 빠른 질문 버튼 : 현재 표시 언어로 질문을 보낸다 (원문 data-q는 한국어) */
const QUICK_Q = {
  "여기서 가장 안전한 경로가 어디야?": { en:"What's the safest route from here?", ja:"ここから一番安全な経路はどこ?", zh:"从这里出发最安全的路线是哪条?", es:"¿Cuál es la ruta más segura desde aquí?", de:"Was ist die sicherste Route von hier?", fr:"Quel est l'itinéraire le plus sûr d'ici ?" },
  "지금 내 주변에 어떤 위험이 있어?": { en:"What hazards are around me right now?", ja:"今、私の周りにはどんな危険がありますか?", zh:"现在我周边有哪些危险?", es:"¿Qué peligros hay a mi alrededor ahora?", de:"Welche Gefahren gibt es gerade um mich herum?", fr:"Quels dangers y a-t-il autour de moi en ce moment ?" },
  "밤 늦게 혼자 귀가할 때 안전 수칙 알려줘": { en:"Give me safety tips for walking home alone late at night.", ja:"夜遅く一人で帰宅するときの安全の心得を教えて。", zh:"请告诉我深夜独自回家的安全须知。", es:"Dame consejos de seguridad para volver a casa solo de noche.", de:"Gib mir Sicherheitstipps, um nachts allein nach Hause zu gehen.", fr:"Donne-moi des conseils de sécurité pour rentrer seul(e) tard le soir." },
  "응급 상황이 생기면 어떻게 해야 해?": { en:"What should I do if there's an emergency?", ja:"緊急事態が起きたらどうすればいい?", zh:"发生紧急情况时该怎么办?", es:"¿Qué debo hacer si hay una emergencia?", de:"Was soll ich bei einem Notfall tun?", fr:"Que dois-je faire en cas d'urgence ?" }
};
document.querySelectorAll('.quick-row button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const ko = b.dataset.q;
    const lang = window.gmLang ? window.gmLang() : 'ko';
    const q = (lang !== 'ko' && QUICK_Q[ko] && QUICK_Q[ko][lang]) ? QUICK_Q[ko][lang] : ko;
    sendChat(q);
  });
});
