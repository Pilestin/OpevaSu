import axios from "axios";
import { Buffer } from "buffer";
import { OPTIONAL_FILE_NAMES, REQUIRED_FILE_NAMES } from "./routingAssets";
import { getRoutingEndpoint } from "./routingConfig";
import { parseRoutingZip } from "./routingZip";

global.Buffer = global.Buffer || Buffer;

function appendXmlFile(formData, fileObj, name) {
  formData.append("input_files", {
    uri: fileObj.uri,
    name: name || fileObj.name,
    type: "text/xml",
  });
}

export async function runRoutingOptimization({ algorithm, files, problemFile }) {
  const missing = REQUIRED_FILE_NAMES.filter((fileName) => !files[fileName]);
  if (missing.length > 0) {
    throw new Error(`Eksik standart dosyalar: ${missing.join(", ")}`);
  }
  if (!problemFile) {
    throw new Error("Problem dosyasi secilmedi.");
  }

  const url = getRoutingEndpoint(algorithm);
  const formData = new FormData();

  REQUIRED_FILE_NAMES.forEach((name) => {
    appendXmlFile(formData, files[name], name);
  });
  OPTIONAL_FILE_NAMES.forEach((name) => {
    if (files[name]) {
      appendXmlFile(formData, files[name], name);
    }
  });
  appendXmlFile(formData, problemFile, problemFile.name);

  const response = await axios.post(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    responseType: "arraybuffer",
    timeout: 300000,
  });

  const base64 = Buffer.from(response.data).toString("base64");
  return parseRoutingZip(base64);
}
