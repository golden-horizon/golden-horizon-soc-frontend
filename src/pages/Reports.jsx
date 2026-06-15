import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import {
  getPresentationIP,
  isGeoIPVisualizationIP,
} from "../utils/geoPresentation";
import goldenHorizonLogo from "../assets/golden-horizon-logo.png";

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const MITRE_TECHNIQUES = [
  {
    id: "T1110",
    name: "Brute Force",
    matches: ["brute force", "t1110"],
  },
  {
    id: "T1190",
    name: "Exploit Public-Facing Application",
    matches: ["api abuse", "sql", "injection", "t1190"],
  },
  {
    id: "T1059",
    name: "Command and Scripting Interpreter",
    matches: ["xss", "script", "command", "t1059"],
  },
  {
    id: "T1539",
    name: "Steal Web Session Cookie",
    matches: ["session hijacking", "session", "t1539"],
  },
];

const CHART_COLORS = {
  critical: [220, 38, 38],
  high: [249, 115, 22],
  medium: [234, 179, 8],
  low: [34, 197, 94],
  blue: [37, 99, 235],
  slate: [100, 116, 139],
  border: [203, 213, 225],
  text: [15, 23, 42],
  muted: [100, 116, 139],
};

const THREAT_COUNTRY_BY_IP = {
  "175.45.176.1": "North Korea",
  "185.22.91.10": "Serbia",
  "114.114.114.114": "China",
  "5.255.255.70": "Russia",
};

const getSeverityColor = (severity) => {
  const value = String(severity || "").toLowerCase();

  if (value === "critical") return CHART_COLORS.critical;
  if (value === "high") return CHART_COLORS.high;
  if (value === "medium") return CHART_COLORS.medium;
  if (value === "low") return CHART_COLORS.low;
  return CHART_COLORS.slate;
};

const normaliseText = (value) => String(value || "").trim();

const toTitle = (item) =>
  normaliseText(item.title || item.attack_type || item.event_type || item.category) ||
  "Unclassified Activity";

const toSeverity = (item) => normaliseText(item.severity).toLowerCase() || "low";

const formatDate = (dateValue) => {
  if (!dateValue) return "Unknown";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString();
};

const truncate = (value, maxLength) => {
  const text = normaliseText(value);

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
};

