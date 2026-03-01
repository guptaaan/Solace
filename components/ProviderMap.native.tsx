import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";

type Provider = {
  id: string;
  name: string;
  typeLabel: string;
  lat?: number;
  lon?: number;
};

export default function ProviderMap({
  userLat,
  userLon,
  radiusKm,
  providers,
  onSelect,
}: {
  userLat: number;
  userLon: number;
  radiusKm: number;
  providers: Provider[];
  onSelect: (p: Provider) => void;
}) {
  const region: Region = useMemo(() => {
    const d = radiusKm <= 5 ? 0.06 : radiusKm <= 10 ? 0.1 : 0.16;
    return {
      latitude: userLat,
      longitude: userLon,
      latitudeDelta: d,
      longitudeDelta: d,
    };
  }, [userLat, userLon, radiusKm]);

  return (
    <View style={styles.wrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        region={region}
        showsUserLocation
        showsMyLocationButton
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      >
        {providers
          .filter((p) => typeof p.lat === "number" && typeof p.lon === "number")
          .map((p) => (
            <Marker
              key={p.id}
              coordinate={{
                latitude: p.lat as number,
                longitude: p.lon as number,
              }}
              title={p.name}
              description={p.typeLabel}
              onPress={() => onSelect(p)}
            />
          ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
});
