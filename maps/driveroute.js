/* global mapboxgl, requestAnimationFrame, FileReader */

mapboxgl.accessToken = 'pk.eyJ1IjoicmFqcnNpbmdoIiwiYSI6ImpzeDhXbk0ifQ.VeSXCxcobmgfLgJAnsK3nw'

const COORDINATE_PRECISION = 7
let map = null

let showRouteButton = null
let driveRouteButton = null

/**
 * Animates moving along the given route
 *
 * @param {Object} geojson - GeoJSON object defining the route
 */
const initDriveRoute = (geojson) => {
  if (map) {
    let destination = geojson.features[0].geometry.coordinates[geojson.features[0].geometry.coordinates.length - 1]
    let counter = 0

    try {
      map.removeLayer('ollie-bus')
      map.removeSource('ollie-bus')
    } catch (err) {
      // layer does not exist
    }

    // a point representing the Ollie bus
    // coordinates initially set to starting coordinate
    let olliebus = {
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
      'id': 'ollie-bus',
      'source': {
        'type': 'geojson',
        'data': olliebus
      },
      'type': 'symbol',
      'layout': {
        'icon-image': 'ollie'
      }
    })

    const animate = () => {
      // update bus coordinate to a new position
      olliebus.features[0].geometry.coordinates = geojson.features[0].geometry.coordinates[counter]

      // update source with this new data.
      map.getSource('ollie-bus').setData(olliebus)

      // request next frame of animation (if destination has not been reached)
      if (olliebus.features[0].geometry.coordinates[0] !== destination[0]) {
        requestAnimationFrame(animate)
      }

      counter = counter + 1
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

    try {
      map.removeLayer('ollie-route')
      map.removeSource('ollie-route')
    } catch (err) {
      // layer does not exist
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
      'id': 'ollie-route',
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
        'line-color': '#ed6498',
        'line-width': 5,
        'line-opacity': 0.8
      }
    })

    const addPoint = () => {
      if (++pointsAdded <= coordinates.length) {
        if (coordinates[pointsAdded] && coordinates[pointsAdded].length > 1) {
          route.features[0].geometry.coordinates.push(coordinates[pointsAdded])
          // then update the map
          map.getSource('ollie-route').setData(route)
        }

        window.setTimeout(addPoint, 100)
      }
    }

    if (!showRouteButton) {
      showRouteButton = document.getElementById('showRoute')
      showRouteButton.addEventListener('click', () => {
        const visibility = map.getLayoutProperty('ollie-route', 'visibility')

        if (visibility === 'visible') {
          map.setLayoutProperty('ollie-route', 'visibility', 'none')
          showRouteButton.innerText = 'Show Route'
        } else if (animate) {
          pointsAdded = 0
          route.features[0].geometry.coordinates = [coordinates[pointsAdded]]
          map.setLayoutProperty('ollie-route', 'visibility', 'visible')
          addPoint()
          showRouteButton.innerText = 'Hide Route'
        } else {
          map.getSource('ollie-route').setData(geojson)
          map.setLayoutProperty('ollie-route', 'visibility', 'visible')
          showRouteButton.innerText = 'Hide Route'
        }
      })
    }

    showRouteButton.style.display = 'inline-block'
    showRouteButton.innerText = 'Show Route'
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

  map.loadImage('ollie-15x19.png', (error, image) => {
    if (error) {
      throw error
    } else {
      map.addImage('ollie', image)
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

document.addEventListener('DOMContentLoaded', function () {
  let pageForm = document.getElementById('pageForm')
  pageForm.reset()
  initMap()

  var fileInput = document.getElementById('kmlFile')
  fileInput.addEventListener('change', function (e) {
    var file = fileInput.files[0]
    if (file) {
      // console.log('Filename: ' + file.name)
      // console.log('Type: ' + file.type)
      // console.log('Size: ' + file.size + ' bytes')

      readFile(file)
        .then(contents => {
          let geojson = kmlToGeoJSON(contents)
          if (map) {
            zoomToFit(geojson)
            map.once('zoomend', () => {
              initShowRoute(geojson)
              initDriveRoute(geojson)
            })
          }
        })
        .catch(err => {
          console.error(err)
        })
    }
  })
})
