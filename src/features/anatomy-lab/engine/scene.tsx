import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createExplosionLayout } from "./explosion-layout";
import { decodeModelResponse } from "./model-download";
import { PointerTap } from "./pointer-tap";
import { SYSTEMS, type Atlas, type SceneState } from "./anatomy";
interface Props {
  atlas: Atlas;
  state: SceneState;
  onSelect: (id: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
}
export default function AnatomyScene({ atlas, state, onSelect, onProgress, onError }: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(state),
    select = useRef(onSelect);
  latest.current = state;
  select.current = onSelect;
  // The scene is built once per atlas. onSelect is read through the `select` ref; onProgress
  // and onError are invoked directly. Depending on them would tear down and rebuild the entire
  // WebGL scene on parent re-renders — the reinitialization we deliberately avoid.
  useEffect(() => {
    const el = host.current!;
    let disposed = false,
      frame = 0,
      dirty = true,
      ready = false,
      lastView = "",
      lastReset = -1,
      lastIsolate = "",
      layoutKey = "",
      amount = 0;
    let lastState: SceneState | null = null;
    const abort = new AbortController();
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      onError(
        "This browser could not start the 3D viewer. Please try a browser with WebGL enabled.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor("#34373d");
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.",
    );
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(34, 1, 0.005, 100),
      controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener("change", () => {
      dirty = true;
    });
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();
    // Soft neutral gradient backdrop — a calm medical-visualization grey that keeps both
    // dark-red vessels and pale bone/nerve legible, with a touch of depth. It replaces the
    // old near-white clear colour that washed out light-coloured structures.
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = bgCanvas.height = 64;
    const bgCtx = bgCanvas.getContext("2d")!;
    const bgGrad = bgCtx.createRadialGradient(32, 26, 4, 32, 34, 48);
    bgGrad.addColorStop(0, "#64686f");
    bgGrad.addColorStop(1, "#303338");
    bgCtx.fillStyle = bgGrad;
    bgCtx.fillRect(0, 0, 64, 64);
    const bgTexture = new T.CanvasTexture(bgCanvas);
    bgTexture.colorSpace = T.SRGBColorSpace;
    scene.background = bgTexture;
    scene.add(new T.HemisphereLight(0xeef1f6, 0x5b5f66, 0.72));
    const key = new T.DirectionalLight(0xfff6ec, 2.15);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const rim = new T.DirectionalLight(0xdfe8ff, 1.5);
    rim.position.set(2, 2, -3);
    scene.add(rim);
    // Gentle frontal fill so structures facing the camera keep readable surface detail
    // against the darker backdrop without washing out.
    const fill = new T.DirectionalLight(0xf3f0ff, 0.6);
    fill.position.set(0, 1.2, 4);
    scene.add(fill);
    // No ground plane or platform: the model floats on the gradient backdrop so the underside
    // of every structure stays visible from any orbit angle.
    const width = T.MathUtils.ceilPowerOfTwo(atlas.parts.length),
      data = new Float32Array(width * 4),
      partTexture = new T.DataTexture(data, width, 1, T.RGBAFormat, T.FloatType);
    partTexture.needsUpdate = true;
    const selectedData = new Uint8Array(width * 4),
      selectionTexture = new T.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;
    const materials: T.Material[] = [],
      geometries: T.BufferGeometry[] = [],
      pickers: (T.Mesh | undefined)[] = [],
      centers = atlas.parts.map((p) =>
        new T.Vector3()
          .fromArray(p.bounds[0])
          .add(new T.Vector3().fromArray(p.bounds[1]))
          .multiplyScalar(0.5),
      );
    const offsets: T.Vector3[] = [],
      bounds = atlas.parts.map(
        (p) =>
          new T.Box3(
            new T.Vector3().fromArray(p.bounds[0]),
            new T.Vector3().fromArray(p.bounds[1]),
          ),
      );
    let packingWidth = 1,
      packingHeight = 1;
    const markerPositions = new Float32Array(atlas.parts.length * 3),
      markerGeometry = new T.BufferGeometry();
    markerGeometry.setAttribute("position", new T.BufferAttribute(markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({
      color: 0x64748b,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    });
    markerMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;",
      );
    };
    const markers = new T.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);
    const hover = document.createElement("div");
    hover.className = "part-hover";
    hover.setAttribute("role", "tooltip");
    hover.hidden = true;
    el.appendChild(hover);
    type Target = {
      index: number;
      x: number;
      y: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    let targets: Target[] = [];
    const projected = new T.Vector3();
    const findTarget = (x: number, y: number, radius: number) => {
      let best = -1,
        score = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right),
          dy = Math.max(t.top - y, 0, y - t.bottom),
          distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
        if (candidate < score) {
          score = candidate;
          best = t.index;
        }
      }
      return best;
    };
    const materialFor = (system: string) => {
      const m = new T.MeshStandardMaterial({
        color: SYSTEMS.find((s) => s.id === system)?.color ?? "#aebbb8",
        metalness: 0.0,
        roughness: 0.62,
        envMapIntensity: 0.55,
        side: T.DoubleSide,
        transparent: system === "integumentary",
        opacity: system === "integumentary" ? 0.1 : 1,
        depthWrite: system !== "integumentary",
      });
      m.onBeforeCompile = (shader) => {
        shader.uniforms["partState"] = { value: partTexture };
        shader.uniforms["selectionState"] = { value: selectionTexture };
        shader.uniforms["stateWidth"] = { value: width };
        shader.vertexShader =
          "attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected; varying float partShade;\n" +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r; partShade = fract(sin(partIndex * 12.9898) * 43758.5453);",
        );
        shader.fragmentShader =
          "varying float partVisible; varying float partSelected; varying float partShade;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;",
        );
        // Every structure keeps its full anatomical colour in all views (full-body, system,
        // isolated and exploded) and in both selected and unselected states — the fill is
        // never repainted. A small per-part lightness shift separates neighbouring pieces of
        // the same system so a multi-part organ never reads as one flat blob.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb *= mix(0.84, 1.08, partShade);",
        );
        // Selection highlight = a light-blue edge rim only (a fresnel glow on the silhouette),
        // so arteries stay red, veins blue, bone ivory, etc. while still clearly reading as
        // selected. Nothing tints the surface, so isolating never turns a structure blue.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\nfloat selRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);\ntotalEmissiveRadiance += vec3(0.32, 0.64, 1.0) * selRim * partSelected * 1.1;",
        );
      };
      materials.push(m);
      return m;
    };
    const mats = new Map(SYSTEMS.map((s) => [s.id, materialFor(s.id)]));
    let loaded = 0;
    const loadChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci]!,
        compressed = !!chunk.gzip && typeof DecompressionStream !== "undefined";
      const response = await fetch(compressed ? chunk.gzip! : chunk.url, { signal: abort.signal });
      const buffer = await decodeModelResponse(response, chunk.bytes, compressed);
      if (disposed) return;
      const groups = new Map<string, T.BufferGeometry[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3),
        );
        // GPU normalized signed-short normals keep the complete atlas compact in memory.
        g.setAttribute(
          "normal",
          new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true),
        );
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i]!.clone();
        g.computeBoundingSphere();
        const pick = new T.Mesh(g);
        pick.matrixAutoUpdate = false;
        pickers[i] = pick;
        geometries.push(g);
        g.setAttribute(
          "partIndex",
          new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1),
        );
        const list = groups.get(p.system) ?? [];
        list.push(g);
        groups.set(p.system, list);
      });
      groups.forEach((gs, system) => {
        const geometry = mergeGeometries(gs, false);
        if (!geometry) throw new Error("Could not assemble anatomy geometry.");
        geometries.push(geometry);
        const mesh = new T.Mesh(geometry, mats.get(system as never));
        mesh.frustumCulled = false;
        scene.add(mesh);
      });
      lastState = null;
      loaded++;
      onProgress(Math.round((loaded / atlas.chunks.length) * 100));
      dirty = true;
    };
    (async () => {
      try {
        let cursor = 0;
        await Promise.all(
          Array.from({ length: 3 }, async () => {
            while (cursor < atlas.chunks.length) {
              const i = cursor++;
              await loadChunk(i);
            }
          }),
        );
        if (!disposed) {
          ready = true;
          dirty = true;
        }
      } catch (e) {
        if (!disposed) onError(e instanceof Error ? e.message : "Could not load the anatomy.");
      }
    })();
    const fit = (view: string, extent = 0) => {
      const aspect = camera.aspect,
        mobile = el.clientWidth < 768,
        normalDistance = mobile
          ? Math.max(
              4.5,
              (1.8 * el.clientHeight) /
                Math.max(160, el.clientHeight - 350) /
                (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))),
            )
          : 4;
      const reservedHeight = mobile ? 350 : 270;
      const availableAspect = Math.max(
        0.35,
        (el.clientWidth - (mobile ? 40 : 340)) / Math.max(160, el.clientHeight - reservedHeight),
      );
      const atlasDistance =
        (Math.max(packingHeight, packingWidth / availableAspect) /
          (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
        (el.clientHeight / Math.max(160, el.clientHeight - reservedHeight)) *
        1.08;
      const distance = T.MathUtils.lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
      if (extent > 0.8) view = "front";
      const direction =
        view === "front"
          ? new T.Vector3(0, 0.02, 1)
          : view === "back"
            ? new T.Vector3(0, 0.02, -1)
            : view === "side"
              ? new T.Vector3(1, 0.02, 0)
              : new T.Vector3(0.35, 0.06, 1).normalize();
      controls.target.set(
        extent > 0.1 && el.clientWidth > 767 ? -packingWidth * 0.12 : 0,
        extent > 0.1 || mobile ? 0.85 : 0.68,
        0,
      );
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update();
      dirty = true;
    };
    const resize = () => {
      layoutKey = "";
      lastState = null;
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2),
      );
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      fit(latest.current.view, amount);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const raycaster = new T.Raycaster(),
      pointer = new T.Vector2(),
      tap = new PointerTap(),
      worldBox = new T.Box3(),
      hitPoint = new T.Vector3();
    const down = (e: PointerEvent) => {
      hover.hidden = true;
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch" ? 12 : 5);
    };
    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || amount < 0.5 || e.pointerType === "touch") {
        hover.hidden = true;
        return;
      }
      const rect = el.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top,
        index = findTarget(x, y, 12);
      hover.hidden = index < 0;
      renderer.domElement.style.cursor = index < 0 ? "grab" : "pointer";
      if (index >= 0) {
        hover.textContent = atlas.parts[index]!.name;
        hover.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 260))}px`;
        hover.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 55))}px`;
      }
    };
    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    const up = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity,
        found = -1;
      const hasSolid = atlas.parts.some(
        (p, i) => p.system !== "integumentary" && data[i * 4 + 3]! > 0.5,
      );
      pickers.forEach((mesh, i) => {
        if (
          !mesh ||
          data[i * 4 + 3]! < 0.5 ||
          (hasSolid && atlas.parts[i]!.system === "integumentary")
        )
          return;
        worldBox.copy(bounds[i]!).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          found = i;
        }
      });
      if (found < 0 && amount > 0.45)
        found = findTarget(
          e.clientX - rect.left,
          e.clientY - rect.top,
          e.pointerType === "touch" ? 24 : 16,
        );
      if (found >= 0) {
        hover.hidden = true;
        select.current(atlas.parts[found]!.id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    const clock = new T.Clock();
    let lastExtent = -1;
    let hadVisible = false;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05),
        s = latest.current;
      const changed =
        lastState?.visible !== s.visible ||
        lastState?.selected !== s.selected ||
        lastState?.isolate !== s.isolate;
      const moving = Math.abs(amount - s.explode) > 0.0001;
      if (moving) {
        amount = T.MathUtils.damp(amount, s.explode, 8, dt);
        dirty = true;
      }
      // Focus = isolation, OR a plain selection. A focused structure keeps the camera on it in
      // EVERY state — including while disassembling — so it never snaps back to the small,
      // full-body framing. The generic/explode fits below are skipped whenever we're focused.
      const focusing = s.isolate || s.selected.length > 0;
      const focusIds = s.isolate ? s.isolateSet : s.selected;
      if (changed || moving || lastExtent < 0) {
        const visible = new Set(s.visible),
          selection = new Set(s.selected),
          isolateSet = new Set(s.isolateSet);
        // Isolation shows the frozen isolate set, NOT the live selection. This keeps every
        // isolated part on screen (and in its exploded position) while the student clicks
        // between them to inspect each one.
        const visibleParts = atlas.parts.filter((p) =>
          s.isolate ? isolateSet.has(p.id) : visible.has(p.system) || selection.has(p.id),
        );
        const nowHasVisible = visibleParts.length > 0;
        if (nowHasVisible && !hadVisible && !focusing) fit(s.view, amount);
        hadVisible = nowHasVisible;
        const nextLayoutKey =
          visibleParts.map((p) => p.id).join(",") + ":" + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new T.Vector3(cell.x, cell.y + 0.85, 0) : centers[i]!.clone();
          });
          layoutKey = nextLayoutKey;
          if (amount > 0.05 && !focusing) fit(s.view, Math.max(0, (amount - 0.3) / 0.7));
        }

        atlas.parts.forEach((p, i) => {
          const c = centers[i]!,
            destination = offsets[i]!;
          let dx = 0,
            dy = 0,
            dz = 0;
          if (amount <= 0.45) {
            const t = amount / 0.45;
            const group = SYSTEMS.findIndex((sys) => sys.id === p.system);
            const angle = (group / SYSTEMS.length) * Math.PI * 2;
            dx = Math.sin(angle) * t * 0.48;
            dy = (c.y - 0.85) * t * 0.28;
            dz = Math.cos(angle) * t * 0.48;
          } else {
            const t = (amount - 0.45) / 0.55,
              group = SYSTEMS.findIndex((sys) => sys.id === p.system),
              angle = (group / SYSTEMS.length) * Math.PI * 2;
            dx = T.MathUtils.lerp(Math.sin(angle) * 0.48, destination.x - c.x, t);
            dy = T.MathUtils.lerp((c.y - 0.85) * 0.28, destination.y - c.y, t);
            dz = T.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
          }
          const selected = selection.has(p.id);
          data.set(
            [
              dx,
              dy,
              dz,
              (s.isolate ? isolateSet.has(p.id) : visible.has(p.system) || selected) ? 1 : 0,
            ],
            i * 4,
          );
          selectedData[i * 4] = selected ? 255 : 0;
          markerPositions.set(
            data[i * 4 + 3]! > 0.5 ? [c.x + dx, c.y + dy, c.z + dz] : [10000, 10000, 10000],
            i * 3,
          );
          const mesh = pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });
        partTexture.needsUpdate = true;
        selectionTexture.needsUpdate = true;
        markerGeometry.attributes["position"]!.needsUpdate = true;
        lastState = s;
        lastExtent = amount;
        dirty = true;
      }
      if (s.view !== lastView || s.reset !== lastReset) {
        fit(s.view, amount);
        lastView = s.view;
        lastReset = s.reset;
      }
      if (moving && !focusing)
        fit(amount > 0.5 ? "front" : s.view, Math.max(0, (amount - 0.3) / 0.7));
      // While focused, re-frame on the focus box every frame it moves (explode included) so the
      // structure stays centred and fills the view — the box already follows exploded offsets.
      const focusKey = focusing
        ? (s.isolate ? "i:" : "s:") +
          focusIds.join(",") +
          ":" +
          s.reset +
          ":" +
          s.inspectorOpen +
          ":" +
          camera.aspect
        : "";
      if (focusKey !== lastIsolate || (focusing && moving)) {
        if (focusing) {
          const box = new T.Box3();
          atlas.parts.forEach((p, i) => {
            if (focusIds.includes(p.id))
              box.union(
                bounds[i]!.clone().translate(
                  new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]),
                ),
              );
          });
          if (!box.isEmpty()) {
            const center = box.getCenter(new T.Vector3()),
              size = box.getSize(new T.Vector3());
            const w = el.clientWidth,
              h = el.clientHeight,
              mobile = w < 768,
              landscape = w > h && h <= 600;
            let left = 20,
              right = w - 20,
              top = mobile ? 175 : 110,
              bottom = h - 170;
            if (s.inspectorOpen) {
              if (landscape) {
                right = w - 335;
                top = 100;
                bottom = h - 125;
              } else if (mobile) {
                const sheet = document.querySelector(".detail-sheet")?.getBoundingClientRect(),
                  header = document.querySelector(".identity")?.getBoundingClientRect();
                top = (header?.bottom ?? 94) + 16;
                bottom = (sheet?.top ?? h * 0.58 - 139) - 16;
              } else {
                right = w - 370;
                left = w > 1100 ? 285 : 25;
              }
            }
            const availableWidth = Math.max(150, right - left),
              availableHeight = Math.max(40, bottom - top);
            camera.setViewOffset(
              w,
              h,
              w / 2 - (left + right) / 2,
              h / 2 - (top + bottom) / 2,
              w,
              h,
            );
            const distance = Math.max(
              0.07,
              (Math.max(
                (size.y * h) / availableHeight,
                (size.x * w) / availableWidth / camera.aspect,
                size.z,
              ) /
                (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
                1.35,
            );
            controls.maxDistance = Math.max(40, distance * 2);
            controls.target.copy(center);
            camera.position
              .copy(center)
              .add(new T.Vector3(0.2, 0.1, 1).normalize().multiplyScalar(distance));
            controls.update();
            dirty = true;
          }
        } else if (lastIsolate) {
          camera.clearViewOffset();
          fit(s.view, amount);
        }
        lastIsolate = focusKey;
      }
      controls.enableRotate = amount < 0.8;
      controls.mouseButtons.LEFT = amount < 0.8 ? T.MOUSE.ROTATE : T.MOUSE.PAN;
      controls.touches.ONE = amount < 0.8 ? T.TOUCH.ROTATE : T.TOUCH.PAN;
      markers.visible = amount > 0.75;
      controls.autoRotate = s.rotate && !s.isolate && amount < 0.4;
      controls.autoRotateSpeed = 0.65;
      controls.update();
      if (controls.autoRotate) dirty = true;
      if (dirty) {
        renderer.render(scene, camera);
        targets = [];
        if (amount > 0.45) {
          const hasSolid = atlas.parts.some(
            (p, i) => p.system !== "integumentary" && data[i * 4 + 3]! > 0.5,
          );
          atlas.parts.forEach((p, i) => {
            if (data[i * 4 + 3]! < 0.5 || (hasSolid && p.system === "integumentary")) return;
            let left = Infinity,
              right = -Infinity,
              top = Infinity,
              bottom = -Infinity;
            for (let corner = 0; corner < 8; corner++) {
              projected
                .set(
                  p.bounds[corner & 1 ? 1 : 0][0] + data[i * 4]!,
                  p.bounds[corner & 2 ? 1 : 0][1] + data[i * 4 + 1]!,
                  p.bounds[corner & 4 ? 1 : 0][2] + data[i * 4 + 2]!,
                )
                .project(camera);
              const x = ((projected.x + 1) * el.clientWidth) / 2,
                y = ((1 - projected.y) * el.clientHeight) / 2;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
            projected
              .copy(centers[i]!)
              .add(new T.Vector3(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]))
              .project(camera);
            if (projected.z < -1 || projected.z > 1) return;
            targets.push({
              index: i,
              x: ((projected.x + 1) * el.clientWidth) / 2,
              y: ((1 - projected.y) * el.clientHeight) / 2,
              left,
              right,
              top,
              bottom,
            });
          });
        }
        dirty = false;
      }
    };
    animate();
    const contextLost = (e: Event) => {
      e.preventDefault();
      onError("The 3D session was paused by your device. Reload to continue.");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      scene.traverse((o) => {
        if (o instanceof T.Mesh && !geometries.includes(o.geometry)) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
      });
      env.dispose();
      bgTexture.dispose();
      partTexture.dispose();
      selectionTexture.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      hover.remove();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas]);
  return <div className="scene" ref={host} />;
}
