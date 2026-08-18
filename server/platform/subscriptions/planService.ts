// STEP 15: Plan Management Service
// CRUD for plans

import { Plan } from '../models/Plan';

export class PlanService {
  async listPlans() {
    try {
      return await Plan.find({ isActive: true }).sort({ monthlyPrice: 1 });
    } catch (error) {
      console.error('List plans failed:', error);
      throw error;
    }
  }

  async getPlan(planId: string) {
    try {
      const plan = await Plan.findById(planId);
      if (!plan) throw new Error('Plan not found');
      return plan;
    } catch (error) {
      console.error('Get plan failed:', error);
      throw error;
    }
  }

  async createPlan(data: {
    name: string;
    description: string;
    monthlyPrice: number;
    tax?: number;
    features: any;
  }) {
    try {
      const plan = new Plan({
        ...data,
        isActive: true,
        createdAt: new Date()
      });

      await plan.save();
      return plan;
    } catch (error) {
      console.error('Create plan failed:', error);
      throw error;
    }
  }

  async updatePlan(planId: string, updates: any) {
    try {
      const updated = await Plan.findByIdAndUpdate(
        planId,
        { ...updates, modifiedAt: new Date() },
        { new: true }
      );

      if (!updated) throw new Error('Plan not found');
      return updated;
    } catch (error) {
      console.error('Update plan failed:', error);
      throw error;
    }
  }

  async deactivatePlan(planId: string) {
    try {
      return await Plan.findByIdAndUpdate(
        planId,
        { isActive: false, modifiedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Deactivate plan failed:', error);
      throw error;
    }
  }
}

export const planService = new PlanService();
