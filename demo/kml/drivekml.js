/* global mapboxgl, requestAnimationFrame, FileReader, XMLHttpRequest */

mapboxgl.accessToken = 'pk.eyJ1IjoicmFqcnNpbmdoIiwiYSI6ImpzeDhXbk0ifQ.VeSXCxcobmgfLgJAnsK3nw'

const COORDINATE_PRECISION = 8
const ANIMATION_SPEED = 3
const STOP_DURATION = 3

let map = null
let showRouteButton = null
let driveRouteButton = null
let hideStopsButton = null

/**
 * Converts from degrees to radians
 *
 * @param {number} degrees - the degrees value to conver to radians
 * @returns {number} the radians equivalent
 */
const toRadians = (degrees) => {
  return degrees * Math.PI / 180
}

/**
 * Converts from radians to degrees.
 *
 * @param {number} radians - the radian value to conver to degrees
 * @returns {number} the degrees equivalent
 */
const toDegrees = (radians) => {
  return radians * 180 / Math.PI
}

/**
 * Computes the full path (all point in between) for the given GeoJSON
 *
 * @param {Object} geojson - the GeoJSON to compute path
 * @returns {Object} GeoJSON object representing the full path
 */
const computeAnimationPath = (geojson) => {
  const earthRadiusKm = 6371.0088
  let coordinates = geojson.features[0].geometry.coordinates

  let ollipath = [coordinates[0]]
  let current = null
  let next = null
  let steps = null
  let pointsBetween = null

  for (let i = 0; i < coordinates.length - 1; i++) {
    current = coordinates[i]
    next = coordinates[i + 1]

    steps = computeDistance(current, next) * earthRadiusKm * (3000 / (ANIMATION_SPEED || 1))
    pointsBetween = getPointsBetween(current, next, steps)

    ollipath = ollipath.concat(pointsBetween)
    ollipath.push(coordinates[i + 1])
  }

  return ollipath
}

/**
 * Animates moving along the given route
 *
 * @param {Object} geojson - GeoJSON object defining the route
 * @param {Object} stops - FeatureCollection representing stops
 */
const initDriveRoute = (geojson, stops) => {
  if (map) {
    let counter = 0

    if (driveRouteButton) {
      map.removeLayer('olli-bus')
      map.removeSource('olli-bus')
    }

    geojson.features[0].geometry.coordinates = computeAnimationPath(geojson)

    // a point representing the olli bus
    // coordinates initially set to starting coordinate
    let ollibus = {
      'type': 'FeatureCollection',
      'features': [{
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': geojson.features[0].geometry.coordinates[0]
        }
      }]
    }

    map.addLayer({
      'id': 'olli-bus',
      'source': {
        'type': 'geojson',
        'data': ollibus
      },
      'type': 'symbol',
      'layout': {
        'icon-image': 'olli',
        'icon-size': 0.75
      }
    })

    const animate = () => {
      let stopCoordinates = []
      if (stops && stops.features) {
        stopCoordinates = stops.features.map(feature => {
          return feature.geometry.coordinates
        })
      }

      // update bus coordinate to a new position
      ollibus.features[0].geometry.coordinates = geojson.features[0].geometry.coordinates[counter]
      // update source with this new data.
      map.getSource('olli-bus').setData(ollibus)

      counter = counter + 1

      // request next frame of animation (if destination has not been reached)
      if (counter < geojson.features[0].geometry.coordinates.length) {
        let current = ollibus.features[0].geometry.coordinates

        const atStop = counter > 3 && stopCoordinates.some(stop => {
          return stop[0] === current[0] && stop[1] === current[1]
        })
        if (atStop && counter > 1) {
          setTimeout(() => {
            requestAnimationFrame(animate)
          }, STOP_DURATION * 1000)
        } else {
          requestAnimationFrame(animate)
        }
      }
    }

    if (!driveRouteButton) {
      driveRouteButton = document.getElementById('driveRoute')
      driveRouteButton.addEventListener('click', () => {
        counter = 0
        animate()
      })
    }

    driveRouteButton.style.display = 'inline-block'
  }
}

/**
 * Toggles the visibility of the route
 *
 * @param {Object} geojson - GeoJSON object defining the route
 * @param {boolean} animate - if true, animate the showing of the route
 */
