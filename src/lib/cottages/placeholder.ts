/**
 * Placeholder cottage layout used until the real illustration arrives.
 * This file is the source of truth for both the placeholder SVG (which
 * needs x/y positions) and the seed script (which needs id + name).
 *
 * When the real illustration ships, replace this file with the actual
 * cottage list (or convert the SVG to use real names + positions there
 * directly and let the seed script take a different JSON input).
 */
export type PlaceholderCottage = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export const PLACEHOLDER_COTTAGES: ReadonlyArray<PlaceholderCottage> = [
  // North shore cluster
  { id: "placeholder-01", name: "Cottage 01", x: 60, y: 40 },
  { id: "placeholder-02", name: "Cottage 02", x: 130, y: 30 },
  { id: "placeholder-03", name: "Cottage 03", x: 200, y: 45 },
  { id: "placeholder-04", name: "Cottage 04", x: 270, y: 35 },
  { id: "placeholder-05", name: "Cottage 05", x: 340, y: 50 },
  { id: "placeholder-06", name: "Cottage 06", x: 410, y: 30 },
  { id: "placeholder-07", name: "Cottage 07", x: 480, y: 45 },
  // South shore cluster
  { id: "placeholder-08", name: "Cottage 08", x: 80, y: 320 },
  { id: "placeholder-09", name: "Cottage 09", x: 150, y: 330 },
  { id: "placeholder-10", name: "Cottage 10", x: 220, y: 315 },
  { id: "placeholder-11", name: "Cottage 11", x: 290, y: 325 },
  { id: "placeholder-12", name: "Cottage 12", x: 360, y: 315 },
  { id: "placeholder-13", name: "Cottage 13", x: 430, y: 330 },
  { id: "placeholder-14", name: "Cottage 14", x: 500, y: 320 },
  // Island
  { id: "placeholder-15", name: "Cottage 15", x: 270, y: 215 },
];
