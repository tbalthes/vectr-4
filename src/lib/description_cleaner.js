function cleanDescription(description) {
  return description
    .replace(/MCC\s*\d+|\d+/g, " ") // Remove 'MCC ####' and numbers
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

const description =
  "AMC 0099 ESPLANADE 14 PHOENIX AZ Date 06/29/25 24431065182237057053852 7832 %% MCC 7832";
const cleaned = cleanDescription(description);
console.log(cleaned); // Output: "AUTOZONE E MCD PHOENIX AZ %%"
