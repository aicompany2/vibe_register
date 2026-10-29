import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, PLACES } from '../data/jejuPlaces.js';

const ALL = new Set(CATEGORIES.map((c) => c.id));
const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// 관람객수 API(서귀포시 직영관광지) 응답을 장소별 월별 숫자로 바꿔요.
function visitorSeries(rows, key) {
  return rows
    .map((r) => ({
      ym: r['기준연도'] != null ? `${String(r['기준연도']).slice(2)}.${String(r['기준월']).padStart(2, '0')}` : String(r['기준연월'] || ''),
      v: Number(String(r[key] ?? '').replace(/,/g, '')),
      sort: Number(r['기준연도'] || 0) * 100 + Number(r['기준월'] || 0),
    }))
    .filter((r) => Number.isFinite(r.v) && r.ym)
    .sort((a, b) => a.sort - b.sort)
    .slice(-12);
}

function VisitorChart({ state, visitorKey }) {
  if (!state) return <p className="mnote">관람객 데이터를 불러오는 중… 🍊</p>;
  if (state.error) return <p className="mnote warn">관람객 데이터를 불러오지 못했어요. ({state.error})<br /><small>DATA_GO_KR_KEY 환경변수와 API 활용신청 승인 상태를 확인해 주세요.</small></p>;
  const s = visitorSeries(state.rows, visitorKey);
  if (!s.length) return <p className="mnote">이 장소의 관람객 데이터가 비어 있어요.</p>;
  const max = Math.max(...s.map((x) => x.v), 1);
  return (
    <div className="vchart">
      <div className="vtitle">월별 관람객수 (최근 {s.length}개월)</div>
      <div className="vbars">
        {s.map((x) => (
          <div key={x.ym} className="vbar" title={`${x.ym}: ${x.v.toLocaleString()}명`}>
            <span style={{ height: `${Math.max(4, (x.v / max) * 100)}%` }} />
            <em>{x.ym.slice(-2)}</em>
          </div>
        ))}
      </div>
      <div className="vsrc">출처: 공공데이터포털 · 서귀포시 직영관광지 관람객수 추이</div>
    </div>
  );
}

