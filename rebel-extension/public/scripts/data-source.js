export const DATA_BASE_URL = "https://rebelremind.github.io/data";

export const DATA_FILES = {
  academicCalendar: "academiccalendar_list.json",
  involvementCenter: "involvementcenter_list.json",
  rebelCoverage: "rebelcoverage_list.json",
  unlvCalendar: "unlvcalendar_list.json",
  organizations: "organization_list.json",
};

export function buildDataUrl(fileName) {
  return `${DATA_BASE_URL}/${fileName}`;
}
