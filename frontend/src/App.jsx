import { useEffect, useMemo, useState } from "react";
import ThreeScene from "./ThreeScene";
import MathGraph from "./MathGraph";

const OBJECTS = [
  { value: "blackhole", label: "Schwarzschild Black Hole" },
  { value: "wormhole", label: "Einstein-Rosen Wormhole" },
  { value: "lensing", label: "Gravitational Lensing" },
  { value: "neutron_star", label: "Neutron Star Curvature" },
  { value: "binary", label: "Binary Black Hole System" },
];

const REFERENCE_FALLBACKS = {
  blackhole: {
    wikipedia: "https://en.wikipedia.org/wiki/Schwarzschild_metric",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Black_hole_-_Messier_87_crop_max_res.jpg",
    credit: "Event Horizon Telescope Collaboration",
  },
  wormhole: {
    wikipedia: "https://en.wikipedia.org/wiki/Wormhole",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Schwarzschild_wormhole_embedding.svg",
    credit: "Wikimedia Commons",
  },
  lensing: {
    wikipedia: "https://en.wikipedia.org/wiki/Gravitational_lens",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Abell_370_galaxy_lensing.jpg",
    credit: "NASA/ESA Hubble",
  },
  neutron_star: {
    wikipedia: "https://en.wikipedia.org/wiki/Neutron_star",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Neutron_star_cross_section.svg",
    credit: "Wikimedia Commons",
  },
  binary: {
    wikipedia: "https://en.wikipedia.org/wiki/Binary_black_hole",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/GW150914_waveform_overview.png",
    credit: "LIGO Scientific Collaboration",
  },
};

const PARAM_SCHEMA = {
  blackhole: [
    { key: "mass", label: "Mass parameter M", min: 0.6, max: 6.0, step: 0.05 },
    { key: "resolution", label: "Mesh resolution", min: 120, max: 360, step: 10 },
  ],
  wormhole: [
    { key: "throat", label: "Throat radius a", min: 0.6, max: 5.0, step: 0.05 },
    { key: "resolution", label: "Mesh resolution", min: 120, max: 380, step: 10 },
  ],
  lensing: [
    { key: "mass", label: "Lens mass", min: 0.5, max: 5.0, step: 0.05 },
    { key: "sourceX", label: "Source galaxy X", min: -4.8, max: 4.8, step: 0.05 },
    { key: "sourceY", label: "Source galaxy Y", min: -4.8, max: 4.8, step: 0.05 },
    { key: "observerX", label: "Observer X", min: -10.0, max: 10.0, step: 0.1 },
    { key: "observerY", label: "Observer Y", min: -8.0, max: 8.0, step: 0.1 },
    { key: "resolution", label: "Mesh resolution", min: 120, max: 360, step: 10 },
  ],
  neutron_star: [
    { key: "mass", label: "Mass parameter", min: 0.7, max: 4.0, step: 0.05 },
    { key: "radius", label: "Star radius", min: 0.8, max: 6.0, step: 0.05 },
    { key: "resolution", label: "Mesh resolution", min: 120, max: 360, step: 10 },
  ],
  binary: [
    { key: "mass1", label: "Mass 1", min: 0.6, max: 5.0, step: 0.05 },
    { key: "mass2", label: "Mass 2", min: 0.6, max: 5.0, step: 0.05 },
    { key: "separation", label: "Orbital separation", min: 2.5, max: 14.0, step: 0.1 },
    { key: "resolution", label: "Mesh resolution", min: 120, max: 360, step: 10 },
  ],
};

const DEFAULT_PARAMS = {
  blackhole: { mass: 1.8, resolution: 240 },
  wormhole: { throat: 1.8, resolution: 260 },
  lensing: { mass: 1.2, sourceX: 0.15, sourceY: 0.0, observerX: -6.0, observerY: 0.0, resolution: 230 },
  neutron_star: { mass: 1.5, radius: 2.4, resolution: 230 },
  binary: { mass1: 1.35, mass2: 1.15, separation: 8.0, resolution: 240 },
};

