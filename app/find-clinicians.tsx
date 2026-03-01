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
  View
} from "react-native";

type Provider = {
  id: string;
  name: string;
  typeLabel: string;
  address: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  lat?: number;
  lon?: number;
  distanceKm?: number;
  source: "Nearby" | "Featured";
};

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
  const q = encodeURIComponent(`${name} ${address}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

async function openGoogleMaps(name: string, address: string) {
  const url = googleMapsSearchUrl(name, address);
  const can = await Linking.canOpenURL(url);
  if (can) return Linking.openURL(url);
  return Linking.openURL(
    `https://www.google.com/search?q=${encodeURIComponent(`${name} ${address}`)}`,
  );
}

// ---- OSM helpers ----
function buildAddress(tags: any) {
  const parts = [
    tags?.["addr:housenumber"],
    tags?.["addr:street"],
    tags?.["addr:city"],
    tags?.["addr:state"],
    tags?.["addr:postcode"],
  ].filter(Boolean);
  return parts.length
    ? parts.join(" ")
    : (tags?.address ?? "Address not available");
}

function normalizeType(tags: any) {
  const hc = (tags?.healthcare || "").toString().toLowerCase();
  const spec = (tags?.["healthcare:speciality"] || tags?.speciality || "")
    .toString()
    .toLowerCase();
  const amenity = (tags?.amenity || "").toString().toLowerCase();

  if (hc.includes("psychotherapist")) return "Psychotherapist";
  if (hc.includes("counselling") || hc.includes("counseling"))
    return "Counselling";
  if (spec.includes("psychiatry")) return "Psychiatry";
  if (spec.includes("psychotherapy")) return "Psychotherapy";
  if (spec.includes("psychology")) return "Psychology";
  if (amenity === "doctors") return "Doctor";
  if (amenity === "clinic") return "Clinic";
  return "Mental Health Provider";
}

async function overpassMentalHealthNearby(
  lat: number,
  lon: number,
  radiusMeters: number,
) {
  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["healthcare"="psychotherapist"];
  way(around:${radiusMeters},${lat},${lon})["healthcare"="psychotherapist"];
  relation(around:${radiusMeters},${lat},${lon})["healthcare"="psychotherapist"];

  node(around:${radiusMeters},${lat},${lon})["healthcare"="counselling"];
  way(around:${radiusMeters},${lat},${lon})["healthcare"="counselling"];
  relation(around:${radiusMeters},${lat},${lon})["healthcare"="counselling"];

  node(around:${radiusMeters},${lat},${lon})["amenity"="doctors"]["healthcare:speciality"~"psychiatry|psychotherapy|psychology",i];
  way(around:${radiusMeters},${lat},${lon})["amenity"="doctors"]["healthcare:speciality"~"psychiatry|psychotherapy|psychology",i];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="doctors"]["healthcare:speciality"~"psychiatry|psychotherapy|psychology",i];

  node(around:${radiusMeters},${lat},${lon})["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychotherapy|psychology",i];
  way(around:${radiusMeters},${lat},${lon})["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychotherapy|psychology",i];
  relation(around:${radiusMeters},${lat},${lon})["amenity"="clinic"]["healthcare:speciality"~"psychiatry|psychotherapy|psychology",i];
);
out center tags;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.elements) ? data.elements : [];
}

function mapOverpassToProviders(
  elements: any[],
  userLat: number,
  userLon: number,
): Provider[] {
  const mapped = elements
    .map((el: any) => {
      const tags = el.tags || {};
      const name =
        tags.name || tags.operator || tags.brand || "Unknown Provider";

      const lat = el.type === "node" ? el.lat : el.center?.lat;
      const lon = el.type === "node" ? el.lon : el.center?.lon;

      const address = buildAddress(tags);
      const typeLabel = normalizeType(tags);
      const phone = tags.phone || tags["contact:phone"];
      const website = tags.website || tags["contact:website"];
      const openingHours = tags.opening_hours;

      const distanceKm =
        typeof lat === "number" && typeof lon === "number"
          ? kmDistance(userLat, userLon, lat, lon)
          : undefined;

      return {
        id: `osm-${el.type}-${el.id}`,
        name,
        typeLabel,
        address,
        phone,
        website,
        openingHours,
        lat,
        lon,
        distanceKm,
        source: "Nearby",
      } satisfies Provider;
    })
    // de-dupe by name+address
    .filter((p, idx, arr) => {
      const key = `${p.name}__${p.address}`;
      return arr.findIndex((x) => `${x.name}__${x.address}` === key) === idx;
    });

  return mapped;
}

