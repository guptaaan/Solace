import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function FindClinicians() {
  const [loading, setLoading] = useState(true);
  const [clinicians, setClinicians] = useState([]);

  const API_KEY =
    "hk_mix8w0lebcff1117f5d1f75df41bf199dae88d66b8953a7b90f2b84934d99b55897ca252";

  const url =
    "https://doctorsapi.com/api/doctors?city=Mississauga&state=ON&limit=10";

  const fetchDoctors = async () => {
    try {
      const response = await fetch(url, {
        headers: {
          "api-key": API_KEY, // ✔ Correct header
        },
      });

      const data = await response.json();
      console.log("Doctors API Response:", data);

      const items = Array.isArray(data.data) ? data.data : [];
      setClinicians(items);
    } catch (error) {
      console.error("Error fetching clinicians:", error);
      setClinicians([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4c6ef5" />
        <Text>Loading clinicians…</Text>
      </View>
    );
  }

  if (clinicians.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 16, color: "#666" }}>No clinicians found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clinicians in Mississauga</Text>

      <FlatList
        data={clinicians}
        keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
        renderItem={({ item }) => <DoctorCard doctor={item} />}
      />
    </View>
  );
}

function DoctorCard({ doctor }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{doctor.name || "Unknown Doctor"}</Text>

      <Text style={styles.specialty}>
        {doctor.specialty || "General Practitioner"}
      </Text>

      <Text style={styles.address}>
        {doctor.address || "Address not available"}
      </Text>

      {doctor.phone && <Text style={styles.phone}>📞 {doctor.phone}</Text>}
      {doctor.organization && (
        <Text style={styles.org}>🏥 {doctor.organization}</Text>
      )}

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#f8f9fc", flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  name: { fontSize: 20, fontWeight: "700" },
  specialty: { fontSize: 14, color: "#4c6ef5", marginTop: 4 },
  address: { fontSize: 13, color: "#444", marginTop: 6 },
  phone: { marginTop: 6, fontSize: 14 },
  org: { marginTop: 4, fontSize: 13, color: "#666" },
  button: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: "#4c6ef5",
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
