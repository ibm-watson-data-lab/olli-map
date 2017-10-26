/* global mapboxgl, PouchDB, XMLHttpRequest */

mapboxgl.accessToken = 'pk.eyJ1IjoicmFqcnNpbmdoIiwiYSI6ImpzeDhXbk0ifQ.VeSXCxcobmgfLgJAnsK3nw'

const DB_NAME = 'ollilocation'
const REMOTE_DB = 'http://admin:password@127.0.0.1:5984/ollilocation'

let db = null
let map = null
let dbsync = null
let ollibus = null
let olliroute = null
let started = false

const initMap = () => {
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v9',
    center: [-92.465944, 44.021392],
    zoom: 16
  })

  map.on('load', () => {
    started = false
    initRoute([[-92.467044, 44.022365]])
    initStops()
      .then(stops => {
        initOlli([-92.467044, 44.022365])
        sync()
      })
  })
}

const initOlli = (coordinates) => {
  if (map) {
    // olli bus icon
    map.loadImage('../olli-icon-svg.png', (error, image) => {
      if (error) {
        throw error
      } else {
        map.addImage('olli', image)
      }
    })

    // point representing the olli bus location
    ollibus = {
      'type': 'FeatureCollection',
      'features': [{
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': coordinates
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
  }
}

const initRoute = (coordinates) => {
  if (map) {
    // line representing the route travelled
    olliroute = {
      'type': 'FeatureCollection',
      'features': [{
        'type': 'Feature',
        'geometry': {
          'type': 'LineString',
          'coordinates': coordinates
        }
      }]
    }

    map.addLayer({
      'id': 'olli-route',
      'type': 'line',
      'properties': {
        'visibility': 'none'
      },
      'source': {
        'type': 'geojson',
        'data': olliroute
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

    let hideRouteButton = document.getElementById('hideRoute')

    hideRouteButton.addEventListener('click', () => {
      const visibility = map.getLayoutProperty('olli-route', 'visibility')
      if (visibility === 'visible') {
        map.setLayoutProperty('olli-route', 'visibility', 'none')
        hideRouteButton.innerText = 'Show Route'
      } else {
        map.setLayoutProperty('olli-route', 'visibility', 'visible')
        hideRouteButton.innerText = 'Hide Route'
      }
    })

    map.setLayoutProperty('olli-route', 'visibility', 'none')
    hideRouteButton.innerText = 'Show Route'
  }
}

const updateOlliLocation = (olliLocation) => {
  // update bus coordinate to a new position
  ollibus.features[0].geometry.coordinates = olliLocation

  // update the route travelled
  if (started) {
    olliroute.features[0].geometry.coordinates.push(ollibus.features[0].geometry.coordinates)
  } else {
    olliroute.features[0].geometry.coordinates = [ollibus.features[0].geometry.coordinates]
    started = true
  }

  // update sources with this new data
  map.getSource('olli-bus').setData(ollibus)
  map.getSource('olli-route').setData(olliroute)
}

const initStops = () => {
  if (map) {
    map.loadImage('../olli-stop.png', (error, image) => {
      if (error) {
        throw error
      } else {
        map.addImage('olli-stop', image)
      }
    })

    return new Promise((resolve, reject) => {
      let xmlhttp = new XMLHttpRequest()
      xmlhttp.addEventListener('load', function () {
        let stops = JSON.parse(this.response)
        addStops(stops)
        resolve(stops)
      }, false)
      xmlhttp.open('GET', '/data/stops.json', true)
      xmlhttp.send()
    })
  }
}

const addStops = (stops) => {
  if (map) {
    map.addLayer({
      'id': 'olli-stops',
      'type': 'symbol',
      'properties': {
        'visibility': 'visible'
      },
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

    let hideStopsButton = document.getElementById('hideStops')
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
}

const sync = () => {
  if (dbsync) {
    dbsync.cancel()
  }

  dbsync = db.sync(REMOTE_DB, { live: true, retry: true })
    .on('change', info => {
      // incoming changes only
      if (info.direction === 'pull' && info.change && info.change.docs) {
        // console.log('sync.on.change', info.change.docs)
        info.change.docs.forEach(function (doc) {
          if (doc.type === 'geo_position') {
            updateOlliLocation(doc.coordinates)
          }
        })
      }
    })
    .on('error', err => {
      console.warn('sync.on.change', err)
    })
}

document.addEventListener('DOMContentLoaded', function () {
  db = new PouchDB(DB_NAME)
  db.info(function (err, info) {
    if (err) {
      console.error(err)
    } else {
      console.log('db.info', info)
    }
  })

  initMap()
})
