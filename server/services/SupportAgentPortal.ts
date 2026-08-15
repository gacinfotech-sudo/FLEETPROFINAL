/**
 * SUPPORT AGENT PORTAL SERVICE
 * Workbench, performance metrics, and agent collaboration features
 */

import mongoose from 'mongoose';

export interface ISupportAgent {
  tenantId: string | mongoose.Types.ObjectId;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  status: 'available' | 'busy' | 'offline' | 'on_break';
  ticketsHandled: number;
  averageResolutionTime: number; // seconds
  satisfactionScore: number; // 0-100
  availableFrom: string; // HH:MM
  availableUntil: string; // HH:MM
  skills: string[];
  internalNotes: string[];
  createdAt: Date;
}

const AgentSchema = new mongoose.Schema<ISupportAgent>({
  tenantId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  agentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  status: { type: String, enum: ['available', 'busy', 'offline', 'on_break'], default: 'offline' },
  ticketsHandled: { type: Number, default: 0 },
  averageResolutionTime: { type: Number, default: 0 },
  satisfactionScore: { type: Number, default: 0, min: 0, max: 100 },
  availableFrom: { type: String },
  availableUntil: { type: String },
  skills: { type: [String], default: [] },
  internalNotes: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

AgentSchema.index({ tenantId: 1, status: 1 });

export const SupportAgent = mongoose.model<ISupportAgent>('SupportAgent', AgentSchema);

export class SupportAgentPortal {
  /**
   * Register a support agent
   */
  static async registerAgent(input: Omit<ISupportAgent, 'createdAt' | 'agentId'>): Promise<ISupportAgent> {
    try {
      const agentId = `AGT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const agent = new SupportAgent({
        ...input,
        agentId,
      });
      await agent.save();
      return agent.toObject();
    } catch (error) {
      console.error('Error registering agent:', error);
      throw new Error('Failed to register agent');
    }
  }

  /**
   * Update agent status
   */
  static async updateAgentStatus(agentId: string, status: ISupportAgent['status']): Promise<ISupportAgent | null> {
    try {
      const updated = await SupportAgent.findOneAndUpdate(
        { agentId },
        { status },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error updating agent status:', error);
      throw new Error('Failed to update agent status');
    }
  }

  /**
   * Get all agents in a tenant
   */
  static async getAgents(tenantId: string, filters?: { status?: string; skills?: string[] }): Promise<ISupportAgent[]> {
    try {
      const query: any = { tenantId };
      if (filters?.status) query.status = filters.status;
      if (filters?.skills && filters.skills.length > 0) {
        query.skills = { $in: filters.skills };
      }

      const agents = await SupportAgent.find(query).sort({ status: 1, name: 1 });
      return agents.map(a => a.toObject());
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw new Error('Failed to fetch agents');
    }
  }

  /**
   * Get available agents
   */
  static async getAvailableAgents(tenantId: string, skills?: string[]): Promise<ISupportAgent[]> {
    try {
      const query: any = { tenantId, status: 'available' };
      if (skills && skills.length > 0) {
        query.skills = { $in: skills };
      }

      const agents = await SupportAgent.find(query).sort({ ticketsHandled: 1 });
      return agents.map(a => a.toObject());
    } catch (error) {
      console.error('Error fetching available agents:', error);
      throw new Error('Failed to fetch available agents');
    }
  }

  /**
   * Get agent performance metrics
   */
  static async getAgentMetrics(agentId: string): Promise<{
    ticketsHandled: number;
    averageResolutionTime: number;
    satisfactionScore: number;
    efficiency: number;
  } | null> {
    try {
      const agent = await SupportAgent.findOne({ agentId });
      if (!agent) return null;

      const efficiency = Math.min(100, (agent.satisfactionScore + (agent.ticketsHandled * 10 / 100)));

      return {
        ticketsHandled: agent.ticketsHandled,
        averageResolutionTime: agent.averageResolutionTime,
        satisfactionScore: agent.satisfactionScore,
        efficiency: Math.round(efficiency),
      };
    } catch (error) {
      console.error('Error fetching agent metrics:', error);
      throw new Error('Failed to fetch agent metrics');
    }
  }

  /**
   * Update agent skills
   */
  static async updateAgentSkills(agentId: string, skills: string[]): Promise<ISupportAgent | null> {
    try {
      const updated = await SupportAgent.findOneAndUpdate(
        { agentId },
        { skills },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error updating agent skills:', error);
      throw new Error('Failed to update agent skills');
    }
  }

  /**
   * Add internal note to agent
   */
  static async addInternalNote(agentId: string, note: string): Promise<ISupportAgent | null> {
    try {
      const updated = await SupportAgent.findOneAndUpdate(
        { agentId },
        { $push: { internalNotes: note } },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error adding internal note:', error);
      throw new Error('Failed to add internal note');
    }
  }

  /**
   * Update agent performance metrics after ticket resolution
   */
  static async updateAgentMetrics(agentId: string, resolutionTimeSeconds: number, customerSatisfaction: number): Promise<ISupportAgent | null> {
    try {
      const agent = await SupportAgent.findOne({ agentId });
      if (!agent) return null;

      const newTicketCount = agent.ticketsHandled + 1;
      const newAvgTime = (agent.averageResolutionTime * agent.ticketsHandled + resolutionTimeSeconds) / newTicketCount;
      const newSatisfaction = (agent.satisfactionScore * agent.ticketsHandled + customerSatisfaction) / newTicketCount;

      const updated = await SupportAgent.findOneAndUpdate(
        { agentId },
        {
          ticketsHandled: newTicketCount,
          averageResolutionTime: Math.round(newAvgTime),
          satisfactionScore: Math.round(newSatisfaction),
        },
        { new: true }
      );
      return updated ? updated.toObject() : null;
    } catch (error) {
      console.error('Error updating agent metrics:', error);
      throw new Error('Failed to update agent metrics');
    }
  }

  /**
   * Get agent workbench (assigned tickets and chats)
   */
  static async getAgentWorkbench(tenantId: string, agentId: string): Promise<{
    openTickets: any[];
    activeChats: any[];
    pendingReview: any[];
  }> {
    try {
      // This would integrate with ticket and chat services
      // For now, return structure
      return {
        openTickets: [],
        activeChats: [],
        pendingReview: [],
      };
    } catch (error) {
      console.error('Error fetching workbench:', error);
      throw new Error('Failed to fetch workbench');
    }
  }
}
