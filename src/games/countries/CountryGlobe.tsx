import { useEffect, useMemo, useRef } from 'preact/hooks'
import {
  CanvasTexture,
  CircleGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'
import { detailedCountryFeatures, detailedCountryIds } from './detailedGeometry'

// Shared marker resources: constant geometry/material parameters are created
// once per page load and reused by every question's markers. They must never
// be disposed, even when the globe scene is torn down.
const contextMarkerGeometry = new CircleGeometry(0.004, 10)
const targetMarkerGeometry = new CircleGeometry(0.01, 16)
const contextMarkerMaterial = new MeshBasicMaterial({
  color: 0x243330,
  side: DoubleSide,
})
const targetMarkerMaterial = new MeshBasicMaterial({
  color: 0xd0a34e,
  side: DoubleSide,
})
const smallCountryMarkerGeometry = new RingGeometry(0.075, 0.105, 40)
const smallCountryMarkerMaterial = new MeshBasicMaterial({
  color: 0x78966f,
  side: DoubleSide,
  depthTest: false,
})

type GlobeSceneHandles = {
  globe: Group
  sphere: Mesh
  markerGroup: Group
  camera: PerspectiveCamera
  controls: OrbitControls
  createdTextures: Set<CanvasTexture>
  requestRender: () => void
}

type Geometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
type MapFeature = {
  id?: string | number
  geometry: Geometry
}
type FeatureCollection = {
  features: MapFeature[]
}

export type GlobeMarker = {
  id: string
  position: [longitude: number, latitude: number]
  role: 'target' | 'context'
}

export type GlobePick = {
  /** ccn3 id of the clicked country, or null for open ocean. */
  countryId: string | null
  /** Screen distance in CSS pixels from the click to the target's focus point. */
  pixelsFromTarget: number
  screen: { x: number; y: number }
}

type CountryGlobeProps = {
  countryId: string
  countryName: string
  focus: [longitude: number, latitude: number]
  showSmallCountryMarker?: boolean
  isIslandNation: boolean
  showIslandEnvelope: boolean
  highlightCountry?: boolean
  markers?: GlobeMarker[]
  cameraDistance?: number
  /** Stop the player zooming back out (used for streak close-ups). */
  lockZoom?: boolean
  /** Point the globe faces at the start instead of `focus`. */
  startFocus?: [longitude: number, latitude: number]
  /** Called when the player clicks (not drags) the globe. */
  onPick?: (pick: GlobePick) => void
  resetSignal: number
  onTargetPosition?: (position: { x: number; y: number }) => void
}

const GLOBE_RADIUS = 2
const MAP_WIDTH = 2048
const MAP_HEIGHT = 1024
const MAX_RENDER_PIXELS = 1_500_000
const mapCanvasCache = new Map<string, HTMLCanvasElement>()
let worldMapCache: FeatureCollection | null = null
let baseMapCanvasCache: HTMLCanvasElement | null = null

// Tiny LRU of rasterized highlight canvases. Atlas rasterization is the
// expensive step; wrong answers tend to re-queue the same country later in a
// round, so a cache hit avoids re-rendering the full atlas.
const MAP_CANVAS_CACHE_LIMIT = 3
const insetMapCache = new Map<string, string>()
let sharedBaseMapTexture: CanvasTexture | null = null

function cacheMapCanvas(key: string, canvas: HTMLCanvasElement) {
  mapCanvasCache.delete(key) // re-insert to refresh recency
  mapCanvasCache.set(key, canvas)
  if (mapCanvasCache.size > MAP_CANVAS_CACHE_LIMIT) {
    const oldestKey = mapCanvasCache.keys().next().value
    if (oldestKey !== undefined) mapCanvasCache.delete(oldestKey)
  }
}

function readMapCanvas(key: string) {
  const canvas = mapCanvasCache.get(key)
  if (!canvas) return null
  mapCanvasCache.delete(key) // refresh recency
  mapCanvasCache.set(key, canvas)
  return canvas
}

function getWorldMap() {
  if (worldMapCache) return worldMapCache
  const topology = world as unknown as {
    objects: { countries: unknown }
  }
  worldMapCache = feature(
    world as never,
    topology.objects.countries as never,
  ) as unknown as FeatureCollection
  return worldMapCache
}

function toPoint(longitude: number, latitude: number, radius = GLOBE_RADIUS) {
  const phi = MathUtils.degToRad(90 - latitude)
  const theta = MathUtils.degToRad(longitude + 180)
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

function polygonsOf(geometry: Geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

function unwrapRing(coordinates: number[][]) {
  const result: number[][] = []
  let previousLongitude = coordinates[0]?.[0] ?? 0

  coordinates.forEach(([rawLongitude, latitude], index) => {
    let longitude = rawLongitude
    if (index > 0) {
      while (longitude - previousLongitude > 180) longitude -= 360
      while (longitude - previousLongitude < -180) longitude += 360
    }
    result.push([longitude, latitude])
    previousLongitude = longitude
  })

  return result
}

function createLandPattern(
  context: CanvasRenderingContext2D,
  background: string,
  grid: string,
) {
  const tile = document.createElement('canvas')
  tile.width = 17
  tile.height = 17
  const tileContext = tile.getContext('2d')
  if (!tileContext) return background

  tileContext.fillStyle = background
  tileContext.fillRect(0, 0, tile.width, tile.height)
  tileContext.strokeStyle = grid
  tileContext.lineWidth = 1
  tileContext.beginPath()
  tileContext.moveTo(0.5, 0)
  tileContext.lineTo(0.5, tile.height)
  tileContext.moveTo(0, 0.5)
  tileContext.lineTo(tile.width, 0.5)
  tileContext.stroke()
  return context.createPattern(tile, 'repeat') ?? background
}

function tracePolygon(
  context: CanvasRenderingContext2D,
  polygon: number[][][],
  horizontalOffset: number,
) {
  context.beginPath()
  polygon.forEach((rawRing) => {
    const ring = unwrapRing(rawRing)
    ring.forEach(([longitude, latitude], index) => {
      const x = ((longitude + 180) / 360) * MAP_WIDTH + horizontalOffset
      const y = ((90 - latitude) / 180) * MAP_HEIGHT
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
  })
}

function drawFeature(
  context: CanvasRenderingContext2D,
  mapFeature: MapFeature,
  fill: string | CanvasPattern,
  glow = false,
) {
  polygonsOf(mapFeature.geometry).forEach((polygon) => {
    ;[-MAP_WIDTH, 0, MAP_WIDTH].forEach((offset) => {
      context.save()
      tracePolygon(context, polygon, offset)
      context.fillStyle = fill
      context.fill('evenodd')
      if (glow) {
        // Cheap two-pass glow: a wide, low-alpha stroke under the dark
        // outline. shadowBlur rasterization on the atlas canvas is
        // disproportionately expensive; this looks near-identical.
        context.strokeStyle = 'rgba(109, 151, 101, 0.4)'
        context.lineWidth = 8
        context.lineJoin = 'round'
        context.stroke()
      }
      context.strokeStyle = '#17201d'
      context.lineWidth = 0.725
      context.lineJoin = 'round'
      context.stroke()
      context.restore()
    })
  })
}

function featureCoordinates(mapFeature: MapFeature) {
  return polygonsOf(mapFeature.geometry)
    .flatMap((polygon) => polygon)
    .flatMap((ring) => ring)
}

function geographicEnvelope(mapFeature: MapFeature) {
  const coordinates = featureCoordinates(mapFeature)
  const latitudes = coordinates.map((coordinate) => coordinate[1])
  const longitudes = coordinates
    .map((coordinate) => ((coordinate[0] % 360) + 360) % 360)
    .sort((first, second) => first - second)
  let largestGap = -1
  let gapIndex = 0

  longitudes.forEach((longitude, index) => {
    const next = index === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[index + 1]
    const gap = next - longitude
    if (gap > largestGap) {
      largestGap = gap
      gapIndex = index
    }
  })

  const arcStart = longitudes[(gapIndex + 1) % longitudes.length]
  const longitudeSpan = Math.max(0.4, 360 - largestGap)
  let centerLongitude = arcStart + longitudeSpan / 2
  if (centerLongitude > 180) centerLongitude -= 360
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const centerLatitude = (minLatitude + maxLatitude) / 2
  const latitudeSpan = Math.max(0.35, maxLatitude - minLatitude)
  const surfaceLongitudeSpan = longitudeSpan * Math.max(0.18, Math.cos(MathUtils.degToRad(centerLatitude)))
  const radius = Math.max(1.2, latitudeSpan / 2, surfaceLongitudeSpan / 2) + 1.25
  const longitudeRadius = radius / Math.max(0.18, Math.cos(MathUtils.degToRad(centerLatitude)))

  return { centerLongitude, centerLatitude, radius, longitudeRadius }
}

function drawIslandEnvelope(context: CanvasRenderingContext2D, mapFeature: MapFeature) {
  const envelope = geographicEnvelope(mapFeature)
  const centerX = ((envelope.centerLongitude + 180) / 360) * MAP_WIDTH
  const centerY = ((90 - envelope.centerLatitude) / 180) * MAP_HEIGHT
  const radiusX = (envelope.longitudeRadius / 360) * MAP_WIDTH
  const radiusY = (envelope.radius / 180) * MAP_HEIGHT

  context.save()
  context.strokeStyle = '#315d43'
  context.lineWidth = 1.6
  context.setLineDash([4.5, 4])
  ;[-MAP_WIDTH, 0, MAP_WIDTH].forEach((offset) => {
    context.beginPath()
    context.ellipse(centerX + offset, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
    context.stroke()
  })
  context.restore()
}

function createInsetMap(mapFeature: MapFeature) {
  const width = 320
  const height = 210
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''
  const envelope = geographicEnvelope(mapFeature)
  const coordinates = featureCoordinates(mapFeature).map(([rawLongitude, latitude]) => {
    let longitude = rawLongitude
    while (longitude - envelope.centerLongitude > 180) longitude -= 360
    while (longitude - envelope.centerLongitude < -180) longitude += 360
    return [longitude, latitude]
  })
  const longitudes = coordinates.map((coordinate) => coordinate[0])
  const latitudes = coordinates.map((coordinate) => coordinate[1])
  const minLongitude = Math.min(...longitudes)
  const maxLongitude = Math.max(...longitudes)
  const minLatitude = Math.min(...latitudes)
  const maxLatitude = Math.max(...latitudes)
  const longitudeSpan = Math.max(0.01, maxLongitude - minLongitude)
  const latitudeSpan = Math.max(0.01, maxLatitude - minLatitude)
  const horizontalPadding = 16
  const verticalPadding = 14

  context.fillStyle = '#5c8390'
  context.fillRect(0, 0, width, height)
  const pattern = createLandPattern(context, '#78966f', 'rgba(54, 61, 57, 0.18)')

  const project = ([rawLongitude, latitude]: number[]) => {
    let longitude = rawLongitude
    while (longitude - envelope.centerLongitude > 180) longitude -= 360
    while (longitude - envelope.centerLongitude < -180) longitude += 360
    return [
      horizontalPadding
        + ((longitude - minLongitude) / longitudeSpan) * (width - horizontalPadding * 2),
      height - verticalPadding
        - ((latitude - minLatitude) / latitudeSpan) * (height - verticalPadding * 2),
    ]
  }

  polygonsOf(mapFeature.geometry).forEach((polygon) => {
    context.beginPath()
    polygon.forEach((ring) => {
      ring.forEach((coordinate, index) => {
        const [x, y] = project(coordinate)
        if (index === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.closePath()
    })
    context.fillStyle = pattern
    context.fill('evenodd')
    context.strokeStyle = '#17201d'
    context.lineWidth = 2
    context.stroke()
  })

  return canvas.toDataURL('image/png')
}

function getBaseMapCanvas(map: FeatureCollection) {
  if (baseMapCanvasCache) return baseMapCanvasCache
  const canvas = document.createElement('canvas')
  canvas.width = MAP_WIDTH
  canvas.height = MAP_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return canvas

  context.fillStyle = '#5c8390'
  context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)

  // A restrained atlas-style ocean graticule.
  context.strokeStyle = 'rgba(226, 234, 228, 0.15)'
  context.lineWidth = 0.5
  for (let longitude = -180; longitude <= 180; longitude += 15) {
    const x = ((longitude + 180) / 360) * MAP_WIDTH + 0.5
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, MAP_HEIGHT)
    context.stroke()
  }
  for (let latitude = -75; latitude <= 75; latitude += 15) {
    const y = ((90 - latitude) / 180) * MAP_HEIGHT + 0.5
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(MAP_WIDTH, y)
    context.stroke()
  }

  const normalLand = createLandPattern(context, '#b1976c', 'rgba(62, 66, 63, 0.18)')
  map.features.forEach((mapFeature) => {
    const featureId = String(mapFeature.id).padStart(3, '0')
    if (detailedCountryIds.has(featureId)) return
    drawFeature(context, mapFeature, normalLand)
  })
  detailedCountryFeatures.forEach((mapFeature) => drawFeature(context, mapFeature, normalLand))

  baseMapCanvasCache = canvas
  return canvas
}

function renderMapCanvas(
  map: FeatureCollection,
  targetId: string,
  isIslandNation = false,
  highlightCountry = true,
) {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_WIDTH
  canvas.height = MAP_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.drawImage(getBaseMapCanvas(map), 0, 0)
  if (!highlightCountry) return canvas

  const targetLand = createLandPattern(context, '#78966f', 'rgba(54, 61, 57, 0.16)')
  const detailedTarget = detailedCountryFeatures.find((mapFeature) => mapFeature.id === targetId)
  const coarseTarget = map.features.find(
    (mapFeature) => String(mapFeature.id).padStart(3, '0') === targetId,
  )
  const targetFeatures = detailedTarget ? [detailedTarget] : coarseTarget ? [coarseTarget] : []

  targetFeatures.forEach((mapFeature) => drawFeature(context, mapFeature, targetLand, true))
  if (isIslandNation) targetFeatures.forEach((mapFeature) => drawIslandEnvelope(context, mapFeature))

  return canvas
}

function createMapTexture(
  map: FeatureCollection,
  targetId: string,
  isIslandNation: boolean,
  highlightCountry: boolean,
) {
  if (!highlightCountry) {
    // Base-map questions (capitals quiz) reuse one mipmapped texture built
    // from the cached base atlas instead of uploading a fresh multi-MB image
    // for every question. The sibling lifecycle PR skips disposing textures
    // flagged with userData.isSharedBaseMap; this code never disposes it.
    if (sharedBaseMapTexture) return sharedBaseMapTexture
    const texture = new CanvasTexture(getBaseMapCanvas(map))
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = true
    texture.minFilter = LinearMipmapLinearFilter
    texture.magFilter = LinearFilter
    texture.userData.isSharedBaseMap = true
    sharedBaseMapTexture = texture
    return texture
  }

  const cacheKey = `${targetId}-${isIslandNation ? 'island' : 'land'}-hl`
  const canvas = readMapCanvas(cacheKey) ?? renderMapCanvas(map, targetId, isIslandNation, true)
  cacheMapCanvas(cacheKey, canvas)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  // Highlighted textures are transient. Avoid allocating and generating a
  // mip chain for every question's temporary highlight.
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 2
  return texture
}

function addCapitalMarkers(globe: Group, markers: GlobeMarker[]) {
  markers.forEach((marker) => {
    const point = toPoint(marker.position[0], marker.position[1], 1).normalize()
    const isTarget = marker.role === 'target'
    const dot = new Mesh(
      isTarget ? targetMarkerGeometry : contextMarkerGeometry,
      isTarget ? targetMarkerMaterial : contextMarkerMaterial,
    )
    dot.position.copy(point.clone().multiplyScalar(GLOBE_RADIUS + 0.012))
    dot.lookAt(point.clone().multiplyScalar(4))
    globe.add(dot)
  })
}

function ringContains(ring: number[][], longitude: number, latitude: number) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[previous]
    if ((y1 > latitude) !== (y2 > latitude)
      && longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1) {
      inside = !inside
    }
  }
  return inside
}

function featureContains(mapFeature: MapFeature, longitude: number, latitude: number) {
  return polygonsOf(mapFeature.geometry).some((polygon) => {
    // Test raw and antimeridian-unwrapped rings so polygons crossing ±180°
    // (Russia, Fiji) still register clicks on either side.
    const contains = (rings: number[][][]) =>
      [longitude, longitude + 360, longitude - 360].some((lon) =>
        ringContains(rings[0], lon, latitude)
        && !rings.slice(1).some((hole) => ringContains(hole, lon, latitude)))
    return contains(polygon) || contains(polygon.map(unwrapRing))
  })
}

/** ccn3 id of the country at a point, preferring the detailed outlines. */
export function countryAt(longitude: number, latitude: number) {
  const detailed = detailedCountryFeatures.find((mapFeature) =>
    featureContains(mapFeature, longitude, latitude))
  if (detailed) return String(detailed.id)
  const coarse = getWorldMap().features.find((mapFeature) => {
    const featureId = String(mapFeature.id).padStart(3, '0')
    return !detailedCountryIds.has(featureId) && featureContains(mapFeature, longitude, latitude)
  })
  return coarse ? String(coarse.id).padStart(3, '0') : null
}

export function preloadCountryMap(
  targetId: string,
  showIslandEnvelope: boolean,
  highlightCountry = true,
) {
  // The base map goes through the shared mipmapped texture, so there is no
  // canvas to pre-rasterize for the highlight-free case.
  if (!highlightCountry) return
  const cacheKey = `${targetId}-${showIslandEnvelope ? 'island' : 'land'}-hl`
  if (mapCanvasCache.has(cacheKey)) return
  cacheMapCanvas(
    cacheKey,
    renderMapCanvas(getWorldMap(), targetId, showIslandEnvelope, true),
  )
}

export function CountryGlobe({
  countryId,
  countryName,
  focus,
  showSmallCountryMarker = false,
  isIslandNation,
  showIslandEnvelope,
  highlightCountry = true,
  markers = [],
  cameraDistance = 6.7,
  lockZoom = false,
  startFocus,
  onPick,
  resetSignal,
  onTargetPosition,
}: CountryGlobeProps) {
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const hostRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const sceneHandlesRef = useRef<GlobeSceneHandles | null>(null)
  const targetCenterRef = useRef(new Vector3())
  const boundsRef = useRef({ left: 0, top: 0, width: 0, height: 0 })
  const onTargetPositionRef = useRef(onTargetPosition)
  onTargetPositionRef.current = onTargetPosition
  const insetMap = useMemo(() => {
    if (!showSmallCountryMarker) return ''
    const cached = insetMapCache.get(countryId)
    if (cached !== undefined) return cached
    const selectedFeature = detailedCountryFeatures.find(
      (mapFeature) => mapFeature.id === countryId,
    ) ?? getWorldMap().features.find(
      (mapFeature) => String(mapFeature.id).padStart(3, '0') === countryId,
    )
    const dataUrl = selectedFeature ? createInsetMap(selectedFeature) : ''
    insetMapCache.set(countryId, dataUrl)
    return dataUrl
  }, [countryId, showSmallCountryMarker])

  const targetMarkerId = useMemo(
    () => markers.find((marker) => marker.role === 'target')?.id,
    [markers],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new Scene()
    const camera = new PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, cameraDistance)

    // MSAA only pays off at 1x device pixel ratio; higher ratios already
    // supersample, so skip the extra memory and fill cost there.
    const renderer = new WebGLRenderer({
      antialias: Math.min(window.devicePixelRatio, 1.5) < 1.5,
      alpha: true,
      powerPreference: 'low-power',
    })
    renderer.outputColorSpace = SRGBColorSpace
    host.appendChild(renderer.domElement)

    const globe = new Group()
    const sphere = new Mesh(
      new SphereGeometry(GLOBE_RADIUS, 96, 64),
      new MeshBasicMaterial(),
    )
    const markerGroup = new Group()
    globe.add(sphere)
    globe.add(markerGroup)
    scene.add(globe)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 4.2
    controls.maxDistance = 9
    controls.minPolarAngle = Math.PI * 0.08
    controls.maxPolarAngle = Math.PI * 0.92
    controls.rotateSpeed = 0.42
    controls.zoomSpeed = 0.7
    controls.zoomToCursor = false
    controlsRef.current = controls

    // Only textures created by the per-question effect land in this set;
    // unmount cleanup disposes exactly those. Textures flagged with
    // userData.isSharedBaseMap are additionally never disposed.
    const createdTextures = new Set<CanvasTexture>()

    let frame = 0
    let resizeFrame: number | null = null
    let renderRequested = false
    let disposed = false
    let lastAppliedWidth = 0
    let lastAppliedHeight = 0
    const projectedTarget = new Vector3()

    const render = () => {
      frame = 0
      renderRequested = false
      if (disposed) return

      // With damping enabled, update emits another change only while the
      // camera is still moving, extending this short render burst as needed.
      const stillDamping = controls.update()
      if (!stillDamping) {
        // The loop is about to idle, so this is the moment to report the
        // target's screen position (the consumer reads it at answer time).
        const report = onTargetPositionRef.current
        if (report) {
          projectedTarget
            .copy(targetCenterRef.current)
            .multiplyScalar(GLOBE_RADIUS + 0.008)
            .applyQuaternion(globe.quaternion)
            .project(camera)
          const bounds = boundsRef.current
          report({
            x: bounds.left + (projectedTarget.x * 0.5 + 0.5) * bounds.width,
            y: bounds.top + (-projectedTarget.y * 0.5 + 0.5) * bounds.height,
          })
        }
      }
      renderer.render(scene, camera)
    }

    const requestRender = () => {
      if (!renderRequested && !disposed) {
        renderRequested = true
        frame = requestAnimationFrame(render)
      }
    }

    // The canvas rect is cached in boundsRef; layout is only re-read on
    // resize and scroll, never once per damped frame.
    const updateBounds = () => {
      boundsRef.current = renderer.domElement.getBoundingClientRect()
    }

    const applyResize = () => {
      resizeFrame = null
      if (disposed) return
      const width = host.clientWidth
      const height = host.clientHeight
      if (width === lastAppliedWidth && height === lastAppliedHeight) return
      lastAppliedWidth = width
      lastAppliedHeight = height
      const deviceScale = Math.min(window.devicePixelRatio, 1.5)
      const pixelScale = Math.min(
        deviceScale,
        Math.sqrt(MAX_RENDER_PIXELS / Math.max(width * height, 1)),
      )
      renderer.setPixelRatio(pixelScale)
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
      updateBounds()
      requestRender()
    }

    // Coalesce resize work: at most one setSize/setPixelRatio per frame.
    const resize = () => {
      if (resizeFrame !== null || disposed) return
      resizeFrame = requestAnimationFrame(applyResize)
    }

    const onScroll = () => {
      updateBounds()
      requestRender()
    }

    // A press that barely moves is a click on the map; anything longer is a
    // globe drag handled by OrbitControls.
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    let pressStart: { x: number; y: number; at: number } | null = null
    const onPointerDown = (event: PointerEvent) => {
      pressStart = { x: event.clientX, y: event.clientY, at: performance.now() }
    }
    const onPointerUp = (event: PointerEvent) => {
      const start = pressStart
      pressStart = null
      const pick = onPickRef.current
      if (!start || !pick) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return
      if (performance.now() - start.at > 600) return
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObject(sphere, false)[0]
      if (!hit) return
      const local = hit.point.clone().applyQuaternion(globe.quaternion.clone().invert()).normalize()
      const latitude = 90 - MathUtils.radToDeg(Math.acos(MathUtils.clamp(local.y, -1, 1)))
      let longitude = MathUtils.radToDeg(Math.atan2(local.z, -local.x)) - 180
      if (longitude < -180) longitude += 360

      const targetWorld = targetCenterRef.current.clone().applyQuaternion(globe.quaternion)
      const facing = targetWorld.dot(camera.position.clone().normalize()) > 0.05
      let pixelsFromTarget = Infinity
      if (facing) {
        const projected = targetWorld.multiplyScalar(GLOBE_RADIUS).project(camera)
        pixelsFromTarget = Math.hypot(
          bounds.left + (projected.x * 0.5 + 0.5) * bounds.width - event.clientX,
          bounds.top + (-projected.y * 0.5 + 0.5) * bounds.height - event.clientY,
        )
      }
      pick({
        countryId: countryAt(longitude, latitude),
        pixelsFromTarget,
        screen: { x: event.clientX, y: event.clientY },
      })
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    window.addEventListener('scroll', onScroll, { passive: true })
    controls.addEventListener('change', requestRender)
    resize()

    sceneHandlesRef.current = {
      globe,
      sphere,
      markerGroup,
      camera,
      controls,
      createdTextures,
      requestRender,
    }

    return () => {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('scroll', onScroll)
      controls.removeEventListener('change', requestRender)
      controls.dispose()
      controlsRef.current = null
      sphere.geometry.dispose()
      const sphereMaterial = sphere.material as MeshBasicMaterial
      createdTextures.forEach((texture) => {
        if (!texture.userData.isSharedBaseMap) texture.dispose()
      })
      createdTextures.clear()
      sphereMaterial.dispose()
      sceneHandlesRef.current = null
      renderer.dispose()
      // dispose() alone leaves the GL context alive until GC; browsers cap
      // the number of live contexts, so release it explicitly.
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  // Texture: changes when the highlighted country (or its reveal) changes,
  // without disturbing where the player has turned the globe.
  useEffect(() => {
    const handles = sceneHandlesRef.current
    if (!handles) return

    const mapTexture = createMapTexture(
      getWorldMap(),
      countryId,
      showIslandEnvelope,
      highlightCountry,
    )

    const material = handles.sphere.material as MeshBasicMaterial
    const previousTexture = material.map
    if (
      previousTexture
      && previousTexture !== mapTexture
      && handles.createdTextures.has(previousTexture as CanvasTexture)
      && !previousTexture.userData.isSharedBaseMap
    ) {
      previousTexture.dispose()
    }
    if (previousTexture) {
      handles.createdTextures.delete(previousTexture as CanvasTexture)
    }
    material.map = mapTexture
    material.needsUpdate = true
    handles.createdTextures.add(mapTexture)
    handles.requestRender()
  }, [countryId, showIslandEnvelope, highlightCountry])

  // Markers on top of the persistent sphere. The marker meshes share
  // module-scope geometry/material, so clearing the group is all the
  // teardown they need.
  useEffect(() => {
    const handles = sceneHandlesRef.current
    if (!handles) return
    const center = toPoint(focus[0], focus[1], 1).normalize()
    handles.markerGroup.clear()
    if (markers.length) addCapitalMarkers(handles.markerGroup, markers)
    if (showSmallCountryMarker && !isIslandNation) {
      const marker = new Mesh(smallCountryMarkerGeometry, smallCountryMarkerMaterial)
      marker.position.copy(center.clone().multiplyScalar(GLOBE_RADIUS + 0.008))
      marker.lookAt(center.clone().multiplyScalar(4))
      handles.markerGroup.add(marker)
    }
    handles.requestRender()
  }, [focus, showSmallCountryMarker, isIslandNation, targetMarkerId, markers.length])

  // Orientation and camera: reset for each new question.
  useEffect(() => {
    const handles = sceneHandlesRef.current
    if (!handles) return

    const center = toPoint(focus[0], focus[1], 1).normalize()
    const viewCenter = startFocus
      ? toPoint(startFocus[0], startFocus[1], 1).normalize()
      : center

    const yaw = Math.atan2(-viewCenter.x, viewCenter.z)
    const yawRotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      yaw,
    )
    const yawedCenter = viewCenter.clone().applyQuaternion(yawRotation)
    const pitch = Math.atan2(yawedCenter.y, yawedCenter.z)
    const pitchRotation = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      pitch,
    )
    handles.globe.quaternion.copy(pitchRotation.multiply(yawRotation))

    // Snap the camera back to this question's viewing distance and sync the
    // controls' saved state so a resetSignal reset() lands on the same spot.
    // Widen the zoom limits to admit close-up distances; a locked close-up
    // keeps the player from simply zooming back out to the normal view.
    handles.controls.minDistance = Math.min(4.2, cameraDistance)
    handles.controls.maxDistance = lockZoom ? cameraDistance : Math.max(9, cameraDistance)
    handles.camera.position.set(0, 0, cameraDistance)
    handles.controls.position0.copy(handles.camera.position)
    handles.controls.reset()

    targetCenterRef.current.copy(center)
    handles.requestRender()
  }, [countryId, focus, startFocus, cameraDistance, lockZoom, targetMarkerId])

  useEffect(() => {
    controlsRef.current?.reset()
  }, [resetSignal])

  return (
    <div
      ref={hostRef}
      class="country-globe"
      role="img"
      aria-label={onPick
        ? `Interactive globe: click ${countryName}`
        : `Interactive globe highlighting ${countryName}`}
    >
      {insetMap ? (
        <div class="country-inset-map" aria-hidden="true">
          <img src={insetMap} alt="" />
        </div>
      ) : null}
    </div>
  )
}
