import React, { useMemo } from "react";
import {
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Provider = {
  id: string;
  name: string;
  typeLabel: string;
  lat?: number;
  lon?: number;
};

function mapsSearchUrl(lat: number, lon: number, radiusKm: number) {
  const q = encodeURIComponent(`mental health therapist near ${lat},${lon}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}&radius=${Math.round(radiusKm * 1000)}`;
}

function mapsEmbedUrl(lat: number, lon: number) {
  // No API key needed for this simple embed view
  return `https://maps.google.com/maps?q=${lat},${lon}&z=13&output=embed`;
}

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
  const embedSrc = useMemo(
    () => mapsEmbedUrl(userLat, userLon),
    [userLat, userLon],
  );
  const openAllUrl = useMemo(
    () => mapsSearchUrl(userLat, userLon, radiusKm),
    [userLat, userLon, radiusKm],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.embedFrame}>
        <iframe
          title="map"
          src={embedSrc}
          style={{ width: "100%", height: "100%", border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </View>

      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Map preview</Text>
        <Text style={styles.overlaySub}>
          Pins are shown in the list below. Open Google Maps to navigate.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => Linking.openURL(openAllUrl)}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryBtnText}>Open Google Maps Results</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {providers.slice(0, 6).map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.row}
            onPress={() => onSelect(p)}
            activeOpacity={0.9}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.type} numberOfLines={1}>
                {p.typeLabel}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {providers.length > 6 ? (
          <Text style={styles.moreText}>
            More results are available in the list view.
          </Text>
        ) : null}
      </View>
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
  embedFrame: {
    height: 280,
    width: "100%",
    backgroundColor: "#f3f4f6",
  },
  overlay: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef2ff",
  },
  overlayTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  overlaySub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    lineHeight: 16,
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
  },
  list: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef2ff",
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5FF",
    marginBottom: 8,
  },
  name: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  type: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  moreText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
});
