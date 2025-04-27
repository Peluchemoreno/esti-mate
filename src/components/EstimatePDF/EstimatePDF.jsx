import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Image,
} from "@react-pdf/renderer";
import { useEffect, useState } from "react";

const styles = StyleSheet.create({
  page: { padding: 20 },
  section: { marginBottom: 15, borderBottom: "1px solid grey" },
  header: {
    fontSize: 28,
    marginBottom: 15,
    textAlign: "right",
  },
  text: { fontSize: 14, marginBottom: 5 },
  smallerText: { fontSize: 12, marginBottom: 5 },
  bold: { fontWeight: "bold" },
});

function getCurrentDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const year = today.getFullYear();

  return `${month}-${day}-${year}`;
}

function EstimatePDF({
  project,
  selectedDiagram,
  activeModal,
  currentUser,
  logoUrl,
}) {
  const [token, setToken] = useState("");

  useEffect(() => {
    console.log(selectedDiagram);
    console.log(currentUser);
  }, [activeModal, selectedDiagram]);

  useEffect(() => {
    console.log(currentUser);
    const token = localStorage.getItem("jwt");
    setToken(token);
  }, []);

  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.header}>ESTIMATE</Text>
        <View style={{}}>
          <View style={[styles.section, { paddingBottom: 40 }]}>
            <Text style={[styles.text, styles.bold, { textAlign: "right" }]}>
              {currentUser.companyName}
            </Text>
            <Text style={[styles.text, { textAlign: "right" }]}>
              {currentUser.companyAddress}
            </Text>
            <Text
              style={[
                styles.smallerText,
                { textAlign: "right", color: "#444", marginTop: 10 },
              ]}
            >
              {currentUser.companyPhone}
            </Text>
          </View>
          <View
            style={[
              styles.section,
              {
                display: "flex",
                flexDirection: "row",
                padding: 20,
                justifyContent: "space-between",
              },
            ]}
          >
            <View>
              <Text
                style={[styles.smallerText, styles.bold, { color: "#444" }]}
              >
                BILL TO
              </Text>
              <Text style={[styles.smallerText, styles.bold]}>
                {project.clientName}
              </Text>
              <Text style={[styles.smallerText, { marginBottom: 10 }]}>
                {project.address}
              </Text>
              <Text style={[styles.smallerText, { color: "#444" }]}></Text>
              <Text style={[styles.smallerText, { color: "#444" }]}>
                {project.primaryPhoneNumber}
              </Text>
            </View>
            <View
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                width: 250,
              }}
            >
              <View
                style={{
                  display: "flex",
                  flexDirection: "row",
                }}
              >
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Estimate Number:
                </Text>
                <Text style={[styles.smallerText]}>001</Text>
              </View>
              <View style={{ display: "flex", flexDirection: "row" }}>
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Estimate Date:
                </Text>
                <Text style={[styles.smallerText]}>{getCurrentDate()}</Text>
              </View>
              <View
                style={{
                  display: "flex",
                  flexDirection: "row",
                }}
              >
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Payment Due:
                </Text>
                <Text style={[styles.smallerText]}>Upon completion</Text>
              </View>
              <View
                style={{
                  display: "flex",
                  flexDirection: "row",
                  backgroundColor: "#ddd",
                  alignItems: "center",
                  padding: 5,
                  marginTop: 10,
                }}
              >
                <Text
                  style={[
                    styles.smallerText,
                    styles.bold,
                    { width: 150, textAlign: "right", marginRight: 5 },
                  ]}
                >
                  Amount Due (USD):
                </Text>
                <Text
                  style={[styles.smallerText, styles.bold, { paddingTop: 2 }]}
                >
                  {selectedDiagram?.price ? `${selectedDiagram.price}` : "N/A"}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={{
              position: "absolute",
              top: -70,
              display: "flex",
              alignItems: "center",
              flexDirection: "row",
            }}
          >
            <View
              style={{
                backgroundColor: "transparent",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* <Text>Company Logo Here</Text> */}
              {logoUrl && (
                <Image
                  src={logoUrl}
                  style={{
                    width: 150,
                    height: 150,
                    objectFit: "contain",
                  }}
                />
              )}
            </View>
            {/* <View>
              <Text style={{ fontSize: 16, padding: 5, maxWidth: 150 }}>
                {currentUser.companyName}
              </Text>
            </View> */}
          </View>
        </View>
      </Page>
    </Document>
  );
}

function EstimatePDFButton({ estimate }) {
  return (
    <PDFDownloadLink
      document={
        <EstimatePDF
          estimate={estimate}
          selectedDiagram={selectedDiagram}
          project={project}
        />
      }
      fileName="estimate.pdf"
    >
      {({ loading }) => (loading ? "Generating PDF..." : "Download Estimate")}
    </PDFDownloadLink>
  );
}

export { EstimatePDFButton, EstimatePDF };
