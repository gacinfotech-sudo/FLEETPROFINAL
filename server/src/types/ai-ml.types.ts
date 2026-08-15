// ============================================================================
// AI & ML ENHANCEMENTS - TYPE DEFINITIONS
// Phase 5: Milestone 1
// ============================================================================

// ============================================================================
// AI ASSISTANT TYPES
// ============================================================================

export enum ConversationIntentType {
  FAQ = 'faq',
  TROUBLESHOOTING = 'troubleshooting',
  ACCOUNT_MANAGEMENT = 'account_management',
  PRODUCT_INQUIRY = 'product_inquiry',
  BILLING = 'billing',
  COMPLAINT = 'complaint',
  OTHER = 'other',
}

export enum SentimentType {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  FRUSTRATED = 'frustrated',
  URGENT = 'urgent',
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sentiment?: SentimentType;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  messages: ConversationMessage[];
  intent: ConversationIntentType;
  status: 'active' | 'closed' | 'escalated';
  escalatedToSupport?: boolean;
  escalationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface AIAssistantContext {
  userId: string;
  tenantId: string;
  conversationHistory: ConversationMessage[];
  userProfile?: {
    name: string;
    email: string;
    subscription?: string;
    lastActivityAt?: Date;
  };
  conversationMetadata?: Record<string, any>;
}

// ============================================================================
// RECOMMENDATION ENGINE TYPES
// ============================================================================

export enum RecommendationType {
  PRODUCT = 'product',
  FEATURE = 'feature',
  SERVICE = 'service',
  CONTENT = 'content',
}

export interface RecommendationItem {
  id: string;
  type: RecommendationType;
  name: string;
  description?: string;
  score: number; // 0-1
  reasoning?: string;
  metadata?: Record<string, any>;
}

export interface UserItemInteraction {
  userId: string;
  itemId: string;
  itemType: RecommendationType;
  interactionType: 'view' | 'click' | 'purchase' | 'rating';
  timestamp: Date;
  rating?: number;
  metadata?: Record<string, any>;
}

export interface Recommendation {
  id: string;
  userId: string;
  tenantId: string;
  items: RecommendationItem[];
  strategy: 'collaborative' | 'content_based' | 'hybrid';
  personalizationScore: number;
  timestamp: Date;
  validUntil?: Date;
  abTestVariant?: string;
}

// ============================================================================
// PREDICTIVE MAINTENANCE TYPES
// ============================================================================

export enum AssetType {
  VEHICLE = 'vehicle',
  EQUIPMENT = 'equipment',
  MACHINERY = 'machinery',
}

export interface AssetHealthScore {
  assetId: string;
  assetType: AssetType;
  healthScore: number; // 0-100
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  lastCalculated: Date;
  factors?: HealthFactor[];
}

export interface HealthFactor {
  name: string;
  weight: number; // 0-1
  value: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
}

export interface FailurePrediction {
  assetId: string;
  failureType: string;
  failureProbability: number; // 0-1
  predictedTimeToFailure?: Date;
  confidenceScore: number;
  recommendedAction: string;
  estimatedCost?: number;
}

export interface MaintenanceWindow {
  assetId: string;
  startDate: Date;
  endDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expectedDowntime: number; // hours
  estimatedCost: number;
}

export interface PartsForecast {
  assetId: string;
  partId: string;
  partName: string;
  quantity: number;
  estimatedDate: Date;
  confidence: number;
}

// ============================================================================
// CUSTOMER SUCCESS AI TYPES
// ============================================================================

export interface CustomerHealthScore {
  customerId: string;
  tenantId: string;
  overallHealth: number; // 0-100
  usageScore: number;
  engagementScore: number;
  npsScore?: number;
  status: 'healthy' | 'at_risk' | 'critical';
  lastCalculated: Date;
  factors?: HealthFactor[];
}

export interface ExpansionOpportunity {
  customerId: string;
  opportunity: string;
  category: string;
  potentialValue: number;
  confidence: number;
  recommendation: string;
  timeline?: string;
}

export interface ChurnPrediction {
  customerId: string;
  churnRisk: number; // 0-1
  riskFactors: string[];
  preventionStrategies: string[];
  recommendedAction: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface EngagementScore {
  customerId: string;
  score: number; // 0-100
  metric: string;
  value: number;
  benchmark: number;
  trend: 'up' | 'stable' | 'down';
}

export interface OutreachRecommendation {
  customerId: string;
  message: string;
  channel: 'email' | 'sms' | 'in_app' | 'call';
  optimalTime: Date;
  contentType: string;
  expectedResponse: number;
}

// ============================================================================
// AUTOMATION RULES ENGINE TYPES
// ============================================================================

export enum TriggerType {
  MANUAL = 'manual',
  TIME_BASED = 'time_based',
  EVENT_BASED = 'event_based',
  CONDITION_BASED = 'condition_based',
}

export enum ActionType {
  SEND_NOTIFICATION = 'send_notification',
  UPDATE_RECORD = 'update_record',
  CREATE_TASK = 'create_task',
  ESCALATE = 'escalate',
  WEBHOOK_CALL = 'webhook_call',
  DATA_TRANSFORM = 'data_transform',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  IN = 'in',
}

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AutomationAction {
  id: string;
  type: ActionType;
  config: Record<string, any>;
  order: number;
}

export interface AutomationRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: {
    type: TriggerType;
    config: Record<string, any>;
  };
  conditions: Condition[];
  actions: AutomationAction[];
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecuted?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecutionLog {
  id: string;
  ruleId: string;
  tenantId: string;
  status: 'pending' | 'executing' | 'success' | 'failed';
  startTime: Date;
  endTime?: Date;
  executionTime?: number; // milliseconds
  errorMessage?: string;
  resultData?: Record<string, any>;
}

// ============================================================================
// NLP PROCESSING TYPES
// ============================================================================

export enum TextClassificationCategory {
  SUPPORT = 'support',
  SALES = 'sales',
  PRODUCT_FEEDBACK = 'product_feedback',
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request',
  SPAM = 'spam',
}

export interface Entity {
  type: string;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface TextClassification {
  text: string;
  category: TextClassificationCategory;
  confidence: number;
  alternativeCategories?: TextClassificationCategory[];
}

export interface NERResult {
  text: string;
  entities: Entity[];
}

export interface SentimentAnalysisResult {
  text: string;
  sentiment: SentimentType;
  score: number; // -1 to 1
  confidence: number;
}

export interface TextSummary {
  originalText: string;
  summary: string;
  keyPoints: string[];
  length: number;
}

export interface NLPProcessingResult {
  id: string;
  tenantId: string;
  text: string;
  classification?: TextClassification;
  entities?: Entity[];
  sentiment?: SentimentAnalysisResult;
  summary?: TextSummary;
  keywords: string[];
  language: string;
  isSpam: boolean;
  hasBias: boolean;
  processingTime: number;
  timestamp: Date;
}

// ============================================================================
// ML FEATURES SERVICE TYPES
// ============================================================================

export interface Feature {
  id: string;
  name: string;
  description?: string;
  featureStore: string;
  version: string;
  dataType: 'numeric' | 'categorical' | 'text' | 'datetime';
  importance: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureVersion {
  featureId: string;
  version: string;
  changes: string[];
  createdAt: Date;
  validFrom: Date;
}

export interface FeatureMonitoring {
  featureId: string;
  monitoringDate: Date;
  dataDriftDetected: boolean;
  driftScore?: number;
  missingValues: number;
  nullRate: number;
  distribution?: Record<string, number>;
  anomalyDetected: boolean;
}

export interface OfflineFeatureRequest {
  featureIds: string[];
  entityIds: string[];
  asOfDate?: Date;
}

export interface OnlineFeatureRequest {
  featureIds: string[];
  entityId: string;
  requestTime: Date;
}

export interface FeatureDiscoveryRecommendation {
  suggestedFeature: string;
  useCase: string;
  expectedImpact: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedEffort: number; // hours
}

// ============================================================================
// GENERIC ML TYPES
// ============================================================================

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  customMetrics?: Record<string, number>;
}

export interface MLPipeline {
  id: string;
  tenantId: string;
  name: string;
  stage: 'training' | 'validation' | 'production';
  models: string[]; // model IDs
  metrics: ModelMetrics;
  lastUpdated: Date;
  version: string;
}