const initShowRoute = (geojson, animate) => {
  if (map) {
    let pointsAdded = 0

    const coordinates = geojson.features[0].geometry.coordinates.map(coords => {
      return [coords[0], coords[1]]
    })

    if (showRouteButton) {
      map.removeLayer('olli-route')
      map.removeSource('olli-route')
    }

    let route = {
      'type': 'FeatureCollection',
      'features': [{
        'type': 'Feature',
        'geometry': {
          'type': 'LineString',
          'coordinates': [coordinates[pointsAdded]]
        }
      }]
    }

    map.addLayer({
      'id': 'olli-route',
      'type': 'line',
      'source': {
        'type': 'geojson',
        'data': route
      },
      'layout': {
        'line-cap': 'round',
        'line-join': 'round'
      },
      'paint': {
        'line-color': '#888888',
        'line-width': 8,
        'line-opacity': 0.6
      }
    })

    const addPoint = () => {
      if (++pointsAdded <= coordinates.length) {
        if (coordinates[pointsAdded] && coordinates[pointsAdded].length > 1) {
          route.features[0].geometry.coordinates.push(coordinates[pointsAdded])
          // then update the map
          map.getSource('olli-route').setData(route)
        }

        window.setTimeout(addPoint, 100)
      }
    }

    if (!showRouteButton) {
      showRouteButton = document.getElementById('showRoute')
      showRouteButton.addEventListener('click', () => {
        const visibility = map.getLayoutProperty('olli-route', 'visibility')

        if (visibility === 'visible') {
          map.setLayoutProperty('olli-route', 'visibility', 'none')
          showRouteButton.innerText = 'Show Route'
        } else if (animate) {
          pointsAdded = 0
          route.features[0].geometry.coordinates = [coordinates[pointsAdded]]
          map.setLayoutProperty('olli-route', 'visibility', 'visible')
          addPoint()
          showRouteButton.innerText = 'Hide Route'
        } else {
          map.getSource('olli-route').setData(geojson)
          map.setLayoutProperty('olli-route', 'visibility', 'visible')
          showRouteButton.innerText = 'Hide Route'
        }
      })
    }

    showRouteButton.style.display = 'inline-block'
    showRouteButton.innerText = 'Show Route'
  }
}

/**
 * Add stops to the map
 *
 * @param {Object} stops - FeatureCollection representing stops
 */
const addStops = (stops) => {
  if (map) {
    if (hideStopsButton) {
      map.removeLayer('olli-stops')
      map.removeSource('olli-stops')
    }

    map.addLayer({
      'id': 'olli-stops',
      'type': 'symbol',
      'source': {
        'type': 'geojson',
        'data': stops
      },
      'layout': {
        'icon-image': 'olli-stop',
        'icon-size': 0.25,
        'text-field': '{name}',
        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        'text-offset': [0, 1.4],
        'text-anchor': 'top'
      }
    })

    if (!hideStopsButton) {
      hideStopsButton = document.getElementById('hideStops')
      hideStopsButton.addEventListener('click', () => {
        const visibility = map.getLayoutProperty('olli-stops', 'visibility')
        if (visibility === 'visible') {
          map.setLayoutProperty('olli-stops', 'visibility', 'none')
          hideStopsButton.innerText = 'Show Stops'
        } else {
          map.setLayoutProperty('olli-stops', 'visibility', 'visible')
          hideStopsButton.innerText = 'Hide Stops'
        }
      })
    }

    hideStopsButton.style.display = 'inline-block'
    hideStopsButton.innerText = 'Hide Stops'
    map.setLayoutProperty('olli-stops', 'visibility', 'visible')
  }
}

/**
 * Loads a street map centered in U.S.
 */
const initMap = () => {
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v9',
    center: [-97.380979, 42.877742],
    zoom: 4
  })

  map.loadImage('../olli-icon-svg.png', (error, image) => {
    if (error) {
      throw error
    } else {
      map.addImage('olli', image)
    }
  })
  map.loadImage('../olli-stop.png', (error, image) => {
    if (error) {
      throw error
    } else {
      map.addImage('olli-stop', image)
    }
  })
}

/**
 * Zoom the map to fit the given coordinates
 *
 * @param {Object} geojson - GeoJSON object defining the area to zoom in to
 */
const zoomToFit = (geojson) => {
  if (map) {
    const coordinates = geojson.features[0].geometry.coordinates.map(coords => {
      return [coords[0], coords[1]]
    })

    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord)
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]))

    map.fitBounds(bounds, {
      padding: 100
    })
  }
}

/**
 * Takes a KML document in a string object and converts each
 * <coordinate> element to a feature in a GeoJSON FeatureCollection
 * NOTE: Currently assumes all features in the KML are LineStrings
 *
 * @param {string} kmlstring - a KML document
 * @returns {Object} GeoJSON object
 */
