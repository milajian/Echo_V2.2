/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum RelationshipCategory {
  FAMILY = 'Family',
  INTIMATE = 'Intimate',
  FRIEND = 'Friend',
  WORK = 'Work',
  OTHER = 'Other'
}

export interface Inspiration {
  id: string;
  content: string;
  type: 'text' | 'voice';
  tags: string[];
  userId: string;
  personId?: string; // Link to a person in the relationship map
  createdAt: number;
  updatedAt?: number;
  aiInsight?: any;
}

export interface Person {
  id: string;
  name: string;
  category: RelationshipCategory;
  notes: string;
  userId: string;
  createdAt: number;
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  userId: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  userId: string;
  createdAt: number;
  updatedAt?: number;
}

export interface WeeklyNarrative {
  week: number;
  year: number;
  inspirations: Inspiration[];
}

export interface WeeklySummary {
  id: string;
  weekStart: string; // YYYY-MM-DD
  content: string;
  userId: string;
  createdAt: number;
}

export interface ConversationSeed {
  id: string;
  title: string;
  question?: string;
  content: string;
  tags?: string[];
  inspirationId?: string;
  autoSend?: boolean;
}

export interface GrowthReportInspiration {
  id?: string;
  content: string;
  tags?: string[];
  createdAt: number;
}

export interface GrowthReportConversation {
  id?: string;
  title: string;
  preview: string;
  createdAt: number;
}

export interface GrowthReportTheme {
  name: string;
  description?: string;
}

export type GrowthReportKind = 'weekly' | 'monthly';

export interface GrowthReport {
  id: string;
  kind: GrowthReportKind;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  title: string;
  headline: string;
  summary: string;
  highlights: string[];
  themes: GrowthReportTheme[];
  emotionalTone?: string;
  growthAreas?: string[];
  inspirations: GrowthReportInspiration[];
  conversations: GrowthReportConversation[];
  tags: string[];
  createdAt: number;
  source: 'mock' | 'ai';
}
