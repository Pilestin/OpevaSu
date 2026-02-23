export const MapUtils = {
  getPointTypeIcon(type) {
    switch (type) {
      case "depot":
      case "start":
      case "end":
        return "warehouse";
      case "delivery":
        return "account-circle";
      case "charging":
        return "ev-station";
      case "station":
        return "gas-station";
      default:
        return "map-marker";
    }
  },

  getPointTypeLabel(type) {
    switch (type) {
      case "start":
        return "S";
      case "end":
        return "E";
      case "delivery":
        return "C";
      case "charging":
        return "CH";
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
      case "start":
      case "end":
        return "#8e44ad";
      case "station":
        return "#f39c12";
      case "charging":
        return "#2ecc71";
      case "delivery":
        return "#3498db";
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
    if (!visitTime) return "Henuz ziyaret edilmedi";
    try {
      return String(visitTime).replace("T", " ");
    } catch (error) {
      return String(visitTime);
    }
  },
};
