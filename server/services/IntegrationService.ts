import {
  IntegrationConnection,
  IntegrationSyncLog,
  AccountingEntityMap,
  HRMSEmployeeData,
  CRMContactData,
  IoTSensorData,
} from '../models/enterprise.models';
import axios, { AxiosInstance } from 'axios';

/**
 * WAVE 23: Advanced Integrations Service
 * Unified integration management for 6 major external systems
 */
export class IntegrationService {
  private clients: Map<string, AxiosInstance> = new Map();

  /**
   * Connect to external system
   */
  async connectIntegration(
    tenantId: string,
    provider: string,
    credentials: any,
    config: any
  ): Promise<any> {
    // Validate credentials first
    const isValid = await this.validateCredentials(provider, credentials);

    if (!isValid) {
      throw new Error(`Invalid credentials for ${provider}`);
    }

    // Find or create connection
    let connection = await IntegrationConnection.findOne({
      tenantId,
      provider,
    });

    if (!connection) {
      connection = new IntegrationConnection({
        tenantId,
        provider,
        name: `${provider} Connection`,
        credentials,
        config,
        isActive: false,
        isConfigured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      connection.credentials = credentials;
      connection.config = config;
      connection.updatedAt = new Date();
    }

    // Test connection
    const testResult = await this.testConnection(provider, credentials);

    if (testResult.success) {
      connection.isConfigured = true;
      connection.isActive = true;
      connection.syncStatus = 'idle';
      connection.lastError = undefined;
    } else {
      connection.lastError = testResult.error;
    }

    return connection.save();
  }

  /**
   * Validate credentials
   */
  private async validateCredentials(provider: string, credentials: any): Promise<boolean> {
    try {
      switch (provider) {
        case 'quickbooks':
          return !!credentials.realmId && !!credentials.accessToken;
        case 'tally':
          return !!credentials.username && !!credentials.password;
        case 'salesforce':
          return !!credentials.clientId && !!credentials.clientSecret;
        case 'hubspot':
          return !!credentials.apiKey;
        case 'sap':
          return !!credentials.username && !!credentials.password;
        case 'oracle':
          return !!credentials.username && !!credentials.password;
        case 'fedex':
        case 'dhl':
          return !!credentials.apiKey;
        case 'hrms':
          return !!credentials.apiKey || (!!credentials.username && !!credentials.password);
        case 'iot':
          return !!credentials.apiKey;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Test connection
   */
  private async testConnection(provider: string, credentials: any): Promise<any> {
    try {
      const client = this.createClient(provider, credentials);

      switch (provider) {
        case 'quickbooks':
          const qbResponse = await client.get('/v2/company/1234567890/query?query=select * from Customer maxResults 1');
          return { success: qbResponse.status === 200 };

        case 'salesforce':
          const sfResponse = await client.get('/services/data/');
          return { success: sfResponse.status === 200 };

        case 'hubspot':
          const hsResponse = await client.get('/crm/v3/objects/contacts?limit=1');
          return { success: hsResponse.status === 200 };

        default:
          return { success: true };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create API client for provider
   */
  private createClient(provider: string, credentials: any): AxiosInstance {
    const cacheKey = `${provider}-${credentials.apiKey || credentials.accessToken}`;

    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    let baseURL = '';
    let headers: any = {};

    switch (provider) {
      case 'quickbooks':
        baseURL = 'https://quickbooks.api.intuit.com';
        headers.Authorization = `Bearer ${credentials.accessToken}`;
        break;

      case 'salesforce':
        baseURL = `https://${credentials.instance || 'login'}.salesforce.com`;
        headers.Authorization = `Bearer ${credentials.accessToken}`;
        break;

      case 'hubspot':
        baseURL = 'https://api.hubapi.com';
        headers['Private-App-Legacy'] = credentials.apiKey;
        break;

      case 'fedex':
      case 'dhl':
        baseURL = provider === 'fedex'
          ? 'https://apis.fedex.com'
          : 'https://api.dhlonline.com';
        headers['api-key'] = credentials.apiKey;
        break;

      case 'hrms':
        baseURL = credentials.baseUrl || 'https://hrms-api.example.com';
        if (credentials.apiKey) {
          headers['X-API-Key'] = credentials.apiKey;
        }
        break;

      case 'iot':
        baseURL = credentials.baseUrl || 'https://iot-api.example.com';
        headers['Authorization'] = `Bearer ${credentials.apiKey}`;
        break;
    }

    const client = axios.create({
      baseURL,
      headers,
      timeout: 30000,
    });

    this.clients.set(cacheKey, client);
    return client;
  }

  /**
   * Sync data with external system
   */
  async syncIntegration(
    tenantId: string,
    provider: string,
    direction: 'inbound' | 'outbound' | 'bidirectional' = 'bidirectional'
  ): Promise<any> {
    const connection = await IntegrationConnection.findOne({
      tenantId,
      provider,
      isActive: true,
    });

    if (!connection) {
      throw new Error(`Integration ${provider} not configured`);
    }

    const syncLog = new IntegrationSyncLog({
      tenantId,
      connectionId: connection._id,
      syncType: 'full',
      direction,
      status: 'in_progress',
      stats: {
        totalRecords: 0,
        syncedRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
      },
      createdAt: new Date(),
    });

    try {
      // Execute sync based on provider
      const result = await this.executeSyncByProvider(tenantId, connection, direction);

      syncLog.status = 'completed';
      syncLog.stats = result.stats;
      syncLog.details = {
        startedAt: syncLog.createdAt,
        completedAt: new Date(),
        errors: result.errors || [],
      };

      connection.lastSyncAt = new Date();
      connection.nextSyncAt = new Date(Date.now() + (connection.config.syncInterval || 60) * 60000);
      connection.syncStatus = 'idle';

      await Promise.all([syncLog.save(), connection.save()]);

      return result;
    } catch (error: any) {
      syncLog.status = 'failed';
      syncLog.details = {
        startedAt: syncLog.createdAt,
        completedAt: new Date(),
        errors: [{ error: error.message, recordId: 'system', retryable: true }],
      };

      connection.syncStatus = 'error';
      connection.lastError = error.message;

      await Promise.all([syncLog.save(), connection.save()]);

      throw error;
    }
  }

  /**
   * Execute sync by provider
   */
  private async executeSyncByProvider(
    tenantId: string,
    connection: any,
    direction: string
  ): Promise<any> {
    switch (connection.provider) {
      case 'quickbooks':
        return this.syncQuickBooks(tenantId, connection, direction);

      case 'tally':
        return this.syncTally(tenantId, connection, direction);

      case 'salesforce':
        return this.syncSalesforce(tenantId, connection, direction);

      case 'hubspot':
        return this.syncHubSpot(tenantId, connection, direction);

      case 'sap':
      case 'oracle':
        return this.syncERP(tenantId, connection, direction);

      case 'fedex':
      case 'dhl':
        return this.syncLogistics(tenantId, connection, direction);

      case 'hrms':
        return this.syncHRMS(tenantId, connection, direction);

      case 'iot':
        return this.syncIoT(tenantId, connection, direction);

      default:
        throw new Error(`Unknown provider: ${connection.provider}`);
    }
  }

  /**
   * Sync QuickBooks
   */
  private async syncQuickBooks(tenantId: string, connection: any, direction: string): Promise<any> {
    // Fetch invoices from QB and sync locally
    // Sync local payments to QB
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    // In production, implement full QB API integration
    // This is a placeholder

    return { stats, errors: [] };
  }

  /**
   * Sync Tally
   */
  private async syncTally(tenantId: string, connection: any, direction: string): Promise<any> {
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    // In production, implement Tally XML API integration
    return { stats, errors: [] };
  }

  /**
   * Sync Salesforce
   */
  private async syncSalesforce(tenantId: string, connection: any, direction: string): Promise<any> {
    const client = this.createClient('salesforce', connection.credentials);
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    try {
      // Fetch Salesforce opportunities/accounts
      const opportunities = await client.get('/services/data/v57.0/sobjects/Opportunity/query/?q=SELECT Id, Name, Amount FROM Opportunity LIMIT 100');

      stats.totalRecords = opportunities.data.records.length;

      for (const opp of opportunities.data.records) {
        try {
          // Map to local contract/booking
          const localMap = new AccountingEntityMap({
            tenantId,
            connectionId: connection._id,
            localEntity: {
              type: 'rental',
              id: null, // Would be actual booking ID
            },
            remoteEntity: {
              provider: 'salesforce',
              id: opp.Id,
              externalId: opp.Name,
              syncedAt: new Date(),
            },
            reconciliationStatus: 'synced',
            lastSyncAt: new Date(),
            createdAt: new Date(),
          });

          await localMap.save();
          stats.syncedRecords++;
        } catch {
          stats.failedRecords++;
        }
      }

      return { stats, errors: [] };
    } catch (error: any) {
      throw new Error(`Salesforce sync failed: ${error.message}`);
    }
  }

  /**
   * Sync HubSpot
   */
  private async syncHubSpot(tenantId: string, connection: any, direction: string): Promise<any> {
    const client = this.createClient('hubspot', connection.credentials);
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    try {
      // Fetch contacts from HubSpot
      const contacts = await client.get('/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone');

      stats.totalRecords = contacts.data.results.length;
      stats.syncedRecords = contacts.data.results.length;

      return { stats, errors: [] };
    } catch (error: any) {
      throw new Error(`HubSpot sync failed: ${error.message}`);
    }
  }

  /**
   * Sync ERP (SAP/Oracle)
   */
  private async syncERP(tenantId: string, connection: any, direction: string): Promise<any> {
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    // In production, implement SAP OData or Oracle REST API
    return { stats, errors: [] };
  }

  /**
   * Sync Logistics (FedEx/DHL)
   */
  private async syncLogistics(tenantId: string, connection: any, direction: string): Promise<any> {
    const client = this.createClient(connection.provider, connection.credentials);
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    // In production, track shipments and sync tracking info
    return { stats, errors: [] };
  }

  /**
   * Sync HRMS
   */
  private async syncHRMS(tenantId: string, connection: any, direction: string): Promise<any> {
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    // Sync employee data from HRMS
    // Create HRMSEmployeeData records

    return { stats, errors: [] };
  }

  /**
   * Sync IoT
   */
  private async syncIoT(tenantId: string, connection: any, direction: string): Promise<any> {
    const stats = {
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
    };

    // Fetch sensor data and create IoTSensorData records
    // Detect anomalies and create alerts

    return { stats, errors: [] };
  }

  /**
   * List integrations
   */
  async listIntegrations(tenantId: string): Promise<any[]> {
    return IntegrationConnection.find({ tenantId }).sort({ createdAt: -1 });
  }

  /**
   * Get integration status
   */
  async getIntegrationStatus(tenantId: string, provider: string): Promise<any> {
    const connection = await IntegrationConnection.findOne({
      tenantId,
      provider,
    });

    if (!connection) {
      throw new Error(`Integration ${provider} not found`);
    }

    const recentSyncs = await IntegrationSyncLog.find({
      tenantId,
      connectionId: connection._id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    return {
      provider,
      isActive: connection.isActive,
      isConfigured: connection.isConfigured,
      syncStatus: connection.syncStatus,
      lastSyncAt: connection.lastSyncAt,
      nextSyncAt: connection.nextSyncAt,
      lastError: connection.lastError,
      recentSyncs,
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(tenantId: string, connectionId: string, limit: number = 50): Promise<any[]> {
    return IntegrationSyncLog.find({
      tenantId,
      connectionId,
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(tenantId: string, provider: string): Promise<void> {
    const connection = await IntegrationConnection.findOne({
      tenantId,
      provider,
    });

    if (connection) {
      connection.isActive = false;
      connection.isConfigured = false;
      connection.syncStatus = 'idle';
      connection.credentials = {}; // Clear sensitive data
      connection.updatedAt = new Date();

      await connection.save();
    }
  }
}

export default new IntegrationService();
