/* GUARDIMATE · js/map.js — 탭 전환 + Leaflet 지도 초기화(타일/마커 아이콘/레이어) (로드 순서 2/9) */

/* ================================================================
   3. 탭 전환
================================================================ */
document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.screen).classList.add('active');
    /* 숨겨져 있던 지도는 크기 정보가 깨지므로 다시 계산 */
    if (btn.dataset.screen === 'screen-map') setTimeout(()=>map.invalidateSize(), 60);
  });
});

/* ================================================================
   4. Leaflet 지도 초기화 (무료 타일 3종)
================================================================ */
const map = L.map('liveMap', { zoomControl:false, attributionControl:false }).setView(FALLBACK, 15);
L.control.attribution({position:'topright', prefix:false}).addAttribution('© OpenStreetMap').addTo(map);

const tileLayers = {
  dark:      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {maxZoom:19}),
  standard:  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19})
};
tileLayers.dark.addTo(map);

/* 마커 아이콘 (HTML 기반 커스텀) */
const userIcon = L.divIcon({className:'', html:'<div class="user-dot"><div class="ring"></div><div class="core"></div></div>', iconSize:[16,16], iconAnchor:[8,8]});
const destIcon = L.divIcon({className:'', html:'<div class="dest-pin">🏁</div>', iconSize:[22,22], iconAnchor:[11,11]});
const policeIcon  = L.divIcon({className:'', html:'<div class="poi-pin">👮</div>', iconSize:[22,22], iconAnchor:[11,11]});
const fireIcon     = L.divIcon({className:'', html:'<div class="poi-pin">🚒</div>', iconSize:[22,22], iconAnchor:[11,11]});
const medicalIcon  = L.divIcon({className:'', html:'<div class="poi-pin">🏥</div>', iconSize:[22,22], iconAnchor:[11,11]});
const newsIcon     = L.divIcon({className:'', html:'<div class="poi-pin" style="background:#2a0f0f;border-color:#ef4444">🚨</div>', iconSize:[24,24], iconAnchor:[12,12]});

let userMarker=null, destMarker=null, zoneLayers={}, routeSafeLine=null, routeShortLine=null;
const poiLayer = L.layerGroup().addTo(map);
const newsLayer = L.layerGroup().addTo(map);