const imageToDataUrl = async (src) => {
  const response = await fetch(src);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function Reports() {
  const [incidents, setIncidents] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [exportStatus, setExportStatus] = useState("");

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");

    return {
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const loadReportData = useCallback(async () => {
    try {
      const [incidentRes, eventRes] = await Promise.allSettled([
        axios.get("http://localhost:5000/incidents", {
          headers: getAuthHeaders(),
        }),
        axios.get("http://localhost:5000/security-events", {
          headers: getAuthHeaders(),
        }),
      ]);

      setIncidents(
        incidentRes.status === "fulfilled" && Array.isArray(incidentRes.value.data)
          ? incidentRes.value.data
          : []
      );
      setSecurityEvents(
        eventRes.status === "fulfilled" && Array.isArray(eventRes.value.data)
          ? eventRes.value.data
          : []
      );
    } catch (err) {
      console.error("Failed to load report data:", err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReportData();
  }, [loadReportData]);

  const reportData = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter((i) => i.status === "open").length;
    const closed = incidents.filter((i) => i.status === "closed").length;
    const critical = incidents.filter((i) => i.severity === "critical").length;
    const high = incidents.filter((i) => i.severity === "high").length;
    const medium = incidents.filter((i) => i.severity === "medium").length;
    const attackSources = new Set(
      incidents
        .map((i) => i.source_ip)
        .filter(isGeoIPVisualizationIP)
        .map(getPresentationIP)
    ).size;

    // Executive health score for reports. This is intentionally less punitive
    // than raw alert scoring so portfolio/demo data reads as high risk without
    // looking completely compromised.
    const totalRiskWeight =
      critical * 1.2 + high * 0.7 + medium * 0.35 + open * 0.15 + attackSources * 0.6;
    const maxExpectedRisk = Math.max(total * 3, 100);
    const securityScore = Math.round(
      Math.max(0, 100 - (totalRiskWeight / maxExpectedRisk) * 100)
    );

    const posture = securityScore >= 75
      ? "Low Risk"
      : securityScore >= 50
      ? "High Risk"
      : "Critical Risk";

    const allActivity = [...incidents, ...securityEvents];
    const severityData = ["critical", "high", "medium", "low"]
      .map((severity) => ({
        label: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: allActivity.filter((item) => toSeverity(item) === severity).length,
        color: getSeverityColor(severity),
      }))
      .filter((item) => item.value > 0);

    const statusData = ["open", "in-progress", "closed"]
      .map((status) => ({
        label: status === "in-progress" ? "In Progress" : status,
        value: incidents.filter((incident) => incident.status === status).length,
      }))
      .filter((item) => item.value > 0);

    const attackTypeGroups = Object.values(
      incidents.reduce((acc, incident) => {
        const title = toTitle(incident);
        const severity = toSeverity(incident);

        if (!acc[title]) {
          acc[title] = {
            title,
            count: 0,
            severity,
            open: 0,
            latest: incident.created_at,
          };
        }

        acc[title].count += 1;
        if (incident.status === "open") acc[title].open += 1;
        if (SEVERITY_ORDER[severity] < SEVERITY_ORDER[acc[title].severity]) {
          acc[title].severity = severity;
        }
        if (
          incident.created_at &&
          (!acc[title].latest ||
            new Date(incident.created_at) > new Date(acc[title].latest))
        ) {
          acc[title].latest = incident.created_at;
        }

        return acc;
      }, {})
    ).sort((a, b) => {
      const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

      return severityDiff || b.count - a.count;
    });

    const topAttackTypes = [...attackTypeGroups]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((group) => ({
        label: group.title,
        value: group.count,
        color: getSeverityColor(group.severity),
      }));

    const mitreCoverage = MITRE_TECHNIQUES.map((technique) => {
      const count = allActivity.filter((item) => {
        const text = [
          item.title,
          item.description,
          item.attack_type,
          item.event_type,
          item.category,
          item.mitre_technique,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return technique.matches.some((match) => text.includes(match));
      }).length;

      return {
        ...technique,
        count,
      };
    }).filter((technique) => technique.count > 0);

    const threatTrends = Object.values(
      allActivity.reduce((acc, item) => {
        const date = formatDate(item.created_at || item.timestamp);

        if (!acc[date]) {
          acc[date] = {
            label: date,
            value: 0,
            time: item.created_at || item.timestamp
              ? new Date(item.created_at || item.timestamp).getTime()
              : 0,
          };
        }

        acc[date].value += 1;
        return acc;
      }, {})
    )
      .sort((a, b) => a.time - b.time)
      .slice(-8);

    const ipCounts = incidents.reduce((acc, incident) => {
      if (!isGeoIPVisualizationIP(incident.source_ip)) return acc;

      const ip = getPresentationIP(incident.source_ip);
      acc[ip] = (acc[ip] || 0) + 1;
      return acc;
    }, {});

    const topSourceEntry = Object.entries(ipCounts).sort((a, b) => b[1] - a[1])[0];
    const topThreat = [...attackTypeGroups].sort((a, b) => b.count - a.count)[0];
    const mostCommonMitre = [...mitreCoverage].sort((a, b) => b.count - a.count)[0];
    const closureRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const criticalPercentage = total > 0 ? Math.round((critical / total) * 100) : 0;
    const topSource = topSourceEntry ? topSourceEntry[0] : "N/A";
    const topThreatSourceCountry =
      topSource !== "N/A" ? THREAT_COUNTRY_BY_IP[topSource] || "GeoIP Available" : "N/A";
    const mttd = {
      value: "N/A",
      subtitle: "Demo Environment",
    };
    const mttr =
      closed > 0
        ? {
            value: `${Math.max(1, Math.round((closed / Math.max(total, 1)) * 8))} hrs`,
            subtitle: "Estimated",
          }
        : {
            value: "N/A",
            subtitle: "No closed incidents",
          };

    return {
      total,
      open,
      closed,
      critical,
      high,
      medium,
      attackSources,
      securityScore,
      posture,
      severityData,
      statusData,
      attackTypeGroups,
      topAttackTypes,
      mitreCoverage,
      threatTrends,
      topThreat: topThreat?.title || "No active threat",
      topSource,
      topThreatSourceCountry,
      highestRiskIndicator: topThreat?.title || "No active indicator",
      mostCommonMitre: mostCommonMitre
        ? `${mostCommonMitre.id} - ${mostCommonMitre.name}`
        : "No MITRE technique detected",
      trendAnalysis:
        critical + high > closed
          ? "Threat activity remains elevated across open incidents."
          : "Threat activity is stable based on current incident volume.",
      closureRate,
      criticalPercentage,
      mttd,
      mttr,
    };
  }, [incidents, securityEvents]);

  const exportExecutiveReport = async () => {
    setExportStatus("");

    const doc = new jsPDF();
    const logoDataUrl = await imageToDataUrl(goldenHorizonLogo);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let pageNumber = 1;

    const setRgb = (method, rgb) => doc[method](rgb[0], rgb[1], rgb[2]);

    const addPageNumber = () => {
      doc.setFontSize(8);
      setRgb("setTextColor", CHART_COLORS.muted);
      doc.text(`Page ${pageNumber}`, pageWidth - 25, pageHeight - 10);
    };

    const drawBrandHeader = (title = "SOC Executive Security Report") => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 32, "F");
      doc.addImage(logoDataUrl, "PNG", 14, 4, 42, 23);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(title, 66, 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(217, 184, 95);
      doc.text("SECURE. BUILD. INNOVATE.", 66, 23);
    };

    const addPage = () => {
      addPageNumber();
      doc.addPage();
      pageNumber += 1;
      drawBrandHeader();
    };

    const sectionTitle = (title, y) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      setRgb("setTextColor", CHART_COLORS.text);
      doc.text(title, 16, y);
      setRgb("setDrawColor", CHART_COLORS.border);
      doc.line(16, y + 4, pageWidth - 16, y + 4);
    };

    const drawMetricCard = (
      label,
      value,
      x,
      y,
      width,
      color = CHART_COLORS.blue,
      options = {}
    ) => {
      setRgb("setDrawColor", CHART_COLORS.border);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, width, 24, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setRgb("setTextColor", CHART_COLORS.muted);
      doc.text(label, x + 5, y + 8);
      const displayValue = String(value);
      const valueFontSize =
        options.valueFontSize || (displayValue.length > 12 ? 10 : displayValue.length > 8 ? 12 : 16);
      doc.setFontSize(valueFontSize);
      setRgb("setTextColor", color);
      const wrappedValue = doc.splitTextToSize(displayValue, width - 10).slice(0, 2);
      doc.text(wrappedValue, x + 5, y + 17);

      if (options.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        setRgb("setTextColor", CHART_COLORS.muted);
        const wrappedSubtitle = doc
          .splitTextToSize(String(options.subtitle), width - 10)
          .slice(0, 1);
        doc.text(wrappedSubtitle, x + 5, y + 22);
      }
    };

    const drawBarChart = (title, data, x, y, width, height, options = {}) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setRgb("setTextColor", CHART_COLORS.text);
      doc.text(title, x, y);

      const rows = data.length > 0 ? data.slice(0, options.limit || 6) : [{ label: "No data", value: 0 }];
      const maxValue = Math.max(...rows.map((row) => row.value), 1);
      const rowHeight = Math.min(11, (height - 12) / rows.length);
      const labelWidth = options.labelWidth || 56;
      const barX = x + labelWidth;
      const barWidth = width - labelWidth - 14;

      rows.forEach((row, index) => {
        const rowY = y + 12 + index * rowHeight;
        const barFill = row.value > 0 ? Math.max(2, (row.value / maxValue) * barWidth) : 0;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setRgb("setTextColor", CHART_COLORS.text);
        doc.text(truncate(row.label, options.labelMax || 28), x, rowY + 4);
        doc.setFillColor(226, 232, 240);
        doc.rect(barX, rowY, barWidth, 4, "F");
        setRgb("setFillColor", row.color || options.color || CHART_COLORS.blue);
        if (barFill > 0) doc.rect(barX, rowY, barFill, 4, "F");
        doc.setFont("helvetica", "bold");
        setRgb("setTextColor", CHART_COLORS.muted);
        doc.text(String(row.value), barX + barWidth + 4, rowY + 4);
      });
    };

    const drawTrendChart = (title, data, x, y, width, height) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setRgb("setTextColor", CHART_COLORS.text);
      doc.text(title, x, y);

      const bars = data.length > 0 ? data : [{ label: "No data", value: 0 }];
      const chartX = x + 8;
      const chartY = y + 14;
      const chartWidth = width - 16;
      const chartHeight = height - 28;
      const maxValue = Math.max(...bars.map((point) => point.value), 1);
      const gap = 3;
      const barWidth = Math.max(5, (chartWidth - gap * (bars.length - 1)) / bars.length);

      setRgb("setDrawColor", CHART_COLORS.border);
      doc.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight);
      doc.line(chartX, chartY, chartX, chartY + chartHeight);

      bars.forEach((bar, index) => {
        const barHeight = bar.value > 0 ? Math.max(2, (bar.value / maxValue) * chartHeight) : 0;
        const xPos = chartX + index * (barWidth + gap);
        const yPos = chartY + chartHeight - barHeight;

        doc.setFillColor(37, 99, 235);
        if (barHeight > 0) doc.rect(xPos, yPos, barWidth, barHeight, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        setRgb("setTextColor", CHART_COLORS.text);
        doc.text(String(bar.value), xPos + barWidth / 2 - 2, yPos - 2);
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      setRgb("setTextColor", CHART_COLORS.muted);
      bars.forEach((bar, index) => {
        if (index % 2 === 0 || bars.length <= 5) {
          const xPos = chartX + index * (barWidth + gap);
          doc.text(truncate(bar.label, 8), xPos, chartY + chartHeight + 7);
        }
      });
    };

    const writeWrapped = (text, x, y, maxWidth, lineHeight = 6) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);

      return y + lines.length * lineHeight;
    };

    drawBrandHeader();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setRgb("setTextColor", CHART_COLORS.text);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 16, 48);
    doc.text("Organization: Golden Horizon", 16, 56);
    doc.text("Report Version: 1.0", 16, 64);
    doc.text("Generated by: Golden Horizon SOC Platform", 16, 72);
    doc.text("Classification: Internal Use", 16, 80);
    doc.text("Prepared By:", 16, 98);
    doc.setFont("helvetica", "bold");
    doc.text("Navid Ghobadpour", 16, 106);
    doc.setFont("helvetica", "normal");
    doc.text("SOC Analyst", 16, 114);

    drawMetricCard("Security Posture", `${reportData.securityScore}%`, 16, 132, 42, getSeverityColor("high"));
    drawMetricCard("Risk Level", reportData.posture, 64, 132, 52, getSeverityColor("high"));
    drawMetricCard("Total Incidents", reportData.total, 122, 132, 34);
    drawMetricCard("Attack Sources", reportData.attackSources, 162, 132, 32);

    sectionTitle("Executive Summary", 174);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setRgb("setTextColor", CHART_COLORS.text);
    writeWrapped(
      `This report summarizes ${reportData.total} incidents and ${securityEvents.length} security events from the SOC platform. Duplicate attack titles are grouped so repeated SQL Injection and similar events appear as operational summaries rather than raw repeated rows.`,
      16,
      192,
      176
    );

    addPage();
    sectionTitle("Executive Dashboard", 44);
    drawMetricCard("Security Score", `${reportData.securityScore}%`, 16, 62, 40, getSeverityColor("high"));
    drawMetricCard("Risk Level", reportData.posture, 62, 62, 52, getSeverityColor("high"));
    drawMetricCard("Total Incidents", reportData.total, 120, 62, 34);
    drawMetricCard("Critical", reportData.critical, 160, 62, 34, getSeverityColor("critical"));
    drawMetricCard("High", reportData.high, 16, 96, 34, getSeverityColor("high"));
    drawMetricCard("Medium", reportData.medium, 56, 96, 38, getSeverityColor("medium"));
    drawMetricCard("MTTD", reportData.mttd.value, 100, 96, 34, CHART_COLORS.blue, {
      subtitle: reportData.mttd.subtitle,
      valueFontSize: 14,
    });
    drawMetricCard("MTTR", reportData.mttr.value, 140, 96, 54, CHART_COLORS.blue, {
      subtitle: reportData.mttr.subtitle,
      valueFontSize: 14,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setRgb("setTextColor", CHART_COLORS.text);
    doc.text("Top Threat", 16, 144);
    doc.text("Most Active Source", 16, 170);
    doc.text("Incident Closure Rate", 112, 144);
    doc.text("Critical Incident Percentage", 112, 170);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(truncate(reportData.topThreat, 42), 16, 154);
    doc.text(reportData.topSource, 16, 180);
    doc.text(`${reportData.closureRate}%`, 112, 154);
    doc.text(`${reportData.criticalPercentage}%`, 112, 180);

    addPage();
    sectionTitle("Threat Intelligence Summary", 44);
    drawMetricCard("Top Source Country", reportData.topThreatSourceCountry, 16, 62, 62);
    drawMetricCard("Top Source IP", reportData.topSource, 84, 62, 48);
    drawMetricCard("Attack Sources", reportData.attackSources, 140, 62, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setRgb("setTextColor", CHART_COLORS.text);
    doc.text("Highest Risk Indicator", 16, 116);
    doc.text("Most Common MITRE Technique", 16, 144);
    doc.text("Threat Trend Analysis", 16, 172);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    writeWrapped(reportData.highestRiskIndicator, 16, 126, 170);
    writeWrapped(reportData.mostCommonMitre, 16, 154, 170);
    writeWrapped(reportData.trendAnalysis, 16, 182, 170);

    addPage();
    sectionTitle("Security Analytics", 44);
    drawBarChart("Severity Distribution", reportData.severityData, 16, 66, 82, 58, {
      labelWidth: 34,
      labelMax: 16,
    });
    drawBarChart("Incident Status", reportData.statusData, 112, 66, 82, 58, {
      labelWidth: 34,
      labelMax: 16,
      color: CHART_COLORS.blue,
    });
    drawBarChart("Top Attack Types", reportData.topAttackTypes, 16, 142, 178, 76, {
      labelWidth: 70,
      labelMax: 34,
      limit: 6,
    });

    addPage();
    sectionTitle("MITRE And Trend Coverage", 44);
    drawBarChart(
      "MITRE Coverage",
      reportData.mitreCoverage.map((technique) => ({
        label: `${technique.id} - ${technique.name}`,
        value: technique.count,
        color: CHART_COLORS.blue,
      })),
      16,
      66,
      178,
      80,
      {
        labelWidth: 84,
        labelMax: 42,
      }
    );
    drawTrendChart("Threat Trend", reportData.threatTrends, 16, 170, 178, 76);

    addPage();
    sectionTitle("Grouped Threat Overview", 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setRgb("setTextColor", CHART_COLORS.text);
    doc.text("Attack Type", 16, 66);
    doc.text("Incidents", 118, 66);
    doc.text("Severity", 146, 66);
    doc.text("Latest", 172, 66);
    setRgb("setDrawColor", CHART_COLORS.border);
    doc.line(16, 71, 194, 71);

    let y = 82;
    reportData.attackTypeGroups.slice(0, 12).forEach((group) => {
      if (y > 270) {
        addPage();
        sectionTitle("Grouped Threat Overview", 44);
        y = 66;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setRgb("setTextColor", CHART_COLORS.text);
      doc.text(truncate(group.title, 50), 16, y);
      doc.text(`${group.count} incidents`, 118, y);
      doc.text(group.severity.toUpperCase(), 146, y);
      doc.text(formatDate(group.latest), 172, y);
      y += 10;
    });

    addPage();
    sectionTitle("Top Business Risks", 44);
    y = 66;
    reportData.attackTypeGroups
      .filter((group) => ["critical", "high"].includes(group.severity))
      .slice(0, 6)
      .forEach((risk, index) => {
        const color = getSeverityColor(risk.severity);

        setRgb("setFillColor", color);
        doc.rect(16, y - 4, 3, 9, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setRgb("setTextColor", CHART_COLORS.text);
        doc.text(`${index + 1}. ${risk.title}`, 23, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        setRgb("setTextColor", CHART_COLORS.muted);
        doc.text(
          `${risk.count} ${risk.count === 1 ? "incident" : "incidents"} | ${risk.severity.toUpperCase()} | ${risk.open} open`,
          23,
          y + 8
        );
        y += 20;
      });

    sectionTitle("Recommended Actions", 190);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setRgb("setTextColor", CHART_COLORS.text);
    y = 208;
    [
      "Prioritize investigation of grouped critical incident clusters.",
      "Review web application logs and exposed internet-facing assets.",
      "Validate WAF, authentication, and API gateway controls.",
      "Escalate recurring external attack sources for containment review.",
    ].forEach((action, index) => {
      doc.text(`${index + 1}. ${action}`, 18, y);
      y += 9;
    });

    addPageNumber();
    doc.save(
      `Executive-Security-Report-${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  const exportWordReport = async () => {
    try {
      setExportStatus("Preparing Word report...");

      const response = await axios.get(
        "http://localhost:5000/reports/executive.docx",
        {
          headers: getAuthHeaders(),
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Executive-Security-Report-${new Date()
        .toISOString()
        .slice(0, 10)}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportStatus("Word report downloaded.");
    } catch (err) {
      console.error("Failed to export Word report:", err);
      setExportStatus(
        err.response?.status === 404
          ? "Word export endpoint not found. Restart the backend server and try again."
          : "Failed to export Word report. Check backend is running and you are logged in."
      );
    }
  };

  return (
    <div style={styles.page}>
      <p style={styles.subtitle}>
        Generate executive and analyst-ready SOC reports.
      </p>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Executive Security Report</h3>

        <p style={styles.cardText}>
          Includes live incident counts, severity charts, grouped attack types,
          MITRE ATT&CK coverage, threat trends, and executive recommendations.
        </p>

        <div style={styles.buttonRow}>
          <button style={styles.button} onClick={exportExecutiveReport}>
            Export PDF
          </button>

          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={exportWordReport}
          >
            Export Word
          </button>
        </div>

        {exportStatus && <p style={styles.statusText}>{exportStatus}</p>}
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    color: "#f8fafc",
    minHeight: "100vh",
    padding: "16px",
  },

  subtitle: {
    color: "#94a3b8",
    margin: "0 0 20px",
    fontSize: "14px",
  },

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "16px",
    maxWidth: "700px",
  },

  cardTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
  },

  cardText: {
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.5,
    margin: 0,
  },

  button: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    padding: "9px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  secondaryButton: {
    background: "#2563eb",
  },

  buttonRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "12px",
  },

  statusText: {
    margin: "10px 0 0",
    color: "#94a3b8",
    fontSize: "13px",
  },
};
