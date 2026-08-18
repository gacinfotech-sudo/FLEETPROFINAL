/**
 * PHASE 14: Multi-Tenant Admin UI
 * Comprehensive tenant management dashboard with isolation verification
 */

import React, { useState, useEffect } from 'react';
import {
  Container, Card, Form, Button, Table, Badge, Modal, Alert, Spinner, Tabs, Tab,
  Row, Col, ListGroup, ProgressBar, Tooltip, OverlayTrigger, Dropdown
} from 'react-bootstrap';
import axios from 'axios';
import { MdAdd, MdEdit, MdDelete, MdCheckCircle, MdError, MdWarning, MdInfo } from 'react-icons/md';

interface Tenant {
  _id: string;
  name: string;
  businessName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise' | 'custom';
  limits: {
    vehicles: number;
    drivers: number;
    managers: number;
  };
  createdAt: string;
  stats?: any;
  quotaUsage?: Record<string, any>;
  complianceStatus?: boolean;
}

interface TenantStats {
  activeVehicles: number;
  activeDrivers: number;
  activeManagers: number;
  totalBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  fleetUtilization: number;
  lastActivityAt: string;
  healthScore: number;
}

interface IsolationResult {
  verified: boolean;
  violations: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    affectedRecords?: number;
  }>;
  report: {
    checksRun: number;
    checksPassed: number;
    checksFailed: number;
    completedAt: string;
  };
}

