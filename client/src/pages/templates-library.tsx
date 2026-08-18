import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, Download, Eye } from "lucide-react";

interface Template {
  name: string;
  description: string;
  template: Record<string, any>;
}

type TemplateCategory = "bookings" | "customers" | "drivers" | "vehicles";

export default function TemplatesLibrary() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<{
    category: TemplateCategory;
    key: string;
    data: Template;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const response = await apiRequest("GET", "/api/templates");
      setTemplates(await response.json());
    } catch (error: any) {
      toast({ title: "Failed to load templates", description: error?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(JSON.stringify(text, null, 2));
    toast({ title: "Copied to clipboard" });
  };

  const downloadTemplate = (template: Template) => {
    const json = JSON.stringify(template.template, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading templates...</p>
      </div>
    );
  }

  const categories: { key: TemplateCategory; title: string; color: string }[] = [
    { key: "bookings", title: "📅 Booking Templates", color: "bg-blue-50 border-blue-200" },
    { key: "customers", title: "👥 Customer Templates", color: "bg-purple-50 border-purple-200" },
    { key: "drivers", title: "🚗 Driver Templates", color: "bg-green-50 border-green-200" },
    { key: "vehicles", title: "🚙 Vehicle Templates", color: "bg-orange-50 border-orange-200" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📋 Templates Library</h1>
        <p className="text-gray-600 mt-2">Pre-filled templates to speed up data entry. Select a template and use its values.</p>
      </div>

      {selectedTemplate ? (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedTemplate.data.name}</CardTitle>
                <CardDescription>{selectedTemplate.data.description}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>← Back</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                {JSON.stringify(selectedTemplate.data.template, null, 2)}
              </pre>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(JSON.stringify(selectedTemplate.data.template, null, 2))}
                className="flex-1"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadTemplate(selectedTemplate.data)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            <p className="text-xs text-gray-500 bg-blue-50 rounded p-2">
              💡 Use this JSON as a reference to fill in forms quickly, or copy it for API calls.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => {
            const categoryTemplates = templates[category.key] || {};
            const templateList = Object.entries(categoryTemplates);

            return (
              <div key={category.key}>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{category.title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templateList.map(([key, template]: [string, any]) => (
                    <Card key={key} className={`border-2 ${category.color} cursor-pointer hover:shadow-lg transition-shadow`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {template.template && (
                          <div className="bg-white rounded p-2 text-xs">
                            <p className="text-gray-600 mb-2 font-semibold">Key Fields:</p>
                            <ul className="space-y-1">
                              {Object.entries(template.template)
                                .slice(0, 5)
                                .map(([fieldKey, fieldValue]: [string, any]) => (
                                  <li key={fieldKey} className="text-gray-700">
                                    <strong>{fieldKey}:</strong> {typeof fieldValue === "object" ? JSON.stringify(fieldValue).slice(0, 30) : String(fieldValue).slice(0, 30)}
                                  </li>
                                ))}
                              {Object.entries(template.template).length > 5 && (
                                <li className="text-gray-500 italic">+ {Object.entries(template.template).length - 5} more fields</li>
                              )}
                            </ul>
                          </div>
                        )}
                        <Button
                          className="w-full"
                          onClick={() => setSelectedTemplate({
                            category: category.key,
                            key,
                            data: template
                          })}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View & Use
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
