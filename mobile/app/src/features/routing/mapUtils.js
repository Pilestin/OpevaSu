export const MapUtils = {
  getPointTypeLabel(type) {
    switch (type) {
      case "start":
        return "S";
      case "end":
        return "E";
      case "charging":
        return "C";
      case "depot":
        return "D";
      case "station":
        return "F";
      default:
        return "P";
    }
  },

  getPointTypeColor(type) {
    switch (type) {
      case "depot":
        return "#8e44ad";
      case "station":
        return "#f39c12";
      case "charging":
        return "#2ecc71";
      case "delivery":
        return "#3498db";
      case "start":
        return "#16a34a";
      case "end":
        return "#dc2626";
      default:
        return "#3498db";
    }
  },

  determinePointType(point, isStart = false, isEnd = false) {
    if (isStart) return "start";
    if (isEnd) return "end";
    if (point?.node_detail?.charging_station) return "charging";
    const pointId = String(point?.id || "").toLowerCase();
    if (pointId.includes("depot") || pointId.includes("warehouse")) return "depot";
    if (pointId.includes("station") || pointId.includes("fuel")) return "station";
    return "delivery";
  },

  formatVisitTime(visitTime) {
    if (!visitTime) return "Henüz ziyaret edilmedi";
    try {
      return String(visitTime).replace("T", " ");
    } catch (error) {
      return String(visitTime);
    }
  },
};
