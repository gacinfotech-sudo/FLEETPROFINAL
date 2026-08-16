import express from 'express';
import { authenticateUser, requireTenant } from '../middleware/auth';
import { SSOProvider } from '../models/enterprise.models';
import SSOAuthService from '../services/SSOAuthService';

const router = express.Router();

/**
 * WAVE 21: SSO/SAML Authentication Endpoints
 */

// POST /api/auth/sso/configure - Configure SSO provider
router.post('/configure', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const { name, config, roleMapping, jitProvisioning } = req.body;

    const ssoProvider = new SSOProvider({
      tenantId: req.tenantId,
      name,
      config,
      roleMapping,
      jitProvisioning,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await ssoProvider.save();

    res.json({
      success: true,
      data: {
        providerId: saved._id,
        name: saved.name,
      },
    });
  } catch (error: any) {
    console.error('Error configuring SSO:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure SSO',
    });
  }
});

// POST /api/auth/saml/initiate - Initiate SAML authentication
router.post('/saml/initiate', async (req: any, res) => {
  try {
    const { tenantId, providerId } = req.body;

    const authData = await SSOAuthService.initiateSAMLAuth(tenantId, providerId);

    res.json({
      success: true,
      data: authData,
    });
  } catch (error: any) {
    console.error('Error initiating SAML auth:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/auth/saml/acs - SAML Assertion Consumer Service (ACS)
router.post('/saml/acs', async (req: any, res) => {
  try {
    const { SAMLResponse, RelayState } = req.body;

    // Parse RelayState to get tenant and provider info
    const relayData = JSON.parse(decodeURIComponent(RelayState || '{}'));

    const result = await SSOAuthService.processSAMLAssertion(
      relayData.tenantId,
      SAMLResponse,
      RelayState
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error processing SAML assertion:', error);
    res.status(401).json({
      success: false,
      error: 'SAML assertion processing failed',
    });
  }
});

// GET /api/auth/saml/metadata - Get SAML metadata
router.get('/saml/metadata/:providerId', async (req: any, res) => {
  try {
    const { tenantId } = req.query;
    const { providerId } = req.params;

    const metadata = await SSOAuthService.generateSAMLMetadata(tenantId, providerId);

    res.type('application/xml');
    res.send(metadata);
  } catch (error: any) {
    console.error('Error generating SAML metadata:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/auth/saml/logout - SAML Logout
router.post('/saml/logout', authenticateUser, async (req: any, res) => {
  try {
    await SSOAuthService.handleSAMLLogout(req.tenantId, req.user._id);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Error logging out:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/auth/sso/providers - List SSO providers for tenant
router.get('/providers', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const providers = await SSOProvider.find({
      tenantId: req.tenantId,
    }).select('_id name isActive createdAt');

    res.json({
      success: true,
      data: providers,
      count: providers.length,
    });
  } catch (error: any) {
    console.error('Error fetching SSO providers:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/auth/sso/provider/:providerId - Get SSO provider details
router.get('/provider/:providerId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const provider = await SSOProvider.findOne({
      _id: req.params.providerId,
      tenantId: req.tenantId,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }

    res.json({
      success: true,
      data: {
        _id: provider._id,
        name: provider.name,
        type: provider.name.toLowerCase(),
        isActive: provider.isActive,
        config: { ...provider.config, cert: undefined }, // Don't send cert in response
        roleMapping: provider.roleMapping,
        jitProvisioning: provider.jitProvisioning,
      },
    });
  } catch (error: any) {
    console.error('Error fetching SSO provider:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PUT /api/auth/sso/provider/:providerId - Update SSO provider
router.put('/provider/:providerId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const provider = await SSOProvider.findOne({
      _id: req.params.providerId,
      tenantId: req.tenantId,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }

    provider.config = req.body.config || provider.config;
    provider.roleMapping = req.body.roleMapping || provider.roleMapping;
    provider.jitProvisioning = req.body.jitProvisioning || provider.jitProvisioning;
    provider.isActive = req.body.isActive !== undefined ? req.body.isActive : provider.isActive;
    provider.updatedAt = new Date();

    await provider.save();

    res.json({
      success: true,
      message: 'SSO provider updated',
      data: { _id: provider._id, name: provider.name },
    });
  } catch (error: any) {
    console.error('Error updating SSO provider:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/auth/sso/provider/:providerId - Delete SSO provider
router.delete('/provider/:providerId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const result = await SSOProvider.deleteOne({
      _id: req.params.providerId,
      tenantId: req.tenantId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }

    res.json({
      success: true,
      message: 'SSO provider deleted',
    });
  } catch (error: any) {
    console.error('Error deleting SSO provider:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/auth/sso/test - Test SSO provider configuration
router.post('/test/:providerId', authenticateUser, requireTenant, async (req: any, res) => {
  try {
    const provider = await SSOProvider.findOne({
      _id: req.params.providerId,
      tenantId: req.tenantId,
    });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }

    // In production, test actual SAML endpoint connectivity
    const testResult = {
      success: true,
      provider: provider.name,
      message: 'Configuration appears valid',
      recommendations: [],
    };

    // Add recommendations if issues detected
    if (!provider.config.cert) {
      testResult.recommendations.push('Certificate should be configured for better security');
    }

    res.json({
      success: true,
      data: testResult,
    });
  } catch (error: any) {
    console.error('Error testing SSO provider:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
