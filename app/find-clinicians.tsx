import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ProviderMap from "../components/ProviderMap";

type Provider = {
  id: string;
  name: string;
  typeLabel: string;
  address: string;
  lat?: number;
  lon?: number;
  distanceKm?: number;
  openNow?: boolean;
  rating?: number;
  userRatingsTotal?: number;
  phone?: string;
  website?: string;
};

type ViewMode = "list" | "map";
type SortMode = "distance" | "name";

function kmDistance(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function googleMapsSearchUrl(name: string, address: string) {
  const q = encodeURIComponent(`${name} ${address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

async function openGoogleMapsSearch(name: string, address: string) {
  const url = googleMapsSearchUrl(name, address);
  const can = await Linking.canOpenURL(url);
  if (can) return Linking.openURL(url);
  return Linking.openURL(
    `https://www.google.com/search?q=${encodeURIComponent(`${name} ${address}`.trim())}`,
  );
}

function buildAddress(tags: any) {
  const parts = [
    tags?.["addr:housenumber"],
    tags?.["addr:street"],
    tags?.["addr:city"],
    tags?.["addr:state"],
    tags?.["addr:postcode"],
  ].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return tags?.address || tags?.["contact:address"] || "Address not available";
}

function normalizeType(tags: any) {
  const hc = String(tags?.healthcare || "").toLowerCase();
  const spec = String(
    tags?.["healthcare:speciality"] || tags?.speciality || "",
  ).toLowerCase();
  const amenity = String(tags?.amenity || "").toLowerCase();

  if (hc.includes("psychotherapist")) return "Psychotherapist";
  if (hc.includes("counselling") || hc.includes("counseling"))
    return "Counselling";
  if (spec.includes("psychiatry")) return "Psychiatrist";
  if (spec.includes("psychology")) return "Psychologist";
  if (spec.includes("psychotherapy")) return "Psychotherapist";
  if (amenity === "clinic") return "Clinic";
  if (amenity === "doctors") return "Doctor";
  return "Mental Health Provider";
}

function mappedFromElements(
  elements: any[],
  lat: number,
  lon: number,
): Provider[] {
  const mapped: Provider[] = elements
    .map((el: any) => {
      const tags = el.tags || {};
      const name = tags.name || tags.operator || "Unknown Provider";
      const pLat = el.type === "node" ? el.lat : el.center?.lat;
      const pLon = el.type === "node" ? el.lon : el.center?.lon;

      const latOk = typeof pLat === "number";
      const lonOk = typeof pLon === "number";

      const distanceKm =
        latOk && lonOk ? kmDistance(lat, lon, pLat, pLon) : undefined;

      return {
        id: `osm-${el.type}-${el.id}`,
        name,
        typeLabel: normalizeType(tags),
        address: buildAddress(tags),
        lat: latOk ? pLat : undefined,
        lon: lonOk ? pLon : undefined,
        distanceKm,
        phone: tags.phone || tags["contact:phone"],
        website: tags.website || tags["contact:website"],
      };
    })
    .filter((p, idx, arr) => {
      const key = `${p.name}__${p.address}`;
      return arr.findIndex((x) => `${x.name}__${x.address}` === key) === idx;
    })
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

  return mapped;
}

async function fetchOverpassMentalHealth(
  lat: number,
  lon: number,
  radiusKm: number,
) {
  const radiusMeters = Math.round(radiusKm * 1000);

  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["healthcare"="psychotherapist"];
  way(around:${radiusMeters},${lat},${lon})["healthcare"="psychotherapist"];
  relation(around:${radiusMeters},${lat},${lon})["healthcare"="psychotherapist"];

  node(around:${radiusMeters},${lat},${lon})["healthcare"="counselling"];
  way(around:${radiusMeters},${lat},${lon})["healthcare"="counselling"];
  relation(around:${radiusMeters},${lat},${lon})["healthcare"="counselling"];

  node(around:${radiusMeters},${lat},${lon})["amenity"="doctors"]["healthcare:speciality"~"psychiatry|psychology|psychotherapy",i];
  way(around:${radiusMeters},${lat},${lon})["amenity"="doctors"]["healthcare:speciality"~"psychiatry|psychology|psychotherapy",i];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="doctors"]["healthcare:speciality"~"psychiatry|psychology|psychotherapy",i];

  node(around:${radiusMeters},${lat},${lon})["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychology|psychotherapy",i];
  way(around:${radiusMeters},${lat},${lon})["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychology|psychotherapy",i];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychology|psychotherapy",i];
);
out center tags;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  let lastErr: any = null;

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: query,
      });

      if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);

      const json = await res.json();
      const elements = Array.isArray(json?.elements) ? json.elements : [];
      return mappedFromElements(elements, lat, lon);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Overpass request failed");
}

