import { Customer, Campaign, CampaignRecipient, ICampaign } from '../models/index';
import { getSegmentFilter } from './segmentService';
import { normalizeIndianPhone } from '../whatsapp/phone';
import { whatsappProvider } from '../whatsapp/index';

async function resolveRecipients(tenantId: string, targetType: 'segment' | 'tag', targetKey: string) {
  const base = { tenantId, isDeleted: { $ne: true } };
  const filter = targetType === 'segment'
    ? await getSegmentFilter(tenantId, targetKey)
    : { tags: targetKey };
  return Customer.find({ ...base, ...filter });
}

function offerPhrase(campaign: Pick<ICampaign, 'offerType' | 'offerValue'>): string {
  switch (campaign.offerType) {
    case 'discount_percent': return `${campaign.offerValue ?? 0}% off`;
    case 'discount_flat': return `₹${campaign.offerValue ?? 0} off`;
    case 'reward_bonus_points': return `${campaign.offerValue ?? 0} bonus reward points`;
    default: return '';
  }
}

// {{name}} and {{offer}} are the only supported placeholders — kept
// deliberately small so every campaign's rendered message is predictable.
export function renderCampaignMessage(template: string, customer: any, campaign: Pick<ICampaign, 'offerType' | 'offerValue'>): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, customer.name || 'Customer')
    .replace(/\{\{\s*offer\s*\}\}/gi, offerPhrase(campaign));
}

export interface CampaignPreview {
  totalTargeted: number;
  eligible: number;
  excludedOptedOut: number;
  excludedInvalidPhone: number;
}

// Read-only — computes the same eligibility split sendCampaign will use,
// without writing anything or contacting the provider, so a user can see
// who a campaign will actually reach before committing to send it.
export async function previewCampaign(tenantId: string, targetType: 'segment' | 'tag', targetKey: string): Promise<CampaignPreview> {
  const customers = await resolveRecipients(tenantId, targetType, targetKey);
  let excludedOptedOut = 0, excludedInvalidPhone = 0, eligible = 0;
  for (const c of customers) {
    if (c.status === 'do_not_contact' || !c.consent?.promotional) { excludedOptedOut++; continue; }
    if (!normalizeIndianPhone(c.primaryMobile)) { excludedInvalidPhone++; continue; }
    eligible++;
  }
  return { totalTargeted: customers.length, eligible, excludedOptedOut, excludedInvalidPhone };
}

export async function sendCampaign(campaignId: string, tenantId: string) {
  // Atomic draft -> sending flip prevents two concurrent send requests
  // (e.g. a double-click) from both processing the same campaign.
  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, tenantId, status: 'draft' },
    { $set: { status: 'sending' } },
    { new: true },
  );
  if (!campaign) {
    const existing = await Campaign.findOne({ _id: campaignId, tenantId });
    if (!existing) throw new Error('Campaign not found');
    throw new Error(`Campaign is already ${existing.status}`);
  }

  try {
    const customers = await resolveRecipients(tenantId, campaign.targetType, campaign.targetKey);
    let sent = 0, failed = 0, excludedOptedOut = 0, excludedInvalidPhone = 0;

    for (const customer of customers) {
      if (customer.status === 'do_not_contact' || !customer.consent?.promotional) {
        excludedOptedOut++;
        await CampaignRecipient.create({
          tenantId, campaignId: campaign._id, customerId: customer._id,
          phone: customer.primaryMobile, status: 'skipped_opted_out',
        }).catch(() => {});
        continue;
      }
      const phone = normalizeIndianPhone(customer.primaryMobile);
      if (!phone) {
        excludedInvalidPhone++;
        await CampaignRecipient.create({
          tenantId, campaignId: campaign._id, customerId: customer._id,
          phone: customer.primaryMobile, status: 'skipped_invalid_phone',
        }).catch(() => {});
        continue;
      }
      const text = renderCampaignMessage(campaign.messageTemplate, customer, campaign);
      const result = await whatsappProvider.sendText(tenantId, phone, text);
      if (result.status === 'sent') sent++; else failed++;
      await CampaignRecipient.create({
        tenantId, campaignId: campaign._id, customerId: customer._id, phone,
        status: result.status === 'sent' ? 'sent' : 'failed',
        providerMessageId: result.providerMessageId || undefined,
        error: result.error || undefined,
        sentAt: result.status === 'sent' ? new Date() : undefined,
      }).catch(() => {});
    }

    campaign.status = 'completed';
    campaign.sentAt = new Date();
    campaign.stats = { totalTargeted: customers.length, sent, failed, excludedOptedOut, excludedInvalidPhone };
    await campaign.save();
    return campaign;
  } catch (error) {
    // Never leave a campaign permanently looking active after a provider or
    // database failure. `failed` is intentionally terminal: blindly retrying
    // could duplicate messages already delivered before the failure.
    await Campaign.updateOne(
      { _id: campaign._id, tenantId, status: 'sending' },
      { $set: { status: 'failed', updatedAt: new Date() } },
    ).catch(() => {});
    throw error;
  }
}
