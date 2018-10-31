const windFiles = {
  0: "2016112000",
  6: "2016112006",
  12: "2016112012",
  18: "2016112018",
  24: "2016112100",
  30: "2016112106",
  36: "2016112112",
  42: "2016112118",
  48: "2016112200"
};

mapboxgl.accessToken =
  "pk.eyJ1IjoiYXN0cm9zYXQiLCJhIjoiY2o3YWtjNnJzMGR6ajM3b2FidmNwaDNsaSJ9.lwWi7kOiejlT0RbD7RxtmA";
var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v9"
}).on("load", function() {
  map.repaint = true;
  const wind = windGL({
    id: "wind",
    source: {
      url: "wind/" + windFiles[0] + ".json"
    }
  });
  window.wind = wind;
  map.addLayer(wind, "road-pedestrian-case");
});
