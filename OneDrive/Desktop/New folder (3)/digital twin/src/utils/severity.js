const typeWeights = {
  "oil spill": 9,
  "chemical spill": 10,
  "sewage discharge": 8,
  "plastic waste": 5,
  "air pollution": 6,
  "industrial waste": 8,
  "dead wildlife": 7,
  "littering": 3,
  other: 4
};

function keywordBoost(description = "") {
  const text = description.toLowerCase();
  let boost = 0;

  const highRisk = ["toxic", "burning", "leaking", "massive", "dead fish", "black water"];
  const mediumRisk = ["smell", "floating", "dumping", "murky", "foam"];

  highRisk.forEach((keyword) => {
    if (text.includes(keyword)) boost += 1.2;
  });

  mediumRisk.forEach((keyword) => {
    if (text.includes(keyword)) boost += 0.6;
  });

  return boost;
}

function calculateSeverity(type, description) {
  const normalizedType = (type || "").toLowerCase();
  const base = typeWeights[normalizedType] ?? typeWeights.other;
  const score = base + keywordBoost(description);
  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
}

function severityBand(score) {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

module.exports = { calculateSeverity, severityBand };