const kmlToGeoJSON = (kmlstring) => {
  var geojson = {
    'type': 'FeatureCollection',
    'features': []
  }

  let kmlcounter = 0
  let coordtag = '<coordinates>'

  while (kmlcounter < kmlstring.length) {
    // Extract coordinates from the KML
    let st = kmlstring.indexOf(coordtag, kmlcounter)
    if (st < 0) break
    st += coordtag.length
    let en = kmlstring.indexOf('</coordinates>', kmlcounter)
    if (en < 0) break
    var coordstring = kmlstring.substring(st, en)
    // Move the starting point for next search to an index after this one
    kmlcounter = en

    // Traverse <coordinates> and build GeoJSON geometry
    let coords = coordstring.split(',')
    let numericCoords = []
    let coordsCount = 0
    while (coordsCount < (coords.length - 2)) {
      // Put each x, y, altitude triple into a numeric array
      if (coords[coordsCount] && coords[coordsCount + 1] && coords[coordsCount + 2]) {
        let numcoord = [coords[coordsCount], coords[coordsCount + 1], coords[coordsCount + 2]]
        for (var i = 0; i < numcoord.length; i++) {
          let x = parseFloat(numcoord[i].trim())
          numcoord[i] = parseFloat(x.toPrecision(COORDINATE_PRECISION))
        }
        numericCoords.push(numcoord)
      }
      coordsCount = coordsCount + 3
    } // end while: traversing <coordinates>

    let feature = {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'LineString',
        'coordinates': numericCoords
      }
    }
    geojson['features'].push(feature)
  } // end while: parsing KML string

  return geojson
}

/**
 * Reads a text file and returns it content
 *
 * @param {File} file to read
 * @returns {string} file content
 */
const readFile = function (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = function (event) {
      const contents = event.target.result
      resolve(contents)
    }

    reader.onerror = function (event) {
      reject(new Error('File could not be read! Code ' + event.target.error.code))
    }

    reader.readAsText(file)
  })
}

/**
 * Compute distance (in radians) between two coordinates
 *
 * @param {Array} from - coordinate of the start point
 * @param {Array} to - coordinate of the end point
 */
const computeDistance = (from, to) => {
  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])
  const deltaLat = toRadians(to[1] - from[1])
  const deltaLon = toRadians(to[0] - from[0])

  let a = Math.pow(Math.sin(deltaLat / 2), 2) +
        Math.pow(Math.sin(deltaLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2)

  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/**
 * JavaScript version of the `pointsBetween` method found here:
 *
 *   https://github.com/cammace/mapbox-utils-android/blob/master/lib/src/main/java/com/mapbox/utils/MathUtil.java#L70
 *
 * @param {Array} from - the coordinates of the start point (i.e., [<lng>, <lat>])
 * @param {Array} to - the coordinates of the end point (i.e., [<lng>, <lat>])
 * @param {number} steps - number of points between start and end to compute
 * @returns {Array} array of the coordinates of the computed points
 */
const getPointsBetween = (from, to, steps) => {
  let pointsBetween = []

  if (from[0] === to[0] && from[1] === to[1]) {
    pointsBetween.push(from)
  } else {
    for (let i = 0; i < steps; i++) {
      let lat1 = toRadians(from[1])
      let lon1 = toRadians(from[0])
      let lat2 = toRadians(to[1])
      let lon2 = toRadians(to[0])

      let f = i * (1 / steps)

      let distance = computeDistance(from, to)

      let a = Math.sin((1 - f) * distance) / Math.sin(distance)
      let b = Math.sin(f * distance) / Math.sin(distance)
      let x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2)
      let y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2)
      let z = a * Math.sin(lat1) + b * Math.sin(lat2)
      let lat3 = Math.atan2(z, Math.sqrt((x * x) + (y * y)))
      let lon3 = Math.atan2(y, x)

      pointsBetween.push([toDegrees(lon3), toDegrees(lat3)])
    }
  }

  return pointsBetween
}

const processKML = (kmldata, stops) => {
  let geojson = kmlToGeoJSON(kmldata)
  if (map) {
    zoomToFit(geojson)
    map.once('zoomend', () => {
      initShowRoute(geojson)
      getOlliStops()
        .then((stops) => {
          initDriveRoute(geojson, stops)
        })
    })
  }
}

const getDefaultKML = () => {
  let xmlhttp = new XMLHttpRequest()
  xmlhttp.addEventListener('load', function () {
    processKML(this.response)
  }, false)
  xmlhttp.open('GET', 'red.route.kml', true)
  xmlhttp.send()
}

const getOlliStops = (callback) => {
  return new Promise((resolve, reject) => {
    let xmlhttp = new XMLHttpRequest()
    xmlhttp.addEventListener('load', function () {
      let stops = JSON.parse(this.response)
      addStops(stops)
      resolve(stops)
    }, false)
    xmlhttp.open('GET', 'red.route.stops.json', true)
    xmlhttp.send()
  })
}

document.addEventListener('DOMContentLoaded', function () {
  let pageForm = document.getElementById('pageForm')
  pageForm.reset()
  initMap()

  if (window.location.search.indexOf('upload=true') === -1) {
    getDefaultKML(window.ollistops)
  } else {
    document.getElementById('fileUpload').style.display = 'inline-block'
    var fileInput = document.getElementById('kmlFile')
    fileInput.addEventListener('change', function (e) {
      var file = fileInput.files[0]
      if (file) {
        readFile(file)
          .then(contents => {
            processKML(contents)
          })
          .catch(err => {
            console.error(err)
          })
      }
    })
  }
})
