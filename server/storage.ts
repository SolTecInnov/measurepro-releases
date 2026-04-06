import { randomUUID } from 'crypto';
import {
  Customer,
  InsertCustomer,
  Subscription,
  InsertSubscription,
  RouteEnforcementConvoy,
  RouteEnforcementMember,
  RouteIncident,
  SweptPathAnalysis,
  InsertSweptPathAnalysis,
  TurnSimulation,
  InsertTurnSimulation,
  MarketingSection,
  InsertMarketingSection,
  MarketingComment,
  InsertMarketingComment,
  MarketingEdit,
  InsertMarketingEdit,
  Pricing,
  InsertPricing,
  SignupProgress,
  InsertSignupProgress,
  TermsVersion,
  InsertTermsVersion,
  TermsAcceptance,
  InsertTermsAcceptance,
  Tester,
  InsertTester,
  TestSession,
  InsertTestSession,
  TestResult,
  InsertTestResult,
  UserSettings,
  InsertUserSettings,
  Company,
  InsertCompany,
  CompanyMember,
  InsertCompanyMember,
  MemberAddonOverride,
  InsertMemberAddonOverride,
} from '../shared/schema.js';
import { db } from '../db/index.js';
import { marketingSections, marketingComments, marketingEdits, pricing, signupProgress, termsVersions, termsAcceptances, subscriptionTiers, emailLogs, testers, testSessions, testResults, loginLogs, activityLogs, userSettings, hardwareVouchers, companies as companiesTable, companyMembers as companyMembersTable, memberAddonOverrides as memberAddonOverridesTable } from '../db/schema.js';
import { eq, desc, and, isNotNull, sql, lt, or, ilike } from 'drizzle-orm';

// Helper Functions for Grace Period Enforcement

// Calculate days remaining until deletion
export function getDaysUntilDeletion(timestamp: string | null, graceDays: number): number | null {
  if (!timestamp) return null;
  const pausedDate = new Date(timestamp);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - pausedDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, graceDays - daysPassed);
}

// Get subscription status with countdown
export function getSubscriptionStatus(pausedAt: string | null, cancelledAt: string | null) {
  if (cancelledAt) {
    const daysRemaining = getDaysUntilDeletion(cancelledAt, 30);
    return {
      status: 'cancelled',
      daysRemaining,
      gracePeriodExpired: daysRemaining === 0
    };
  }
  if (pausedAt) {
    const daysRemaining = getDaysUntilDeletion(pausedAt, 90);
    return {
      status: 'paused',
      daysRemaining,
      gracePeriodExpired: daysRemaining === 0
    };
  }
  return {
    status: 'active',
    daysRemaining: null,
    gracePeriodExpired: false
  };
}

export interface IStorage {
  // Customer CRUD
  createCustomer(data: InsertCustomer): Promise<Customer>;
  getCustomer(id: string): Promise<Customer | null>;
  getAllCustomers(): Promise<Customer[]>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | null>;
  deleteCustomer(id: string): Promise<boolean>;

  // Subscription CRUD
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  getSubscription(id: string): Promise<Subscription | null>;
  getAllSubscriptions(): Promise<Subscription[]>;
  getSubscriptionsByCustomer(customerId: string): Promise<Subscription[]>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | null>;
  deleteSubscription(id: string): Promise<boolean>;

  // Route Enforcement Convoy CRUD
  createRouteConvoy(data: Omit<RouteEnforcementConvoy, 'id' | 'createdAt'>): Promise<RouteEnforcementConvoy>;
  getRouteConvoy(id: string): Promise<RouteEnforcementConvoy | null>;
  getRouteConvoyByToken(qrToken: string): Promise<RouteEnforcementConvoy | null>;
  getAllRouteConvoys(): Promise<RouteEnforcementConvoy[]>;
  getActiveRouteConvoys(dispatcherId?: string): Promise<RouteEnforcementConvoy[]>;
  updateRouteConvoy(id: string, data: Partial<RouteEnforcementConvoy>): Promise<RouteEnforcementConvoy | null>;
  deleteRouteConvoy(id: string): Promise<boolean>;

  // Route Enforcement Member CRUD
  createRouteMember(data: Omit<RouteEnforcementMember, 'id' | 'joinedAt' | 'lastSeen'>): Promise<RouteEnforcementMember>;
  getRouteMember(id: string): Promise<RouteEnforcementMember | null>;
  getRouteMembers(convoyId: string): Promise<RouteEnforcementMember[]>;
  updateRouteMember(id: string, data: Partial<RouteEnforcementMember>): Promise<RouteEnforcementMember | null>;
  deleteRouteMember(id: string): Promise<boolean>;

