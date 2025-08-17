export function getStatusColor(status: string): React.CSSProperties {
  switch (status) {
    case "over-budget":
      return {
        backgroundColor: "hsl(0 84.2% 60.2%)",
        color: "white",
        border: "1px solid hsl(0 84.2% 60.2%)",
      };
    case "on-track":
      return {
        backgroundColor: "hsl(43 74% 66%)",
        color: "black",
        border: "1px solid hsl(43 74% 66%)",
      };
    case "under-budget":
      return {
        backgroundColor: "hsl(120 100% 25%)",
        color: "white",
        border: "1px solid hsl(120 100% 25%)",
      };
    default:
      return {
        backgroundColor: "rgb(109 40 217)", // violet-700
        color: "white",
        border: "1px solid rgb(109 40 217)",
      };
  }
}
