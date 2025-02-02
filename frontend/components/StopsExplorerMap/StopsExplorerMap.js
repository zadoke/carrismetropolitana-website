'use client';

import OSMMap from '@/components/OSMMap/OSMMap';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import { useMap, Source, Layer, Popup, GeolocateControl } from 'react-map-gl/maplibre';
import { useDebugContext } from '@/contexts/DebugContext';
import { useStopsExplorerContext } from '@/contexts/StopsExplorerContext';
import useSWR from 'swr';
import generateUUID from '@/services/generateUUID';

/* * */

const MAP_DEFAULT_OPTIONS = {
  speed: 4000,
  duration: 2000,
  zoom: 17,
  zoomMargin: 3,
  maxZoom: 16,
};

/* * */

export default function StopsExplorerMap() {
  //

  //
  // A. Setup variables

  const debugContext = useDebugContext();

  const { stopsExplorerMap } = useMap();
  const stopsExplorerContext = useStopsExplorerContext();

  const [selectedMapFeature, setSelectedMapFeature] = useState(null);

  //
  // B. Fetch data

  const { data: allStopsData } = useSWR('https://api.carrismetropolitana.pt/stops');
  const { data: allVehiclesData } = useSWR('https://api.carrismetropolitana.pt/vehicles', { refreshInterval: 5000 });
  const { data: selectedPatternData } = useSWR(stopsExplorerContext.entities.pattern_id && `https://api.carrismetropolitana.pt/patterns/${stopsExplorerContext.entities.pattern_id}`);
  const { data: selectedShapeData } = useSWR(stopsExplorerContext.entities.shape_id && `https://api.carrismetropolitana.pt/shapes/${stopsExplorerContext.entities.shape_id}`);

  //
  // C. Transform data

  const allStopsMapData = useMemo(() => {
    const geoJSON = { type: 'FeatureCollection', features: [] };
    if (allStopsData) {
      for (const stop of allStopsData) {
        geoJSON.features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
          properties: {
            mapid: `${stop.id}|${generateUUID()}`,
            id: stop.id,
            name: stop.name,
            lat: stop.lat,
            lon: stop.lon,
          },
        });
      }
    }
    return geoJSON;
  }, [allStopsData]);

  const selectedStopMapData = useMemo(() => {
    if (stopsExplorerContext.entities.stop) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [stopsExplorerContext.entities.stop.lon, stopsExplorerContext.entities.stop.lat],
        },
        properties: {
          id: stopsExplorerContext.entities.stop.id,
        },
      };
    }
  }, [stopsExplorerContext.entities.stop]);

  const selectedShapeMapData = useMemo(() => {
    if (selectedPatternData && selectedShapeData) {
      return {
        ...selectedShapeData.geojson,
        properties: {
          color: selectedPatternData.color,
        },
      };
    }
    return null;
  }, [selectedPatternData, selectedShapeData]);

  const selectedVehicleMapData = useMemo(() => {
    if (allVehiclesData && stopsExplorerContext.entities.trip_id) {
      const selectedVehicleData = allVehiclesData.find((item) => item.trip_id && item.trip_id === stopsExplorerContext.entities.trip_id);
      if (selectedVehicleData) {
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [selectedVehicleData.lon, selectedVehicleData.lat],
          },
          properties: {
            id: selectedVehicleData.id,
            speed: selectedVehicleData.speed,
            timestamp: selectedVehicleData.timestamp,
            timeString: new Date(selectedVehicleData.timestamp * 1000).toLocaleString(),
            delay: Math.floor(Date.now() / 1000) - selectedVehicleData.timestamp,
            heading: selectedVehicleData.heading,
            trip_id: selectedVehicleData.trip_id,
            pattern_id: selectedVehicleData.pattern_id,
          },
        };
      }
      return null;
    }
  }, [allVehiclesData, stopsExplorerContext.entities.trip_id]);

  const selectedCoordinatesMapData = useMemo(() => {
    if (stopsExplorerContext.map.selected_coordinates) {
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: stopsExplorerContext.map.selected_coordinates,
        },
      };
    }
    return null;
  }, [stopsExplorerContext.map.selected_coordinates]);

  //
  // C. Handle actions

  useEffect(() => {
    if (!stopsExplorerMap) return;
    // Load direction arrows
    stopsExplorerMap.loadImage('/icons/shape-arrow-direction.png', (error, image) => {
      if (error) throw error;
      stopsExplorerMap.addImage('shape-arrow-direction', image, { sdf: true });
    });
    // Load vehicle symbol
    stopsExplorerMap.loadImage('/icons/bus.png', (error, image) => {
      if (error) throw error;
      stopsExplorerMap.addImage('bus', image, { sdf: false });
    });
    // Load vehicle symbol
    stopsExplorerMap.loadImage('/icons/bus-dead.png', (error, image) => {
      if (error) throw error;
      stopsExplorerMap.addImage('bus-dead', image, { sdf: false });
    });
    // Load vehicle symbol
    stopsExplorerMap.loadImage('/icons/bus-delay.png', (error, image) => {
      if (error) throw error;
      stopsExplorerMap.addImage('bus-delay', image, { sdf: false });
    });
    // Load stop selected symbol
    stopsExplorerMap.loadImage('/icons/map-stop-selected.png', (error, image) => {
      if (error) throw error;
      stopsExplorerMap.addImage('stop-selected', image, { sdf: false });
    });
    // Load pin symbol
    stopsExplorerMap.loadImage('/icons/map-pin.png', (error, image) => {
      if (error) throw error;
      stopsExplorerMap.addImage('map-pin', image, { sdf: false });
    });
  }, [stopsExplorerMap]);

  useEffect(() => {
    if (selectedStopMapData && selectedVehicleMapData) {
      // Get window width and height
      let fitBoundsPadding = 100;
      if (window.innerWidth < window.innerHeight) fitBoundsPadding = 50;
      // Fit map
      const collection = turf.featureCollection([selectedStopMapData, selectedVehicleMapData]);
      const boundingBox = turf.bbox(collection);
      stopsExplorerMap.fitBounds(boundingBox, { duration: 2000, padding: fitBoundsPadding, bearing: stopsExplorerMap.getBearing(), maxZoom: 16 });
    }
  }, [selectedStopMapData, selectedVehicleMapData, stopsExplorerMap]);

  //
  // C. Helper functions

  const moveMap = useCallback(
    (coordinates) => {
      // Get map current zoom level
      const currentZoom = stopsExplorerMap.getZoom();
      const currentZoomWithMargin = currentZoom + MAP_DEFAULT_OPTIONS.zoomMargin;
      // Check if the given coordinates are inside the currently rendered map bounds
      const currentMapBounds = stopsExplorerMap.getBounds().toArray();
      const isInside = turf.booleanIntersects(turf.point(coordinates), turf.bboxPolygon([...currentMapBounds[0], ...currentMapBounds[1]]));
      // If the given coordinates are visible and the zoom is not too far back (plus a little margin)...
      if (isInside && currentZoomWithMargin > MAP_DEFAULT_OPTIONS.zoom) {
        // ...then simply ease to it.
        stopsExplorerMap.easeTo({ center: coordinates, zoom: currentZoom, duration: MAP_DEFAULT_OPTIONS.speed * 0.25 });
      } else {
        // If the zoom is too far, or the given coordinates are not visible, then fly to it
        stopsExplorerMap.flyTo({ center: coordinates, zoom: MAP_DEFAULT_OPTIONS.zoom, duration: MAP_DEFAULT_OPTIONS.speed });
      }
    },
    [stopsExplorerMap]
  );

  //
  // C. Handle actions

  useEffect(() => {
    if (stopsExplorerContext.entities.stop?.id) {
      // Get map feature matching currently selected stop_id
      const stopMapFeature = allStopsMapData?.features.find((f) => f.properties?.id === stopsExplorerContext.entities.stop?.id);
      if (!stopMapFeature) return;
      // Move map to this location
      moveMap(stopMapFeature.geometry?.coordinates);
      // Update local state
      setSelectedMapFeature(stopMapFeature);
    } else {
      setSelectedMapFeature(null);
    }
  }, [allStopsMapData?.features, moveMap, stopsExplorerContext.entities.stop?.id, stopsExplorerMap]);

  useEffect(() => {
    if (stopsExplorerContext.map.selected_coordinates) {
      moveMap(stopsExplorerContext.map.selected_coordinates);
    }
  }, [moveMap, stopsExplorerContext.map.selected_coordinates]);

  const handleMapClick = (event) => {
    if (event?.features[0]?.properties?.id) {
      stopsExplorerContext.selectStop(event.features[0].properties.id);
    }
  };

  const handleMapMouseEnter = (event) => {
    if (event?.features[0]?.properties?.id) {
      stopsExplorerMap.getCanvas().style.cursor = 'pointer';
    }
  };

  const handleMapMouseLeave = (event) => {
    if (event?.features[0]?.properties?.id) {
      stopsExplorerMap.getCanvas().style.cursor = 'default';
    }
  };

  const handleMapMove = () => {
    // Get all currently rendered features and mark all of them as unselected
    const allRenderedFeatures = stopsExplorerMap.queryRenderedFeatures();
    allRenderedFeatures.forEach(function (f) {
      stopsExplorerMap.setFeatureState({ source: 'all-stops', id: f.id }, { selected: false });
    });
    // Then mark the selected one as selected
    if (selectedMapFeature) {
      stopsExplorerMap.setFeatureState({ source: 'all-stops', id: selectedMapFeature.properties.mapid }, { selected: true });
    }
  };

  //
  // G. Render components

  return (
    <OSMMap id="stopsExplorerMap" mapStyle={stopsExplorerContext.map.style} onClick={handleMapClick} onMouseEnter={handleMapMouseEnter} onMouseLeave={handleMapMouseLeave} onMove={handleMapMove} interactiveLayerIds={['all-stops']}>
      <GeolocateControl />
      {selectedVehicleMapData && debugContext.isDebug && (
        <Popup closeButton={false} closeOnClick={false} latitude={selectedVehicleMapData.geometry.coordinates[1]} longitude={selectedVehicleMapData.geometry.coordinates[0]} anchor="bottom">
          <div>Vehicle ID: {selectedVehicleMapData.properties.id}</div>
          <div>Timestamp: {selectedVehicleMapData.properties.timeString}</div>
          <div>Delay: {selectedVehicleMapData.properties.delay} seconds</div>
        </Popup>
      )}
      {selectedVehicleMapData && (
        <Source id="selected-vehicle" type="geojson" data={selectedVehicleMapData} generateId={true}>
          <Layer
            id="selected-vehicle"
            type="symbol"
            source="selected-vehicle"
            layout={{
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'symbol-placement': 'point',
              'icon-rotation-alignment': 'map',
              'icon-image': 'bus',
              'icon-size': ['interpolate', ['linear', 0.5], ['zoom'], 10, 0.05, 20, 0.15],
              'icon-offset': [0, 0],
              'icon-rotate': selectedVehicleMapData.properties.heading || 0,
            }}
            paint={{
              'icon-opacity': ['interpolate', ['linear', 0.5], ['zoom'], 7, 0, 10, 1],
            }}
          />
          {/* <Layer
            id="selected-vehicle-delay"
            type="symbol"
            source="selected-vehicle"
            layout={{
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'symbol-placement': 'point',
              'icon-rotation-alignment': 'map',
              'icon-image': 'bus-delay',
              'icon-size': ['interpolate', ['linear', 0.5], ['zoom'], 10, 0.05, 20, 0.15],
              'icon-offset': [0, 0],
              'icon-rotate': selectedVehicleMapData.properties.heading || 0,
            }}
            paint={{
              'icon-opacity': ['interpolate', ['linear', 0.5], ['get', 'delay'], 20, 0, 21, 1],
            }}
          /> */}
          <Layer
            id="selected-vehicle-dead"
            type="symbol"
            source="selected-vehicle"
            layout={{
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'symbol-placement': 'point',
              'icon-rotation-alignment': 'map',
              'icon-image': 'bus-dead',
              'icon-size': ['interpolate', ['linear', 0.5], ['zoom'], 10, 0.05, 20, 0.15],
              'icon-offset': [0, 0],
              'icon-rotate': selectedVehicleMapData.properties.heading || 0,
            }}
            paint={{
              'icon-opacity': ['interpolate', ['linear', 0.5], ['get', 'delay'], 20, 0, 40, 1],
            }}
          />
        </Source>
      )}
      {stopsExplorerContext.map.selected_coordinates != null && (
        <Source id="selected-coordinates" type="geojson" data={selectedCoordinatesMapData} generateId={true}>
          <Layer
            id="selected-coordinates-pin"
            type="symbol"
            source="selected-coordinates"
            layout={{
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'bottom',
              'symbol-placement': 'point',
              'icon-image': 'map-pin',
              'icon-size': ['interpolate', ['linear', 0.5], ['zoom'], 10, 0.25, 20, 0.35],
              'icon-offset': [0, 5],
            }}
            paint={{
              'icon-opacity': ['interpolate', ['linear', 0.5], ['zoom'], 7, 0, 10, 1],
            }}
          />
        </Source>
      )}
      {selectedStopMapData && (
        <Source id="selected-stop" type="geojson" data={selectedStopMapData} generateId={true}>
          <Layer
            id="selected-stop"
            type="symbol"
            source="selected-stop"
            beforeId={selectedVehicleMapData && 'selected-vehicle'}
            layout={{
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'bottom',
              'symbol-placement': 'point',
              'icon-image': 'stop-selected',
              'icon-size': ['interpolate', ['linear', 0.5], ['zoom'], 10, 0.1, 20, 0.25],
              'icon-offset': [0, 5],
            }}
            paint={{
              'icon-opacity': ['interpolate', ['linear', 0.5], ['zoom'], 7, 0, 10, 1],
            }}
          />
        </Source>
      )}
      {allStopsMapData && (
        <Source id="all-stops" type="geojson" data={allStopsMapData} generateId={false} promoteId={'mapid'}>
          <Layer
            id="all-stops"
            source="all-stops"
            beforeId={selectedStopMapData && 'selected-stop'}
            type="circle"
            paint={{
              'circle-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ffffff', '#ffdd01'],
              'circle-radius': ['interpolate', ['linear', 0.5], ['zoom'], 9, ['case', ['boolean', ['feature-state', 'selected'], false], 5, 1], 26, ['case', ['boolean', ['feature-state', 'selected'], false], 15, 10]],
              'circle-stroke-width': ['interpolate', ['linear', 1], ['zoom'], 9, 0.01, 26, 6],
              'circle-stroke-color': '#000000',
              'circle-pitch-alignment': 'map',
            }}
          />
        </Source>
      )}
      {selectedShapeMapData && (
        <Source id="selected-shape" type="geojson" data={selectedShapeMapData} generateId={true}>
          <Layer
            id="selected-shape-direction"
            type="symbol"
            source="selected-shape"
            beforeId="all-stops"
            layout={{
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'icon-anchor': 'center',
              'symbol-placement': 'line',
              'icon-image': 'shape-arrow-direction',
              'icon-size': ['interpolate', ['linear', 0.5], ['zoom'], 10, 0.1, 20, 0.2],
              'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 10, 2, 20, 30],
              'icon-offset': [0, 0],
              'icon-rotate': 90,
            }}
            paint={{
              'icon-color': '#ffffff',
              'icon-opacity': 0.8,
            }}
          />
          <Layer
            id="selected-shape-line"
            type="line"
            source="selected-shape"
            beforeId="selected-shape-direction"
            layout={{
              'line-join': 'round',
              'line-cap': 'round',
            }}
            paint={{
              'line-color': selectedShapeMapData.properties.color,
              'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 20, 12],
            }}
          />
        </Source>
      )}
    </OSMMap>
  );
}
