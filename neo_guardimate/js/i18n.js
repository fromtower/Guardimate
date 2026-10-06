/* GUARDIMATE (neo) · js/i18n.js — 앱 표시 언어 전환
   지원: 한국어(ko) · English(en) · 日本語(ja) · 中文(zh) · Español(es) · Deutsch(de) · Français(fr)
   ================================================================
   · 정적 UI 문구 : DOM 텍스트 노드를 순회하며 한국어 원문 → 선택 언어로 치환(I18N).
   · 토스트 문구  : core.js의 toast()가 window.gmTr()로 번역(TOASTS).
   · 동적 문구    : chat/scenario/escort가 window.gmPick()으로 현재 언어를 직접 선택.
   각 노드의 원문(한국어)을 __gmko에 보관해 '한국어'로 되돌릴 때 복원한다.
   ================================================================ */
(function(){
  var I18N = {
    /* --- 하단 탭 (en은 원문 영어로 폴백) --- */
    "Safe Map":     { ja:"セーフマップ", zh:"安全地图", es:"Mapa seguro", de:"Sichere Karte", fr:"Carte sûre" },
    "AI Core Chat": { ja:"AIチャット", zh:"AI核心聊天", es:"Chat con IA", de:"KI-Chat", fr:"Chat IA" },
    "Emergency":    { ja:"緊急", zh:"紧急", es:"Emergencia", de:"Notfall", fr:"Urgence" },
    "Settings":     { ja:"設定", zh:"设置", es:"Ajustes", de:"Einstellungen", fr:"Réglages" },

    /* --- Safe Map --- */
    "🖐 탭: 목적지 변경 · 🚩: 위험 제보": { en:"🖐 Tap: set destination · 🚩: report hazard", ja:"🖐 タップ:目的地変更 · 🚩:危険提報", zh:"🖐 点击:更改目的地 · 🚩:上报危险", es:"🖐 Toca: fijar destino · 🚩: reportar peligro", de:"🖐 Tippen: Ziel setzen · 🚩: Gefahr melden", fr:"🖐 Toucher : définir la destination · 🚩 : signaler un danger" },
    "👮 경찰서 · 🚒 소방서 · 🏥 병원 (경로 2km)": { en:"👮 Police · 🚒 Fire · 🏥 Hospital (2 km of route)", ja:"👮 警察 · 🚒 消防 · 🏥 病院(経路2km)", zh:"👮 警察 · 🚒 消防 · 🏥 医院(路线2km)", es:"👮 Policía · 🚒 Bomberos · 🏥 Hospital (2 km de la ruta)", de:"👮 Polizei · 🚒 Feuerwehr · 🏥 Krankenhaus (2 km der Route)", fr:"👮 Police · 🚒 Pompiers · 🏥 Hôpital (2 km de l'itinéraire)" },
    "🚨 위험/통제 뉴스 (약 30km)": { en:"🚨 Hazard / closure news (~30 km)", ja:"🚨 危険・規制ニュース(約30km)", zh:"🚨 危险/管制新闻(约30km)", es:"🚨 Noticias de peligro / cierres (~30 km)", de:"🚨 Gefahren-/Sperrungsnews (~30 km)", fr:"🚨 Actus danger / fermetures (~30 km)" },
    "치안 위험":   { en:"Public safety", ja:"治安リスク", zh:"治安风险", es:"Seguridad", de:"Sicherheit", fr:"Sécurité" },
    "재난·침수":   { en:"Disaster · flood", ja:"災害・浸水", zh:"灾害·内涝", es:"Desastre · inund.", de:"Katastrophe · Flut", fr:"Catastrophe · crue" },
    "인프라 차단": { en:"Infrastructure", ja:"インフラ遮断", zh:"基础设施封闭", es:"Infraestructura", de:"Infrastruktur", fr:"Infrastructure" },
    "커뮤니티 제보": { en:"Community report", ja:"コミュニティ提報", zh:"社区上报", es:"Reporte comunitario", de:"Community-Meldung", fr:"Signalement communautaire" },
    "보호자 동행 시작": { en:"Start guardian escort", ja:"保護者同行を開始", zh:"开启监护人同行", es:"Iniciar acompañamiento", de:"Begleitung starten", fr:"Démarrer l'accompagnement" },
    "실시간 위치·경로 이탈을 보호자에게 공유": { en:"Shares live location & route deviations with your guardian", ja:"リアルタイム位置・経路逸脱を保護者に共有", zh:"向监护人共享实时位置与偏离路线", es:"Comparte tu ubicación en vivo y desvíos de ruta con tu tutor", de:"Teilt Live-Standort & Routenabweichungen mit deinem Betreuer", fr:"Partage la position en direct et les écarts d'itinéraire avec votre tuteur" },

    /* --- AI Core Chat --- */
    "● 온라인 · 지도 연동됨": { en:"● Online · Map linked", ja:"● オンライン · 地図連動", zh:"● 在线 · 已连动地图", es:"● En línea · Mapa vinculado", de:"● Online · Karte verbunden", fr:"● En ligne · Carte liée" },
    "안녕하세요! GUARDIMATE AI 안전 비서입니다. 🛡️ 현재 Safe Map과 연동되어 있어요. 경로, 주변 위험 정보, 응급 대처 요령 등 무엇이든 물어보세요.": {
      en:"Hi! I'm the GUARDIMATE AI safety assistant. 🛡️ I'm linked with Safe Map. Ask me anything — routes, nearby risks, emergency tips, and more.",
      ja:"こんにちは!GUARDIMATE AI安全アシスタントです。🛡️ Safe Mapと連動しています。経路、周辺の危険情報、緊急対応のコツなど何でもお尋ねください。",
      zh:"您好!我是GUARDIMATE AI安全助手。🛡️ 已与Safe Map连动。路线、周边危险信息、应急处理要领等尽管问我。",
      es:"¡Hola! Soy el asistente de seguridad con IA de GUARDIMATE. 🛡️ Estoy vinculado con Safe Map. Pregúntame lo que sea: rutas, riesgos cercanos, consejos de emergencia y más.",
      de:"Hallo! Ich bin der GUARDIMATE-KI-Sicherheitsassistent. 🛡️ Ich bin mit Safe Map verbunden. Frag mich alles — Routen, Gefahren in der Nähe, Notfalltipps und mehr.",
      fr:"Bonjour ! Je suis l'assistant de sécurité IA de GUARDIMATE. 🛡️ Je suis lié à Safe Map. Demande-moi tout : itinéraires, risques à proximité, conseils d'urgence, et plus." },
    "🗺️ 가장 안전한 경로는?": { en:"🗺️ Safest route?", ja:"🗺️ 最も安全な経路は?", zh:"🗺️ 最安全的路线?", es:"🗺️ ¿Ruta más segura?", de:"🗺️ Sicherste Route?", fr:"🗺️ Itinéraire le plus sûr ?" },
    "⚠️ 주변 위험 요약": { en:"⚠️ Nearby risks", ja:"⚠️ 周辺の危険まとめ", zh:"⚠️ 周边危险概要", es:"⚠️ Riesgos cercanos", de:"⚠️ Gefahren in der Nähe", fr:"⚠️ Risques à proximité" },
    "🌙 심야 귀가 수칙": { en:"🌙 Late-night tips", ja:"🌙 深夜帰宅の心得", zh:"🌙 深夜回家须知", es:"🌙 Consejos nocturnos", de:"🌙 Tipps für nachts", fr:"🌙 Conseils nocturnes" },
    "🚨 응급 대처 요령": { en:"🚨 Emergency steps", ja:"🚨 緊急対応のコツ", zh:"🚨 应急处理要领", es:"🚨 Pasos de emergencia", de:"🚨 Notfall-Schritte", fr:"🚨 Gestes d'urgence" },
    "메시지를 입력하세요...": { en:"Type a message...", ja:"メッセージを入力...", zh:"输入消息...", es:"Escribe un mensaje...", de:"Nachricht eingeben...", fr:"Écris un message..." },
    "목적지 검색...": { en:"Search destination...", ja:"目的地を検索...", zh:"搜索目的地...", es:"Buscar destino...", de:"Ziel suchen...", fr:"Rechercher une destination..." },
    "🚶 도보": { en:"🚶 Walking", ja:"🚶 徒歩", zh:"🚶 步行", es:"🚶 A pie", de:"🚶 Zu Fuß", fr:"🚶 À pied" },
    "🚗 운전": { en:"🚗 Driving", ja:"🚗 車", zh:"🚗 驾车", es:"🚗 En coche", de:"🚗 Auto", fr:"🚗 Voiture" },

    /* --- Emergency SOS --- */
    "원터치 응급 SOS": { en:"One-touch Emergency SOS", ja:"ワンタッチ緊急SOS", zh:"一键紧急SOS", es:"SOS de emergencia con un toque", de:"Ein-Tipp-Notruf-SOS", fr:"SOS d'urgence en un toucher" },
    "버튼을 누르면 5초 후 응급 연락처로": { en:"Press the button — after 5 seconds, your", ja:"ボタンを押すと5秒後に緊急連絡先へ", zh:"按下按钮5秒后向紧急联系人", es:"Pulsa el botón; tras 5 s, tu", de:"Taste drücken — nach 5 s gehen dein", fr:"Appuie ; après 5 s, ta" },
    "현재 위치와 긴급 알림이 전송됩니다": { en:"location & emergency alert go to your contacts", ja:"現在地と緊急アラートが送信されます", zh:"发送当前位置与紧急警报", es:"ubicación y alerta de emergencia van a tus contactos", de:"Standort & Notfallalarm an deine Kontakte", fr:"position et une alerte d'urgence vont à tes contacts" },
    "탭하여 활성화": { en:"Tap to activate", ja:"タップで起動", zh:"点击激活", es:"Toca para activar", de:"Zum Aktivieren tippen", fr:"Toucher pour activer" },
    "대기 중": { en:"Standby", ja:"待機中", zh:"待机中", es:"En espera", de:"Bereit", fr:"En attente" },
    "전송 취소": { en:"Cancel send", ja:"送信を取消", zh:"取消发送", es:"Cancelar envío", de:"Senden abbrechen", fr:"Annuler l'envoi" },
    "⏱ 안전 타이머 · 도착 체크인": { en:"⏱ Safety timer · Arrival check-in", ja:"⏱ 安全タイマー · 到着チェックイン", zh:"⏱ 安全计时器 · 到达签到", es:"⏱ Temporizador de seguridad · Registro de llegada", de:"⏱ Sicherheits-Timer · Ankunfts-Check-in", fr:"⏱ Minuteur de sécurité · Enregistrement d'arrivée" },
    "예상 이동 시간을 설정하세요. 시간 내에 '무사 도착'을 누르지 않으면 보호자에게 마지막 위치와 함께 미응답 알림이 자동 전송됩니다.": {
      en:"Set your expected travel time. If you don't tap 'Arrived safely' in time, a no-response alert with your last location is sent to your guardian automatically.",
      ja:"予想移動時間を設定してください。時間内に「無事到着」を押さないと、最後の位置とともに未応答通知が保護者へ自動送信されます。",
      zh:"请设置预计出行时间。若未在时间内点击'平安到达',系统将自动向监护人发送含最后位置的未响应提醒。",
      es:"Fija tu tiempo estimado de viaje. Si no pulsas 'Llegué bien' a tiempo, se envía automáticamente a tu tutor una alerta de no respuesta con tu última ubicación.",
      de:"Lege deine voraussichtliche Reisezeit fest. Wenn du nicht rechtzeitig 'Sicher angekommen' tippst, wird deinem Betreuer automatisch eine Nichtantwort-Warnung mit deinem letzten Standort gesendet.",
      fr:"Définis ta durée de trajet prévue. Si tu n'appuies pas sur « Bien arrivé(e) » à temps, une alerte de non-réponse avec ta dernière position est envoyée automatiquement à ton tuteur." },
    "15분": { en:"15 min", ja:"15分", zh:"15分钟", es:"15 min", de:"15 Min.", fr:"15 min" },
    "30분": { en:"30 min", ja:"30分", zh:"30分钟", es:"30 min", de:"30 Min.", fr:"30 min" },
    "60분": { en:"60 min", ja:"60分", zh:"60分钟", es:"60 min", de:"60 Min.", fr:"60 min" },
    "✅ 무사 도착": { en:"✅ Arrived safely", ja:"✅ 無事到着", zh:"✅ 平安到达", es:"✅ Llegué bien", de:"✅ Sicher angekommen", fr:"✅ Bien arrivé(e)" },
    "타이머 취소": { en:"Cancel timer", ja:"タイマー取消", zh:"取消计时器", es:"Cancelar temporizador", de:"Timer abbrechen", fr:"Annuler le minuteur" },
    "🚓 현지 긴급 연락처": { en:"🚓 Local emergency contacts", ja:"🚓 現地の緊急連絡先", zh:"🚓 当地紧急联系人", es:"🚓 Contactos de emergencia locales", de:"🚓 Lokale Notfallkontakte", fr:"🚓 Contacts d'urgence locaux" },
    "긴급 신고 (경찰·소방·구급)": { en:"Emergency (police · fire · medical)", ja:"緊急通報(警察・消防・救急)", zh:"紧急报警(警察·消防·急救)", es:"Emergencias (policía · bomberos · médica)", de:"Notruf (Polizei · Feuerwehr · Rettung)", fr:"Urgences (police · pompiers · secours)" },
    "현지 통합 긴급번호 (호주 000 · 미국 911)": { en:"Local unified emergency number (Australia 000 · US 911)", ja:"現地統合緊急番号(豪州000 · 米国911)", zh:"当地统一紧急号码(澳大利亚000 · 美国911)", es:"Número único de emergencias local (Australia 000 · EE. UU. 911)", de:"Lokale Notrufnummer (Australien 000 · USA 911)", fr:"Numéro d'urgence unique local (Australie 000 · É.-U. 911)" },
    "대한민국 영사콜센터": { en:"Korea Consular Call Center", ja:"韓国 領事コールセンター", zh:"韩国领事呼叫中心", es:"Centro de llamadas consular de Corea", de:"Konsularisches Callcenter Koreas", fr:"Centre d'appels consulaire de Corée" },
    "해외 사건·사고 24시간 접수": { en:"24h intake for overseas incidents", ja:"海外事件・事故を24時間受付", zh:"海外事件·事故24小时受理", es:"Atención 24 h para incidentes en el extranjero", de:"24-Std.-Annahme für Vorfälle im Ausland", fr:"Assistance 24 h pour incidents à l'étranger" },
    "지정 보호자": { en:"Designated guardian", ja:"指定保護者", zh:"指定监护人", es:"Tutor designado", de:"Bestimmter Betreuer", fr:"Tuteur désigné" },
    "Emergency Contact · SOS 자동 전송 대상": { en:"Emergency Contact · auto SOS recipient", ja:"緊急連絡先 · SOS自動送信対象", zh:"紧急联系人 · SOS自动发送对象", es:"Contacto de emergencia · receptor automático de SOS", de:"Notfallkontakt · automatischer SOS-Empfänger", fr:"Contact d'urgence · destinataire auto du SOS" },
    "발신": { en:"Call", ja:"発信", zh:"拨打", es:"Llamar", de:"Anrufen", fr:"Appeler" },

    /* --- Settings : 그룹 헤더 --- */
    "화면 · 테마": { en:"Display · Theme", ja:"表示 · テーマ", zh:"显示 · 主题", es:"Pantalla · Tema", de:"Anzeige · Thema", fr:"Affichage · Thème" },
    "위험 알림 설정": { en:"Hazard alerts", ja:"危険アラート設定", zh:"危险提醒设置", es:"Alertas de peligro", de:"Gefahrenwarnungen", fr:"Alertes de danger" },
    "지도 스타일": { en:"Map style", ja:"地図スタイル", zh:"地图样式", es:"Estilo de mapa", de:"Kartenstil", fr:"Style de carte" },
    "응급 연락처 관리": { en:"Emergency contacts", ja:"緊急連絡先の管理", zh:"紧急联系人管理", es:"Contactos de emergencia", de:"Notfallkontakte", fr:"Contacts d'urgence" },
    "AI 연결": { en:"AI connection", ja:"AI接続", zh:"AI连接", es:"Conexión de IA", de:"KI-Verbindung", fr:"Connexion IA" },
    "데이터 소스 공개": { en:"Data sources", ja:"データソース公開", zh:"数据来源公开", es:"Fuentes de datos", de:"Datenquellen", fr:"Sources de données" },

    /* --- Settings : 프로필/디스플레이 --- */
    "안녕하세요, 사용자님!": { en:"Hello!", ja:"こんにちは!", zh:"您好!", es:"¡Hola!", de:"Hallo!", fr:"Bonjour !" },
    "디스플레이 모드": { en:"Display mode", ja:"表示モード", zh:"显示模式", es:"Modo de pantalla", de:"Anzeigemodus", fr:"Mode d'affichage" },
    "Light(밝은 화면) · Dark(어두운 화면)": { en:"Light (bright screen) · Dark (dark screen)", ja:"ライト(明るい画面) · ダーク(暗い画面)", zh:"浅色(明亮界面) · 深色(暗色界面)", es:"Claro (pantalla clara) · Oscuro (pantalla oscura)", de:"Hell (helle Ansicht) · Dunkel (dunkle Ansicht)", fr:"Clair (écran clair) · Sombre (écran sombre)" },
    "Light": { ja:"ライト", zh:"浅色", es:"Claro", de:"Hell", fr:"Clair" },
    "Dark": { ja:"ダーク", zh:"深色", es:"Oscuro", de:"Dunkel", fr:"Sombre" },
    "시즌 테마": { en:"Seasonal theme", ja:"シーズンテーマ", zh:"季节主题", es:"Tema de temporada", de:"Saison-Thema", fr:"Thème saisonnier" },
    "기본 + 기념일 테마 (크리스마스엔 눈이 내리는 등 장식 · 안전=그린은 유지)": { en:"Default + holiday themes (snow on Christmas, etc. · safety stays green)", ja:"基本 + 記念日テーマ(クリスマスは雪など · 安全=グリーンは維持)", zh:"基本 + 节日主题(圣诞下雪等 · 安全=绿色保持)", es:"Predeterminado + temas festivos (nieve en Navidad, etc. · la seguridad sigue en verde)", de:"Standard + Feiertagsthemen (Schnee an Weihnachten usw. · Sicherheit bleibt grün)", fr:"Par défaut + thèmes de fête (neige à Noël, etc. · la sécurité reste en vert)" },
    "기본": { en:"Default", ja:"基本", zh:"基本", es:"Predet.", de:"Standard", fr:"Défaut" },
    /* --- 테마(7종) 라벨 --- */
    "테마": { en:"Theme", ja:"テーマ", zh:"主题", es:"Tema", de:"Thema", fr:"Thème" },
    "테마 선택": { en:"Select theme", ja:"テーマ選択", zh:"选择主题", es:"Seleccionar tema", de:"Thema wählen", fr:"Choisir le thème" },
    "색 · 밝기 · 장식 · 로고가 함께 바뀝니다 (안전=그린은 항상 유지)": { en:"Colors · brightness · decorations · logo all change together (safety stays green)", ja:"色・明るさ・装飾・ロゴが一緒に変わります(安全=グリーンは維持)", zh:"颜色·亮度·装饰·徽标一起改变(安全=绿色保持)", es:"Los colores · el brillo · la decoración · el logo cambian juntos (la seguridad sigue en verde)", de:"Farben · Helligkeit · Deko · Logo ändern sich gemeinsam (Sicherheit bleibt grün)", fr:"Couleurs · luminosité · décor · logo changent ensemble (la sécurité reste en vert)" },
    "봄": { en:"Spring", ja:"春", zh:"春季", es:"Primavera", de:"Frühling", fr:"Printemps" },
    "여름": { en:"Summer", ja:"夏", zh:"夏季", es:"Verano", de:"Sommer", fr:"Été" },
    "가을": { en:"Fall", ja:"秋", zh:"秋季", es:"Otoño", de:"Herbst", fr:"Automne" },
    "겨울": { en:"Winter", ja:"冬", zh:"冬季", es:"Invierno", de:"Winter", fr:"Hiver" },
    "할로윈": { en:"Halloween", ja:"ハロウィン", zh:"万圣节", es:"Halloween", de:"Halloween", fr:"Halloween" },
    "다크": { en:"Dark", ja:"ダーク", zh:"深色", es:"Oscuro", de:"Dunkel", fr:"Sombre" },
    "표준": { en:"Standard", ja:"標準", zh:"标准", es:"Estándar", de:"Standard", fr:"Standard" },
    "위성": { en:"Satellite", ja:"衛星", zh:"卫星", es:"Satélite", de:"Satellit", fr:"Satellite" },
    "지도 테마": { en:"Map theme", ja:"地図テーマ", zh:"地图主题", es:"Tema del mapa", de:"Kartenthema", fr:"Thème de la carte" },

    /* --- Settings : 위험 알림 --- */
    "치안 및 위험 동향": { en:"Public safety & risk", ja:"治安・危険動向", zh:"治安及危险动态", es:"Seguridad y riesgos", de:"Sicherheit & Risiken", fr:"Sécurité et risques" },
    "심야 우범 구역 · 주취자 대치 · 가로등 결함": { en:"Late-night crime areas · drunk confrontations · broken streetlights", ja:"深夜の犯罪多発地域 · 酔客との対峙 · 街灯不良", zh:"深夜高发区 · 醉酒对峙 · 路灯故障", es:"Zonas de delito nocturno · altercados con ebrios · farolas averiadas", de:"Nächtliche Kriminalitätszonen · Konfrontationen mit Betrunkenen · defekte Straßenlaternen", fr:"Zones de délinquance nocturne · altercations avec des personnes ivres · lampadaires en panne" },
    "실시간 재난 경보": { en:"Real-time disaster alerts", ja:"リアルタイム災害警報", zh:"实时灾害警报", es:"Alertas de desastre en tiempo real", de:"Echtzeit-Katastrophenwarnungen", fr:"Alertes catastrophe en temps réel" },
    "침수 위험 구역 · 태풍 · 산불 등 물리적 긴급 경보": { en:"Flood zones · typhoons · wildfires and other physical emergencies", ja:"浸水危険地域 · 台風 · 山火事などの緊急警報", zh:"内涝区 · 台风 · 山火等物理紧急警报", es:"Zonas de inundación · tifones · incendios y otras emergencias físicas", de:"Überschwemmungszonen · Taifune · Waldbrände und andere physische Notfälle", fr:"Zones d'inondation · typhons · incendies et autres urgences physiques" },
    "인프라 차단 정보": { en:"Infrastructure closures", ja:"インフラ遮断情報", zh:"基础设施封闭信息", es:"Cierres de infraestructura", de:"Infrastruktur-Sperrungen", fr:"Fermetures d'infrastructure" },
    "도로 파손 · 긴급 굴착 공사 · 교통 통제": { en:"Road damage · emergency excavation · traffic control", ja:"道路損傷 · 緊急掘削工事 · 交通規制", zh:"道路损坏 · 紧急开挖 · 交通管制", es:"Daños en la vía · excavación de emergencia · control de tráfico", de:"Straßenschäden · Notgrabungen · Verkehrssperren", fr:"Chaussée endommagée · fouilles d'urgence · contrôle de la circulation" },
    "커뮤니티 제보 구역": { en:"Community report zones", ja:"コミュニティ提報区域", zh:"社区上报区域", es:"Zonas reportadas por la comunidad", de:"Community-Meldezonen", fr:"Zones signalées par la communauté" },
    "사용자들이 직접 제보한 위험 · 지도를 길게 눌러 제보": { en:"Hazards reported by users · long-press the map to report", ja:"ユーザーが提報した危険 · 地図長押しで提報", zh:"用户上报的危险 · 长按地图上报", es:"Peligros reportados por usuarios · mantén pulsado el mapa para reportar", de:"Von Nutzern gemeldete Gefahren · Karte lang drücken zum Melden", fr:"Dangers signalés par les utilisateurs · appui long sur la carte pour signaler" },
    "심야 위험 가중": { en:"Late-night risk boost", ja:"深夜リスク加重", zh:"深夜风险加权", es:"Refuerzo de riesgo nocturno", de:"Nächtliche Risikoverstärkung", fr:"Renforcement du risque nocturne" },
    "야간(21~06시)에 치안 구역 반경 자동 확대 · 우회 강화": { en:"At night (21–06h) safety-zone radius auto-expands · stronger detours", ja:"夜間(21〜06時)は治安区域の半径を自動拡大 · 迂回を強化", zh:"夜间(21~06时)自动扩大治安区半径 · 强化绕行", es:"De noche (21–06 h) el radio de las zonas de seguridad se amplía automáticamente · desvíos reforzados", de:"Nachts (21–06 Uhr) vergrößert sich der Radius der Sicherheitszonen automatisch · verstärkte Umwege", fr:"La nuit (21 h–06 h), le rayon des zones de sécurité s'agrandit automatiquement · détours renforcés" },

    /* --- Settings : 연락처/AI --- */
    "지정 보호자 번호": { en:"Guardian number", ja:"指定保護者の番号", zh:"指定监护人号码", es:"Número del tutor", de:"Betreuer-Nummer", fr:"Numéro du tuteur" },
    "SOS 발생 시 위치·알림 자동 전송 대상": { en:"Auto-recipient of location & alerts on SOS", ja:"SOS時に位置・通知を自動送信する相手", zh:"SOS时自动接收位置与提醒", es:"Receptor automático de ubicación y alertas en un SOS", de:"Automatischer Empfänger von Standort & Warnungen bei SOS", fr:"Destinataire auto de la position et des alertes lors d'un SOS" },
    "저장": { en:"Save", ja:"保存", zh:"保存", es:"Guardar", de:"Speichern", fr:"Enregistrer" },
    "번호가 등록되지 않았습니다": { en:"No number registered", ja:"番号が未登録です", zh:"尚未登记号码", es:"No hay número registrado", de:"Keine Nummer registriert", fr:"Aucun numéro enregistré" },
    "영사콜센터 연동": { en:"Consular call center", ja:"領事コールセンター連携", zh:"领事呼叫中心联动", es:"Centro consular", de:"Konsular-Callcenter", fr:"Centre consulaire" },
    "해외 사건·사고 접수 시 안내 · +82-2-3210-0404": { en:"Guidance for overseas incidents · +82-2-3210-0404", ja:"海外事件・事故の受付案内 · +82-2-3210-0404", zh:"海外事件·事故受理指引 · +82-2-3210-0404", es:"Orientación para incidentes en el extranjero · +82-2-3210-0404", de:"Hilfe bei Vorfällen im Ausland · +82-2-3210-0404", fr:"Aide pour incidents à l'étranger · +82-2-3210-0404" },
    "🧪 타이머 테스트 모드": { en:"🧪 Timer test mode", ja:"🧪 タイマーテストモード", zh:"🧪 计时器测试模式", es:"🧪 Modo de prueba del temporizador", de:"🧪 Timer-Testmodus", fr:"🧪 Mode test du minuteur" },
    "안전 타이머를 15초로 단축 실행 · 텔레그램 알림 동작 확인용": { en:"Runs the safety timer in 15s · to verify Telegram alerts", ja:"安全タイマーを15秒に短縮 · Telegram通知の確認用", zh:"将安全计时器缩短为15秒 · 用于验证Telegram提醒", es:"Ejecuta el temporizador en 15 s · para verificar las alertas de Telegram", de:"Führt den Timer in 15 s aus · zum Prüfen der Telegram-Warnungen", fr:"Exécute le minuteur en 15 s · pour vérifier les alertes Telegram" },
    "AI Core Chat 연결 방식": { en:"AI Core Chat connection", ja:"AI Core Chatの接続方式", zh:"AI Core Chat连接方式", es:"Conexión de AI Core Chat", de:"AI-Core-Chat-Verbindung", fr:"Connexion AI Core Chat" },
    "기본 내장 Gemini API 키로 자동 연결됩니다. 다른 키를 쓰려면 아래에 입력하세요. 연결 실패 시 내장 오프라인 어시스턴트가 대신 답변합니다.": {
      en:"Auto-connects with the built-in Gemini API key. Enter another key below to use your own. If it fails, the built-in offline assistant replies instead.",
      ja:"内蔵のGemini APIキーで自動接続します。別のキーを使う場合は下に入力してください。接続に失敗した場合は内蔵オフラインアシスタントが応答します。",
      zh:"使用内置Gemini API密钥自动连接。如需使用其他密钥请在下方输入。连接失败时由内置离线助手代为回答。",
      es:"Se conecta automáticamente con la clave Gemini integrada. Introduce otra clave abajo para usar la tuya. Si falla, responde el asistente sin conexión integrado.",
      de:"Verbindet automatisch mit dem integrierten Gemini-API-Schlüssel. Gib unten einen anderen Schlüssel ein, um deinen eigenen zu nutzen. Bei Fehlschlag antwortet der integrierte Offline-Assistent.",
      fr:"Se connecte automatiquement avec la clé Gemini intégrée. Saisis une autre clé ci-dessous pour utiliser la tienne. En cas d'échec, l'assistant hors ligne intégré répond à la place." },
    "AIza... (Gemini API 키)": { en:"AIza... (Gemini API key)", ja:"AIza...(Gemini APIキー)", zh:"AIza...(Gemini API密钥)", es:"AIza... (clave de API de Gemini)", de:"AIza... (Gemini-API-Schlüssel)", fr:"AIza... (clé API Gemini)" },
    "연결 상태: 첫 메시지 전송 시 자동 판별": { en:"Status: detected on first message", ja:"接続状態:最初のメッセージ送信時に自動判別", zh:"连接状态:首次发送消息时自动判定", es:"Estado: se detecta al enviar el primer mensaje", de:"Status: wird bei der ersten Nachricht erkannt", fr:"État : détecté au premier message" },

    /* --- Settings : 데이터 소스 --- */
    "본 서비스는 아래 출처의 데이터를 투명하게 활용합니다": { en:"This service transparently uses data from the sources below", ja:"本サービスは以下の出典データを透明に活用します", zh:"本服务透明地使用以下来源的数据", es:"Este servicio usa de forma transparente datos de las siguientes fuentes", de:"Dieser Dienst nutzt transparent Daten aus den folgenden Quellen", fr:"Ce service utilise de façon transparente les données des sources ci-dessous" },
    "🗺 OpenStreetMap (지도·도로망)": { en:"🗺 OpenStreetMap (maps · roads)", ja:"🗺 OpenStreetMap(地図・道路網)", zh:"🗺 OpenStreetMap(地图·路网)", es:"🗺 OpenStreetMap (mapas · vías)", de:"🗺 OpenStreetMap (Karten · Straßen)", fr:"🗺 OpenStreetMap (cartes · voirie)" },
    "🧭 OSRM (도보 경로)": { en:"🧭 OSRM (walking routes)", ja:"🧭 OSRM(徒歩経路)", zh:"🧭 OSRM(步行路线)", es:"🧭 OSRM (rutas a pie)", de:"🧭 OSRM (Fußwege)", fr:"🧭 OSRM (itinéraires piétons)" },
    "🏢 Overpass API (경찰서·소방서·병원, 도로 그래프)": { en:"🏢 Overpass API (police · fire · hospital, road graph)", ja:"🏢 Overpass API(警察・消防・病院、道路グラフ)", zh:"🏢 Overpass API(警察·消防·医院、路网图)", es:"🏢 Overpass API (policía · bomberos · hospital, grafo vial)", de:"🏢 Overpass API (Polizei · Feuerwehr · Krankenhaus, Straßengraph)", fr:"🏢 Overpass API (police · pompiers · hôpital, graphe routier)" },
    "📍 Nominatim (역지오코딩)": { en:"📍 Nominatim (reverse geocoding)", ja:"📍 Nominatim(逆ジオコーディング)", zh:"📍 Nominatim(逆地理编码)", es:"📍 Nominatim (geocodificación inversa)", de:"📍 Nominatim (Reverse-Geocoding)", fr:"📍 Nominatim (géocodage inverse)" },
    "🌦 OpenWeatherMap (실시간 날씨)": { en:"🌦 OpenWeatherMap (live weather)", ja:"🌦 OpenWeatherMap(リアルタイム天気)", zh:"🌦 OpenWeatherMap(实时天气)", es:"🌦 OpenWeatherMap (clima en vivo)", de:"🌦 OpenWeatherMap (Live-Wetter)", fr:"🌦 OpenWeatherMap (météo en direct)" },
    "📰 GNews (위험·통제 뉴스)": { en:"📰 GNews (hazard · closure news)", ja:"📰 GNews(危険・規制ニュース)", zh:"📰 GNews(危险·管制新闻)", es:"📰 GNews (noticias de peligro · cierres)", de:"📰 GNews (Gefahren-/Sperrungsnews)", fr:"📰 GNews (actus danger · fermetures)" },
    "🤖 Google Gemini (AI 챗봇)": { en:"🤖 Google Gemini (AI chatbot)", ja:"🤖 Google Gemini(AIチャットボット)", zh:"🤖 Google Gemini(AI聊天机器人)", es:"🤖 Google Gemini (chatbot de IA)", de:"🤖 Google Gemini (KI-Chatbot)", fr:"🤖 Google Gemini (chatbot IA)" },
    "※ 데모의 위험 구역(치안·재난·인프라)은 시연용 시뮬레이션 데이터입니다": { en:"※ Demo hazard zones (safety · disaster · infra) are simulated data for the demo", ja:"※ デモの危険区域(治安・災害・インフラ)はデモ用のシミュレーションデータです", zh:"※ 演示的危险区域(治安·灾害·基础设施)为演示用模拟数据", es:"※ Las zonas de peligro de la demo (seguridad · desastre · infraestructura) son datos simulados para la demostración", de:"※ Die Gefahrenzonen der Demo (Sicherheit · Katastrophe · Infrastruktur) sind simulierte Demodaten", fr:"※ Les zones de danger de la démo (sécurité · catastrophe · infrastructure) sont des données simulées pour la démo" },

    /* --- 커뮤니티 제보 패널 --- */
    "🚩 커뮤니티 위험 제보": { en:"🚩 Community hazard report", ja:"🚩 コミュニティ危険提報", zh:"🚩 社区危险上报", es:"🚩 Reporte de peligro comunitario", de:"🚩 Community-Gefahrenmeldung", fr:"🚩 Signalement de danger communautaire" },
    "이 위치의 위험을 다른 사용자와 공유합니다. 제보 구역은 즉시 안전 경로 회피 계산에 반영됩니다.": {
      en:"Share this location's hazard with other users. Reported zones are instantly factored into safe-route avoidance.",
      ja:"この場所の危険を他のユーザーと共有します。提報区域は即座に安全経路の回避計算へ反映されます。",
      zh:"与其他用户分享此位置的危险。上报区域将立即计入安全路线的规避计算。",
      es:"Comparte el peligro de esta ubicación con otros usuarios. Las zonas reportadas se incorporan al instante al cálculo de rutas seguras.",
      de:"Teile die Gefahr an diesem Ort mit anderen Nutzern. Gemeldete Zonen fließen sofort in die Berechnung sicherer Routen ein.",
      fr:"Partage le danger de ce lieu avec d'autres utilisateurs. Les zones signalées sont immédiatement prises en compte dans l'évitement d'itinéraire." },
    "💡 가로등 고장": { en:"💡 Broken streetlight", ja:"💡 街灯の故障", zh:"💡 路灯故障", es:"💡 Farola averiada", de:"💡 Defekte Laterne", fr:"💡 Lampadaire en panne" },
    "🚧 공사·통제": { en:"🚧 Construction · control", ja:"🚧 工事・規制", zh:"🚧 施工·管制", es:"🚧 Obras · control", de:"🚧 Baustelle · Sperrung", fr:"🚧 Travaux · barrage" },
    "🌊 침수·물웅덩이": { en:"🌊 Flooding · puddles", ja:"🌊 浸水・水たまり", zh:"🌊 内涝·积水", es:"🌊 Inundación · charcos", de:"🌊 Überschwemmung · Pfützen", fr:"🌊 Inondation · flaques" },
    "⚠ 위협·치안 불안": { en:"⚠ Threat · unsafe", ja:"⚠ 脅威・治安不安", zh:"⚠ 威胁·治安不安", es:"⚠ Amenaza · inseguridad", de:"⚠ Bedrohung · Unsicherheit", fr:"⚠ Menace · insécurité" },
    "유지 시간": { en:"Duration", ja:"保持時間", zh:"保持时长", es:"Duración", de:"Dauer", fr:"Durée" },
    "1시간": { en:"1 hr", ja:"1時間", zh:"1小时", es:"1 h", de:"1 Std.", fr:"1 h" },
    "6시간": { en:"6 hr", ja:"6時間", zh:"6小时", es:"6 h", de:"6 Std.", fr:"6 h" },
    "24시간": { en:"24 hr", ja:"24時間", zh:"24小时", es:"24 h", de:"24 Std.", fr:"24 h" },
    "취소": { en:"Cancel", ja:"キャンセル", zh:"取消", es:"Cancelar", de:"Abbrechen", fr:"Annuler" },
    "제보 등록": { en:"Submit report", ja:"提報を登録", zh:"提交上报", es:"Enviar reporte", de:"Meldung senden", fr:"Envoyer le signalement" }
  };

  /* --- 토스트(하단 알림) 문구 : core.js의 toast()가 gmTr로 번역 --- */
  var TOASTS = {
    "🔑 API 키가 저장되었습니다": { en:"🔑 API key saved", ja:"🔑 APIキーを保存しました", zh:"🔑 已保存API密钥", es:"🔑 Clave de API guardada", de:"🔑 API-Schlüssel gespeichert", fr:"🔑 Clé API enregistrée" },
    "기본 내장 키로 복귀했습니다": { en:"Reverted to the built-in key", ja:"内蔵キーに戻しました", zh:"已恢复为内置密钥", es:"Se volvió a la clave integrada", de:"Auf integrierten Schlüssel zurückgesetzt", fr:"Retour à la clé intégrée" },
    "🔌 AI 서버 연결 불가 · 내장 어시스턴트로 전환됨": { en:"🔌 AI server unreachable · switched to built-in assistant", ja:"🔌 AIサーバーに接続不可 · 内蔵アシスタントに切替", zh:"🔌 无法连接AI服务器 · 已切换到内置助手", es:"🔌 Servidor de IA no disponible · se cambió al asistente integrado", de:"🔌 KI-Server nicht erreichbar · zum integrierten Assistenten gewechselt", fr:"🔌 Serveur IA injoignable · passage à l'assistant intégré" },
    "⚠ 장시간 정지 감지 · 보호자에게 알림": { en:"⚠ Long stop detected · guardian notified", ja:"⚠ 長時間の停止を検知 · 保護者へ通知", zh:"⚠ 检测到长时间停止 · 已通知监护人", es:"⚠ Parada prolongada detectada · tutor notificado", de:"⚠ Langer Stopp erkannt · Betreuer benachrichtigt", fr:"⚠ Arrêt prolongé détecté · tuteur averti" },
    "⚠ 안전 경로 이탈 감지 · 보호자에게 알림": { en:"⚠ Off-route detected · guardian notified", ja:"⚠ 経路逸脱を検知 · 保護者へ通知", zh:"⚠ 检测到偏离路线 · 已通知监护人", es:"⚠ Desvío de ruta detectado · tutor notificado", de:"⚠ Routenabweichung erkannt · Betreuer benachrichtigt", fr:"⚠ Écart d'itinéraire détecté · tuteur averti" },
    "✅ 안전 경로로 복귀했습니다": { en:"✅ Back on the safe route", ja:"✅ 安全経路に復帰しました", zh:"✅ 已回到安全路线", es:"✅ De vuelta en la ruta segura", de:"✅ Zurück auf der sicheren Route", fr:"✅ De retour sur l'itinéraire sûr" },
    "현재 위치를 먼저 확인해 주세요": { en:"Please get your current location first", ja:"先に現在地を確認してください", zh:"请先确认当前位置", es:"Primero obtén tu ubicación actual", de:"Bitte zuerst deinen Standort ermitteln", fr:"Obtiens d'abord ta position actuelle" },
    "목적지와 안전 경로를 먼저 설정해 주세요": { en:"Set a destination and safe route first", ja:"先に目的地と安全経路を設定してください", zh:"请先设置目的地和安全路线", es:"Primero fija un destino y una ruta segura", de:"Lege zuerst Ziel und sichere Route fest", fr:"Définis d'abord une destination et un itinéraire sûr" },
    "🧪 테스트 동행 시작 · 임계값 단축": { en:"🧪 Test escort started · shortened thresholds", ja:"🧪 テスト同行開始 · しきい値短縮", zh:"🧪 测试同行开始 · 阈值缩短", es:"🧪 Acompañamiento de prueba iniciado · umbrales reducidos", de:"🧪 Test-Begleitung gestartet · verkürzte Schwellen", fr:"🧪 Accompagnement test démarré · seuils réduits" },
    "🛡 보호자 동행을 시작합니다": { en:"🛡 Starting guardian escort", ja:"🛡 保護者同行を開始します", zh:"🛡 开始监护人同行", es:"🛡 Iniciando acompañamiento", de:"🛡 Begleitung wird gestartet", fr:"🛡 Démarrage de l'accompagnement" },
    "위치 추적을 시작할 수 없어 마지막 위치로 공유합니다": { en:"Can't start tracking · sharing last known location", ja:"位置追跡を開始できないため最後の位置を共有します", zh:"无法开始定位 · 将共享最后位置", es:"No se puede iniciar el rastreo · se comparte la última ubicación", de:"Tracking nicht möglich · letzter Standort wird geteilt", fr:"Suivi impossible · partage de la dernière position connue" },
    "✅ 목적지 도착 · 보호자에게 무사 도착을 알렸습니다": { en:"✅ Arrived · guardian notified of safe arrival", ja:"✅ 目的地到着 · 保護者に無事到着を通知", zh:"✅ 已到达 · 已通知监护人平安到达", es:"✅ Has llegado · tutor notificado de tu llegada segura", de:"✅ Angekommen · Betreuer über sichere Ankunft informiert", fr:"✅ Arrivé(e) · tuteur informé de l'arrivée en sécurité" },
    "보호자 동행을 종료했습니다": { en:"Guardian escort ended", ja:"保護者同行を終了しました", zh:"已结束监护人同行", es:"Acompañamiento finalizado", de:"Begleitung beendet", fr:"Accompagnement terminé" },
    "🧪 테스트 모드 ON · 안전 타이머가 15초로 실행됩니다": { en:"🧪 Test mode ON · safety timer runs in 15s", ja:"🧪 テストモードON · 安全タイマーは15秒で実行", zh:"🧪 测试模式开启 · 安全计时器按15秒运行", es:"🧪 Modo de prueba activado · el temporizador corre en 15 s", de:"🧪 Testmodus AN · Sicherheits-Timer läuft in 15 s", fr:"🧪 Mode test activé · le minuteur s'exécute en 15 s" },
    "테스트 모드 해제 · 원래 시간으로 실행": { en:"Test mode off · runs at normal time", ja:"テストモード解除 · 通常時間で実行", zh:"已关闭测试模式 · 按正常时间运行", es:"Modo de prueba desactivado · corre con el tiempo normal", de:"Testmodus aus · läuft mit normaler Zeit", fr:"Mode test désactivé · durée normale" },
    "⚠ 도착 확인이 없어 보호자에게 알림을 전송했습니다": { en:"⚠ No arrival check-in · alert sent to guardian", ja:"⚠ 到着確認がないため保護者へ通知を送信", zh:"⚠ 无到达签到 · 已向监护人发送提醒", es:"⚠ Sin registro de llegada · alerta enviada al tutor", de:"⚠ Kein Ankunfts-Check-in · Warnung an Betreuer gesendet", fr:"⚠ Pas d'enregistrement d'arrivée · alerte envoyée au tuteur" },
    "✅ 무사 도착이 보호자에게 공유되었습니다": { en:"✅ Safe arrival shared with guardian", ja:"✅ 無事到着を保護者に共有しました", zh:"✅ 已向监护人分享平安到达", es:"✅ Llegada segura compartida con el tutor", de:"✅ Sichere Ankunft mit Betreuer geteilt", fr:"✅ Arrivée en sécurité partagée avec le tuteur" },
    "안전 타이머가 취소되었습니다": { en:"Safety timer cancelled", ja:"安全タイマーをキャンセルしました", zh:"已取消安全计时器", es:"Temporizador de seguridad cancelado", de:"Sicherheits-Timer abgebrochen", fr:"Minuteur de sécurité annulé" },
    "🚨 보호자에게 긴급 메시지와 위치를 전송했습니다!": { en:"🚨 Emergency message and location sent to guardian!", ja:"🚨 保護者に緊急メッセージと位置を送信しました!", zh:"🚨 已向监护人发送紧急消息和位置!", es:"🚨 ¡Mensaje de emergencia y ubicación enviados al tutor!", de:"🚨 Notfallnachricht und Standort an Betreuer gesendet!", fr:"🚨 Message d'urgence et position envoyés au tuteur !" },
    "이 브라우저는 위치를 지원하지 않아 데모 위치를 사용합니다": { en:"This browser doesn't support location · using demo location", ja:"このブラウザは位置情報に非対応のためデモ位置を使用します", zh:"此浏览器不支持定位 · 使用演示位置", es:"Este navegador no admite ubicación · se usa una ubicación de demo", de:"Dieser Browser unterstützt keine Ortung · Demo-Standort wird verwendet", fr:"Ce navigateur ne gère pas la localisation · position de démo utilisée" },
    "위치 권한이 거부되어 데모 위치를 사용합니다": { en:"Location permission denied · using demo location", ja:"位置情報の許可が拒否されたためデモ位置を使用します", zh:"定位权限被拒绝 · 使用演示位置", es:"Permiso de ubicación denegado · se usa una ubicación de demo", de:"Standortberechtigung verweigert · Demo-Standort wird verwendet", fr:"Autorisation de localisation refusée · position de démo utilisée" },
    "🏁 목적지가 변경되었습니다": { en:"🏁 Destination changed", ja:"🏁 目的地を変更しました", zh:"🏁 已更改目的地", es:"🏁 Destino cambiado", de:"🏁 Ziel geändert", fr:"🏁 Destination modifiée" },
    "✅ AI가 안전 경로로 최적화했습니다": { en:"✅ AI optimized to the safe route", ja:"✅ AIが安全経路に最適化しました", zh:"✅ AI已优化为安全路线", es:"✅ La IA optimizó a la ruta segura", de:"✅ KI hat auf die sichere Route optimiert", fr:"✅ L'IA a optimisé vers l'itinéraire sûr" },
    "⚠ 최단 경로로 전환됨": { en:"⚠ Switched to the shortest route", ja:"⚠ 最短経路に切り替えました", zh:"⚠ 已切换到最短路线", es:"⚠ Cambiado a la ruta más corta", de:"⚠ Auf kürzeste Route gewechselt", fr:"⚠ Passage à l'itinéraire le plus court" },
    "⚠ 라우팅 서버 연결 불가 · 직선 근사로 표시": { en:"⚠ Routing server unreachable · showing straight-line approx.", ja:"⚠ ルーティングサーバーに接続不可 · 直線近似で表示", zh:"⚠ 无法连接路由服务器 · 以直线近似显示", es:"⚠ Servidor de rutas no disponible · aproximación en línea recta", de:"⚠ Routing-Server nicht erreichbar · Anzeige als Luftlinie", fr:"⚠ Serveur d'itinéraire injoignable · approximation à vol d'oiseau" },
    "카테고리 켜짐 · 경로 재계산": { en:"Category on · recalculating route", ja:"カテゴリON · 経路を再計算", zh:"类别已开启 · 重新计算路线", es:"Categoría activada · recalculando ruta", de:"Kategorie an · Route wird neu berechnet", fr:"Catégorie activée · recalcul de l'itinéraire" },
    "카테고리 꺼짐 · 경로 재계산": { en:"Category off · recalculating route", ja:"カテゴリOFF · 経路を再計算", zh:"类别已关闭 · 重新计算路线", es:"Categoría desactivada · recalculando ruta", de:"Kategorie aus · Route wird neu berechnet", fr:"Catégorie désactivée · recalcul de l'itinéraire" },
    "🌙 심야 가중 켜짐 · 치안 구역 확대 적용": { en:"🌙 Night boost on · safety zones expanded", ja:"🌙 深夜加重ON · 治安区域を拡大適用", zh:"🌙 深夜加权开启 · 治安区已扩大", es:"🌙 Refuerzo nocturno activado · zonas de seguridad ampliadas", de:"🌙 Nachtverstärkung an · Sicherheitszonen erweitert", fr:"🌙 Renforcement nocturne activé · zones de sécurité agrandies" },
    "🌙 심야 가중 켜짐 · 야간(21~06시)에 자동 적용": { en:"🌙 Night boost on · auto-applies at night (21–06h)", ja:"🌙 深夜加重ON · 夜間(21〜06時)に自動適用", zh:"🌙 深夜加权开启 · 夜间(21~06时)自动应用", es:"🌙 Refuerzo nocturno activado · se aplica de noche (21–06 h)", de:"🌙 Nachtverstärkung an · greift nachts (21–06 Uhr) automatisch", fr:"🌙 Renforcement nocturne activé · s'applique la nuit (21 h–06 h)" },
    "심야 위험 가중이 꺼졌습니다": { en:"Night risk boost turned off", ja:"深夜リスク加重をオフにしました", zh:"已关闭深夜风险加权", es:"Refuerzo de riesgo nocturno desactivado", de:"Nächtliche Risikoverstärkung deaktiviert", fr:"Renforcement du risque nocturne désactivé" },
    "🗑 제보가 삭제되어 경로를 재계산합니다": { en:"🗑 Report deleted · recalculating route", ja:"🗑 提報を削除して経路を再計算します", zh:"🗑 已删除上报 · 重新计算路线", es:"🗑 Reporte eliminado · recalculando ruta", de:"🗑 Meldung gelöscht · Route wird neu berechnet", fr:"🗑 Signalement supprimé · recalcul de l'itinéraire" },
    "🚩 제보 모드 ON · 지도를 탭해 위치를 선택하세요": { en:"🚩 Report mode ON · tap the map to pick a spot", ja:"🚩 提報モードON · 地図をタップして位置を選択", zh:"🚩 上报模式开启 · 点地图选择位置", es:"🚩 Modo de reporte activado · toca el mapa para elegir un punto", de:"🚩 Meldemodus AN · tippe auf die Karte, um einen Ort zu wählen", fr:"🚩 Mode signalement activé · touche la carte pour choisir un point" },
    "제보 모드가 해제되었습니다": { en:"Report mode turned off", ja:"提報モードを解除しました", zh:"已关闭上报模式", es:"Modo de reporte desactivado", de:"Meldemodus deaktiviert", fr:"Mode signalement désactivé" },
    "🚩 제보가 등록되어 회피 경로를 재계산합니다": { en:"🚩 Report added · recalculating avoidance route", ja:"🚩 提報を登録して回避経路を再計算します", zh:"🚩 已登记上报 · 重新计算规避路线", es:"🚩 Reporte añadido · recalculando ruta de evitación", de:"🚩 Meldung hinzugefügt · Ausweichroute wird neu berechnet", fr:"🚩 Signalement ajouté · recalcul de l'itinéraire d'évitement" },
    "📱 보호자 번호가 저장되었습니다": { en:"📱 Guardian number saved", ja:"📱 保護者番号を保存しました", zh:"📱 已保存监护人号码", es:"📱 Número del tutor guardado", de:"📱 Betreuer-Nummer gespeichert", fr:"📱 Numéro du tuteur enregistré" },
    "보호자 번호가 삭제되었습니다": { en:"Guardian number removed", ja:"保護者番号を削除しました", zh:"已删除监护人号码", es:"Número del tutor eliminado", de:"Betreuer-Nummer entfernt", fr:"Numéro du tuteur supprimé" },
    "☎ 영사콜센터 연동이 켜졌습니다": { en:"☎ Consular call center linked", ja:"☎ 領事コールセンター連携をオンにしました", zh:"☎ 已开启领事呼叫中心联动", es:"☎ Centro consular vinculado", de:"☎ Konsular-Callcenter verbunden", fr:"☎ Centre consulaire lié" },
    "☎ 영사콜센터 연동이 꺼졌습니다": { en:"☎ Consular call center unlinked", ja:"☎ 領事コールセンター連携をオフにしました", zh:"☎ 已关闭领事呼叫中心联动", es:"☎ Centro consular desvinculado", de:"☎ Konsular-Callcenter getrennt", fr:"☎ Centre consulaire délié" },
    "🧪 테스트 · 15초 후 미응답 알림이 전송됩니다": { en:"🧪 Test · a no-response alert will be sent in 15s", ja:"🧪 テスト · 15秒後に未応答通知を送信", zh:"🧪 测试 · 15秒后发送未响应提醒", es:"🧪 Prueba · se enviará una alerta de no respuesta en 15 s", de:"🧪 Test · Nichtantwort-Warnung wird in 15 s gesendet", fr:"🧪 Test · une alerte de non-réponse sera envoyée dans 15 s" },
    "⚠ 주변 시설 정보를 불러오지 못했습니다 (서버 응답 지연 · 잠시 후 다시 시도하세요)": { en:"⚠ Couldn't load nearby facilities (server delay · try again shortly)", ja:"⚠ 周辺施設情報を取得できませんでした(サーバー遅延 · しばらくして再試行)", zh:"⚠ 无法加载周边设施信息(服务器延迟 · 请稍后重试)", es:"⚠ No se pudieron cargar los servicios cercanos (retraso del servidor · reintenta en breve)", de:"⚠ Einrichtungen in der Nähe nicht geladen (Serververzögerung · bitte später erneut)", fr:"⚠ Impossible de charger les services à proximité (serveur lent · réessaie bientôt)" },
    "주변에 등록된 경찰서/소방서/병원 정보가 없습니다": { en:"No police/fire/hospital found nearby", ja:"周辺に登録された警察・消防・病院情報がありません", zh:"附近没有登记的警察/消防/医院信息", es:"No hay policía/bomberos/hospital registrados cerca", de:"Keine Polizei/Feuerwehr/Krankenhaus in der Nähe gefunden", fr:"Aucun poste de police/pompiers/hôpital à proximité" },
    "검색 결과가 없습니다": { en:"No results found", ja:"検索結果がありません", zh:"没有搜索结果", es:"Sin resultados", de:"Keine Ergebnisse", fr:"Aucun résultat" },
    "검색에 실패했습니다 (서버 지연 · 잠시 후 다시 시도)": { en:"Search failed (server delay · try again shortly)", ja:"検索に失敗しました(サーバー遅延 · しばらくして再試行)", zh:"搜索失败(服务器延迟 · 请稍后重试)", es:"Error de búsqueda (retraso del servidor · reintenta en breve)", de:"Suche fehlgeschlagen (Serververzögerung · bitte später erneut)", fr:"Échec de la recherche (serveur lent · réessaie bientôt)" },
    "🚗 자동차 경로로 전환": { en:"🚗 Switched to driving route", ja:"🚗 車の経路に切替", zh:"🚗 已切换到驾车路线", es:"🚗 Cambiado a ruta en coche", de:"🚗 Auf Autoroute gewechselt", fr:"🚗 Passage à l'itinéraire en voiture" },
    "🚶 도보 경로로 전환": { en:"🚶 Switched to walking route", ja:"🚶 徒歩の経路に切替", zh:"🚶 已切换到步行路线", es:"🚶 Cambiado a ruta a pie", de:"🚶 Auf Fußweg gewechselt", fr:"🚶 Passage à l'itinéraire à pied" }
  };

  var currentLang = 'ko';
  function norm(s){ return s.trim().replace(/\s+/g, ' '); }

  function applyLang(lang){
    var root = document.querySelector('.phone');
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function(node){
      if (node.__gmko === undefined) node.__gmko = node.nodeValue;
      var key = norm(node.__gmko);
      if (!key) return;
      if (lang === 'ko'){ node.nodeValue = node.__gmko; return; }
      var tr = I18N[key];
      node.nodeValue = (tr && tr[lang]) ? tr[lang] : ((tr && tr.en) ? tr.en : node.__gmko);
    });
    root.querySelectorAll('[placeholder]').forEach(function(el){
      if (el.__gmkoPh === undefined) el.__gmkoPh = el.getAttribute('placeholder') || '';
      var key = norm(el.__gmkoPh);
      var tr = I18N[key];
      el.setAttribute('placeholder', (lang !== 'ko' && tr && tr[lang]) ? tr[lang] : el.__gmkoPh);
    });
    document.documentElement.setAttribute('lang', lang);
  }

  function markActive(lang){
    var sel = document.getElementById('langSelect');
    if (sel && sel.value !== lang) sel.value = lang;
  }

  function setLang(lang){
    currentLang = lang;
    try { localStorage.setItem('gm_lang', lang); } catch(e){}
    applyLang(lang);
    markActive(lang);
    /* 동적으로 그려지는 UI(경로 배너/요약·동행 버튼·프로필 위치)를 새 언어로 다시 렌더 */
    try { if (typeof refreshMapUI === 'function') refreshMapUI(); } catch(e){}
    try { if (typeof escortUpdateUI === 'function') escortUpdateUI(); } catch(e){}
    try { if (typeof updateProfileLoc === 'function') updateProfileLoc(); } catch(e){}
    try { if (typeof checkWeatherAlert === 'function' && state && state.userPos) checkWeatherAlert(state.userPos); } catch(e){}
    /* 지도 위 Leaflet 팝업(위험구역/주변시설/경로선/목적지/뉴스/제보)은 생성 시 언어가
       굳으므로 다시 그림/재라벨한다 (재조회 없이 툴팁 내용만 갱신) */
    try { if (typeof buildZones === 'function' && state && state.userPos && state.destPos) buildZones(false); } catch(e){}
    try { if (typeof relabelFacilities === 'function') relabelFacilities(); } catch(e){}
    try { if (typeof relabelRouteLines === 'function') relabelRouteLines(); } catch(e){}
    try { if (typeof relabelDestMarker === 'function') relabelDestMarker(); } catch(e){}
    try { if (typeof relabelNews === 'function') relabelNews(); } catch(e){}
  }

  window.gmLang = function(){ return currentLang; };
  window.gmPick = function(obj){                       // {ko,en,ja,zh,es,de,fr} 중 현재 언어 선택(없으면 en→ko 폴백)
    if (!obj) return '';
    if (obj[currentLang] != null) return obj[currentLang];
    return obj.en != null ? obj.en : obj.ko;
  };
  window.gmTr = function(msg){                          // 토스트 등 알려진 한국어 문구 번역
    if (currentLang === 'ko' || msg == null) return msg;
    var tr = TOASTS[norm(msg)];
    return (tr && tr[currentLang]) ? tr[currentLang] : ((tr && tr.en) ? tr.en : msg);
  };

  var sel = document.getElementById('langSelect');
  if (sel) sel.addEventListener('change', function(){ setLang(sel.value); });

  var saved = 'ko';
  try { saved = localStorage.getItem('gm_lang') || 'ko'; } catch(e){}
  setLang(saved);

  window.gmSetLang = setLang;
})();