function ProviderCard({
  item,
  onDetails,
  onOpen,
}: {
  item: Provider;
  onDetails: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.cardPremium}>
      <View style={styles.cardAccent} />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={styles.subRow}>
              <View style={styles.typePill}>
                <Text style={styles.typePillText} numberOfLines={1}>
                  {item.typeLabel}
                </Text>
              </View>

              {typeof item.distanceKm === "number" ? (
                <View style={styles.distancePill}>
                  <Text style={styles.distanceText}>
                    {item.distanceKm.toFixed(1)} km
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.cardAddress} numberOfLines={2}>
          {item.address}
        </Text>

        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={onDetails}
            activeOpacity={0.9}
          >
            <Text style={styles.btnGhostText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={onOpen}
            activeOpacity={0.9}
          >
            <Text style={styles.btnPrimaryText}>View Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function FindClinicians() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<Provider | null>(null);

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchText, setSearchText] = useState("");
  const [radiusKm, setRadiusKm] = useState(15);
  const [sortMode, setSortMode] = useState<SortMode>("distance");

  const filtered = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    let list = providers;

    if (s) {
      list = list.filter((p) =>
        `${p.name} ${p.typeLabel} ${p.address}`.toLowerCase().includes(s),
      );
    }

    if (sortMode === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].sort(
        (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
      );
    }

    return list;
  }, [providers, searchText, sortMode]);

  const load = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission denied.");

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;

      setUserLat(lat);
      setUserLon(lon);

      const items = await fetchOverpassMentalHealth(lat, lon, radiusKm);
      setProviders(items);
    } catch (e: any) {
      setProviders([]);
      setErrorMsg(e?.message || "Failed to load providers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [radiusKm]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Find Care</Text>

          <View style={styles.toggleWrap}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === "list" && styles.toggleActive,
              ]}
              onPress={() => setViewMode("list")}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === "list" && styles.toggleTextActive,
                ]}
              >
                List
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === "map" && styles.toggleActive,
              ]}
              onPress={() => setViewMode("map")}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.toggleText,
                  viewMode === "map" && styles.toggleTextActive,
                ]}
              >
                Map
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <View style={styles.controlsCard}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search name, type, area"
            style={styles.search}
            placeholderTextColor="#8a8f98"
          />

          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() =>
                setRadiusKm((r) => (r === 10 ? 15 : r === 15 ? 25 : 10))
              }
              activeOpacity={0.9}
            >
              <Text style={styles.chipText}>Radius {radiusKm} km</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chip}
              onPress={() =>
                setSortMode((m) => (m === "distance" ? "name" : "distance"))
              }
              activeOpacity={0.9}
            >
              <Text style={styles.chipText}>
                Sort {sortMode === "distance" ? "Distance" : "Name"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chipPrimary}
              onPress={load}
              activeOpacity={0.9}
            >
              <Text style={styles.chipPrimaryText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === "map" ? (
          userLat != null && userLon != null ? (
            <ProviderMap
              userLat={userLat}
              userLon={userLon}
              radiusKm={radiusKm}
              providers={filtered}
              onSelect={(p: Provider) => setSelected(p)}
            />
          ) : (
            <View style={styles.webMapCard}>
              <Text style={styles.webMapTitle}>Location not available</Text>
              <Text style={styles.webMapSub}>
                Enable location services and try again.
              </Text>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={load}
                activeOpacity={0.9}
              >
                <Text style={styles.btnPrimaryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )
        ) : filtered.length === 0 ? (
          <View style={styles.webMapCard}>
            <Text style={styles.webMapTitle}>No results found</Text>
            <Text style={styles.webMapSub}>
              Try increasing the radius and scan again.
            </Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={load}
              activeOpacity={0.9}
            >
              <Text style={styles.btnPrimaryText}>Scan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 18 }}
            refreshing={loading}
            onRefresh={load}
            renderItem={({ item }) => (
              <ProviderCard
                item={item}
                onDetails={() => setSelected(item)}
                onOpen={() => openGoogleMapsSearch(item.name, item.address)}
              />
            )}
          />
        )}

        <Modal
          visible={!!selected}
          transparent
          animationType="fade"
          onRequestClose={() => setSelected(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelected(null)}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{selected?.name}</Text>
            <Text style={styles.modalLine}>{selected?.typeLabel}</Text>
            <Text style={styles.modalLine}>{selected?.address}</Text>

            {selected?.phone ? (
              <Text style={styles.modalLine}>Phone: {selected.phone}</Text>
            ) : null}
            {selected?.website ? (
              <Text style={styles.modalLine}>Website: {selected.website}</Text>
            ) : null}
            {typeof selected?.distanceKm === "number" ? (
              <Text style={styles.modalLine}>
                Distance: {selected.distanceKm.toFixed(1)} km
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => setSelected(null)}
                activeOpacity={0.9}
              >
                <Text style={styles.btnGhostText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() =>
                  selected &&
                  openGoogleMapsSearch(selected.name, selected.address)
                }
                activeOpacity={0.9}
              >
                <Text style={styles.btnPrimaryText}>Open in Google</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F8FC",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  container: {
    flex: 1,
    backgroundColor: "#F7F8FC",
    padding: 16,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 980 : undefined,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 20, fontWeight: "900", color: "#111827" },

  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 4,
  },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  toggleActive: { backgroundColor: "#3B82F6" },
  toggleText: { fontWeight: "900", color: "#111827", fontSize: 12 },
  toggleTextActive: { color: "#fff" },

  error: { color: "#b00020", fontWeight: "800", marginBottom: 10 },

  controlsCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  search: {
    backgroundColor: "#F1F5FF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
  },

  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  chip: {
    backgroundColor: "#F1F5FF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipText: { fontWeight: "900", color: "#111827", fontSize: 12 },
  chipPrimary: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipPrimaryText: { fontWeight: "900", color: "#fff", fontSize: 12 },

  webMapCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  webMapTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  webMapSub: {
    marginTop: 6,
    color: "#6b7280",
    fontWeight: "700",
    lineHeight: 18,
  },

  cardPremium: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  cardAccent: { height: 4, backgroundColor: "#3B82F6" },
  cardBody: { padding: 16 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  subRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  typePill: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  typePillText: { fontSize: 12, fontWeight: "900", color: "#1D4ED8" },
  distancePill: {
    backgroundColor: "#F1F5FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { fontSize: 12, fontWeight: "900", color: "#111827" },
  cardAddress: {
    marginTop: 10,
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  cardActionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },

  btnGhost: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    paddingVertical: 12,
    alignItems: "center",
  },
  btnGhostText: { fontWeight: "900", color: "#111827" },
  btnPrimary: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimaryText: { fontWeight: "900", color: "#fff" },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  modalLine: {
    marginTop: 6,
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
