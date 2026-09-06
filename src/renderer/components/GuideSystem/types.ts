export interface GuideSection {
  title: string;
  icon: string;
  content: string;
}

export interface ValidationRule {
  field: string;
  rule: string;
  example?: string;
}

export interface GuideStep {
  stepNumber: number;
  title: string;
  description: string;
  tip?: string;
  warning?: string;
}

export interface GuideData {
  pageId: string;
  pageTitle: string;
  pageDescription: string;
  route: string;
  whatIsThis: string;
  whenToUse: string;
  prerequisites: string[];
  sections: GuideSection[];
  steps: GuideStep[];
  dos: string[];
  donts: string[];
  validationRules: ValidationRule[];
  relatedPages: { title: string; route: string }[];
}

export interface GuideContextType {
  openGuide: (pageId: string) => void;
  closeGuide: () => void;
  currentGuide: GuideData | null;
  isGuideOpen: boolean;
  seenGuides: string[];
  markAsSeen: (pageId: string) => void;
}
