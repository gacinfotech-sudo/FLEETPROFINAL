import React, { useEffect, useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';

interface TemplateTag {
  _id: string;
  name: string;
  color?: string;
  icon?: string;
}

interface Props {
  templateId: string;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TemplateTagManager({ templateId, selectedTags, onTagsChange }: Props) {
  const [availableTags, setAvailableTags] = useState<TemplateTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tenant/whatsapp-tags');
      if (!response.ok) throw new Error('Failed to fetch tags');
      const data = await response.json();
      setAvailableTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await fetch('/api/tenant/whatsapp-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName,
          color: newTagColor,
        }),
      });

      if (!response.ok) throw new Error('Failed to create tag');
      const newTag = await response.json();
      setAvailableTags([...availableTags, newTag]);
      setNewTagName('');
      setNewTagColor('#3B82F6');
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const toggleTag = async (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      const newTags = selectedTags.filter((id) => id !== tagId);
      onTagsChange(newTags);

      // Remove from backend
      try {
        await fetch(`/api/tenant/whatsapp-templates/${templateId}/tags/${tagId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error removing tag:', error);
      }
    } else {
      const newTags = [...selectedTags, tagId];
      onTagsChange(newTags);

      // Add to backend
      try {
        await fetch(`/api/tenant/whatsapp-templates/${templateId}/tags/${tagId}`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error adding tag:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Loading tags...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-900 mb-2 block">Tags</label>
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag._id}
              onClick={() => toggleTag(tag._id)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedTags.includes(tag._id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              style={
                selectedTags.includes(tag._id) ? { backgroundColor: tag.color || '#3B82F6' } : {}
              }
            >
              {tag.icon && <span>{tag.icon}</span>}
              {tag.name}
              {selectedTags.includes(tag._id) && <X size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* Create New Tag */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-semibold text-slate-600 mb-2">Create New Tag</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name..."
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="w-10 h-8 border border-slate-300 rounded cursor-pointer"
          />
          <button
            onClick={handleCreateTag}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
