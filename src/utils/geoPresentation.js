export const DEMO_IP_REPLACEMENTS = {
  "8.8.8.8": "185.22.91.10",
};

export const INTERNAL_NETWORK_LABEL = "Internal Network";

export const normaliseIP = (ip) => (ip || "").toString().trim();

export const isInternalIP = (ip) => {
  const value = normaliseIP(ip).toLowerCase();

  return (
    !value ||
    value === "localhost" ||
    value === "::1" ||
    value === "127.0.0.1" ||
    value === "::ffff:127.0.0.1" ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  );
};

export const getPresentationIP = (ip) => {
  const value = normaliseIP(ip);

  if (isInternalIP(value)) return INTERNAL_NETWORK_LABEL;

  return DEMO_IP_REPLACEMENTS[value] || value;
};

export const isGeoIPVisualizationIP = (ip) => {
  const value = normaliseIP(ip);
  return Boolean(value) && !isInternalIP(value);
};

export const getGeoIPLookupIP = (ip) => {
  const value = normaliseIP(ip);
  return DEMO_IP_REPLACEMENTS[value] || value;
};

export const getDisplayCountry = (country) => {
  const value = (country || "").toString().trim();

  if (!value || value.toLowerCase() === "localhost") {
    return INTERNAL_NETWORK_LABEL;
  }

  return value;
};

export const isExternalCountry = (country) => {
  const value = getDisplayCountry(country);
  return value !== INTERNAL_NETWORK_LABEL && value !== "Unknown";
};
