// Email notification service for bug reports, support tickets, and platform alerts

interface NotificationPayload {
  type: 'bug_report' | 'support_ticket' | 'bug_resolved' | 'ticket_replied' | 'platform_alert';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  data: Record<string, any>;
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    // In production, this would call an email service (SendGrid, AWS SES, etc)
    // For now, we'll log and queue for future implementation

    const templates = {
      bug_report: buildBugReportEmail,
      support_ticket: buildSupportTicketEmail,
      bug_resolved: buildBugResolvedEmail,
      ticket_replied: buildTicketRepliedEmail,
      platform_alert: buildPlatformAlertEmail,
    };

    const emailTemplate = templates[payload.type];
    if (!emailTemplate) {
      console.error(`Unknown notification type: ${payload.type}`);
      return false;
    }

    const htmlContent = emailTemplate(payload.data);

    // Queue for email service (implement your own email sending logic)
    await queueEmailForSending({
      to: payload.recipientEmail,
      subject: payload.subject,
      html: htmlContent,
      text: generatePlainText(htmlContent),
    });

    console.log(`✉️ Notification queued: ${payload.type} → ${payload.recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Notification service error:', error);
    return false;
  }
}

function buildBugReportEmail(data: Record<string, any>): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d32f2f;">🐛 New Bug Report Submitted</h2>

          <p>Thank you for reporting this issue. Our team has received your bug report and will investigate it shortly.</p>

          <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0;">
            <p><strong>Title:</strong> ${data.title}</p>
            <p><strong>Severity:</strong> ${data.severity}</p>
            <p><strong>Module:</strong> ${data.module}</p>
            <p><strong>Description:</strong> ${data.description}</p>
          </div>

          <p style="color: #666;">
            We'll keep you updated on the progress. You can track this report in your FleetPro dashboard under
            <strong>Settings → Bug Reports</strong>.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
            <p>Report ID: ${data._id}</p>
            <p>Submitted on: ${new Date(data.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildSupportTicketEmail(data: Record<string, any>): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1976d2;">💬 Support Ticket Created</h2>

          <p>We've received your support request and our team will respond as soon as possible.</p>

          <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #1976d2; margin: 20px 0;">
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Priority:</strong> ${data.priority}</p>
            <p><strong>Category:</strong> ${data.category}</p>
            <p><strong>Message:</strong> ${data.message}</p>
          </div>

          <p style="color: #666;">
            Expected response time: <strong>${getExpectedResponseTime(data.priority)}</strong>
          </p>

          <p style="color: #666;">
            You can track this ticket in your FleetPro dashboard under
            <strong>Settings → Support Tickets</strong>.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
            <p>Ticket ID: ${data._id}</p>
            <p>Created on: ${new Date(data.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildBugResolvedEmail(data: Record<string, any>): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #388e3c;">✅ Your Bug Report Has Been Resolved</h2>

          <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #388e3c; margin: 20px 0;">
            <p><strong>Bug:</strong> ${data.title}</p>
            <p><strong>Module:</strong> ${data.module}</p>
            <p><strong>Resolution:</strong> ${data.resolution || 'Fixed in latest update'}</p>
          </div>

          <p style="color: #666;">
            Thank you for reporting this issue. Our team has addressed the problem and the fix will be available
            in the next platform update.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
            <p>Report ID: ${data._id}</p>
            <p>Resolved on: ${new Date(data.resolvedAt).toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildTicketRepliedEmail(data: Record<string, any>): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1976d2;">💬 New Response to Your Support Ticket</h2>

          <p>Our support team has replied to your ticket:</p>

          <div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #1976d2; margin: 20px 0;">
            <p><strong>Ticket:</strong> ${data.subject}</p>
            <p style="margin-top: 10px;"><strong>Response:</strong></p>
            <p>${data.message}</p>
          </div>

          <p style="color: #666;">
            Please reply to this ticket in your FleetPro dashboard to continue the conversation.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
            <p>Ticket ID: ${data._id}</p>
            <p>Replied on: ${new Date(data.timestamp).toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildPlatformAlertEmail(data: Record<string, any>): string {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f57c00;">⚠️ Platform Alert</h2>

          <div style="background: #fff3e0; padding: 15px; border-left: 4px solid #f57c00; margin: 20px 0;">
            <p><strong>Alert:</strong> ${data.title}</p>
            <p>${data.message}</p>
            ${data.action ? `<p style="margin-top: 10px;"><strong>Required Action:</strong> ${data.action}</p>` : ''}
          </div>

          <p style="color: #666;">
            This alert requires your attention. Please log in to your FleetPro dashboard to take action.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999;">
            <p>Sent on: ${new Date(data.timestamp).toLocaleString()}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getExpectedResponseTime(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '1-2 hours';
    case 'high':
      return '4-8 hours';
    case 'normal':
      return '24 hours';
    case 'low':
      return '2-3 days';
    default:
      return '24 hours';
  }
}

function generatePlainText(html: string): string {
  // Strip HTML tags for plain text version
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

async function queueEmailForSending(emailData: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  // Implementation depends on your email service
  // Options: SendGrid, AWS SES, Mailgun, etc.

  // For now, log the email queue
  console.log(`📧 Email queued:`, {
    to: emailData.to,
    subject: emailData.subject,
    timestamp: new Date().toISOString(),
  });

  // TODO: Implement actual email sending
  // await emailService.send(emailData);
}

export async function notifyAdminBugReport(bugReport: Record<string, any>, adminEmail: string) {
  return sendNotification({
    type: 'bug_report',
    recipientEmail: adminEmail,
    recipientName: 'Admin',
    subject: `🐛 New Bug Report: ${bugReport.title}`,
    data: bugReport,
  });
}

export async function notifyTenantBugReport(bugReport: Record<string, any>, tenantEmail: string, tenantName: string) {
  return sendNotification({
    type: 'bug_report',
    recipientEmail: tenantEmail,
    recipientName: tenantName,
    subject: `🐛 Bug Report Received: ${bugReport.title}`,
    data: bugReport,
  });
}

export async function notifyAdminSupportTicket(ticket: Record<string, any>, adminEmail: string) {
  return sendNotification({
    type: 'support_ticket',
    recipientEmail: adminEmail,
    recipientName: 'Admin',
    subject: `💬 New Support Ticket: ${ticket.subject}`,
    data: ticket,
  });
}

export async function notifyTenantSupportTicket(ticket: Record<string, any>, tenantEmail: string, tenantName: string) {
  return sendNotification({
    type: 'support_ticket',
    recipientEmail: tenantEmail,
    recipientName: tenantName,
    subject: `💬 Support Ticket Created: ${ticket.subject}`,
    data: ticket,
  });
}

export async function notifyBugResolved(bugReport: Record<string, any>, tenantEmail: string) {
  return sendNotification({
    type: 'bug_resolved',
    recipientEmail: tenantEmail,
    recipientName: bugReport.reportedBy,
    subject: `✅ Bug Resolved: ${bugReport.title}`,
    data: bugReport,
  });
}

export async function notifyTicketReply(ticket: Record<string, any>, tenantEmail: string, message: string) {
  return sendNotification({
    type: 'ticket_replied',
    recipientEmail: tenantEmail,
    recipientName: ticket.tenantName,
    subject: `💬 New Response: ${ticket.subject}`,
    data: { ...ticket, message },
  });
}