export default function Map3D() {
  const stageRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');
  const [cats, setCats] = useState(() => new Set(ALL));
  const [selectedId, setSelectedId] = useState(null);
  const [night, setNight] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [visitors, setVisitors] = useState(null);

  // 장면 만들기 (three.js 는 이 페이지에 들어올 때만 내려받아요)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { createJejuMap } = await import('../three/jejuMap.js');
        if (cancelled || !stageRef.current) return;
        apiRef.current = createJejuMap(stageRef.current, {
          places: PLACES,
          categories: CATEGORIES,
          onSelect: (id) => setSelectedId(id),
          onAutoRotateChange: setAutoRotate,
        });
        setStatus('ready');
      } catch (e) {
        console.error(e);
        if (!cancelled) { setErrMsg(String((e && e.message) || e)); setStatus('error'); }
      }
    }, 40);
    return () => { cancelled = true; clearTimeout(timer); if (apiRef.current) { apiRef.current.dispose(); apiRef.current = null; } };
  }, []);

  useEffect(() => { apiRef.current && apiRef.current.setCategories(cats); }, [cats, status]);
  useEffect(() => { apiRef.current && apiRef.current.setNight(night); }, [night, status]);
  useEffect(() => { apiRef.current && apiRef.current.select(selectedId); }, [selectedId, status]);

  const selected = useMemo(() => PLACES.find((p) => p.id === selectedId) || null, [selectedId]);

  // 관람객 API 는 해당 장소를 처음 눌렀을 때 한 번만 불러와요
  const needVisitors = !!(selected && selected.visitorKey);
  useEffect(() => {
    if (!needVisitors || visitors) return;
    let off = false;
    fetch('/api/visitors?perPage=200')
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j; })
      .then((j) => { if (!off) setVisitors({ rows: j.rows || [] }); })
      .catch((e) => { if (!off) setVisitors({ error: String(e.message || e) }); });
    return () => { off = true; };
  }, [needVisitors, visitors]);

  const toggleCat = (id) => setCats((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const onlyAll = cats.size === ALL.size;
  const visible = PLACES.filter((p) => cats.has(p.cat));

  return (
    <section className="map-page">
      <h2 className="page-title">🗺️ 제주 3D 입체 지도</h2>
      <p className="map-intro">
        한라산·오름·해안·풍력발전기·등대·돌하르방이 있는 제주를 돌려 보고 확대해 보세요. 관광지, 올레길, 항·포구, 감귤 재배지를 눌러 가며 둘러볼 수 있어요.
      </p>

      <div className="map-grid">
        <div className="map-stage-wrap">
          <div className="map-stage" ref={stageRef}>
            {status === 'loading' && <div className="map-overlay">🍊 3D 지도를 만드는 중이에요…</div>}
            {status === 'error' && (
              <div className="map-overlay err">
                3D 지도를 열 수 없어요.<br /><small>이 브라우저에서 WebGL 이 꺼져 있을 수 있어요. ({errMsg})</small>
              </div>
            )}
          </div>
          {status === 'ready' && (
            <div className="map-tools">
              <button className="btn ghost" onClick={() => setNight((v) => !v)}>{night ? '☀️ 낮' : '🌙 밤'}</button>
              <button className="btn ghost" onClick={() => { const v = !autoRotate; setAutoRotate(v); apiRef.current && apiRef.current.setAutoRotate(v); }}>{autoRotate ? '⏸ 회전 멈춤' : '🔄 자동 회전'}</button>
              <button className="btn ghost" onClick={() => { setSelectedId(null); apiRef.current && apiRef.current.resetView(); }}>🏠 처음 위치</button>
            </div>
          )}
          <div className="map-hint">드래그: 회전 · 휠/핀치: 확대 · 오른쪽 버튼 드래그: 이동 · 핀을 누르면 날아가요</div>
        </div>

        <aside className="map-side">
          <div className="chips map-chips">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={'chip' + (cats.has(c.id) ? ' on' : '')} style={cats.has(c.id) ? { background: c.color, borderColor: c.color } : undefined} onClick={() => toggleCat(c.id)}>
                {c.emoji} {c.label}
              </button>
            ))}
            <button className="chip" onClick={() => setCats(new Set(onlyAll ? [] : ALL))}>{onlyAll ? '모두 끄기' : '모두 켜기'}</button>
          </div>

          {selected && (
            <div className="mcard" style={{ borderColor: catById[selected.cat].color }}>
              <button className="mclose" onClick={() => setSelectedId(null)} aria-label="닫기">✕</button>
              <div className="mtag" style={{ background: catById[selected.cat].color }}>{catById[selected.cat].emoji} {catById[selected.cat].label}</div>
              <h3>{selected.name}</h3>
              <p>{selected.desc}</p>
              {selected.tip && <p className="mtip">💡 {selected.tip}</p>}
              {selected.visitorKey && <VisitorChart state={visitors} visitorKey={selected.visitorKey} />}
            </div>
          )}

          <ul className="mlist">
            {visible.length === 0 && <li className="mnote">켜진 종류가 없어요. 위에서 골라 보세요!</li>}
            {visible.map((p) => (
              <li key={p.id}>
                <button className={p.id === selectedId ? 'on' : ''} onClick={() => setSelectedId(p.id)}>
                  <span className="mdot" style={{ background: catById[p.cat].color }} />{catById[p.cat].emoji} {p.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <p className="map-foot">지형과 위치는 이해를 돕기 위해 단순화한 모형이에요. 실제 위치와 조금 다를 수 있어요. 세로 높이는 약 5배 과장했어요.</p>
    </section>
  );
}
