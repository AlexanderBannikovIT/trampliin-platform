"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Map as LeafletMap } from "leaflet";
import type { GeoJsonFeature, GeoJsonFeatureCollection } from "@/types";
import PopupCard from "./PopupCard";
import OpportunityPreview from "./OpportunityPreview";

const DEFAULT_CENTER: [number, number] = [55.752, 37.618];
const DEFAULT_ZOOM = 10;
const MARKER_NORMAL = "#9CA3AF";
const MARKER_FAVORITE = "#BA7517";

function createPinIcon(color: string): L.DivIcon {
  const svg = `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0Z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -40],
  });
}

export interface YandexMapProps {
  geoJson: GeoJsonFeatureCollection;
  favoriteIds: Set<string>;
  onMarkerClick: (opportunityId: string) => void;
}

export default function YandexMap({ geoJson, favoriteIds, onMarkerClick }: YandexMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const normalIcon = useMemo(() => createPinIcon(MARKER_NORMAL), []);
  const favoriteIcon = useMemo(() => createPinIcon(MARKER_FAVORITE), []);
  const [selectedFeature, setSelectedFeature] = useState<GeoJsonFeature | null>(null);

  useEffect(() => {
    return () => {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch (e) {
        // игнорируем ошибки при размонтировании
      }
    };
  }, []);

  return (
    <>
      <MapContainer
        ref={mapRef}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ width: "100%", height: "600px" }}
        className="rounded-xl overflow-hidden"
      >
        <TileLayer
          url="https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1"
          attribution='© 2ГИС'
        />

        {geoJson.features.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const isFav = favoriteIds.has(feature.properties.id);
          const icon = isFav ? favoriteIcon : normalIcon;

          return (
            <Marker
              key={feature.properties.id}
              position={[lat, lng]}
              icon={icon}
              eventHandlers={{
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup(),
                click: (e) => {
                  e.target.closePopup();
                  setTimeout(() => setSelectedFeature(feature), 150);
                },
              }}
            >
              <Popup>
                <PopupCard feature={feature} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <OpportunityPreview
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onOpen={(id) => {
          setSelectedFeature(null);
          setTimeout(() => onMarkerClick(id), 100);
        }}
      />
    </>
  );
}
