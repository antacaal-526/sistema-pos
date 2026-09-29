const API_URL = 'https://terra-pos-backend-526.onrender.com';

const catalogo = [
  {"barcode": "1", "name": "MANI DE DULCE  50G X 12"},
  {"barcode": "2", "name": "MANI DE DULCE  125G"},
  {"barcode": "3", "name": "MANI DE DULCE  250G"},
  {"barcode": "4", "name": "MANI DE DULCE  500 G"},
  {"barcode": "5", "name": "MANI DE DULCE  2500G"},
  {"barcode": "6", "name": "MANI DE DULCE CON AJONJOLI  50G X 12"},
  {"barcode": "7", "name": "MANI DE DULCE CON AJONJOLI  125G"},
  {"barcode": "8", "name": "MANI DE DULCE CON AJONJOLI 250G"},
  {"barcode": "9", "name": "MANI DE DULCE CON AJONJOLI  500 G"},
  {"barcode": "10", "name": "MANI DE DULCE CON AJONJOLI 2500G"},
  {"barcode": "11", "name": "MANI CON SAL  50G X 12"},
  {"barcode": "12", "name": "MANI CON SAL   125G"},
  {"barcode": "13", "name": "MANI CON SAL 250G"},
  {"barcode": "14", "name": "MANI CON SAL   500 G"},
  {"barcode": "15", "name": "MANI CON SAL   2500G"},
  {"barcode": "16", "name": "MANI CON UVAS  50G X 12"},
  {"barcode": "17", "name": "MANI CON UVAS 125G"},
  {"barcode": "18", "name": "MANI CON UVAS 250G"},
  {"barcode": "19", "name": "MANI CON UVAS 500 G"},
  {"barcode": "20", "name": "MANI CON UVAS  2500G"},
  {"barcode": "21", "name": "MANI PICANTE  50G X 12"},
  {"barcode": "22", "name": "MANI PICANTE  125G"},
  {"barcode": "23", "name": "MANI PICANTE250G"},
  {"barcode": "24", "name": "MANI PICANTE  500 G"},
  {"barcode": "25", "name": "MANI PICANTE  2500G"},
  {"barcode": "26", "name": "HABAS FRITAS SALADAS 50G X 12"},
  {"barcode": "27", "name": "HABAS FRITAS SALADAS125G"},
  {"barcode": "28", "name": "HABAS FRITAS SALADAS 250G"},
  {"barcode": "29", "name": "HABAS FRITAS SALADAS 500 G"},
  {"barcode": "30", "name": "HABAS FRITAS SALADAS 2500G"},
  {"barcode": "31", "name": "HABAS FRITAS PICANTES 50G X 12"},
  {"barcode": "32", "name": "HABAS FRITAS PICANTES 125G"},
  {"barcode": "33", "name": "HABAS FRITAS PICANTES 250G"},
  {"barcode": "34", "name": "HABAS FRITAS PICANTES 500 G"},
  {"barcode": "35", "name": "HABAS FRITAS PICANTES 2500G"},
  {"barcode": "36", "name": "PATACON SALADO 50G X 12"},
  {"barcode": "37", "name": "PATACON SALADO  125G"},
  {"barcode": "38", "name": "PATACON SALADO  250G"},
  {"barcode": "39", "name": "PATACON SALADO  500 G"},
  {"barcode": "40", "name": "PATACON SALADO  2500G"},
  {"barcode": "41", "name": "PATACON DE DULCE 50G X 12"},
  {"barcode": "42", "name": "PATACON DE DULCE  125G"},
  {"barcode": "43", "name": "PATACON DE DULCE 250G"},
  {"barcode": "44", "name": "PATACON DE DULCE  500 G"},
  {"barcode": "45", "name": "PATACON DE DULCE  2500G"},
  {"barcode": "46", "name": "TOCIENTA SURTIDA 60 G"},
  {"barcode": "47", "name": "TOCIENTA SURTIDA 200 G"},
  {"barcode": "48", "name": "TOCIENTA SURTIDA 2500 G"},
  {"barcode": "49", "name": "MIX TERRA ARANDANOS Y HABAS"},
  {"barcode": "50", "name": "MIX TERRA ARANDANOS Y PISTACHOS"},
  {"barcode": "51", "name": "MIX TERRA PISTACHOS Y MANI CON UVAS"},
  {"barcode": "52", "name": "MIX TERRA MANI CON UVAS Y HABAS"}
];

async function importar() {
  console.log("🚀 Iniciando importación del catálogo de Fábrica (Preventa) a Render...");
  let agregados = 0;
  let omitidos = 0;

  for (const item of catalogo) {
    try {
      const res = await fetch(API_URL + '/api/preventa-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: item.barcode,
          name: item.name,
          price: 0, 
          discount_rules: "[]",
          stock: 0,
          min_stock: 3
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        console.log(`✅ Creado: [${item.barcode}] ${item.name}`);
        agregados++;
      } else {
        // Si el código ya existe, la BD devuelve un error UNIQUE
        if (data.error && data.error.includes('UNIQUE')) {
          console.log(`⏩ Omitido (Ya existe): [${item.barcode}] ${item.name}`);
          omitidos++;
        } else {
          console.log(`❌ Error [${item.barcode}]: ${data.error}`);
        }
      }
    } catch (e) {
      console.log(`❌ Fallo de red con [${item.barcode}]: ${e.message}`);
    }
  }

  console.log("\n=============================================");
  console.log("✅ RESULTADO DE LA IMPORTACIÓN:");
  console.log(`➕ Nuevos agregados: ${agregados}`);
  console.log(`⏩ Conservados (intactos): ${omitidos}`);
  console.log("=============================================\n");
}

importar();