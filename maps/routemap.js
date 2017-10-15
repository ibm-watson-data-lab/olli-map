var map;
const COORDINATE_PRECISION = 7;

function kmlToGeoJSON(kmlstring) {
  var geojson = {
    "type": "FeatureCollection",
    "features": []
  };

  let kmlcounter = 0;
  let coordtag = "<coordinates>";

  while(kmlcounter<kmlstring.length) {
    //Extract coordinates from the KML
    let st = kmlstring.indexOf(coordtag, kmlcounter);
    if (st<0) break;
    st += coordtag.length
    let en = kmlstring.indexOf("</coordinates>", kmlcounter);
    if (en<0) break;
    var coordstring = kmlstring.substring(st, en);
    //Move the starting point for next search to an index after this one
    kmlcounter = en; 

    //Traverse <coordinates> and build GeoJSON geometry
    let coords = coordstring.split(',');
    let numericCoords = [];
    let coordsCount = 0;
    while (coordsCount < (coords.length-2)) {
      //Put each x, y, altitude triple into a numeric array
      if (coords[coordsCount] && coords[coordsCount+1] && coords[coordsCount+2]) {
        let numcoord = [coords[coordsCount], coords[coordsCount+1], coords[coordsCount+2]];
        for (var i = 0; i < numcoord.length; i++) {
          let x = parseFloat( numcoord[i].trim() );
          numcoord[i] = parseFloat( x.toPrecision(COORDINATE_PRECISION) );
        }
        numericCoords.push(numcoord);
      }
      coordsCount = coordsCount + 3;
    } // end while: traversing <coordinates>
  
    let feature = {
      "type": "Feature",
      "properties": {},
      "geometry": {
        "type": "LineString", 
        "coordinates": numericCoords
      }
    };
    geojson["features"].push(feature);

  } // end while: parsing KML string

  return geojson;
}

function gotFile() {
  let gj = kmlToGeoJSON(this.response);

  map.addLayer({
    "id": "route", 
    "type": "line", 
    "source": {
      "type": "geojson", 
      "data": gj, 
    }, 
    "paint": {
      "line-color": "rgba(48,48,255,0.5)", 
      "line-width": 12
    }
  });

}

function afterMapLoad() {
  let xmlhttp = new XMLHttpRequest();
  xmlhttp.addEventListener("load", gotFile, false);
  xmlhttp.open("GET", "../M2_Oct08_S01_RedRoute.kml", true);
  xmlhttp.send();
}


mapboxgl.accessToken = "pk.eyJ1IjoicmFqcnNpbmdoIiwiYSI6ImpzeDhXbk0ifQ.VeSXCxcobmgfLgJAnsK3nw";

map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v9",
  // style: "mapbox://styles/rajrsingh/cj8qmi7ezaq042rqng3pisvx9", 
  center: [-92.4659, 44.0216],
  zoom: 16
});

map.on("load", afterMapLoad);