interface AuditLog {
  id: string;
  timestamp: string;
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  status: 'success' | 'failed' | 'pending';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export function TenantAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showIsolationModal, setShowIsolationModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    address: '',
    subscriptionPlan: 'pro',
    timezone: 'Asia/Kolkata',
  });

  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any>(null);
  const [isolationResult, setIsolationResult] = useState<IsolationResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    page: 1,
  });

  // Load tenants
  useEffect(() => {
    fetchTenants();
  }, [page, statusFilter, searchTerm]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/tenants', {
        params: {
          page,
          limit: 20,
          status: statusFilter,
          search: searchTerm,
        },
      });

      if (response.data.success) {
        setTenants(response.data.data);
        setPagination(response.data.pagination);
        setError(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantDetails = async (tenantId: string) => {
    try {
      const response = await axios.get(`/api/admin/tenants/${tenantId}`);
      if (response.data.success) {
        setTenantDetails(response.data.data);
        setSelectedTenant(response.data.data.tenant);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load tenant details');
    }
  };

  const fetchIsolationStatus = async (tenantId: string) => {
    try {
      const response = await axios.get(`/api/admin/tenants/${tenantId}/isolation`);
      if (response.data.success) {
        setIsolationResult(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify isolation');
    }
  };

  const fetchAuditLogs = async (tenantId?: string) => {
    try {
      const response = await axios.get('/api/admin/audit-logs', {
        params: { tenantId, limit: 50 },
      });
      if (response.data.success) {
        setAuditLogs(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load audit logs');
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/admin/tenants', formData);
      if (response.data.success) {
        setSuccess('Tenant created successfully');
        setShowCreateModal(false);
        setFormData({
          name: '',
          businessName: '',
          email: '',
          phone: '',
          address: '',
          subscriptionPlan: 'pro',
          timezone: 'Asia/Kolkata',
        });
        fetchTenants();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create tenant');
    }
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    try {
      const response = await axios.put(`/api/admin/tenants/${selectedTenant._id}`, formData);
      if (response.data.success) {
        setSuccess('Tenant updated successfully');
        setShowEditModal(false);
        fetchTenants();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update tenant');
    }
  };

  const handleToggleTenantStatus = async (tenant: Tenant) => {
    try {
      const response = await axios.patch(`/api/admin/tenants/${tenant._id}/status`, {
        isActive: !tenant.isActive,
      });
      if (response.data.success) {
        setSuccess(`Tenant ${tenant.isActive ? 'deactivated' : 'activated'} successfully`);
        fetchTenants();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update tenant status');
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(`/api/admin/tenants/${tenantId}`);
      if (response.data.success) {
        setSuccess('Tenant deleted successfully');
        fetchTenants();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete tenant');
    }
  };

  const openDetailsModal = (tenant: Tenant) => {
    fetchTenantDetails(tenant._id);
    setShowDetailsModal(true);
  };

  const openIsolationModal = (tenant: Tenant) => {
    fetchIsolationStatus(tenant._id);
    setSelectedTenant(tenant);
    setShowIsolationModal(true);
  };

  const openAuditModal = (tenant?: Tenant) => {
    fetchAuditLogs(tenant?._id);
    setSelectedTenant(tenant || null);
    setShowAuditModal(true);
  };

  const openEditModal = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      businessName: tenant.businessName,
      email: tenant.email,
      phone: tenant.phone || '',
      address: '',
      subscriptionPlan: tenant.subscriptionPlan,
      timezone: 'Asia/Kolkata',
    });
    setShowEditModal(true);
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      critical: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'success',
      info: 'secondary',
    };
    return variants[severity] || 'secondary';
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Multi-Tenant Admin</h1>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <MdAdd className="me-2" />
          Create Tenant
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Control
                placeholder="Search by name, business name, or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </Col>
            <Col md={6}>
              <Form.Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tenants Table */}
      <Card>
        <Card.Header>
          <Card.Title className="mb-0">Tenants ({pagination.total})</Card.Title>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover striped>
            <thead>
              <tr>
                <th>Name</th>
                <th>Business</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Health</th>
                <th>Usage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant._id}>
                  <td>
                    <strong>{tenant.name}</strong>
                  </td>
                  <td>{tenant.businessName}</td>
                  <td>{tenant.email}</td>
                  <td>
                    <Badge bg="info">{tenant.subscriptionPlan}</Badge>
                  </td>
                  <td>
                    <Badge bg={tenant.isActive ? 'success' : 'danger'}>
                      {tenant.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    {tenant.stats && (
                      <div>
                        <div className="text-muted small">Score: {tenant.stats.healthScore}</div>
                        <ProgressBar
                          now={tenant.stats.healthScore}
                          variant={tenant.stats.healthScore > 70 ? 'success' : 'warning'}
                          className="small"
                          style={{ height: '20px' }}
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    {tenant.quotaUsage && (
                      <small>
                        <div>Vehicles: {tenant.quotaUsage.vehicles.percentage.toFixed(0)}%</div>
                        <div>Drivers: {tenant.quotaUsage.drivers.percentage.toFixed(0)}%</div>
                        <div>Managers: {tenant.quotaUsage.managers.percentage.toFixed(0)}%</div>
                      </small>
                    )}
                  </td>
                  <td>
                    <Dropdown>
                      <Dropdown.Toggle variant="sm" id={`dropdown-${tenant._id}`} className="me-2">
                        Actions
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => openDetailsModal(tenant)}>
                          View Details
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => openEditModal(tenant)}>
                          <MdEdit className="me-2" />
                          Edit
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => openIsolationModal(tenant)}>
                          🔒 Verify Isolation
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => openAuditModal(tenant)}>
                          📋 Audit Logs
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={() => handleToggleTenantStatus(tenant)}>
                          {tenant.isActive ? '⛔ Deactivate' : '✅ Activate'}
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => handleDeleteTenant(tenant._id)} className="text-danger">
                          <MdDelete className="me-2" />
                          Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
        <Card.Footer>
          <div className="d-flex justify-content-between align-items-center">
            <small>
              Showing page {pagination.page} of {pagination.pages}
            </small>
            <div>
              <Button
                variant="sm"
                disabled={pagination.page === 1}
                onClick={() => setPage(pagination.page - 1)}
                className="me-2"
              >
                Previous
              </Button>
              <Button
                variant="sm"
                disabled={pagination.page === pagination.pages}
                onClick={() => setPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card.Footer>
      </Card>

      {/* Create Tenant Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Tenant</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateTenant}>
            <Form.Group className="mb-3">
              <Form.Label>Tenant Name *</Form.Label>
              <Form.Control
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Acme Corp"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Business Name *</Form.Label>
              <Form.Control
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="e.g., Acme Corporation"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@acme.com"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1-555-0123"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Subscription Plan *</Form.Label>
              <Form.Select
                required
                value={formData.subscriptionPlan}
                onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
              >
                <option value="starter">Starter (5 vehicles, 10 drivers, 2 managers)</option>
                <option value="pro">Pro (20 vehicles, 50 drivers, 5 managers)</option>
                <option value="enterprise">Enterprise (100 vehicles, 500 drivers, 20 managers)</option>
                <option value="custom">Custom</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Timezone</Form.Label>
              <Form.Control
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="Asia/Kolkata"
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Create Tenant
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Tenant</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleUpdateTenant}>
            <Form.Group className="mb-3">
              <Form.Label>Tenant Name *</Form.Label>
              <Form.Control
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Business Name *</Form.Label>
              <Form.Control
                required
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Update Tenant
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Details Modal */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Tenant Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tenantDetails && (
            <Tabs defaultActiveKey="overview" className="mb-3">
              <Tab eventKey="overview" title="Overview">
                <div className="mt-3">
                  <h6>Tenant Information</h6>
                  <ListGroup>
                    <ListGroup.Item>
                      <strong>Name:</strong> {tenantDetails.tenant.name}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Business:</strong> {tenantDetails.tenant.businessName}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Email:</strong> {tenantDetails.tenant.email}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Plan:</strong> {tenantDetails.tenant.subscriptionPlan}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Status:</strong> {tenantDetails.tenant.isActive ? 'Active' : 'Inactive'}
                    </ListGroup.Item>
                  </ListGroup>

                  <h6 className="mt-4">Statistics</h6>
                  <ListGroup>
                    <ListGroup.Item>
                      <strong>Total Bookings:</strong> {tenantDetails.stats?.totalBookings}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Total Revenue:</strong> ₹{tenantDetails.stats?.totalRevenue.toLocaleString()}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Active Vehicles:</strong> {tenantDetails.stats?.activeVehicles}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Health Score:</strong> {tenantDetails.stats?.healthScore}%
                    </ListGroup.Item>
                  </ListGroup>
                </div>
              </Tab>
              <Tab eventKey="quotas" title="Quotas">
                <div className="mt-3">
                  {tenantDetails.quotaUsage &&
                    Object.entries(tenantDetails.quotaUsage).map(([key, usage]: any) => (
                      <div key={key} className="mb-4">
                        <strong>{key}</strong>
                        <div className="text-muted small mb-2">
                          {usage.used} / {usage.limit}
                        </div>
                        <ProgressBar
                          now={usage.percentage}
                          variant={usage.percentage > 80 ? 'danger' : 'success'}
                          label={`${usage.percentage.toFixed(1)}%`}
                        />
                      </div>
                    ))}
                </div>
              </Tab>
            </Tabs>
          )}
        </Modal.Body>
      </Modal>

      {/* Isolation Modal */}
      <Modal show={showIsolationModal} onHide={() => setShowIsolationModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Tenant Isolation Verification</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isolationResult && (
            <div>
              <div className="mb-4">
                <h6>Verification Status</h6>
                <div className="d-flex align-items-center gap-2 mb-2">
                  {isolationResult.verified ? (
                    <MdCheckCircle className="text-success" size={24} />
                  ) : (
                    <MdError className="text-danger" size={24} />
                  )}
                  <strong>{isolationResult.verified ? 'Compliant' : 'Violations Found'}</strong>
                </div>
              </div>

              <div className="mb-4">
                <h6>Check Summary</h6>
                <ListGroup>
                  <ListGroup.Item>
                    <strong>Checks Run:</strong> {isolationResult.report.checksRun}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Passed:</strong> {isolationResult.report.checksPassed}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Failed:</strong> {isolationResult.report.checksFailed}
                  </ListGroup.Item>
                </ListGroup>
              </div>

              {isolationResult.violations.length > 0 && (
                <div>
                  <h6>Violations</h6>
                  {isolationResult.violations.map((violation, idx) => (
                    <Alert key={idx} variant={getSeverityBadge(violation.severity)}>
                      <strong>{violation.type}</strong>
                      <div className="small">{violation.description}</div>
                      {violation.affectedRecords && (
                        <div className="text-muted small">Affected: {violation.affectedRecords} records</div>
                      )}
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Audit Logs Modal */}
      <Modal show={showAuditModal} onHide={() => setShowAuditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Audit Logs {selectedTenant && `- ${selectedTenant.name}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table responsive size="sm">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Status</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.action}</td>
                  <td>{log.entityType}</td>
                  <td>
                    <Badge bg={log.status === 'success' ? 'success' : 'danger'}>
                      {log.status}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg={getSeverityBadge(log.severity)}>
                      {log.severity}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
    </Container>
  );
}

export default TenantAdminPage;
