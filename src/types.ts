/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Photo {
  id: string;
  url: string;
  title: string;
  album: string;
  date: string;
  location: string;
  tags: string[];
  size: string;
  favorite: boolean;
  filter: string; // CSS Filter representation
  originalUrl: string;
  aiGenerated: boolean;
  description?: string;
  isAnalyzed?: boolean;
  isSyncedToDrive?: boolean;
  driveFileId?: string;
}

export interface Album {
  id: string;
  name: string;
  iconName: string;
  coverUrl: string;
}

export type DeviceType = "phone" | "tablet" | "desktop";

export interface FilterType {
  id: string;
  name: string;
  class: string;
}

export interface AIAnalysis {
  status: "success" | "error";
  description: string;
  suggestedTags: string[];
  story?: string;
}