const SIMULATE_API_URL = "https://cosmocurve.onrender.com/simulate";

async function runSimulation(query) {
  const response = await fetch(`${SIMULATE_API_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error("Simulation request failed");
  }

  const data = await response.json();
  return data;
}

function App() {
  const [selectedObject, setSelectedObject] = useState("blackhole");
  const [wireframe, setWireframe] = useState(false);
  const [colorMode, setColorMode] = useState("curvature");
  const [graphMode, setGraphMode] = useState(false);
  const [paramsByObject, setParamsByObject] = useState(DEFAULT_PARAMS);

  const [field, setField] = useState([]);
  const [rays, setRays] = useState([]);
  const [labels, setLabels] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [reference, setReference] = useState(null);
  const [graph, setGraph] = useState(null);
  const [verification, setVerification] = useState(null);

  const [simTime, setSimTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const activeParams = useMemo(() => paramsByObject[selectedObject] ?? {}, [paramsByObject, selectedObject]);
  const paramSchema = useMemo(() => PARAM_SCHEMA[selectedObject] ?? [], [selectedObject]);
  const fallbackReference = REFERENCE_FALLBACKS[selectedObject] ?? REFERENCE_FALLBACKS.blackhole;
  const wikiUrl = reference?.wikipedia || fallbackReference.wikipedia;
  const imageUrl = reference?.image?.url || fallbackReference.imageUrl;
  const imageCredit = reference?.image?.credit || fallbackReference.credit;

  useEffect(() => {
    if (selectedObject !== "binary") {
      setSimTime(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSimTime((prev) => prev + 0.12);
    }, 110);

    return () => window.clearInterval(timer);
  }, [selectedObject]);

  useEffect(() => {
    const fetchField = async () => {
      setIsLoading(true);
      setError("");

      try {
        const query = new URLSearchParams(
          Object.entries({
            object: selectedObject,
            t: simTime.toFixed(3),
            ...activeParams,
          }).map(([key, value]) => [key, String(value)])
        );
        const data = await runSimulation(query);

        if (!Array.isArray(data?.field)) {
          throw new Error("Backend returned invalid field data.");
        }

        setField(data.field);
        setRays(Array.isArray(data.rays) ? data.rays : []);
        setLabels(Array.isArray(data.labels) ? data.labels : []);
        setMetadata(data.metadata ?? null);
        setGraph(data.graph ?? null);
        setReference(data.reference ?? null);
        setVerification(data.verification ?? null);
      } catch (requestError) {
        setError(requestError?.message || "Failed to fetch simulation data.");
        setField([]);
        setRays([]);
        setLabels([]);
        setMetadata(null);
        setGraph(null);
        setReference(null);
        setVerification(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchField();
  }, [selectedObject, activeParams, simTime]);

  const onParamChange = (key, value) => {
    setParamsByObject((prev) => ({
      ...prev,
      [selectedObject]: {
        ...prev[selectedObject],
        [key]: value,
      },
    }));
  };

  return (
    <div className="app-shell">
      <aside className="panel">
        <h1>Spacetime Curvature Simulator</h1>
        <p className="subtitle">
          Educational GR visualizer of how mass-energy bends spacetime geometry.
        </p>

        <label className="control-label" htmlFor="object-select">Spacetime Model</label>
        <select
          id="object-select"
          value={selectedObject}
          onChange={(event) => setSelectedObject(event.target.value)}
        >
          {OBJECTS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>

        <label className="checkbox-row" htmlFor="wireframe-toggle">
          <input
            id="wireframe-toggle"
            type="checkbox"
            checked={wireframe}
            onChange={(event) => setWireframe(event.target.checked)}
          />
          Wireframe Mode
        </label>

        <label className="checkbox-row" htmlFor="graph-mode-toggle">
          <input
            id="graph-mode-toggle"
            type="checkbox"
            checked={graphMode}
            onChange={(event) => setGraphMode(event.target.checked)}
          />
          Mathematical Graph Mode
        </label>

        <label className="control-label" htmlFor="color-mode-select">Color Mode</label>
        <select
          id="color-mode-select"
          value={colorMode}
          onChange={(event) => setColorMode(event.target.value)}
        >
          <option value="curvature">Curvature Strength</option>
          <option value="wavelength">Wavelength Mode</option>
        </select>

        <div className="legend-row">
          {colorMode === "curvature" && (
            <p>
              Curvature strength color map: <strong>blue</strong> (weak) {"->"}
              <strong> green</strong> (moderate) {"->"}
              <strong> red</strong> (strong)
            </p>
          )}
          {colorMode === "wavelength" && (
            <p>
              Wavelength mode: <strong>red</strong> (long wavelength) {"->"}
              <strong> violet</strong> (short wavelength / high energy)
            </p>
          )}
        </div>

        {paramSchema.length > 0 && (
          <div className="param-card">
            <h3>Model Parameters</h3>
            {paramSchema.map((param) => {
              const value = Number(activeParams[param.key] ?? param.min);
              return (
                <label key={param.key} className="param-row">
                  <span>{param.label}: {value.toFixed(param.step < 1 ? 2 : 0)}</span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={value}
                    onChange={(event) => onParamChange(param.key, Number(event.target.value))}
                  />
                </label>
              );
            })}
          </div>
        )}

        {reference && (
          <div className="info-card">
            <h2>{reference.title}</h2>
            <p>{reference.physics}</p>
            <p><strong>Equation:</strong> <code>{reference.equation}</code></p>
            {selectedObject === "lensing" && (
              <p>
                <strong>Source-Lens-Observer:</strong> move source and observer sliders. Near alignment creates an Einstein ring; offset alignment produces arcs and multiple images.
              </p>
            )}
            <p>
              <a href={wikiUrl} target="_blank" rel="noreferrer">Wikipedia Reference</a>
            </p>
            {imageUrl && (
              <a href={imageUrl} target="_blank" rel="noreferrer" className="image-link-wrap">
                <img
                  src={imageUrl}
                  alt={`${reference.title} reference`}
                  className="reference-image"
                  onError={(event) => {
                    event.currentTarget.src = fallbackReference.imageUrl;
                  }}
                />
                <span className="image-credit">Image: {imageCredit}</span>
              </a>
            )}
          </div>
        )}

        {verification && (
          <div className="verification-card">
            <h3>Physics Consistency</h3>
            <p className="verification-framework">{verification.framework}</p>
            <p className="verification-score">Model alignment score: <strong>{verification.score}%</strong></p>
            <p>{verification.summary}</p>
            <ul>
              {verification.checks?.map((check) => (
                <li key={check.name} className={check.pass ? "check-pass" : "check-warn"}>
                  {check.name}: {String(check.value)} (target: {check.target})
                </li>
              ))}
            </ul>
            <p className="verification-disclaimer">{verification.disclaimer}</p>
          </div>
        )}

        {graphMode && (
          <div className="graph-card">
            <MathGraph graph={graph} />
          </div>
        )}

        {isLoading && <p className="status">Loading simulation...</p>}
        {error && <p className="status error">{error}</p>}
      </aside>

      <main className="viewer-wrap">
        <ThreeScene
          field={field}
          wireframe={wireframe}
          colorMode={colorMode}
          rays={rays}
          labels={labels}
          metadata={metadata}
          objectName={selectedObject}
        />
        {field.length === 0 && (
          <div className="viewer-empty">
            {isLoading && <span>Loading simulation...</span>}
            {!isLoading && error && (
              <span>
                <strong>Backend unavailable.</strong><br />
                Run <code>python app.py</code> in <code>backend/</code>.
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
