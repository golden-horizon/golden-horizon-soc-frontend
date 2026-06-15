const LOCAL_COORDINATES = {
  latitude: -33.8688,
  longitude: 151.2093,
};

const DEMO_IP_REPLACEMENTS = {
  "8.8.8.8": "185.22.91.10",
};

const isLocalIP = (ip) =>
  !ip ||
  String(ip).toLowerCase() === "localhost" ||
  String(ip).toLowerCase() === "internal network" ||
  ip === "::1" ||
  ip === "127.0.0.1" ||
  ip === "::ffff:127.0.0.1" ||
  ip.startsWith("192.168.") ||
  ip.startsWith("10.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);

const calculateIPReputation = (ip, geoData) => {
  if (isLocalIP(ip)) {
    return {
      reputation: "Clean",
      abuseScore: 0,
      isTor: false,
      isVpn: false,
      recommendation: "Internal lab traffic. No external risk.",
    };
  }

  if (!geoData?.country || geoData.country === "Unknown") {
    return {
      reputation: "Unknown",
      abuseScore: 50,
      isTor: false,
      isVpn: false,
      recommendation: "Location data unavailable. Review manually.",
    };
  }

  return {
    reputation: "Unverified",
    abuseScore: 30,
    isTor: false,
    isVpn: false,
    recommendation:
      "Review related incidents and investigate potential malicious activity.",
  };
};

const buildGeoIPResult = ({
  ip,
  country,
  city,
  isp,
  org,
  latitude,
  longitude,
  risk,
}) => {
  const result = {
    ip,
    country,
    city,
    isp,
    org,
    latitude,
    longitude,
    risk,
  };

  return {
    ...result,
    ...calculateIPReputation(ip, result),
  };
};

const getGeoIP = async (ip) => {
  try {
    if (isLocalIP(ip)) {
      return buildGeoIPResult({
        ip: "Internal Network",
        country: "Internal Network",
        city: "Internal",
        isp: "Internal Host",
        org: "Internal Network",
        latitude: LOCAL_COORDINATES.latitude,
        longitude: LOCAL_COORDINATES.longitude,
        risk: "Low",
      });
    }

    const lookupIP = DEMO_IP_REPLACEMENTS[ip] || ip;

    const response = await fetch(
      `http://ip-api.com/json/${lookupIP}?fields=status,query,country,city,isp,org,lat,lon`
    );

    const data = await response.json();

    if (data.status !== "success") {
      return buildGeoIPResult({
        ip: lookupIP,
        country: "Unknown",
        city: "Unknown",
        isp: "Unknown",
        org: "Unknown",
        latitude: null,
        longitude: null,
        risk: "Medium",
      });
    }

    return buildGeoIPResult({
      ip: data.query || lookupIP,
      country: data.country || "Unknown",
      city: data.city || "Unknown",
      isp: data.isp || "Unknown",
      org: data.org || "Unknown",
      latitude: data.lat,
      longitude: data.lon,
      risk: "Medium",
    });
  } catch (err) {
    console.error("GeoIP lookup error:", err);

    return buildGeoIPResult({
      ip: DEMO_IP_REPLACEMENTS[ip] || ip,
      country: "Unknown",
      city: "Unknown",
      isp: "Unknown",
      org: "Unknown",
      latitude: null,
      longitude: null,
      risk: "Medium",
    });
  }
};

export default getGeoIP;