// ---- Featured (curated) ----
// ✅ Professional approach: replace this with Firestore fetch later.
// For now, we keep a tiny fallback so app NEVER feels empty.
const FEATURED_FALLBACK: Provider[] = [
  {
    id: "featured-1",
    name: "Mindful Path Counselling",
    typeLabel: "Counselling",
    address: "Featured provider (shows when curated list is empty)",
    source: "Featured",
    website: "https://www.google.com",
  },
  {
    id: "featured-2",
    name: "CalmBridge Therapy",
    typeLabel: "Psychotherapist",
    address: "Featured provider (replace via Firestore)",
    source: "Featured",
  },
];

export default function FindMentalHealthCliniciansPro() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const [searchText, setSearchText] = useState("");

  const [nearby, setNearby] = useState<Provider[]>([]);
  const [featured, setFeatured] = useState<Provider[]>(FEATURED_FALLBACK);

  const [selected, setSelected] = useState<Provider | null>(null);

  const loadNearby = async () => {
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

      const elements = await overpassMentalHealthNearby(
        lat,
        lon,
        radiusKm * 1000,
      );
      const mapped = mapOverpassToProviders(elements, lat, lon);

      setNearby(mapped);
    } catch (e: any) {
      setNearby([]);
      setErrorMsg(e?.message || "Could not load nearby providers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNearby();
    // Later: also fetch Featured from Firestore based on country/province/city
    // If fetched list is empty, keep fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredNearby = useMemo(() => {
    let list = nearby;
    const s = searchText.trim().toLowerCase();
    if (s)
      list = list.filter((p) =>
        `${p.name} ${p.typeLabel} ${p.address}`.toLowerCase().includes(s),
      );

    if (sortMode === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list = [...list].sort(
        (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
      );
    }
    return list;
  }, [nearby, searchText, sortMode]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Scanning mental health providers near you…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Find Care</Text>
          <Text style={styles.headerSubtitle}>
            Nearby counselling • psychotherapy • psychiatry
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>PRO</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsCard}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search by name, type, area…"
          style={styles.search}
          placeholderTextColor="#8a8f98"
        />

        <View style={styles.chipsRow}>
          <Chip
            label={`Radius ${radiusKm} km`}
            onPress={() =>
              setRadiusKm((r) => (r === 5 ? 10 : r === 10 ? 20 : 5))
            }
          />
          <Chip
            label={`Sort ${sortMode === "distance" ? "Distance" : "Name"}`}
            onPress={() =>
              setSortMode((m) => (m === "distance" ? "name" : "distance"))
            }
          />
          <ChipPrimary label="Scan" onPress={loadNearby} />
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {userLat && userLon ? (
          <Text style={styles.mini}>
            Location: {userLat.toFixed(3)}, {userLon.toFixed(3)}
          </Text>
        ) : null}
      </View>

      {/* Featured Section */}
      <SectionTitle
        title="Featured Practitioners"
        subtitle="More options you can trust"
      />
      <FlatList
        data={featured}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item }) => (
          <FeaturedCard
            provider={item}
            onDetails={() => setSelected(item)}
            onOpen={() => openGoogleMaps(item.name, item.address)}
          />
        )}
      />

      {/* Nearby Section */}
      <SectionTitle
        title="Nearby Providers"
        subtitle={
          filteredNearby.length
            ? `${filteredNearby.length} results near you`
            : "Try increasing radius"
        }
      />

      {filteredNearby.length === 0 ? (
        <EmptyState onScan={loadNearby} />
      ) : (
        <FlatList
          data={filteredNearby}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 18 }}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onDetails={() => setSelected(item)}
              onOpen={() => openGoogleMaps(item.name, item.address)}
            />
          )}
        />
      )}

      {/* Details Modal */}
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
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{selected?.name}</Text>
          <Text style={styles.modalType}>{selected?.typeLabel}</Text>

          <Text style={styles.modalLine}>{selected?.address}</Text>
          {!!selected?.distanceKm && (
            <Text style={styles.modalLine}>
              Distance: {selected.distanceKm.toFixed(1)} km
            </Text>
          )}
          {!!selected?.openingHours && (
            <Text style={styles.modalLine}>Hours: {selected.openingHours}</Text>
          )}
          {!!selected?.phone && (
            <Text style={styles.modalLine}>Phone: {selected.phone}</Text>
          )}
          {!!selected?.website && (
            <Text style={styles.modalLine}>Website: {selected.website}</Text>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalBtnGhost}
              onPress={() => setSelected(null)}
              activeOpacity={0.9}
            >
              <Text style={styles.modalBtnGhostText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={() =>
                selected && openGoogleMaps(selected.name, selected.address)
              }
              activeOpacity={0.9}
            >
              <Text style={styles.modalBtnPrimaryText}>Open in Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.chip}
      activeOpacity={0.85}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipPrimary({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.chipPrimary}
      activeOpacity={0.9}
    >
      <Text style={styles.chipPrimaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

function FeaturedCard({
  provider,
  onDetails,
  onOpen,
}: {
  provider: Provider;
  onDetails: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.featuredCard}>
      <View style={styles.featuredTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {provider.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.featuredPill}>
          <Text style={styles.featuredPillText}>{provider.typeLabel}</Text>
        </View>
      </View>

      <Text style={styles.featuredName} numberOfLines={1}>
        {provider.name}
      </Text>
      <Text style={styles.featuredAddr} numberOfLines={2}>
        {provider.address}
      </Text>

      <View style={styles.cardActionsRow}>
        <TouchableOpacity
          style={styles.btnGhostSmall}
          onPress={onDetails}
          activeOpacity={0.85}
        >
          <Text style={styles.btnGhostSmallText}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnPrimarySmall}
          onPress={onOpen}
          activeOpacity={0.9}
        >
          <Text style={styles.btnPrimarySmallText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProviderCard({
  provider,
  onDetails,
  onOpen,
}: {
  provider: Provider;
  onDetails: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{provider.name}</Text>
          <Text style={styles.type}>{provider.typeLabel}</Text>
        </View>

        {provider.distanceKm != null ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {provider.distanceKm.toFixed(1)} km
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.meta}>{provider.address}</Text>

      {!!provider.openingHours && (
        <Text style={styles.metaSmall}>Hours: {provider.openingHours}</Text>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.btnGhost}
          onPress={onDetails}
          activeOpacity={0.85}
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
  );
}

function EmptyState({ onScan }: { onScan: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>No results in this radius</Text>
      <Text style={styles.emptyText}>
        Try a bigger radius or scan again. Some areas have fewer listings.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={onScan}
        activeOpacity={0.9}
      >
        <Text style={styles.emptyBtnText}>Scan Nearby</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8FC", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, color: "#4b5563", fontWeight: "700" },

  header: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerSubtitle: { color: "#cbd5e1", marginTop: 4, fontWeight: "600" },
  headerBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  headerBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  controlsCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 10,
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

  error: { marginTop: 10, color: "#b00020", fontWeight: "800" },
  mini: { marginTop: 8, color: "#6b7280", fontSize: 12, fontWeight: "700" },

  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },

  featuredCard: {
    width: 240,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  featuredTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  featuredPill: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  featuredPillText: { fontWeight: "900", color: "#1D4ED8", fontSize: 12 },
  featuredName: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },
  featuredAddr: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    lineHeight: 16,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  name: { fontSize: 16, fontWeight: "900", color: "#111827" },
  type: { marginTop: 4, fontSize: 13, fontWeight: "900", color: "#2563EB" },
  badge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: "900", color: "#1D4ED8" },
  meta: {
    marginTop: 8,
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  metaSmall: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },

  cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnGhost: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#F1F5FF",
    paddingVertical: 11,
    alignItems: "center",
  },
  btnGhostText: { fontWeight: "900", color: "#111827" },
  btnPrimary: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    paddingVertical: 11,
    alignItems: "center",
  },
  btnPrimaryText: { fontWeight: "900", color: "#fff" },

  cardActionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnGhostSmall: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#F1F5FF",
    paddingVertical: 10,
    alignItems: "center",
  },
  btnGhostSmallText: { fontWeight: "900", color: "#111827", fontSize: 12 },
  btnPrimarySmall: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    paddingVertical: 10,
    alignItems: "center",
  },
  btnPrimarySmallText: { fontWeight: "900", color: "#fff", fontSize: 12 },

  emptyWrap: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    color: "#6b7280",
    fontWeight: "700",
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  emptyBtnText: { color: "#fff", fontWeight: "900" },

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
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e6e6e6",
    alignSelf: "center",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  modalType: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "900",
    color: "#2563EB",
  },
  modalLine: {
    marginTop: 8,
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalBtnGhost: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#F1F5FF",
    paddingVertical: 11,
    alignItems: "center",
  },
  modalBtnGhostText: { fontWeight: "900", color: "#111827" },
  modalBtnPrimary: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    paddingVertical: 11,
    alignItems: "center",
  },
  modalBtnPrimaryText: { fontWeight: "900", color: "#fff" },
});
