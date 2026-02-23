import JSZip from "jszip";

function getTagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return match ? match[1] : null;
}

export async function parseRoutingZip(base64Data) {
  const zip = await JSZip.loadAsync(base64Data, { base64: true });
  const files = Object.keys(zip.files);
  const vehicleFile = files.find((file) => file.endsWith("Route4Vehicle.json"));
  const planFile = files.find((file) => file.endsWith("Route4Plan.xml"));

  if (!vehicleFile || !planFile) {
    throw new Error("ZIP ciktilari gecersiz: Route4Vehicle.json veya Route4Plan.xml bulunamadi.");
  }

  const vehicleContent = await zip.file(vehicleFile).async("string");
  const planContent = await zip.file(planFile).async("string");

  return {
    routes: JSON.parse(vehicleContent),
    stats: {
      distance: getTagValue(planContent, "TotalDistance") || 0,
      duration: getTagValue(planContent, "TotalDuration") || 0,
      energy: getTagValue(planContent, "TotalEnergyConsumption") || 0,
    },
  };
}
