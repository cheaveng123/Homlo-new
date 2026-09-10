export type QuickChip = {
  id: string;
  label: string;
  icon: "square.grid.2x2" | "clock" | "graduationcap.fill" | "calendar" | "mappin";
};

export const defaultQuickChips: QuickChip[] = [
  { id: "all", label: "All", icon: "square.grid.2x2" },
  { id: "part-time", label: "Part-time", icon: "clock" },
  { id: "internship", label: "Internship", icon: "graduationcap.fill" },
  { id: "weekend", label: "Weekend", icon: "calendar" },
  { id: "remote", label: "Remote", icon: "mappin" },
];
