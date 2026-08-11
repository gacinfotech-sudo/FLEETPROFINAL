// Admin Reports Dashboard
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Report {
  type: string;
  title: string;
  description: string;
}

interface ReportSchedule {
  _id: string;
  tenantId: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  deliveryChannels: string[];
  recipients: string[];
  webhookUrl?: string;
  enabled: boolean;
  lastGenerated?: Date;
  nextScheduled?: Date;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

export default function AdminReports() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Report generation state
  const [reportType, setReportType] = useState('performance');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json' | 'html'>('pdf');
  const [granularity, setGranularity] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');

  // Report list state
  const [reports, setReports] = useState<Report[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);

  // Dialog states
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    reportType: '',
    frequency: 'monthly' as const,
    deliveryChannels: [] as string[],
    recipients: '',
    webhookUrl: '',
    enabled: true,
  });

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);
  const [costTrendData, setCostTrendData] = useState<any[]>([]);

  useEffect(() => {
    loadReportTypes();
    loadSchedules();
  }, []);

  const loadReportTypes = async () => {
    try {
      const response = await fetch('/api/reports/types', {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (err) {
      log.error('Failed to load report types', err);
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await fetch('/api/reports/schedules', {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (err) {
      log.error('Failed to load schedules', err);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type: reportType,
        startDate,
        endDate,
        granularity,
        ...(format && { format }),
      });

      const response = await fetch(`/api/reports/generate?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        if (format === 'json') {
          const data = await response.json();
          setSuccess(`Report generated successfully`);
          // Could display data in the UI
        } else {
          // Handle file download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `report-${reportType}-${Date.now()}.${format}`;
          a.click();
          setSuccess(`Report exported as ${format.toUpperCase()}`);
        }
      } else {
        setError('Failed to generate report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (providerId: string) => {
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      const response = await fetch(`/api/reports/analytics/provider/${providerId}?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      log.error('Failed to load analytics', err);
    }
  };

  const loadBillingData = async (tenantId: string, month: string) => {
    try {
      const response = await fetch(`/api/reports/billing/invoice/${tenantId}?month=${month}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setBillingData(data);
      }
    } catch (err) {
      log.error('Failed to load billing data', err);
    }
  };

  const loadCostTrend = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/reports/billing/cost-trend/${tenantId}?months=12`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setCostTrendData(data);
      }
    } catch (err) {
      log.error('Failed to load cost trend', err);
    }
  };

  const saveSchedule = async () => {
    try {
      setLoading(true);

      const payload = {
        ...newSchedule,
        recipients: newSchedule.recipients.split(',').filter((r) => r.trim()),
      };

      const method = editingSchedule ? 'PUT' : 'POST';
      const url = editingSchedule
        ? `/api/reports/schedule/${editingSchedule._id}`
        : '/api/reports/schedule';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSuccess(`Schedule ${editingSchedule ? 'updated' : 'created'} successfully`);
        setScheduleDialogOpen(false);
        setNewSchedule({
          reportType: '',
          frequency: 'monthly',
          deliveryChannels: [],
          recipients: '',
          webhookUrl: '',
          enabled: true,
        });
        loadSchedules();
      } else {
        setError('Failed to save schedule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      const response = await fetch(`/api/reports/schedule/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setSuccess('Schedule deleted successfully');
        loadSchedules();
      } else {
        setError('Failed to delete schedule');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  };

  const openScheduleDialog = (schedule?: ReportSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setNewSchedule({
        reportType: schedule.reportType,
        frequency: schedule.frequency,
        deliveryChannels: schedule.deliveryChannels,
        recipients: schedule.recipients.join(', '),
        webhookUrl: schedule.webhookUrl || '',
        enabled: schedule.enabled,
      });
    } else {
      setEditingSchedule(null);
      setNewSchedule({
        reportType: '',
        frequency: 'monthly',
        deliveryChannels: [],
        recipients: '',
        webhookUrl: '',
        enabled: true,
      });
    }
    setScheduleDialogOpen(true);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <AssessmentIcon /> Admin Reports & Analytics
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Generate Reports" />
          <Tab label="Report Schedules" />
          <Tab label="Analytics" />
          <Tab label="Billing" />
        </Tabs>
      </Paper>

      {/* Generate Reports Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Report Generator Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Generate New Report" />
              <CardContent>
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Report Type</InputLabel>
                    <Select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      label="Report Type"
                    >
                      {reports.map((report) => (
                        <MenuItem key={report.id} value={report.id}>
                          {report.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Start Date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />

                  <TextField
                    label="End Date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />

                  <FormControl fullWidth>
                    <InputLabel>Granularity</InputLabel>
                    <Select
                      value={granularity}
                      onChange={(e) => setGranularity(e.target.value as any)}
                      label="Granularity"
                    >
                      <MenuItem value="hourly">Hourly</MenuItem>
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>Export Format</InputLabel>
                    <Select value={format} onChange={(e) => setFormat(e.target.value as any)} label="Export Format">
                      <MenuItem value="pdf">PDF</MenuItem>
                      <MenuItem value="csv">CSV</MenuItem>
                      <MenuItem value="json">JSON</MenuItem>
                      <MenuItem value="html">HTML</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    onClick={generateReport}
                    disabled={loading}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Generate & Export'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Available Reports */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Available Report Types" />
              <CardContent>
                <Stack spacing={1}>
                  {reports.map((report) => (
                    <Box
                      key={report.id}
                      sx={{
                        p: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        '&:hover': { bgcolor: '#f5f5f5' },
                      }}
                    >
                      <Typography variant="subtitle2">{report.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {report.description}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Report Schedules Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Scheduled Reports</Typography>
              <Button
                variant="contained"
                startIcon={<ScheduleIcon />}
                onClick={() => openScheduleDialog()}
              >
                Create Schedule
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell>Report Type</TableCell>
                    <TableCell>Frequency</TableCell>
                    <TableCell>Channels</TableCell>
                    <TableCell>Last Generated</TableCell>
                    <TableCell>Next Scheduled</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule._id}>
                      <TableCell>{schedule.reportType}</TableCell>
                      <TableCell>
                        <Chip label={schedule.frequency} size="small" />
                      </TableCell>
                      <TableCell>{schedule.deliveryChannels.join(', ')}</TableCell>
                      <TableCell>
                        {schedule.lastGenerated
                          ? new Date(schedule.lastGenerated).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        {schedule.nextScheduled
                          ? new Date(schedule.nextScheduled).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={schedule.enabled ? 'Active' : 'Inactive'}
                          color={schedule.enabled ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => openScheduleDialog(schedule)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => deleteSchedule(schedule._id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {analyticsData && (
            <>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Usage Metrics" />
                  <CardContent>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Success Rate:</Typography>
                        <Chip label={`${analyticsData.successRate}%`} color="success" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Error Rate:</Typography>
                        <Chip label={`${analyticsData.errorRate}%`} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Messages Sent:</Typography>
                        <Typography>{analyticsData.messages?.totalSent}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Delivery Rate:</Typography>
                        <Typography>{analyticsData.messages?.deliveryRate}%</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {analyticsData.trendAnalysis?.daily && (
                <Grid item xs={12}>
                  <Card>
                    <CardHeader title="Delivery Trend" />
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analyticsData.trendAnalysis.daily}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <ChartTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="sent" stroke="#8884d8" />
                          <Line type="monotone" dataKey="delivered" stroke="#82ca9d" />
                          <Line type="monotone" dataKey="failed" stroke="#ff7c7c" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </>
          )}
        </Grid>
      </TabPanel>

      {/* Billing Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          {billingData && (
            <>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Current Billing" />
                  <CardContent>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Month:</Typography>
                        <Typography>{billingData.month}</Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Subtotal:</Typography>
                        <Typography>${billingData.billing?.subtotal?.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Discount:</Typography>
                        <Typography color="success.main">-${billingData.billing?.volumeDiscount?.amount?.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography>Taxes (GST):</Typography>
                        <Typography>${billingData.billing?.taxes?.gst?.toFixed(2)}</Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <Typography>Total:</Typography>
                        <Typography>${billingData.billing?.totalCost?.toFixed(2)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {costTrendData.length > 0 && (
                <Grid item xs={12}>
                  <Card>
                    <CardHeader title="12-Month Cost Trend" />
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={costTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <ChartTooltip />
                          <Legend />
                          <Bar dataKey="totalCost" fill="#8884d8" name="Total Cost" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </>
          )}
        </Grid>
      </TabPanel>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onClose={() => setScheduleDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Report Type</InputLabel>
              <Select
                value={newSchedule.reportType}
                onChange={(e) => setNewSchedule({ ...newSchedule, reportType: e.target.value })}
                label="Report Type"
              >
                {reports.map((report) => (
                  <MenuItem key={report.id} value={report.id}>
                    {report.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={newSchedule.frequency}
                onChange={(e) => setNewSchedule({ ...newSchedule, frequency: e.target.value as any })}
                label="Frequency"
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Delivery Channels</InputLabel>
              <Select
                multiple
                value={newSchedule.deliveryChannels}
                onChange={(e) => setNewSchedule({ ...newSchedule, deliveryChannels: e.target.value as any })}
                label="Delivery Channels"
              >
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="dashboard">Dashboard</MenuItem>
                <MenuItem value="webhook">Webhook</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Recipients (comma-separated emails)"
              value={newSchedule.recipients}
              onChange={(e) => setNewSchedule({ ...newSchedule, recipients: e.target.value })}
              multiline
              rows={3}
            />

            <TextField
              label="Webhook URL (optional)"
              value={newSchedule.webhookUrl}
              onChange={(e) => setNewSchedule({ ...newSchedule, webhookUrl: e.target.value })}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                checked={newSchedule.enabled}
                onChange={(e) => setNewSchedule({ ...newSchedule, enabled: e.target.checked })}
              />
              <Typography>Enabled</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveSchedule}
            disabled={loading || !newSchedule.reportType || !newSchedule.frequency}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
