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
  itemsHeader: { display: "flex", flexDirection: "row" },
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
  const [itemizedArray, setItemizedArray] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    setToken(token);
  }, []);

  function formatLineItems(lines) {
    const downspoutItems = [];
    const nonDownspoutItems = [];
    const lineItemTable = {};
    const tempArray = [];

    lines.forEach((line) => {
      if (line.isDownspout) {
        downspoutItems.push(line);
      } else {
        nonDownspoutItems.push(line);
      }
    });

    for (let i = 0; i < downspoutItems.length; i++) {
      console.log(downspoutItems[i].measurement);
      if (!lineItemTable[downspoutItems[i].downspoutSize]) {
        lineItemTable[downspoutItems[i].downspoutSize] =
          downspoutItems[i].measurement;
      } else {
        lineItemTable[downspoutItems[i].downspoutSize] +=
          downspoutItems[i].measurement;
      }
    }

    for (let i = 0; i < nonDownspoutItems.length; i++) {
      console.log(nonDownspoutItems[i].currentProduct?.name);
      if (lineItemTable[nonDownspoutItems[i].currentProduct?.name]) {
        lineItemTable[nonDownspoutItems[i].currentProduct.name] +=
          nonDownspoutItems[i].measurement;
      } else {
        lineItemTable[nonDownspoutItems[i].currentProduct?.name] =
          nonDownspoutItems[i].measurement;
      }
    }

    Object.keys(lineItemTable).forEach((item) => {
      const formattedItem = {
        item: selectedDiagram.lines.filter((line) => {
          if (line.isDownspout) {
            return line.downspoutSize === item;
          } else {
            return line.currentProduct?.name === item;
          }
        })[0].currentProduct?.name,
        quantity: lineItemTable[item],
        price: selectedDiagram.lines.filter((line) => {
          if (line.isDownspout) {
            return line.downspoutSize === item;
          } else {
            return line.currentProduct?.name === item;
          }
        })[0].currentProduct.price,
      };

      console.log(formattedItem);
      tempArray.push(formattedItem);
    });
    console.log(lineItemTable);

    console.log(tempArray);
    setItemizedArray(tempArray);
    return downspoutItems;
  }

  useEffect(() => {
    console.log("selectedDiagram: ", selectedDiagram);
    formatLineItems(selectedDiagram.lines);
  }, [activeModal]);

  useEffect(() => {
    console.log(itemizedArray);
  }, [itemizedArray]);

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
          </View>
        </View>
        <View>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#ccc",
              padding: 8,
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{ width: "60%", fontWeight: "bold", fontSize: "12px" }}
            >
              Item
            </Text>
            <Text
              style={{
                width: "10%",
                fontWeight: "bold",
                textAlign: "center",
                fontSize: "12px",
              }}
            >
              Quantity
            </Text>
            <Text
              style={{
                width: "20%",
                fontWeight: "bold",
                textAlign: "right",
                fontSize: "12px",
              }}
            >
              Amount
            </Text>
          </View>

          {itemizedArray.map((line, index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                padding: 8,
                borderBottom: "1px solid #eee",
                alignItems: "center",
              }}
            >
              <Text
                style={{ width: "60%", fontSize: "12px", fontWeight: "bold" }}
              >
                {line.item || "N/A"}
              </Text>
              <Text
                style={{ width: "20%", textAlign: "center", fontSize: "12px" }}
              >
                {line.quantity || "-"}
              </Text>
              <Text
                style={{ width: "20%", textAlign: "right", fontSize: "12px" }}
              >
                ${(parseFloat(line.price.slice(1)) * line.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
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
