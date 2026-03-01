import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Clinician = {
  id: string;
  name: string;
  specialty?: string;
  address?: string;
  phone?: string;
  organization?: string;
  statusLabel?: string; // e.g., "Hours: Mo-Fr 09:00-17:00" or "Status unknown"
  languages?: string[]; // for filtering (client-side)
  source: "DoctorsAPI" | "OSM";
};

type SortMode = "relevance" | "name";

const DOCTORS_API_KEY =
  "hk_mix8w0lebcff1117f5d1f75df41bf199dae88d66b8953a7b90f2b84934d99b55897ca252";

// ---- Helpers (OSM) ----
async function geocodeCityToLatLon(city: string, state: string) {
  // Nominatim: free geocoder (rate-limited). Use responsibly.
  const q = encodeURIComponent(`${city}, ${state}, Canada`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;

  const res = await fetch(url, {
    headers: {
      // Nominatim asks for a valid UA via header in many clients; keep it simple:
      "User-Agent": "SolaceApp/1.0 (expo-react-native)",
    },
  });

  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0)
    throw new Error("No geocode result");
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

function buildAddressFromTags(tags: any) {
  const parts = [
    tags?.["addr:housenumber"],
    tags?.["addr:street"],
    tags?.["addr:city"],
    tags?.["addr:state"],
    tags?.["addr:postcode"],
  ].filter(Boolean);

  return parts.join(" ");
}

async function fetchCliniciansFromOSM(
  lat: number,
  lon: number,
  radiusMeters = 8000,
) {
  // Overpass query: doctors/clinics/hospitals around a point
  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${lat},${lon})["amenity"="clinic"];
  node(around:${radiusMeters},${lat},${lon})["amenity"="doctors"];
  node(around:${radiusMeters},${lat},${lon})["amenity"="hospital"];
  node(around:${radiusMeters},${lat},${lon})["healthcare"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="clinic"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="doctors"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="hospital"];
  way(around:${radiusMeters},${lat},${lon})["healthcare"];
);
out center tags;`;

  const url = "https://overpass-api.de/api/interpreter";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const data = await res.json();

  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const mapped: Clinician[] = elements
    .map((el: any) => {
      const tags = el.tags || {};
      const name = tags.name || tags.operator || "Unknown Clinician";
      const specialty =
        tags.healthcare ||
        tags.amenity ||
        tags["healthcare:speciality"] ||
        tags.speciality ||
        "clinician";

      const address =
        buildAddressFromTags(tags) || tags.address || "Address not available";
      const phone = tags.phone || tags["contact:phone"];
      const org = tags.operator || tags.brand;
      const opening = tags.opening_hours;

      return {
        id: `osm-${el.type}-${el.id}`,
        name,
        specialty: String(specialty),
        address,
        phone,
        organization: org,
        statusLabel: opening ? `Hours: ${opening}` : "Status unknown",
        // You can enrich this later (or map based on user’s onboarding answers)
        languages: guessLanguagesFromName(name),
        source: "OSM",
      } satisfies Clinician;
    })
    // remove obvious duplicates by name+address
    .filter((c, idx, arr) => {
      const key = `${c.name}__${c.address}`;
      return arr.findIndex((x) => `${x.name}__${x.address}` === key) === idx;
    });

  return mapped.slice(0, 25);
}

// Very light heuristic (you can replace with real data later)
function guessLanguagesFromName(name: string): string[] {
  const n = name.toLowerCase();
  const langs: string[] = ["English"];

  if (n.includes("singh") || n.includes("kaur") || n.includes("patel"))
    langs.push("Punjabi", "Hindi");
  if (n.includes("kim") || n.includes("lee") || n.includes("park"))
    langs.push("Korean");
  if (n.includes("chen") || n.includes("wang") || n.includes("liu"))
    langs.push("Mandarin");
  if (n.includes("garcia") || n.includes("martinez")) langs.push("Spanish");

  // dedupe
  return Array.from(new Set(langs));
}

// ---- DoctorsAPI ----
async function fetchCliniciansFromDoctorsAPI(city: string, state: string) {
  // DoctorsAPI example uses BASE_URL + /doctors and Authorization Bearer. :contentReference[oaicite:1]{index=1}
  const BASE_URL = "https://doctorsapi.com/api";
  const url = new URL(`${BASE_URL}/doctors`);

  // If their city/state params work for you, you can keep them.
  // But the documented example shows address + radius, which is safer.
  url.searchParams.set("address", `${city}, ${state}, Canada`);
  url.searchParams.set("radius", "25");
  url.searchParams.set("limit", "15");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${DOCTORS_API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    let errText = `${res.status}`;
    try {
      const j = await res.json();
      errText = JSON.stringify(j);
    } catch {}
    throw new Error(`DoctorsAPI error: ${errText}`);
  }

  const data = await res.json();

  const items = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];

  const mapped: Clinician[] = items.map((d: any, idx: number) => {
    const name =
      d?.name || d?.full_name || d?.provider_name || "Unknown Clinician";
    const specialty = d?.specialty || d?.taxonomy || d?.type || "clinician";

    const address =
      d?.address ||
      [d?.address1, d?.city, d?.state, d?.zip].filter(Boolean).join(", ") ||
      "Address not available";

    const phone = d?.phone || d?.phone_number;
    const organization = d?.organization || d?.clinic || d?.facility;

    // Most directory APIs do NOT provide “live availability”.
    const statusLabel = d?.status ? String(d.status) : "Status unknown";

    return {
      id: String(d?.id ?? `doctorsapi-${idx}`),
      name,
      specialty,
      address,
      phone,
      organization,
      statusLabel,
      languages: Array.isArray(d?.languages)
        ? d.languages
        : guessLanguagesFromName(name),
      source: "DoctorsAPI",
    };
  });

  return mapped;
}

export default function FindClinicians() {
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("Mississauga");
  const [stateProv, setStateProv] = useState("ON");

  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [language, setLanguage] = useState<string>("Any");

  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [sourceNote, setSourceNote] = useState<string>("");

  const filtered = useMemo(() => {
    let list = clinicians;

    if (language !== "Any") {
      list = list.filter((c) => (c.languages || []).includes(language));
    }

    if (sortMode === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [clinicians, language, sortMode]);

  const load = async () => {
    setLoading(true);
    setSourceNote("");

    try {
      // 1) Try DoctorsAPI first
      const docs = await fetchCliniciansFromDoctorsAPI(
        city.trim(),
        stateProv.trim(),
      );
      if (docs.length > 0) {
        setClinicians(docs);
        setSourceNote("Source: DoctorsAPI");
        return;
      }
      throw new Error("DoctorsAPI returned empty");
    } catch (e) {
      // 2) Fallback to OSM (always works)
      try {
        const { lat, lon } = await geocodeCityToLatLon(
          city.trim(),
          stateProv.trim(),
        );
        const osm = await fetchCliniciansFromOSM(lat, lon, 9000);
        setClinicians(osm);
        setSourceNote("Source: OpenStreetMap (fallback)");
      } catch (e2) {
        setClinicians([]);
        setSourceNote("Could not load clinicians from any source.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4c6ef5" />
        <Text style={{ marginTop: 10 }}>Loading clinicians…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find Clinicians</Text>

      {/* Search Controls */}
      <View style={styles.controls}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>City</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="e.g., Mississauga"
              style={styles.input}
              autoCapitalize="words"
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={{ width: 90 }}>
            <Text style={styles.label}>State</Text>
            <TextInput
              value={stateProv}
              onChangeText={setStateProv}
              placeholder="ON"
              style={styles.input}
              autoCapitalize="characters"
              maxLength={4}
            />
          </View>
        </View>

        <View style={styles.row}>
          <FilterPill
            label={`Language: ${language}`}
            onPress={() => {
              const order = [
                "Any",
                "English",
                "Punjabi",
                "Hindi",
                "Spanish",
                "Mandarin",
                "Korean",
              ];
              const next = order[(order.indexOf(language) + 1) % order.length];
              setLanguage(next);
            }}
          />
          <FilterPill
            label={`Sort: ${sortMode === "relevance" ? "Relevance" : "Name"}`}
            onPress={() =>
              setSortMode((p) => (p === "relevance" ? "name" : "relevance"))
            }
          />
          <FilterPill label="Search" primary onPress={load} />
        </View>

        <Text style={styles.sourceNote}>{sourceNote}</Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 16, color: "#666" }}>
            No clinicians found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClinicianCard clinician={item} />}
          contentContainerStyle={{ paddingBottom: 18 }}
        />
      )}
    </View>
  );
}

function FilterPill({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, primary ? styles.pillPrimary : styles.pillGhost]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.pillText,
          primary ? { color: "#fff" } : { color: "#222" },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ClinicianCard({ clinician }: { clinician: Clinician }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{clinician.name}</Text>
          <Text style={styles.specialty}>
            {clinician.specialty || "Clinician"}
          </Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{clinician.source}</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {clinician.address || "Address not available"}
      </Text>

      {!!clinician.phone && (
        <Text style={styles.meta}>📞 {clinician.phone}</Text>
      )}
      {!!clinician.organization && (
        <Text style={styles.meta}>🏥 {clinician.organization}</Text>
      )}

      <Text style={styles.status}>
        {clinician.statusLabel || "Status unknown"}
      </Text>

      <View style={styles.langRow}>
        {(clinician.languages || ["English"]).slice(0, 4).map((l) => (
          <View key={l} style={styles.langTag}>
            <Text style={styles.langText}>{l}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} activeOpacity={0.9}>
        <Text style={styles.buttonText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f8f9fc", flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 12 },

  controls: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  label: { fontSize: 12, color: "#666", marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#f3f5fb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  pill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillGhost: { backgroundColor: "#f3f5fb" },
  pillPrimary: { backgroundColor: "#4c6ef5" },
  pillText: { fontSize: 13, fontWeight: "700" },
  sourceNote: { marginTop: 10, color: "#666", fontSize: 12 },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  name: { fontSize: 18, fontWeight: "800" },
  specialty: {
    fontSize: 13,
    color: "#4c6ef5",
    marginTop: 4,
    fontWeight: "700",
  },
  meta: { fontSize: 13, color: "#444", marginTop: 6 },
  status: { marginTop: 8, fontSize: 12, color: "#666", fontWeight: "700" },

  badge: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: "#2b3a8a", fontWeight: "800", fontSize: 12 },

  langRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  langTag: {
    backgroundColor: "#f3f5fb",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  langText: { fontSize: 12, fontWeight: "700", color: "#333" },

  button: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: "#4c6ef5",
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "800" },
});