  // Route Incident CRUD
  createRouteIncident(data: Omit<RouteIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<RouteIncident>;
  getRouteIncident(id: string): Promise<RouteIncident | null>;
  getRouteIncidents(convoyId: string): Promise<RouteIncident[]>;
  getPendingIncidents(convoyId: string): Promise<RouteIncident[]>;
  updateRouteIncident(id: string, data: Partial<RouteIncident>): Promise<RouteIncident | null>;
  deleteRouteIncident(id: string): Promise<boolean>;

  // Swept Path Analysis CRUD
  createSweptPathAnalysis(data: InsertSweptPathAnalysis): Promise<SweptPathAnalysis>;
  getSweptPathAnalysis(id: string): Promise<SweptPathAnalysis | null>;
  getAllSweptPathAnalyses(): Promise<SweptPathAnalysis[]>;
  getSweptPathAnalysesByVehicleProfile(vehicleProfileId: string): Promise<SweptPathAnalysis[]>;
  getSweptPathAnalysesByProject(projectId: string): Promise<SweptPathAnalysis[]>;
  updateSweptPathAnalysis(id: string, data: Partial<InsertSweptPathAnalysis>): Promise<SweptPathAnalysis | null>;
  deleteSweptPathAnalysis(id: string): Promise<boolean>;

  // Turn Simulation CRUD
  createTurnSimulation(data: InsertTurnSimulation): Promise<TurnSimulation>;
  getTurnSimulation(id: string): Promise<TurnSimulation | null>;
  getTurnSimulationsByAnalysis(analysisId: string): Promise<TurnSimulation[]>;
  deleteTurnSimulation(id: string): Promise<boolean>;

  // Marketing Collaboration CRUD
  getAllMarketingSections(): Promise<MarketingSection[]>;
  getMarketingSection(id: number): Promise<MarketingSection | null>;
  createMarketingComment(data: InsertMarketingComment): Promise<MarketingComment>;
  getMarketingComments(documentId: string): Promise<MarketingComment[]>;
  createMarketingEdit(data: InsertMarketingEdit): Promise<MarketingEdit>;
  getMarketingEdits(documentId: string): Promise<MarketingEdit[]>;

  // Pricing CRUD
  getAllPricing(): Promise<Pricing[]>;
  getPricing(id: string): Promise<Pricing | null>;
  createPricing(data: InsertPricing): Promise<Pricing>;
  updatePricing(id: string, data: Partial<InsertPricing>): Promise<Pricing | null>;
  deletePricing(id: string): Promise<boolean>;

  // Signup Progress CRUD
  createSignupProgress(data: InsertSignupProgress): Promise<SignupProgress>;
  getSignupProgress(id: string): Promise<SignupProgress | null>;
  getSignupProgressByEmail(email: string): Promise<SignupProgress | null>;
  updateSignupProgress(id: string, data: Partial<InsertSignupProgress>): Promise<SignupProgress | null>;
  deleteSignupProgress(id: string): Promise<boolean>;
  cleanupIncompleteSignups(hoursOld: number): Promise<{ deletedCount: number; deletedIds: string[] }>;

  // Terms Version CRUD
  createTermsVersion(data: InsertTermsVersion): Promise<TermsVersion>;
  getTermsVersion(id: string): Promise<TermsVersion | null>;
  getLatestTermsVersion(): Promise<TermsVersion | null>;
  getAllTermsVersions(): Promise<TermsVersion[]>;
  updateTermsVersion(id: string, data: Partial<InsertTermsVersion>): Promise<TermsVersion | null>;
  deleteTermsVersion(id: string): Promise<boolean>;

  // Terms Acceptance CRUD
  createTermsAcceptance(data: InsertTermsAcceptance): Promise<TermsAcceptance>;
  getTermsAcceptance(id: string): Promise<TermsAcceptance | null>;
  getTermsAcceptancesByUser(userId: string): Promise<TermsAcceptance[]>;
  getTermsAcceptanceByUserAndVersion(userId: string, termsVersionId: string): Promise<TermsAcceptance | null>;
  getAcceptanceStats(versionId: string): Promise<{ totalUsers: number; acceptedCount: number; pendingCount: number; acceptanceRate: number }>;

  // Subscription Management Methods
  getUserSubscription(userId: string): Promise<any | null>;
  pauseSubscription(userId: string): Promise<SignupProgress | null>;
  cancelSubscription(userId: string): Promise<SignupProgress | null>;
  unpauseSubscription(userId: string): Promise<SignupProgress | null>;
  uncancelSubscription(userId: string): Promise<SignupProgress | null>;
  enforceGracePeriods(): Promise<{ expiredPaused: string[]; expiredCancelled: string[] }>;
  
  // Data Lifecycle Methods
  getAllUserData(userId: string): Promise<{
    subscription: any;
    signupProgress: SignupProgress | null;
    termsAcceptances: TermsAcceptance[];
    exportDate: string;
  }>;
  deleteExpiredUserData(expiredEmails: string[]): Promise<Array<{
    userId: string;
    email: string;
    deletedAt: string;
    fullName?: string | null;
  }>>;

  // Testing Portal Methods
  // Testers
  createTester(tester: InsertTester): Promise<Tester>;
  getTesterByEmail(email: string): Promise<Tester | null>;
  getAllTesters(): Promise<Tester[]>;

  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | null>;
  getTestSessionsByTester(testerId: number): Promise<TestSession[]>;
  updateTestSession(id: number, updates: Partial<InsertTestSession>): Promise<TestSession>;
  getAllTestSessions(): Promise<TestSession[]>;

  // Test Results
  createTestResult(result: InsertTestResult): Promise<TestResult>;
  getTestResultsBySession(sessionId: number): Promise<TestResult[]>;
  updateTestResult(id: number, updates: Partial<InsertTestResult>): Promise<TestResult>;
  bulkCreateTestResults(results: InsertTestResult[]): Promise<TestResult[]>;

  // User Settings (database-persisted)
  getUserSettings(userId: string): Promise<UserSettings | null>;
  saveUserSettings(data: InsertUserSettings): Promise<UserSettings>;

  // Company CRUD
  createCompany(data: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | null>;
  getAllCompanies(): Promise<Company[]>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | null>;
  deleteCompany(id: string): Promise<boolean>;

  // Company Member CRUD
  createCompanyMember(data: InsertCompanyMember): Promise<CompanyMember>;
  getCompanyMember(id: string): Promise<CompanyMember | null>;
  getCompanyMemberByUid(companyId: string, firebaseUid: string): Promise<CompanyMember | null>;
  getCompanyMembersByCompany(companyId: string): Promise<CompanyMember[]>;
  getCompanyMembershipByUid(firebaseUid: string): Promise<CompanyMember | null>;
  searchCompanyMembersByQuery(query: string, limit?: number): Promise<CompanyMember[]>;
  updateCompanyMember(id: string, data: Partial<InsertCompanyMember>): Promise<CompanyMember | null>;
  deleteCompanyMember(id: string): Promise<boolean>;

  // Member Add-on Overrides CRUD
  createMemberAddonOverride(data: InsertMemberAddonOverride): Promise<MemberAddonOverride>;
  getMemberAddonOverride(id: string): Promise<MemberAddonOverride | null>;
  getActiveOverridesByUser(userId: string): Promise<MemberAddonOverride[]>;
  getAllOverrides(): Promise<MemberAddonOverride[]>;
  revokeMemberAddonOverride(id: string, revokedByUid: string, revokedReason: string): Promise<MemberAddonOverride | null>;
  expireOverdueMemberAddonOverrides(): Promise<MemberAddonOverride[]>;
}

export class MemStorage implements IStorage {
  private customers: Map<string, Customer> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private routeConvoys: Map<string, RouteEnforcementConvoy> = new Map();
  private routeMembers: Map<string, RouteEnforcementMember> = new Map();
  private routeIncidents: Map<string, RouteIncident> = new Map();
  private sweptPathAnalyses: Map<string, SweptPathAnalysis> = new Map();
  private turnSimulations: Map<string, TurnSimulation> = new Map();
  private signupProgressMap: Map<string, SignupProgress> = new Map();
  private testersMap: Map<number, Tester> = new Map();
  private testSessionsMap: Map<number, TestSession> = new Map();
  private testResultsMap: Map<number, TestResult> = new Map();
  private testerIdCounter: number = 1;
  private testSessionIdCounter: number = 1;
  private testResultIdCounter: number = 1;

  // Customer CRUD Methods
  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const now = new Date().toISOString();
    const customer: Customer = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.set(customer.id, customer);
    return customer;
  }

  async getCustomer(id: string): Promise<Customer | null> {
    return this.customers.get(id) || null;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | null> {
    const existing = this.customers.get(id);
    if (!existing) return null;

    const updated: Customer = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  // Subscription CRUD Methods
  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const now = new Date().toISOString();
    const subscription: Subscription = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async getAllSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  async getSubscriptionsByCustomer(customerId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(
      (sub) => sub.customerId === customerId
    );
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | null> {
    const existing = this.subscriptions.get(id);
    if (!existing) return null;

    const updated: Subscription = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(id, updated);
    return updated;
  }

  async deleteSubscription(id: string): Promise<boolean> {
    return this.subscriptions.delete(id);
  }

  // Route Enforcement Convoy CRUD Methods
  async createRouteConvoy(data: Omit<RouteEnforcementConvoy, 'id' | 'createdAt'>): Promise<RouteEnforcementConvoy> {
    const convoy: RouteEnforcementConvoy = {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.routeConvoys.set(convoy.id, convoy);
    return convoy;
  }

  async getRouteConvoy(id: string): Promise<RouteEnforcementConvoy | null> {
    return this.routeConvoys.get(id) || null;
  }

  async getRouteConvoyByToken(qrToken: string): Promise<RouteEnforcementConvoy | null> {
    return Array.from(this.routeConvoys.values()).find(
      (convoy) => convoy.qrToken === qrToken
    ) || null;
  }

  async getAllRouteConvoys(): Promise<RouteEnforcementConvoy[]> {
    return Array.from(this.routeConvoys.values());
  }

  async getActiveRouteConvoys(dispatcherId?: string): Promise<RouteEnforcementConvoy[]> {
    return Array.from(this.routeConvoys.values()).filter(
      (convoy) => convoy.status === 'active' && 
      (!dispatcherId || convoy.dispatcherId === dispatcherId)
    );
  }

  async updateRouteConvoy(id: string, data: Partial<RouteEnforcementConvoy>): Promise<RouteEnforcementConvoy | null> {
    const existing = this.routeConvoys.get(id);
    if (!existing) return null;

    const updated: RouteEnforcementConvoy = {
      ...existing,
      ...data,
    };
    this.routeConvoys.set(id, updated);
    return updated;
  }

  async deleteRouteConvoy(id: string): Promise<boolean> {
    return this.routeConvoys.delete(id);
  }

  // Route Enforcement Member CRUD Methods
  async createRouteMember(data: Omit<RouteEnforcementMember, 'id' | 'joinedAt' | 'lastSeen'>): Promise<RouteEnforcementMember> {
    const now = new Date().toISOString();
    const member: RouteEnforcementMember = {
      id: randomUUID(),
      ...data,
      joinedAt: now,
      lastSeen: now,
    };
    this.routeMembers.set(member.id, member);
    return member;
  }

  async getRouteMember(id: string): Promise<RouteEnforcementMember | null> {
    return this.routeMembers.get(id) || null;
  }

  async getRouteMembers(convoyId: string): Promise<RouteEnforcementMember[]> {
    return Array.from(this.routeMembers.values()).filter(
      (member) => member.convoyId === convoyId
    );
  }

  async updateRouteMember(id: string, data: Partial<RouteEnforcementMember>): Promise<RouteEnforcementMember | null> {
    const existing = this.routeMembers.get(id);
    if (!existing) return null;

    const updated: RouteEnforcementMember = {
      ...existing,
      ...data,
      lastSeen: new Date().toISOString(),
    };
    this.routeMembers.set(id, updated);
    return updated;
  }

  async deleteRouteMember(id: string): Promise<boolean> {
    return this.routeMembers.delete(id);
  }

  // Route Incident CRUD Methods
  async createRouteIncident(data: Omit<RouteIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<RouteIncident> {
    const now = new Date().toISOString();
    const incident: RouteIncident = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    this.routeIncidents.set(incident.id, incident);
    return incident;
  }

  async getRouteIncident(id: string): Promise<RouteIncident | null> {
    return this.routeIncidents.get(id) || null;
  }

  async getRouteIncidents(convoyId: string): Promise<RouteIncident[]> {
    return Array.from(this.routeIncidents.values()).filter(
      (incident) => incident.convoyId === convoyId
    );
  }

  async getPendingIncidents(convoyId: string): Promise<RouteIncident[]> {
    return Array.from(this.routeIncidents.values()).filter(
      (incident) => incident.convoyId === convoyId && incident.status === 'pending'
    );
  }

  async updateRouteIncident(id: string, data: Partial<RouteIncident>): Promise<RouteIncident | null> {
    const existing = this.routeIncidents.get(id);
    if (!existing) return null;

    const updated: RouteIncident = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.routeIncidents.set(id, updated);
    return updated;
  }

  async deleteRouteIncident(id: string): Promise<boolean> {
    return this.routeIncidents.delete(id);
  }

  // Swept Path Analysis CRUD Methods
  async createSweptPathAnalysis(data: InsertSweptPathAnalysis): Promise<SweptPathAnalysis> {
    const analysis: SweptPathAnalysis = {
      id: randomUUID(),
      ...data,
    };
    this.sweptPathAnalyses.set(analysis.id, analysis);
    return analysis;
  }

  async getSweptPathAnalysis(id: string): Promise<SweptPathAnalysis | null> {
    return this.sweptPathAnalyses.get(id) || null;
  }

  async getAllSweptPathAnalyses(): Promise<SweptPathAnalysis[]> {
    return Array.from(this.sweptPathAnalyses.values());
  }

  async getSweptPathAnalysesByVehicleProfile(vehicleProfileId: string): Promise<SweptPathAnalysis[]> {
    return Array.from(this.sweptPathAnalyses.values()).filter(
      (analysis) => analysis.vehicleProfileId === vehicleProfileId
    );
  }

  async getSweptPathAnalysesByProject(projectId: string): Promise<SweptPathAnalysis[]> {
    return Array.from(this.sweptPathAnalyses.values()).filter(
      (analysis) => analysis.projectId === projectId
    );
  }

  async updateSweptPathAnalysis(id: string, data: Partial<InsertSweptPathAnalysis>): Promise<SweptPathAnalysis | null> {
    const existing = this.sweptPathAnalyses.get(id);
    if (!existing) return null;

    const updated: SweptPathAnalysis = {
      ...existing,
      ...data,
    };
    this.sweptPathAnalyses.set(id, updated);
    return updated;
  }

  async deleteSweptPathAnalysis(id: string): Promise<boolean> {
    return this.sweptPathAnalyses.delete(id);
  }

  // Turn Simulation CRUD Methods
  async createTurnSimulation(data: InsertTurnSimulation): Promise<TurnSimulation> {
    const simulation: TurnSimulation = {
      id: randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
    };
    this.turnSimulations.set(simulation.id, simulation);
    return simulation;
  }

  async getTurnSimulation(id: string): Promise<TurnSimulation | null> {
    return this.turnSimulations.get(id) || null;
  }

  async getTurnSimulationsByAnalysis(analysisId: string): Promise<TurnSimulation[]> {
    return Array.from(this.turnSimulations.values()).filter(
      (simulation) => simulation.analysisId === analysisId
    );
  }

  async deleteTurnSimulation(id: string): Promise<boolean> {
    return this.turnSimulations.delete(id);
  }

  // Marketing Collaboration Methods (using database instead of in-memory)
  async getAllMarketingSections(): Promise<MarketingSection[]> {
    return await db.select().from(marketingSections);
  }

  async getMarketingSection(id: number): Promise<MarketingSection | null> {
    const results = await db.select().from(marketingSections).where(eq(marketingSections.id, id));
    return results[0] || null;
  }

  async createMarketingComment(data: InsertMarketingComment): Promise<MarketingComment> {
    const results = await db.insert(marketingComments).values(data).returning();
    return results[0];
  }

  async getMarketingComments(documentId: string): Promise<MarketingComment[]> {
    return await db.select().from(marketingComments).where(eq(marketingComments.documentId, documentId));
  }

  async createMarketingEdit(data: InsertMarketingEdit): Promise<MarketingEdit> {
    const results = await db.insert(marketingEdits).values(data).returning();
    const row = results[0];
    return {
      ...row,
      editNote: row.editNote ?? undefined,
    };
  }

  async getMarketingEdits(documentId: string): Promise<MarketingEdit[]> {
    const results = await db.select().from(marketingEdits).where(eq(marketingEdits.documentId, documentId));
    return results.map(row => ({
      ...row,
      editNote: row.editNote ?? undefined,
    }));
  }

  // Pricing CRUD Methods (using database)
  async getAllPricing(): Promise<Pricing[]> {
    const results = await db.select().from(pricing);
    return results.map(row => ({
      ...row,
      itemType: row.itemType as "subscription_tier" | "addon",
      currency: row.currency ?? "USD",
      billingPeriod: (row.billingPeriod as "monthly" | "yearly" | null) ?? undefined,
      isActive: row.isActive ?? true,
      description: row.description ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getPricing(id: string): Promise<Pricing | null> {
    const results = await db.select().from(pricing).where(eq(pricing.id, id));
    if (results.length === 0) return null;
    const row = results[0];
    return {
      ...row,
      itemType: row.itemType as "subscription_tier" | "addon",
      currency: row.currency ?? "USD",
      billingPeriod: (row.billingPeriod as "monthly" | "yearly" | null) ?? undefined,
      isActive: row.isActive ?? true,
      description: row.description ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async createPricing(data: InsertPricing): Promise<Pricing> {
    const results = await db.insert(pricing).values(data).returning();
    const row = results[0];
    return {
      ...row,
      itemType: row.itemType as "subscription_tier" | "addon",
      currency: row.currency ?? "USD",
      billingPeriod: (row.billingPeriod as "monthly" | "yearly" | null) ?? undefined,
      isActive: row.isActive ?? true,
      description: row.description ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async updatePricing(id: string, data: Partial<InsertPricing>): Promise<Pricing | null> {
    const results = await db
      .update(pricing)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pricing.id, id))
      .returning();
    
    if (results.length === 0) return null;
    const row = results[0];
    return {
      ...row,
      itemType: row.itemType as "subscription_tier" | "addon",
      currency: row.currency ?? "USD",
      billingPeriod: (row.billingPeriod as "monthly" | "yearly" | null) ?? undefined,
      isActive: row.isActive ?? true,
      description: row.description ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async deletePricing(id: string): Promise<boolean> {
    const results = await db.delete(pricing).where(eq(pricing.id, id)).returning();
    return results.length > 0;
  }

  // Signup Progress CRUD Methods (using database)
  async createSignupProgress(data: InsertSignupProgress): Promise<SignupProgress> {
    // Convert date strings to Date objects for database insertion
    const insertData: any = { ...data };
    if (insertData.completedAt && typeof insertData.completedAt === 'string') {
      insertData.completedAt = new Date(insertData.completedAt);
    }
    if (insertData.pausedAt && typeof insertData.pausedAt === 'string') {
      insertData.pausedAt = new Date(insertData.pausedAt);
    }
    if (insertData.cancelledAt && typeof insertData.cancelledAt === 'string') {
      insertData.cancelledAt = new Date(insertData.cancelledAt);
    }
    if (insertData.startedAt && typeof insertData.startedAt === 'string') {
      insertData.startedAt = new Date(insertData.startedAt);
    }
    if (insertData.lastUpdatedAt && typeof insertData.lastUpdatedAt === 'string') {
      insertData.lastUpdatedAt = new Date(insertData.lastUpdatedAt);
    }
    
    const results = await db.insert(signupProgress).values([insertData]).returning();
    const row = results[0];
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || new Date().toISOString(),
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || new Date().toISOString(),
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async getSignupProgress(id: string): Promise<SignupProgress | null> {
    const results = await db.select().from(signupProgress).where(eq(signupProgress.id, id));
    if (results.length === 0) return null;
    const row = results[0];
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || new Date().toISOString(),
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || new Date().toISOString(),
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async getSignupProgressByEmail(email: string): Promise<SignupProgress | null> {
    const results = await db.select().from(signupProgress).where(eq(signupProgress.email, email));
    if (results.length === 0) return null;
    const row = results[0];
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || new Date().toISOString(),
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || new Date().toISOString(),
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async updateSignupProgress(id: string, data: Partial<InsertSignupProgress>): Promise<SignupProgress | null> {
    const updateData: any = {
      ...data,
      lastUpdatedAt: new Date(),
    };
    
    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }
    if (data.pausedAt !== undefined) {
      updateData.pausedAt = data.pausedAt ? new Date(data.pausedAt) : null;
    }
    if (data.cancelledAt !== undefined) {
      updateData.cancelledAt = data.cancelledAt ? new Date(data.cancelledAt) : null;
    }
    
    const results = await db
      .update(signupProgress)
      .set(updateData)
      .where(eq(signupProgress.id, id))
      .returning();
    
    if (results.length === 0) return null;
    const row = results[0];
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || new Date().toISOString(),
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || new Date().toISOString(),
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async deleteSignupProgress(id: string): Promise<boolean> {
    const results = await db.delete(signupProgress).where(eq(signupProgress.id, id)).returning();
    return results.length > 0;
  }

  // Subscription Management Methods
  async getUserSubscription(userId: string): Promise<any | null> {
    // Get signup progress by email (userId in this context is actually the email)
    const results = await db
      .select()
      .from(signupProgress)
      .where(eq(signupProgress.email, userId))
      .limit(1);
    
    if (results.length === 0) return null;
    const progress = results[0];
    
    // Get subscription tier details if selected
    const selectedTier = (progress.step3Data as any)?.selectedTier;
    let tierDetails: any = null;
    
    if (selectedTier) {
      const tierResults = await db
        .select()
        .from(subscriptionTiers)
        .where(eq(subscriptionTiers.tierKey, selectedTier))
        .limit(1);
      
      if (tierResults.length > 0) {
        const tier = tierResults[0];
        tierDetails = {
          ...tier,
          description: tier.description ?? undefined,
          includedFeatures: tier.includedFeatures ?? undefined,
          isActive: tier.isActive ?? true,
          metadata: tier.metadata as Record<string, any> | undefined,
          createdAt: tier.createdAt?.toISOString() || '',
          updatedAt: tier.updatedAt?.toISOString() || '',
        };
      }
    }
    
    // Get selected add-ons pricing
    const selectedAddons = (progress.step3Data as any)?.selectedAddons || [];
    const addonsDetails: any[] = [];
    
    if (selectedAddons.length > 0) {
      const addonResults = await db
        .select()
        .from(pricing)
        .where(eq(pricing.itemType, 'addon'));
      
      for (const addon of addonResults) {
        if (selectedAddons.includes(addon.itemKey)) {
          addonsDetails.push({
            ...addon,
            itemType: addon.itemType as "subscription_tier" | "addon",
            currency: addon.currency ?? "USD",
            billingPeriod: (addon.billingPeriod as "monthly" | "yearly" | null) ?? undefined,
            isActive: addon.isActive ?? true,
            description: addon.description ?? undefined,
            metadata: addon.metadata as Record<string, any> | undefined,
            createdAt: addon.createdAt?.toISOString() || '',
            updatedAt: addon.updatedAt?.toISOString() || '',
          });
        }
      }
    }
    
    // Calculate status with countdown
    const pausedAtStr = progress.pausedAt?.toISOString() || null;
    const cancelledAtStr = progress.cancelledAt?.toISOString() || null;
    const statusInfo = getSubscriptionStatus(pausedAtStr, cancelledAtStr);
    
    return {
      subscription: {
        ...progress,
        startedAt: progress.startedAt?.toISOString() || '',
        lastUpdatedAt: progress.lastUpdatedAt?.toISOString() || '',
        completedAt: progress.completedAt?.toISOString() || null,
        pausedAt: pausedAtStr,
        cancelledAt: cancelledAtStr,
        status: statusInfo.status,
        daysUntilDeletion: statusInfo.daysRemaining,
        gracePeriodExpired: statusInfo.gracePeriodExpired,
      },
      tier: tierDetails,
      addons: addonsDetails,
    };
  }

  async pauseSubscription(userId: string): Promise<SignupProgress | null> {
    const results = await db
      .update(signupProgress)
      .set({
        pausedAt: new Date(),
        lastUpdatedAt: new Date(),
      })
      .where(eq(signupProgress.email, userId))
      .returning();
    
    if (results.length === 0) return null;
    const row = results[0];
    
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || '',
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || '',
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async cancelSubscription(userId: string): Promise<SignupProgress | null> {
    const results = await db
      .update(signupProgress)
      .set({
        cancelledAt: new Date(),
        lastUpdatedAt: new Date(),
      })
      .where(eq(signupProgress.email, userId))
      .returning();
    
    if (results.length === 0) return null;
    const row = results[0];
    
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || '',
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || '',
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async unpauseSubscription(userId: string): Promise<SignupProgress | null> {
    const results = await db
      .update(signupProgress)
      .set({
        pausedAt: null,
        lastUpdatedAt: new Date(),
      })
      .where(eq(signupProgress.email, userId))
      .returning();
    
    if (results.length === 0) return null;
    const row = results[0];
    
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || '',
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || '',
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async uncancelSubscription(userId: string): Promise<SignupProgress | null> {
    const results = await db
      .update(signupProgress)
      .set({
        cancelledAt: null,
        lastUpdatedAt: new Date(),
      })
      .where(eq(signupProgress.email, userId))
      .returning();
    
    if (results.length === 0) return null;
    const row = results[0];
    
    return {
      ...row,
      status: (row.status ?? "in_progress") as "in_progress" | "completed" | "abandoned",
      userAgent: row.userAgent ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      step1Data: row.step1Data as { name?: string; email?: string; passwordHash?: string } | undefined,
      step2Data: row.step2Data as { company?: string; title?: string; address?: string; phone?: string } | undefined,
      step3Data: row.step3Data as { selectedTier?: string; selectedAddons?: string[] } | undefined,
      step4Data: row.step4Data as { termsAccepted?: boolean; termsVersion?: string; timestamp?: string } | undefined,
      step5Data: row.step5Data as Record<string, any> | undefined,
      startedAt: row.startedAt?.toISOString() || '',
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() || '',
      completedAt: row.completedAt?.toISOString() || undefined,
      pausedAt: row.pausedAt?.toISOString() || undefined,
      cancelledAt: row.cancelledAt?.toISOString() || undefined,
    };
  }

  async enforceGracePeriods(): Promise<{ expiredPaused: string[]; expiredCancelled: string[] }> {
    // Find all expired paused subscriptions (90+ days)
    const expiredPaused = await db
      .select()
      .from(signupProgress)
      .where(
        and(
          isNotNull(signupProgress.pausedAt),
          sql`${signupProgress.pausedAt} < NOW() - INTERVAL '90 days'`
        )
      );
    
    // Find all expired cancelled subscriptions (30+ days)
    const expiredCancelled = await db
      .select()
      .from(signupProgress)
      .where(
        and(
          isNotNull(signupProgress.cancelledAt),
          sql`${signupProgress.cancelledAt} < NOW() - INTERVAL '30 days'`
        )
      );
    
    // Return list of affected userIds (emails)
    return {
      expiredPaused: expiredPaused.map(p => p.email),
      expiredCancelled: expiredCancelled.map(p => p.email),
    };
  }

  async getAllUserData(userId: string): Promise<{
    subscription: any;
    signupProgress: SignupProgress | null;
    termsAcceptances: TermsAcceptance[];
    exportDate: string;
  }> {
    // Get user subscription data
    const subscription = await this.getUserSubscription(userId);
    
    // Get signup progress
    const signupProgressData = await this.getSignupProgressByEmail(userId);
    
    // Get terms acceptances
    const termsAcceptances = await this.getTermsAcceptancesByUser(userId);
    
    return {
      subscription,
      signupProgress: signupProgressData,
      termsAcceptances,
      exportDate: new Date().toISOString(),
    };
  }

  async deleteExpiredUserData(expiredEmails: string[]): Promise<Array<{
    userId: string;
    email: string;
    deletedAt: string;
    fullName?: string | null;
  }>> {
    const deletedUsers: Array<{
      userId: string;
      email: string;
      deletedAt: string;
      fullName?: string | null;
    }> = [];
    
    // Delete data for each expired account (using explicit list, no re-fetching)
    for (const email of expiredEmails) {
      try {
        // Get user data before deletion for logging
        const userData = await db
          .select()
          .from(signupProgress)
          .where(eq(signupProgress.email, email))
          .limit(1);
        
        if (userData.length === 0) {
          console.log(`⚠️ No user data found for email: ${email}`);
          continue;
        }
        
        const user = userData[0];
        
        // Delete ALL user data from all tables to ensure complete removal
        
        // 1. Delete terms acceptances (userId field is actually email)
        await db
          .delete(termsAcceptances)
          .where(eq(termsAcceptances.userId, email));
        
        // 2. Delete email logs (userId field can be email or userId)
        await db
          .delete(emailLogs)
          .where(eq(emailLogs.userId, email));
        
        // Also delete by recipient email to catch all email logs
        await db
          .delete(emailLogs)
          .where(eq(emailLogs.recipientEmail, email));
        
        // 3. Delete signup progress (main user account data) - MUST BE LAST
        await db
          .delete(signupProgress)
          .where(eq(signupProgress.email, email));
        
        // Note: Firebase Auth deletion would be done here in production
        // await getAuth().deleteUser(email);
        
        deletedUsers.push({
          userId: user.id,
          email: user.email,
          deletedAt: new Date().toISOString(),
          fullName: (user.step1Data as any)?.name || null,
        });
        
        console.log(`✅ Deleted all data for user: ${email} (ID: ${user.id})`);
      } catch (error: any) {
        console.error(`❌ Failed to delete user ${email}:`, error);
      }
    }
    
    return deletedUsers;
  }

  // ==================== TERMS VERSION & ACCEPTANCE METHODS ====================

  async createTermsVersion(data: InsertTermsVersion): Promise<TermsVersion> {
    const results = await db.insert(termsVersions).values({
      version: data.version,
      title: data.title,
      content: data.content,
      effectiveDate: new Date(data.effectiveDate),
      isActive: data.isActive ?? true,
      requiresReacceptance: data.requiresReacceptance ?? false,
      metadata: data.metadata,
    }).returning();

    const row = results[0];
    return {
      ...row,
      isActive: row.isActive ?? true,
      requiresReacceptance: row.requiresReacceptance ?? false,
      metadata: row.metadata as Record<string, any> | undefined,
      effectiveDate: row.effectiveDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getTermsVersion(id: string): Promise<TermsVersion | null> {
    const results = await db
      .select()
      .from(termsVersions)
      .where(eq(termsVersions.id, id))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      ...row,
      isActive: row.isActive ?? true,
      requiresReacceptance: row.requiresReacceptance ?? false,
      metadata: row.metadata as Record<string, any> | undefined,
      effectiveDate: row.effectiveDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getLatestTermsVersion(): Promise<TermsVersion | null> {
    const results = await db
      .select()
      .from(termsVersions)
      .where(eq(termsVersions.isActive, true))
      .orderBy(desc(termsVersions.createdAt))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      ...row,
      isActive: row.isActive ?? true,
      requiresReacceptance: row.requiresReacceptance ?? false,
      metadata: row.metadata as Record<string, any> | undefined,
      effectiveDate: row.effectiveDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getAllTermsVersions(): Promise<TermsVersion[]> {
    const results = await db
      .select()
      .from(termsVersions)
      .orderBy(desc(termsVersions.createdAt));

    return results.map(row => ({
      ...row,
      isActive: row.isActive ?? true,
      requiresReacceptance: row.requiresReacceptance ?? false,
      metadata: row.metadata as Record<string, any> | undefined,
      effectiveDate: row.effectiveDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async updateTermsVersion(id: string, data: Partial<InsertTermsVersion>): Promise<TermsVersion | null> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.version !== undefined) updateData.version = data.version;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.effectiveDate !== undefined) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.requiresReacceptance !== undefined) updateData.requiresReacceptance = data.requiresReacceptance;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const results = await db
      .update(termsVersions)
      .set(updateData)
      .where(eq(termsVersions.id, id))
      .returning();

    if (results.length === 0) return null;

    const row = results[0];
    return {
      ...row,
      isActive: row.isActive ?? true,
      requiresReacceptance: row.requiresReacceptance ?? false,
      metadata: row.metadata as Record<string, any> | undefined,
      effectiveDate: row.effectiveDate.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async deleteTermsVersion(id: string): Promise<boolean> {
    const results = await db
      .delete(termsVersions)
      .where(eq(termsVersions.id, id))
      .returning();

    return results.length > 0;
  }

  async createTermsAcceptance(data: InsertTermsAcceptance): Promise<TermsAcceptance> {
    const results = await db.insert(termsAcceptances).values({
      userId: data.userId,
      userEmail: data.userEmail,
      termsVersionId: data.termsVersionId,
      termsVersion: data.termsVersion,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      deviceFingerprint: data.deviceFingerprint,
      metadata: data.metadata,
    }).returning();

    const row = results[0];
    return {
      ...row,
      userAgent: row.userAgent ?? undefined,
      deviceFingerprint: row.deviceFingerprint ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      acceptedAt: row.acceptedAt.toISOString(),
    };
  }

  async getTermsAcceptance(id: string): Promise<TermsAcceptance | null> {
    const results = await db
      .select()
      .from(termsAcceptances)
      .where(eq(termsAcceptances.id, id))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      ...row,
      userAgent: row.userAgent ?? undefined,
      deviceFingerprint: row.deviceFingerprint ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      acceptedAt: row.acceptedAt.toISOString(),
    };
  }

  async getTermsAcceptancesByUser(userId: string): Promise<TermsAcceptance[]> {
    const results = await db
      .select()
      .from(termsAcceptances)
      .where(eq(termsAcceptances.userId, userId))
      .orderBy(desc(termsAcceptances.acceptedAt));

    return results.map(row => ({
      ...row,
      userAgent: row.userAgent ?? undefined,
      deviceFingerprint: row.deviceFingerprint ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      acceptedAt: row.acceptedAt.toISOString(),
    }));
  }

  async getTermsAcceptanceByUserAndVersion(userId: string, termsVersionId: string): Promise<TermsAcceptance | null> {
    const results = await db
      .select()
      .from(termsAcceptances)
      .where(
        and(
          eq(termsAcceptances.userId, userId),
          eq(termsAcceptances.termsVersionId, termsVersionId)
        )
      )
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      ...row,
      userAgent: row.userAgent ?? undefined,
      deviceFingerprint: row.deviceFingerprint ?? undefined,
      metadata: row.metadata as Record<string, any> | undefined,
      acceptedAt: row.acceptedAt.toISOString(),
    };
  }

  async hasUserAcceptedLatestTerms(userId: string): Promise<boolean> {
    const latest = await this.getLatestTermsVersion();
    if (!latest) return true; // No terms exist

    const acceptance = await this.getTermsAcceptanceByUserAndVersion(userId, latest.id);
    return acceptance !== null;
  }

  async getUsersWithoutLatestTerms(): Promise<Array<{ userId: string; email: string; fullName: string | null }>> {
    const latest = await this.getLatestTermsVersion();
    if (!latest) return [];

    // Get all users from signup progress who have completed signup
    const allUsers = await db
      .select()
      .from(signupProgress)
      .where(isNotNull(signupProgress.completedAt));

    const usersWithoutAcceptance: Array<{ userId: string; email: string; fullName: string | null }> = [];

    for (const user of allUsers) {
      const acceptance = await this.getTermsAcceptanceByUserAndVersion(user.email, latest.id);
      if (!acceptance) {
        usersWithoutAcceptance.push({
          userId: user.id,
          email: user.email,
          fullName: (user.step1Data as any)?.fullName || null,
        });
      }
    }

    return usersWithoutAcceptance;
  }

  async getAcceptanceStats(versionId: string): Promise<{
    totalUsers: number;
    acceptedCount: number;
    pendingCount: number;
    acceptanceRate: number;
  }> {
    // Get total completed users
    const allUsers = await db
      .select()
      .from(signupProgress)
      .where(isNotNull(signupProgress.completedAt));

    const totalUsers = allUsers.length;

    // Get acceptances for this version
    const acceptances = await db
      .select()
      .from(termsAcceptances)
      .where(eq(termsAcceptances.termsVersionId, versionId));

    const acceptedCount = acceptances.length;
    const pendingCount = totalUsers - acceptedCount;
    const acceptanceRate = totalUsers > 0 ? (acceptedCount / totalUsers) * 100 : 0;

    return {
      totalUsers,
      acceptedCount,
      pendingCount,
      acceptanceRate,
    };
  }

  // Testing Portal Methods
  async createTester(data: InsertTester): Promise<Tester> {
    const id = this.testerIdCounter++;
    const now = new Date();
    const tester: Tester = {
      id,
      name: data.name,
      email: data.email,
      groundReference: data.groundReference,
      installationDescription: data.installationDescription ?? null,
      photoUrl: data.photoUrl ?? null,
      weatherConditions: data.weatherConditions ?? null,
      temperature: data.temperature ?? null,
      location: data.location ?? null,
      createdAt: now,
    };
    this.testersMap.set(id, tester);
    return tester;
  }

  async getTesterByEmail(email: string): Promise<Tester | null> {
    const tester = Array.from(this.testersMap.values()).find(t => t.email === email);
    return tester || null;
  }

  async getAllTesters(): Promise<Tester[]> {
    return Array.from(this.testersMap.values());
  }

  async createTestSession(data: InsertTestSession): Promise<TestSession> {
    const id = this.testSessionIdCounter++;
    const now = new Date();
    const session: TestSession = {
      id,
      ...data,
      startedAt: now,
      completedAt: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      blockedTests: 0,
      completionPercentage: 0,
      notes: data.notes || null,
      location: data.location || null,
    };
    this.testSessionsMap.set(id, session);
    return session;
  }

  async getTestSession(id: number): Promise<TestSession | null> {
    return this.testSessionsMap.get(id) || null;
  }

  async getTestSessionsByTester(testerId: number): Promise<TestSession[]> {
    return Array.from(this.testSessionsMap.values()).filter(s => s.testerId === testerId);
  }

  async updateTestSession(id: number, updates: Partial<InsertTestSession>): Promise<TestSession> {
    const existing = this.testSessionsMap.get(id);
    if (!existing) {
      throw new Error(`Test session with id ${id} not found`);
    }
    const updated: TestSession = { ...existing, ...updates };
    this.testSessionsMap.set(id, updated);
    return updated;
  }

  async getAllTestSessions(): Promise<TestSession[]> {
    return Array.from(this.testSessionsMap.values());
  }

  async createTestResult(data: InsertTestResult): Promise<TestResult> {
    const id = this.testResultIdCounter++;
    const result: TestResult = {
      id,
      ...data,
      testedAt: data.testedAt || null,
      notes: data.notes || null,
    };
    this.testResultsMap.set(id, result);
    return result;
  }

  async getTestResultsBySession(sessionId: number): Promise<TestResult[]> {
    return Array.from(this.testResultsMap.values()).filter(r => r.sessionId === sessionId);
  }

  async updateTestResult(id: number, updates: Partial<InsertTestResult>): Promise<TestResult> {
    const existing = this.testResultsMap.get(id);
    if (!existing) {
      throw new Error(`Test result with id ${id} not found`);
    }
    const updated: TestResult = { ...existing, ...updates };
    this.testResultsMap.set(id, updated);
    return updated;
  }

  async bulkCreateTestResults(results: InsertTestResult[]): Promise<TestResult[]> {
    const createdResults: TestResult[] = [];
    for (const data of results) {
      const result = await this.createTestResult(data);
      createdResults.push(result);
    }
    return createdResults;
  }

  // User Settings CRUD Methods (database-persisted)
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const results = await db.select().from(userSettings).where(eq(userSettings.id, userId));
    if (results.length === 0) return null;
    const row = results[0];
    return {
      id: row.id,
      displaySettings: row.displaySettings,
      laserSettings: row.laserSettings,
      gpsSettings: row.gpsSettings,
      cameraSettings: row.cameraSettings,
      mapSettings: row.mapSettings,
      loggingSettings: row.loggingSettings,
      alertSettings: row.alertSettings,
      aiSettings: row.aiSettings,
      convoySettings: row.convoySettings,
      developerSettings: row.developerSettings,
      profileSettings: row.profileSettings,
      liveSharingSettings: row.liveSharingSettings,
      aiAssistantSettings: row.aiAssistantSettings,
      lateralLaserSettings: row.lateralLaserSettings ?? null,
      rearOverhangSettings: row.rearOverhangSettings ?? null,
      overheadDetectionConfig: row.overheadDetectionConfig,
      bufferDetectionConfig: row.bufferDetectionConfig,
      layoutConfig: row.layoutConfig ?? null,
      uiSettings: row.uiSettings ?? null,
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    };
  }

  async saveUserSettings(data: InsertUserSettings): Promise<UserSettings> {
    const existing = await this.getUserSettings(data.id);
    
    if (existing) {
      const results = await db
        .update(userSettings)
        .set({
          displaySettings: data.displaySettings,
          laserSettings: data.laserSettings,
          gpsSettings: data.gpsSettings,
          cameraSettings: data.cameraSettings,
          mapSettings: data.mapSettings,
          loggingSettings: data.loggingSettings,
          alertSettings: data.alertSettings,
          aiSettings: data.aiSettings,
          convoySettings: data.convoySettings,
          developerSettings: data.developerSettings,
          profileSettings: data.profileSettings,
          liveSharingSettings: data.liveSharingSettings,
          aiAssistantSettings: data.aiAssistantSettings,
          lateralLaserSettings: data.lateralLaserSettings,
          rearOverhangSettings: data.rearOverhangSettings,
          overheadDetectionConfig: data.overheadDetectionConfig,
          bufferDetectionConfig: data.bufferDetectionConfig,
          layoutConfig: data.layoutConfig,
          uiSettings: data.uiSettings,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.id, data.id))
        .returning();
      const row = results[0];
      return {
        id: row.id,
        displaySettings: row.displaySettings,
        laserSettings: row.laserSettings,
        gpsSettings: row.gpsSettings,
        cameraSettings: row.cameraSettings,
        mapSettings: row.mapSettings,
        loggingSettings: row.loggingSettings,
        alertSettings: row.alertSettings,
        aiSettings: row.aiSettings,
        convoySettings: row.convoySettings,
        developerSettings: row.developerSettings,
        profileSettings: row.profileSettings,
        liveSharingSettings: row.liveSharingSettings,
        aiAssistantSettings: row.aiAssistantSettings,
        lateralLaserSettings: row.lateralLaserSettings ?? null,
        rearOverhangSettings: row.rearOverhangSettings ?? null,
        overheadDetectionConfig: row.overheadDetectionConfig,
        bufferDetectionConfig: row.bufferDetectionConfig,
        layoutConfig: row.layoutConfig ?? null,
        uiSettings: row.uiSettings ?? null,
        createdAt: row.createdAt?.toISOString(),
        updatedAt: row.updatedAt?.toISOString(),
      };
    } else {
      const results = await db
        .insert(userSettings)
        .values({
          id: data.id,
          displaySettings: data.displaySettings,
          laserSettings: data.laserSettings,
          gpsSettings: data.gpsSettings,
          cameraSettings: data.cameraSettings,
          mapSettings: data.mapSettings,
          loggingSettings: data.loggingSettings,
          alertSettings: data.alertSettings,
          aiSettings: data.aiSettings,
          convoySettings: data.convoySettings,
          developerSettings: data.developerSettings,
          profileSettings: data.profileSettings,
          liveSharingSettings: data.liveSharingSettings,
          aiAssistantSettings: data.aiAssistantSettings,
          lateralLaserSettings: data.lateralLaserSettings,
          rearOverhangSettings: data.rearOverhangSettings,
          overheadDetectionConfig: data.overheadDetectionConfig,
          bufferDetectionConfig: data.bufferDetectionConfig,
          layoutConfig: data.layoutConfig,
          uiSettings: data.uiSettings,
        })
        .returning();
      const row = results[0];
      return {
        id: row.id,
        displaySettings: row.displaySettings,
        laserSettings: row.laserSettings,
        gpsSettings: row.gpsSettings,
        cameraSettings: row.cameraSettings,
        mapSettings: row.mapSettings,
        loggingSettings: row.loggingSettings,
        alertSettings: row.alertSettings,
        aiSettings: row.aiSettings,
        convoySettings: row.convoySettings,
        developerSettings: row.developerSettings,
        profileSettings: row.profileSettings,
        liveSharingSettings: row.liveSharingSettings,
        aiAssistantSettings: row.aiAssistantSettings,
        lateralLaserSettings: row.lateralLaserSettings ?? null,
        rearOverhangSettings: row.rearOverhangSettings ?? null,
        overheadDetectionConfig: row.overheadDetectionConfig,
        bufferDetectionConfig: row.bufferDetectionConfig,
        layoutConfig: row.layoutConfig ?? null,
        uiSettings: row.uiSettings ?? null,
        createdAt: row.createdAt?.toISOString(),
        updatedAt: row.updatedAt?.toISOString(),
      };
    }
  }

  // Company CRUD Methods — DB-backed via Drizzle

  private mapCompanyRow(row: any): Company {
    return {
      id: row.id,
      name: row.name,
      address: row.address ?? null,
      city: row.city ?? null,
      province: row.province ?? null,
      country: row.country ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      website: row.website ?? null,
      notes: row.notes ?? null,
      enabledAddons: row.enabledAddons ?? [],
      pendingSync: row.pendingSync ?? false,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt ?? new Date().toISOString()),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt ?? new Date().toISOString()),
    };
  }

  private mapMemberRow(row: any): CompanyMember {
    return {
      id: row.id,
      companyId: row.companyId,
      firebaseUid: row.firebaseUid,
      email: row.email,
      fullName: row.fullName,
      role: row.role as 'company_admin' | 'member',
      allowedAddons: row.allowedAddons ?? null,
      betaAccess: row.betaAccess ?? null,
      pendingSync: row.pendingSync ?? false,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : (row.createdAt ?? new Date().toISOString()),
    };
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const now = new Date();
    const [row] = await db.insert(companiesTable).values({
      id,
      name: data.name,
      address: data.address ?? null,
      city: data.city ?? null,
      province: data.province ?? null,
      country: data.country ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      notes: data.notes ?? null,
      enabledAddons: data.enabledAddons ?? [],
      pendingSync: data.pendingSync ?? false,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return this.mapCompanyRow(row);
  }

  async getCompany(id: string): Promise<Company | null> {
    const rows = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
    return rows.length ? this.mapCompanyRow(rows[0]) : null;
  }

  async getAllCompanies(): Promise<Company[]> {
    const rows = await db.select().from(companiesTable).orderBy(desc(companiesTable.createdAt));
    return rows.map(r => this.mapCompanyRow(r));
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | null> {
    const rows = await db.update(companiesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companiesTable.id, id))
      .returning();
    return rows.length ? this.mapCompanyRow(rows[0]) : null;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const rows = await db.delete(companiesTable).where(eq(companiesTable.id, id)).returning({ id: companiesTable.id });
    return rows.length > 0;
  }

  async createCompanyMember(data: InsertCompanyMember): Promise<CompanyMember> {
    const id = randomUUID();
    const now = new Date();
    const [row] = await db.insert(companyMembersTable).values({
      id,
      companyId: data.companyId,
      firebaseUid: data.firebaseUid,
      email: data.email,
      fullName: data.fullName,
      role: data.role ?? 'member',
      allowedAddons: data.allowedAddons ?? null,
      betaAccess: data.betaAccess ?? null,
      pendingSync: data.pendingSync ?? false,
      createdAt: now,
    }).returning();
    return this.mapMemberRow(row);
  }

  async getCompanyMember(id: string): Promise<CompanyMember | null> {
    const rows = await db.select().from(companyMembersTable).where(eq(companyMembersTable.id, id)).limit(1);
    return rows.length ? this.mapMemberRow(rows[0]) : null;
  }

  async getCompanyMemberByUid(companyId: string, firebaseUid: string): Promise<CompanyMember | null> {
    const rows = await db.select().from(companyMembersTable)
      .where(and(eq(companyMembersTable.companyId, companyId), eq(companyMembersTable.firebaseUid, firebaseUid)))
      .limit(1);
    return rows.length ? this.mapMemberRow(rows[0]) : null;
  }

  async getCompanyMembersByCompany(companyId: string): Promise<CompanyMember[]> {
    const rows = await db.select().from(companyMembersTable).where(eq(companyMembersTable.companyId, companyId));
    return rows.map(r => this.mapMemberRow(r));
  }

  async getCompanyMembershipByUid(firebaseUid: string): Promise<CompanyMember | null> {
    const rows = await db.select().from(companyMembersTable).where(eq(companyMembersTable.firebaseUid, firebaseUid)).limit(1);
    return rows.length ? this.mapMemberRow(rows[0]) : null;
  }

  async searchCompanyMembersByQuery(query: string, limit = 10): Promise<CompanyMember[]> {
    const pattern = `%${query}%`;
    const rows = await db.select().from(companyMembersTable)
      .where(or(
        ilike(companyMembersTable.email, pattern),
        ilike(companyMembersTable.fullName, pattern),
      ))
      .limit(limit);
    return rows.map(r => this.mapMemberRow(r));
  }

  async updateCompanyMember(id: string, data: Partial<InsertCompanyMember>): Promise<CompanyMember | null> {
    const rows = await db.update(companyMembersTable).set(data).where(eq(companyMembersTable.id, id)).returning();
    return rows.length ? this.mapMemberRow(rows[0]) : null;
  }

  async deleteCompanyMember(id: string): Promise<boolean> {
    const rows = await db.delete(companyMembersTable).where(eq(companyMembersTable.id, id)).returning({ id: companyMembersTable.id });
    return rows.length > 0;
  }

  async cleanupIncompleteSignups(hoursOld: number): Promise<{ deletedCount: number; deletedIds: string[] }> {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    const results = await db
      .delete(signupProgress)
      .where(
        and(
          eq(signupProgress.status, 'in_progress'),
          lt(signupProgress.startedAt, cutoffDate)
        )
      )
      .returning({ id: signupProgress.id });
    const deletedIds = results.map((r) => r.id);
    return { deletedCount: deletedIds.length, deletedIds };
  }

  // Member Add-on Overrides

  private mapOverrideRow(row: any): MemberAddonOverride {
    return {
      id: row.id,
      userId: row.userId,
      userEmail: row.userEmail,
      userName: row.userName ?? null,
      addonKey: row.addonKey,
      grantedByUid: row.grantedByUid,
      grantedByName: row.grantedByName ?? null,
      reason: row.reason,
      expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
      grantedAt: row.grantedAt instanceof Date ? row.grantedAt.toISOString() : row.grantedAt,
      revokedAt: row.revokedAt instanceof Date ? row.revokedAt.toISOString() : (row.revokedAt ?? null),
      revokedByUid: row.revokedByUid ?? null,
      revokedReason: row.revokedReason ?? null,
      isActive: row.isActive,
    };
  }

  async createMemberAddonOverride(data: InsertMemberAddonOverride): Promise<MemberAddonOverride> {
    const id = randomUUID();
    const now = new Date();
    const [row] = await db.insert(memberAddonOverridesTable).values({
      id,
      userId: data.userId,
      userEmail: data.userEmail,
      userName: data.userName ?? null,
      addonKey: data.addonKey,
      grantedByUid: data.grantedByUid,
      grantedByName: data.grantedByName ?? null,
      reason: data.reason,
      expiresAt: new Date(data.expiresAt),
      grantedAt: now,
      isActive: true,
    }).returning();
    return this.mapOverrideRow(row);
  }

  async getMemberAddonOverride(id: string): Promise<MemberAddonOverride | null> {
    const rows = await db.select().from(memberAddonOverridesTable).where(eq(memberAddonOverridesTable.id, id)).limit(1);
    return rows.length ? this.mapOverrideRow(rows[0]) : null;
  }

  async getActiveOverridesByUser(userId: string): Promise<MemberAddonOverride[]> {
    const now = new Date();
    const rows = await db.select().from(memberAddonOverridesTable)
      .where(and(
        eq(memberAddonOverridesTable.userId, userId),
        eq(memberAddonOverridesTable.isActive, true),
      ))
      .orderBy(desc(memberAddonOverridesTable.grantedAt));
    return rows
      .filter(r => new Date(r.expiresAt) > now)
      .map(r => this.mapOverrideRow(r));
  }

  async getAllOverrides(): Promise<MemberAddonOverride[]> {
    const rows = await db.select().from(memberAddonOverridesTable).orderBy(desc(memberAddonOverridesTable.grantedAt));
    return rows.map(r => this.mapOverrideRow(r));
  }

  async revokeMemberAddonOverride(id: string, revokedByUid: string, revokedReason: string): Promise<MemberAddonOverride | null> {
    const rows = await db.update(memberAddonOverridesTable)
      .set({ isActive: false, revokedAt: new Date(), revokedByUid, revokedReason })
      .where(eq(memberAddonOverridesTable.id, id))
      .returning();
    return rows.length ? this.mapOverrideRow(rows[0]) : null;
  }

  async expireOverdueMemberAddonOverrides(): Promise<MemberAddonOverride[]> {
    const now = new Date();
    const rows = await db.update(memberAddonOverridesTable)
      .set({
        isActive: false,
        revokedAt: now,
        revokedByUid: 'system',
        revokedReason: 'Auto-expired: grant period ended',
      })
      .where(and(
        eq(memberAddonOverridesTable.isActive, true),
        lt(memberAddonOverridesTable.expiresAt, now),
      ))
      .returning();
    return rows.map(r => this.mapOverrideRow(r));
  }
}

export const storage = new MemStorage();
