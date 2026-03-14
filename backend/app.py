from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np

app = Flask(__name__)
CORS(app)


def make_grid(n: int, extent: float):
    x = np.linspace(-extent, extent, n)
    y = np.linspace(-extent, extent, n)
    x_grid, y_grid = np.meshgrid(x, y)
    r = np.sqrt(x_grid**2 + y_grid**2) + 1e-9
    return x_grid, y_grid, r


def parse_float(name: str, default: float, min_value: float, max_value: float):
    try:
        value = float(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return float(max(min_value, min(max_value, value)))


def schwarzschild_black_hole():
    n = int(parse_float("resolution", 260, 120, 420))
    extent = parse_float("extent", 16.0, 8.0, 40.0)
    mass = parse_float("mass", 1.8, 0.6, 6.0)

    x_grid, y_grid, r = make_grid(n=n, extent=extent)
    r_s = 2.0 * mass

    # Flamm paraboloid (outside horizon): z = -2*sqrt(r_s*(r-r_s)).
    # This is perfectly radial and gives the characteristic steep wall near r_s.
    outer = -2.0 * np.sqrt(np.maximum(r_s * (r - r_s), 0.0))

    # Inside r_s is not part of the same Euclidean embedding surface. For
    # visualization we use a smooth, almost-flat continuation to avoid a
    # conical tip or spike at the center while preserving a near-vertical wall
    # at the event horizon.
    horizon_depth = -2.0 * np.sqrt(r_s) * 1.02
    center_depth = horizon_depth * 1.12
    s = np.clip(r / r_s, 0.0, 1.0)
    smoothstep = s * s * (3.0 - 2.0 * s)
    inner = center_depth + (horizon_depth - center_depth) * smoothstep

    field = np.where(r >= r_s, outer, inner)

    r_profile = np.linspace(0.0, extent, 320)
    z_profile_outer = -2.0 * np.sqrt(np.maximum(r_s * (r_profile - r_s), 0.0))
    s_profile = np.clip(r_profile / r_s, 0.0, 1.0)
    smoothstep_profile = s_profile * s_profile * (3.0 - 2.0 * s_profile)
    z_profile_inner = center_depth + (horizon_depth - center_depth) * smoothstep_profile
    z_profile = np.where(r_profile >= r_s, z_profile_outer, z_profile_inner)

    labels = [
        {"name": "Event Horizon", "type": "ring", "radius": float(r_s), "color": "#ffcc66"},
        {
            "name": "Photon Sphere",
            "type": "ring",
            "radius": float(1.5 * r_s),
            "color": "#ffd966",
        },
    ]

    metadata = {
        "object": "blackhole",
        "extent": float(extent),
        "event_horizon_radius": float(r_s),
        "photon_sphere_radius": float(1.5 * r_s),
    }

    graph = {
        "xLabel": "r",
        "yLabel": "z(r)",
        "title": "Flamm Embedding Curve",
        "x": r_profile.tolist(),
        "y": z_profile.tolist(),
    }

    return field, labels, [], metadata, graph


def einstein_rosen_wormhole():
    n = int(parse_float("resolution", 280, 120, 420))
    extent = parse_float("extent", 13.0, 7.0, 30.0)
    throat = parse_float("throat", 1.8, 0.6, 5.0)

    x_grid, _, r = make_grid(n=n, extent=extent)

    ratio = np.maximum(r / throat, 1.0 + 1e-9)
    # Einstein-Rosen bridge embedding profile:
    # z = +-a ln(r/a + sqrt(r^2/a^2 - 1)).
    profile = throat * np.log(ratio + np.sqrt(ratio**2 - 1.0))

    # Height map encodes both sheets by mirrored sign across x=0.
    field = 2.0 * profile * np.tanh(x_grid / 0.38)

    r_profile = np.linspace(throat, extent, 320)
    ratio_profile = np.maximum(r_profile / throat, 1.0 + 1e-9)
    z_profile = throat * np.log(ratio_profile + np.sqrt(ratio_profile**2 - 1.0))

    labels = [
        {"name": "Wormhole Throat", "type": "ring", "radius": float(throat), "color": "#ffcc66"}
    ]

    metadata = {
        "object": "wormhole",
        "extent": float(extent),
        "throat_radius": float(throat),
    }

    graph = {
        "xLabel": "r",
        "yLabel": "|z(r)|",
        "title": "Einstein-Rosen Throat Profile",
        "x": r_profile.tolist(),
        "y": z_profile.tolist(),
    }

    return field, labels, [], metadata, graph


def make_distorted_star_background(mass: float):
    rng = np.random.default_rng(7)
    stars = []
    for _ in range(180):
        x = rng.uniform(-13.0, 13.0)
        y = rng.uniform(-13.0, 13.0)
        b2 = x * x + y * y + 1.0
        # Weak-field deflection-inspired radial perturbation.
        dx = (4.0 * mass * x) / b2
        dy = (4.0 * mass * y) / b2
        stars.append([x + 0.3 * dx, y + 0.3 * dy, 3.8])
    return stars


def sample_quadratic_bezier(p0, p1, p2, count=40):
    t = np.linspace(0.0, 1.0, count)
    one_minus_t = 1.0 - t
    curve = (one_minus_t**2)[:, None] * p0 + (2.0 * one_minus_t * t)[:, None] * p1 + (t**2)[:, None] * p2
    return curve


def build_backward_ray(observer_xy, image_xy, source_xy):
    observer = np.array([observer_xy[0], observer_xy[1], 6.4])
    image = np.array([image_xy[0], image_xy[1], 2.9])
    source = np.array([source_xy[0], source_xy[1], 0.8])

    # Backward ray trace approximation: observer -> lens/image plane -> source plane.
    c1 = np.array([
        0.7 * observer_xy[0] + 0.3 * image_xy[0],
        0.7 * observer_xy[1] + 0.3 * image_xy[1],
        4.8,
    ])
    c2 = np.array([
        0.35 * source_xy[0] + 0.65 * image_xy[0],
        0.35 * source_xy[1] + 0.65 * image_xy[1],
        1.9,
    ])

    seg_a = sample_quadratic_bezier(observer, c1, image, count=46)
    seg_b = sample_quadratic_bezier(image, c2, source, count=46)
    return np.vstack([seg_a[:-1], seg_b]).tolist()


def raytrace_lensing_paths(mass: float, source_xy, observer_xy):
    # Thin-lens equation in geometrized units (G=c=1):
    # alpha = 4M / b, vector form beta = theta - theta_E^2 * theta / |theta|^2
    theta_max = 6.2
    samples = 180
    tx = np.linspace(-theta_max, theta_max, samples)
    ty = np.linspace(-theta_max, theta_max, samples)
    theta_x, theta_y = np.meshgrid(tx, ty)
    theta2 = theta_x**2 + theta_y**2 + 1e-6

    alpha_x = 4.0 * mass * theta_x / theta2
    alpha_y = 4.0 * mass * theta_y / theta2
    beta_x = theta_x - alpha_x
    beta_y = theta_y - alpha_y

    sx, sy = source_xy
    source_sigma = 0.35
    dist2 = (beta_x - sx) ** 2 + (beta_y - sy) ** 2
    brightness = np.exp(-dist2 / (2.0 * source_sigma**2))

    flat_idx = np.argsort(brightness.ravel())[::-1]
    selected = []
    min_sep = 0.22
    for idx in flat_idx:
        if brightness.ravel()[idx] < 0.38:
            break
        i, j = np.unravel_index(idx, brightness.shape)
        candidate = np.array([theta_x[i, j], theta_y[i, j]])
        if all(np.linalg.norm(candidate - prev) > min_sep for prev in selected):
            selected.append(candidate)
        if len(selected) >= 22:
            break

    paths = [build_backward_ray(observer_xy, image_xy=point, source_xy=source_xy) for point in selected]
    image_points = [point.tolist() for point in selected]
    return paths, image_points


def gravitational_lensing():
    n = int(parse_float("resolution", 240, 120, 420))
    extent = parse_float("extent", 13.0, 7.0, 30.0)
    mass = parse_float("mass", 1.2, 0.5, 5.0)
    source_x = parse_float("sourceX", 0.15, -4.8, 4.8)
    source_y = parse_float("sourceY", 0.0, -4.8, 4.8)
    observer_x = parse_float("observerX", -6.0, -10.0, 10.0)
    observer_y = parse_float("observerY", 0.0, -8.0, 8.0)

    _, _, r = make_grid(n=n, extent=extent)

    # Potential-like embedding proxy for lensing mass.
    field = -5.5 * mass / np.sqrt(r**2 + 2.0**2)

    source_xy = np.array([source_x, source_y])
    observer_xy = np.array([observer_x, observer_y])

    rays, image_points = raytrace_lensing_paths(mass=mass, source_xy=source_xy, observer_xy=observer_xy)

    beta_mag = float(np.sqrt(source_x**2 + source_y**2))
    einstein_ring_radius = float(np.sqrt(max(4.0 * mass, 1e-6)))
    stars = make_distorted_star_background(mass=mass)

    b = np.linspace(0.8, 10.0, 320)
    alpha = 4.0 * mass / b

    labels = [
        {
            "name": "Einstein Ring",
            "type": "ring",
            "radius": float(einstein_ring_radius),
            "color": "#ffd966",
        },
        {
            "name": "Lens Mass",
            "type": "point",
            "position": [0.0, 0.0, 0.0],
            "color": "#ffd966",
        },
        {
            "name": "Observer",
            "type": "point",
            "position": [float(observer_x), float(observer_y), 0.0],
            "color": "#9fd6ff",
        },
        {
            "name": "Source Galaxy",
            "type": "point",
            "position": [float(source_x), float(source_y), 0.0],
            "color": "#ff9db3",
        },
    ]

    metadata = {
        "object": "lensing",
        "extent": float(extent),
        "einstein_ring_radius": float(einstein_ring_radius),
        "source": [float(source_x), float(source_y)],
        "observer": [float(observer_x), float(observer_y)],
        "alignment": float(beta_mag),
        "image_points": image_points,
        "stars": stars,
    }

    graph = {
        "xLabel": "Impact parameter b",
        "yLabel": "Deflection alpha",
        "title": "Weak-Field Light Deflection",
        "x": b.tolist(),
        "y": alpha.tolist(),
    }

    return field, labels, rays, metadata, graph


def neutron_star():
    n = int(parse_float("resolution", 240, 120, 420))
    extent = parse_float("extent", 12.0, 7.0, 30.0)
    mass = parse_float("mass", 1.5, 0.7, 4.0)
    radius = parse_float("radius", 2.4, 0.8, 6.0)

    _, _, r = make_grid(n=n, extent=extent)

    # Finite compact-star well: steep but non-singular.
    field = -(6.0 * mass) / np.sqrt(r**2 + radius**2)

    rr = np.linspace(0.0, extent, 320)
    zz = -(6.0 * mass) / np.sqrt(rr**2 + radius**2)

    labels = [
        {"name": "Neutron Star Surface (model)", "type": "ring", "radius": float(radius), "color": "#ffcc66"}
    ]

    metadata = {
        "object": "neutron_star",
        "extent": float(extent),
        "star_radius": float(radius),
        "pulsar_beam": True,
    }

    graph = {
        "xLabel": "r",
        "yLabel": "z(r)",
        "title": "Compact-Star Curvature Profile",
        "x": rr.tolist(),
        "y": zz.tolist(),
    }

    return field, labels, [], metadata, graph


def binary_black_hole():
    n = int(parse_float("resolution", 250, 120, 420))
    extent = parse_float("extent", 14.0, 8.0, 35.0)
    mass_1 = parse_float("mass1", 1.35, 0.6, 5.0)
    mass_2 = parse_float("mass2", 1.15, 0.6, 5.0)
    separation = parse_float("separation", 8.0, 2.5, 14.0)
    t = parse_float("t", 0.0, -1e9, 1e9)

    x_grid, y_grid, _ = make_grid(n=n, extent=extent)

    orbit_radius = separation / 2.0
    omega = 0.85
    phase = omega * t

    x1 = orbit_radius * np.cos(phase)
    y1 = orbit_radius * np.sin(phase)
    x2 = -x1
    y2 = -y1

    soft = 0.9
    r1 = np.sqrt((x_grid - x1) ** 2 + (y_grid - y1) ** 2 + soft**2)
    r2 = np.sqrt((x_grid - x2) ** 2 + (y_grid - y2) ** 2 + soft**2)

    base = -6.2 * (mass_1 / r1 + mass_2 / r2)

    # Ripple-like far-field wave proxy (educational, not full NR waveform).
    radial = np.sqrt(x_grid**2 + y_grid**2)
    wave = 0.55 * np.sin(2.7 * radial - 2.4 * t) * np.exp(-0.11 * radial)
    field = base + wave

    x_line = np.linspace(-extent, extent, 320)
    z_line = np.interp(x_line, x_grid[n // 2, :], field[n // 2, :])

    labels = [
        {"name": "BH 1", "type": "point", "position": [float(x1), float(y1), 0.0], "color": "#ffd966"},
        {"name": "BH 2", "type": "point", "position": [float(x2), float(y2), 0.0], "color": "#ffd966"},
    ]

    metadata = {
        "object": "binary",
        "extent": float(extent),
        "positions": [[float(x1), float(y1)], [float(x2), float(y2)]],
        "time": float(t),
    }

    graph = {
        "xLabel": "x (y=0 slice)",
        "yLabel": "z(x,0)",
        "title": "Binary Curvature Slice",
        "x": x_line.tolist(),
        "y": z_line.tolist(),
    }

    return field, labels, [], metadata, graph


def model_explanation(object_name: str):
    entries = {
        "blackhole": {
            "title": "Schwarzschild Black Hole",
            "physics": "Non-rotating mass creates Schwarzschild geometry; spatial slices form the Flamm funnel.",
            "equation": "z = ±2*sqrt(rs*(r-rs)), r >= rs",
            "wikipedia": "https://en.wikipedia.org/wiki/Schwarzschild_metric",
            "image": {
                "url": "https://upload.wikimedia.org/wikipedia/commons/4/4f/Black_hole_-_Messier_87_crop_max_res.jpg",
                "credit": "Event Horizon Telescope Collaboration",
            },
        },
        "wormhole": {
            "title": "Einstein-Rosen Wormhole",
            "physics": "An embedding-style bridge with a minimum throat radius connecting two sheets.",
            "equation": "z = ±a*ln(r/a + sqrt(r^2/a^2 - 1))",
            "wikipedia": "https://en.wikipedia.org/wiki/Wormhole",
            "image": {
                "url": "https://upload.wikimedia.org/wikipedia/commons/e/e8/Schwarzschild_wormhole_embedding.svg",
                "credit": "Wikimedia Commons",
            },
        },
        "lensing": {
            "title": "Gravitational Lensing",
            "physics": "Light geodesics bend in curved spacetime, producing arcs and Einstein rings for alignment.",
            "equation": "alpha_hat ≈ 4GM/(c^2 b)",
            "wikipedia": "https://en.wikipedia.org/wiki/Gravitational_lens",
            "image": {
                "url": "https://upload.wikimedia.org/wikipedia/commons/9/9b/Abell_370_galaxy_lensing.jpg",
                "credit": "NASA/ESA Hubble",
            },
        },
        "neutron_star": {
            "title": "Neutron Star Curvature",
            "physics": "Extreme compactness yields strong but finite curvature, less singular than BH horizons.",
            "equation": "z ∝ -M/sqrt(r^2 + R^2)",
            "wikipedia": "https://en.wikipedia.org/wiki/Neutron_star",
            "image": {
                "url": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Neutron_star_cross_section.svg",
                "credit": "Wikimedia Commons",
            },
        },
        "binary": {
            "title": "Binary Black Hole System",
            "physics": "Two orbiting compact objects produce interacting wells and wave-like far-field perturbations.",
            "equation": "Phi ≈ -GM1/r1 - GM2/r2 + wave term",
            "wikipedia": "https://en.wikipedia.org/wiki/Binary_black_hole",
            "image": {
                "url": "https://upload.wikimedia.org/wikipedia/commons/5/5e/GW150914_waveform_overview.png",
                "credit": "LIGO Scientific Collaboration",
            },
        },
    }
    return entries.get(object_name, entries["blackhole"])


MODELS = {
    "blackhole": schwarzschild_black_hole,
    "wormhole": einstein_rosen_wormhole,
    "lensing": gravitational_lensing,
    "neutron_star": neutron_star,
    "binary": binary_black_hole,
}


@app.route("/", methods=["GET"])
def index():
    return jsonify(
        {
            "service": "spacetime-curvature-backend",
            "status": "ok",
            "endpoints": {
                "simulate": "/simulate?object=blackhole",
                "health": "/health",
            },
        }
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/simulate", methods=["GET"])
def simulate():
    object_name = request.args.get("object", "blackhole").strip().lower()
    generator = MODELS.get(object_name, schwarzschild_black_hole)

    field, labels, rays, metadata, graph = generator()

    # Compact educational quality indicator for UI (not strict validation proof).
    magnitude = np.abs(field)
    central = float(np.mean(magnitude[field.shape[0] // 2 - 3 : field.shape[0] // 2 + 3, field.shape[1] // 2 - 3 : field.shape[1] // 2 + 3]))
    mean_all = float(np.mean(magnitude)) + 1e-9
    score = float(max(70.0, min(98.0, 76.0 + 14.0 * (central / mean_all - 1.0))))

    return jsonify(
        {
            "object": object_name,
            "size": int(field.shape[0]),
            "field": field.tolist(),
            "rays": rays,
            "labels": labels,
            "metadata": metadata,
            "graph": graph,
            "reference": model_explanation(object_name),
            "verification": {
                "framework": "General Relativity educational embeddings",
                "score": round(score, 1),
                "checks": [
                    {
                        "name": "Central Curvature Concentration",
                        "value": round(central / mean_all, 3),
                        "target": "> 1",
                        "pass": central / mean_all > 1.0,
                        "note": "Curvature should increase near compact mass regions.",
                    }
                ],
                "summary": "Model is based on known GR-inspired embedding/deflection equations.",
                "disclaimer": "Educational simulator: not a full numerical relativity solver.",
            },
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
