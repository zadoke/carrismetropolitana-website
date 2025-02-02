'use client';

import useSWR from 'swr';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// A.
// SETUP INITIAL STATE

const initialMapState = {
  style: 'map',
  auto_zoom: null,
};

const initialEntitiesState = {
  //
  municipality: null,
  //
  date: null,
  //
  line: null,
  pattern: null,
  shape: null,
  //
  stop_id: null,
  vehicle_id: null,
  trip_id: null,
};

// B.
// CREATE CONTEXTS

const LinesExplorerContext = createContext(null);

// C.
// SETUP CUSTOM HOOKS

export function useLinesExplorerContext() {
  return useContext(LinesExplorerContext);
}

// D.
// SETUP PROVIDER

export function LinesExplorerContextProvider({ children }) {
  //

  //
  // A. Setup state

  const [mapState, setMapState] = useState(initialMapState);
  const [entitiesState, setEntitiesState] = useState(initialEntitiesState);

  //
  // B. Fetch data

  const { data: allLinesData } = useSWR('https://api.carrismetropolitana.pt/lines');
  const { data: allMunicipalitiesData } = useSWR('https://api.carrismetropolitana.pt/municipalities');

  //
  // C. Supporting functions

  const updateWindowUrl = (lineId = 'all', lineName = 'Carris Metropolitana') => {
    const newUrl = `/lines/${lineId}`;
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    document.title = lineName;
  };

  //
  // B. Setup actions

  const selectMunicipality = useCallback(
    (municipalityId) => {
      const foundMunicipality = allMunicipalitiesData.find((item) => item.id === municipalityId);
      if (foundMunicipality) {
        setEntitiesState((prev) => ({ ...prev, municipality: foundMunicipality }));
      }
    },
    [allMunicipalitiesData]
  );

  const clearSelectedMunicipality = useCallback(() => {
    setEntitiesState((prev) => ({ ...prev, municipality: null }));
  }, []);

  // ---------

  const selectLine = useCallback(
    (lineId) => {
      const foundLine = allLinesData.find((item) => item.id === lineId);
      if (foundLine) {
        setEntitiesState((prev) => ({ ...prev, line: foundLine, pattern: null, shape: null }));
        updateWindowUrl(lineId, foundLine.long_name);
      }
    },
    [allLinesData]
  );

  const clearSelectedLine = useCallback(() => {
    setEntitiesState((prev) => ({ ...initialEntitiesState, municipality: prev.municipality }));
    updateWindowUrl();
  }, []);

  // ---------

  const updateMapState = useCallback(
    (newMapState, reset = false) => {
      if (reset) setMapState({ ...initialMapState, ...newMapState });
      else setMapState({ ...mapState, ...newMapState });
    },
    [mapState]
  );

  const updateEntitiesState = useCallback(
    (newEntitiesState, reset = false) => {
      if (reset) setEntitiesState({ ...initialEntitiesState, ...newEntitiesState });
      else setEntitiesState({ ...entitiesState, ...newEntitiesState });
    },
    [entitiesState]
  );

  //
  // C. Setup context object

  const contextObject = useMemo(
    () => ({
      //
      map: mapState,
      updateMap: updateMapState,
      //
      entities: entitiesState,
      updateEntities: updateEntitiesState,
      //
      selectMunicipality,
      clearSelectedMunicipality,
      //
      selectLine,
      clearSelectedLine,
      //
    }),
    [mapState, updateMapState, entitiesState, updateEntitiesState, selectMunicipality, clearSelectedMunicipality, selectLine, clearSelectedLine]
  );

  //
  // D. Return provider

  return <LinesExplorerContext.Provider value={contextObject}>{children}</LinesExplorerContext.Provider>;

  //
}
