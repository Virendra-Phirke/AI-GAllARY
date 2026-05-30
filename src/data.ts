/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Photo, Album } from "./types";

export const INITIAL_ALBUMS: Album[] = [
  {
    id: "all",
    name: "All Photos",
    iconName: "Image",
    coverUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "camera",
    name: "Camera Roll",
    iconName: "Camera",
    coverUrl: "https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "wanderlust",
    name: "Wanderlust",
    iconName: "Compass",
    coverUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "metropolis",
    name: "Metropolis",
    iconName: "Building2",
    coverUrl: "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "nature",
    name: "Pure Nature",
    iconName: "Trees",
    coverUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
  },
];

export const INITIAL_PHOTOS: Photo[] = [];


export const FILTER_PRESETS = [
  { id: "normal", name: "Normal", class: "" },
  { id: "grayscale", name: "Grayscale", class: "grayscale" },
  { id: "sepia", name: "Vintage Sepia", class: "sepia contrast-125 brightness-95" },
  { id: "warmth", name: "Sun-Drenched", class: "saturate-150 sepia-10 hue-rotate-15" },
  { id: "cool", name: "Nordic Frost", class: "saturate-75 contrast-105 hue-rotate--15 brightness-105" },
  { id: "cyberpunk", name: "Cyber Neon", class: "hue-rotate-180 saturate-200 contrast-125" },
  { id: "dramatic", name: "Shadow High", class: "contrast-150 brightness-75 grayscale" },
  { id: "blur", name: "Soft Dream", class: "blur-[2px] opacity-90 brightness-110" },
  { id: "vintage", name: "Retro Film", class: "sepia-50 saturate-150 hue-rotate-15 contrast-125" },
  { id: "vivid", name: "Vibrant Pop", class: "saturate-200 contrast-110 brightness-105" },
  { id: "noir", name: "Classic Noir", class: "grayscale contrast-150 brightness-90" },
  { id: "washed", name: "Faded Memory", class: "saturate-50 contrast-75 brightness-110 sepia-20" },
];
