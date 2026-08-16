import { SSOProvider } from '../models/enterprise.models';
import { User } from '../models';
import crypto from 'crypto';

/**
 * WAVE 21: SSO/SAML Authentication Service
 * Handles SSO authentication, user provisioning, and session management
 */
export class SSOAuthService {
  /**
   * Initialize SAML authentication
   */
  async initiateSAMLAuth(tenantId: string, providerId: string) {
    const provider = await SSOProvider.findOne({
      _id: providerId,
      tenantId,
      isActive: true,
    });

    if (!provider) {
      throw new Error('SSO provider not found or inactive');
    }

    const authUrl = this.generateSAMLAuthUrl(provider);
    return {
      authUrl,
      providerId,
      requestId: crypto.randomUUID(),
    };
  }

  /**
   * Generate SAML Authentication URL
   */
  private generateSAMLAuthUrl(provider: any): string {
    const entryPoint = provider.config.entryPoint;
    const issuer = encodeURIComponent(provider.config.issuer);
    const relayState = encodeURIComponent(JSON.stringify({
      providerId: provider._id,
      tenantId: provider.tenantId,
    }));

    return `${entryPoint}?SAMLRequest=${issuer}&RelayState=${relayState}`;
  }

  /**
   * Process SAML Assertion (ACS Endpoint)
   */
  async processSAMLAssertion(tenantId: string, samlResponse: string, relayState: string) {
    // Parse SAML response (in production, use @node-saml/node-saml)
    const assertion = this.decodeSAMLResponse(samlResponse);

    const provider = await SSOProvider.findOne({
      _id: assertion.providerId,
      tenantId,
      isActive: true,
    });

    if (!provider) {
      throw new Error('SSO provider not found');
    }

    // Extract user data from SAML assertion
    const userData = {
      email: assertion.email,
      name: assertion.name,
      ssoId: assertion.nameID,
      attributes: assertion.attributes,
    };

    // Map SSO role to application role
    const appRole = this.mapSSORole(provider, assertion.attributes.role);

    // Find or create user (JIT provisioning)
    let user = await User.findOne({
      tenantId,
      $or: [
        { userId: userData.email },
        { 'ssoId': userData.ssoId },
      ],
    });

    if (!user && provider.jitProvisioning.enabled && provider.jitProvisioning.autoCreateUsers) {
      // Create new user via JIT
      user = new User({
        userId: userData.email,
        name: userData.name,
        tenantId,
        role: appRole,
        isActive: true,
        password: crypto.randomBytes(32).toString('hex'),
        permissions: this.getDefaultPermissions(appRole),
        createdAt: new Date(),
      });
      await user.save();
    } else if (user) {
      // Update existing user
      user.lastLogin = new Date();
      user.lastLoginIP = '';
      user.lastLoginUserAgent = '';
      await user.save();
    }

    if (!user) {
      throw new Error('User creation failed - JIT provisioning disabled');
    }

    // Create session
    const sessionId = crypto.randomUUID();
    user.sessionId = sessionId;
    await user.save();

    return {
      success: true,
      user: {
        userId: user.userId,
        name: user.name,
        role: user.role,
        email: userData.email,
      },
      sessionId,
      provider: provider.name,
    };
  }

  /**
   * Decode SAML Response
   */
  private decodeSAMLResponse(samlResponse: string): any {
    // In production, use proper SAML library validation
    const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');

    // Extract key fields (simplified)
    const emailMatch = decodedResponse.match(/<saml:Attribute Name="email".*?>(.*?)<\/saml:AttributeValue>/);
    const nameMatch = decodedResponse.match(/<saml:Attribute Name="name".*?>(.*?)<\/saml:AttributeValue>/);
    const nameIDMatch = decodedResponse.match(/<saml:NameID.*?>(.*?)<\/saml:NameID>/);
    const roleMatch = decodedResponse.match(/<saml:Attribute Name="role".*?>(.*?)<\/saml:AttributeValue>/);

    return {
      email: emailMatch ? emailMatch[1] : '',
      name: nameMatch ? nameMatch[1] : '',
      nameID: nameIDMatch ? nameIDMatch[1] : '',
      providerId: crypto.randomUUID(),
      attributes: {
        role: roleMatch ? roleMatch[1] : 'manager',
      },
    };
  }

  /**
   * Map SSO role to application role
   */
  private mapSSORole(provider: any, ssoRole: string): 'admin' | 'manager' | 'client' {
    const mapping = provider.roleMapping.find((m: any) => m.ssoRole === ssoRole);
    return mapping?.appRole || 'manager';
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissions(role: string): string[] {
    const permissionMap: Record<string, string[]> = {
      admin: ['all'],
      manager: ['bookings:read', 'bookings:create', 'drivers:read', 'reports:read'],
      client: ['bookings:read', 'profile:read'],
    };
    return permissionMap[role] || [];
  }

  /**
   * Generate SAML Metadata
   */
  async generateSAMLMetadata(tenantId: string, providerId: string): Promise<string> {
    const provider = await SSOProvider.findOne({
      _id: providerId,
      tenantId,
    });

    if (!provider) {
      throw new Error('Provider not found');
    }

    const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${provider.config.issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://api.example.com/auth/saml/logout"/>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://api.example.com/auth/saml/acs" isDefault="true" index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`;

    return metadata;
  }

  /**
   * Handle SAML Logout
   */
  async handleSAMLLogout(tenantId: string, userId: string): Promise<void> {
    const user = await User.findOne({
      _id: userId,
      tenantId,
    });

    if (user) {
      user.sessionId = undefined;
      user.activeSessions = [];
      await user.save();
    }
  }

  /**
   * Verify SSO Session
   */
  async verifySSOSession(tenantId: string, sessionId: string): Promise<boolean> {
    const user = await User.findOne({
      tenantId,
      sessionId,
      isActive: true,
    });

    return !!user;
  }
}

export default new SSOAuthService();
